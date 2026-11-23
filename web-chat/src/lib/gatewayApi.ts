import { deriveDefaultNickname } from "./formatters";
import { calculateSmsMetrics } from "./smsCounter";
import type {
  ChatMessageDoc,
  FamilyMemberDoc,
  GatewayHealth,
  MemberCreateWrite,
  OutboundMessageWrite,
  SenderContext,
} from "./types";

export const GATEWAY_STALE_MS = 20 * 60 * 1000;

export type GatewayStateKey = "online" | "cellular_backup" | "paused" | "offline";

export interface GatewayDisplayState {
  state: GatewayStateKey;
  tone: "mint" | "amber" | "coral";
  label: "Online" | "4G Backup" | "Paused" | "Offline";
  detail: string;
  reachable: boolean;
}

export interface GatewayStore {
  resolveJoinCode(code: string): Promise<string | null>;
  getMember(familyId: string, uid: string): Promise<FamilyMemberDoc | null>;
  createMember(
    familyId: string,
    uid: string,
    data: MemberCreateWrite
  ): Promise<void>;
  updateMemberProfile(
    familyId: string,
    uid: string,
    updates: { smsNickname?: string; lastActiveMs: number }
  ): Promise<void>;
  createOutboundMessage(
    familyId: string,
    messageId: string,
    payload: OutboundMessageWrite
  ): Promise<void>;
}

export interface GatewayApiDeps {
  store: GatewayStore;
  getIdToken: () => Promise<string | null>;
  notifyGateway: (
    familyId: string,
    messageId: string,
    idToken: string
  ) => Promise<boolean>;
  generateId?: () => string;
  now?: () => number;
}

export function isGatewayStale(
  lastHeartbeatMs: number | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (lastHeartbeatMs == null) {
    return true;
  }
  return nowMs - lastHeartbeatMs > GATEWAY_STALE_MS;
}

export function deriveGatewayDisplayState(
  gateway: GatewayHealth | null | undefined,
  nowMs: number = Date.now()
): GatewayDisplayState {
  if (
    !gateway ||
    gateway.status === "OFFLINE" ||
    gateway.networkType === "NONE" ||
    isGatewayStale(gateway.lastHeartbeatMs, nowMs)
  ) {
    return {
      state: "offline",
      tone: "coral",
      label: "Offline",
      detail: "Gateway Offline",
      reachable: false,
    };
  }

  if (gateway.status === "PAUSED") {
    return {
      state: "paused",
      tone: "coral",
      label: "Paused",
      detail: "Paused · messages will queue",
      reachable: false,
    };
  }

  const carrierSuffix = gateway.carrierName ? ` · ${gateway.carrierName}` : "";

  if (gateway.networkType === "CELLULAR") {
    return {
      state: "cellular_backup",
      tone: "amber",
      label: "4G Backup",
      detail: `4G LTE${carrierSuffix}`,
      reachable: true,
    };
  }

  return {
    state: "online",
    tone: "mint",
    label: "Online",
    detail: `Wi-Fi${carrierSuffix}`,
    reachable: true,
  };
}

export function normalizeJoinCode(rawCode: string): string {
  return rawCode.trim().toUpperCase();
}

export async function notifyWorkerPush(
  workerNotifyUrl: string,
  familyId: string,
  messageId: string,
  idToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  const url = workerNotifyUrl.trim();
  if (!url) {
    return false;
  }

  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ familyId, messageId }),
  });

  return response.ok;
}

async function dispatchOutbound(
  sender: SenderContext,
  text: string,
  retryOfMessageId: string | null,
  deps: GatewayApiDeps
): Promise<{ messageId: string; notified: boolean }> {
  const trimmedText = text.trim();
  if (!trimmedText) {
    throw new Error("Message cannot be empty.");
  }

  const nowMs = (deps.now ?? Date.now)();
  const messageId = (deps.generateId ?? (() => crypto.randomUUID()))();
  const metrics = calculateSmsMetrics(sender.senderName, trimmedText);

  const payload: OutboundMessageWrite = {
    direction: "OUTBOUND",
    senderUid: sender.senderUid,
    senderName: sender.senderName,
    text: trimmedText,
    smsFormattedText: metrics.formattedText,
    encoding: metrics.encoding,
    segmentCount: metrics.segmentCount,
    status: "QUEUED",
    retryCount: 0,
    retryOfMessageId,
    createdAtMs: nowMs,
    statusUpdatedAtMs: nowMs,
  };

  await deps.store.createOutboundMessage(sender.familyId, messageId, payload);

  // Best-effort member activity refresh; never blocks sending.
  try {
    await deps.store.updateMemberProfile(sender.familyId, sender.senderUid, {
      lastActiveMs: nowMs,
    });
  } catch {
    // Non-fatal: Gateway catch-up does not depend on lastActiveAt.
  }

  let notified = false;
  try {
    const idToken = await deps.getIdToken();
    if (idToken) {
      notified = await deps.notifyGateway(sender.familyId, messageId, idToken);
    }
  } catch {
    // Resilient fallback: QUEUED message is already in Firestore for Gateway catch-up.
    notified = false;
  }

  return { messageId, notified };
}

export async function sendOutboundMessage(
  sender: SenderContext,
  text: string,
  deps: GatewayApiDeps
): Promise<{ messageId: string; notified: boolean }> {
  return dispatchOutbound(sender, text, null, deps);
}

export async function retryFailedMessage(
  failedMessage: ChatMessageDoc,
  sender: SenderContext,
  deps: GatewayApiDeps
): Promise<{ messageId: string; notified: boolean }> {
  if (failedMessage.status !== "FAILED") {
    throw new Error("Only FAILED messages can be retried.");
  }
  if (failedMessage.senderUid !== sender.senderUid) {
    throw new Error("You can only retry your own failed messages.");
  }

  return dispatchOutbound(sender, failedMessage.text, failedMessage.id, deps);
}

export async function joinFamilyByCode(
  rawCode: string,
  user: { uid: string; displayName: string },
  nicknameInput: string,
  deps: GatewayApiDeps
): Promise<string> {
  const code = normalizeJoinCode(rawCode);
  if (!code) {
    throw new Error("Enter your family join code.");
  }

  const familyId = await deps.store.resolveJoinCode(code);
  if (!familyId) {
    throw new Error("Family code not found. Check with your family host.");
  }

  const nowMs = (deps.now ?? Date.now)();
  const trimmedNickname = nicknameInput.trim();
  const existing = await deps.store.getMember(familyId, user.uid);

  if (existing) {
    await deps.store.updateMemberProfile(familyId, user.uid, {
      lastActiveMs: nowMs,
      ...(trimmedNickname ? { smsNickname: trimmedNickname } : {}),
    });
  } else {
    await deps.store.createMember(familyId, user.uid, {
      displayName: user.displayName || "Family Member",
      smsNickname: trimmedNickname || deriveDefaultNickname(user.displayName),
      joinCode: code,
    });
  }

  return familyId;
}
