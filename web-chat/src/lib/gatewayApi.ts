import { calculateSmsMetrics } from "./smsCounter";
import type {
  ChatMessageDoc,
  FamilyMemberDoc,
  GatewayHealth,
  OutboundMessageWrite,
} from "./types";

export const GATEWAY_STALE_MS = 20 * 60 * 1000;

export interface GatewayDisplayState {
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
    data: { displayName: string; smsNickname: string }
  ): Promise<void>;
  updateMemberProfile(
    familyId: string,
    uid: string,
    updates: { displayName?: string; smsNickname?: string; lastActiveMs: number }
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
  if (!gateway) {
    return {
      tone: "coral",
      label: "Offline",
      detail: "Gateway Offline",
      reachable: false,
    };
  }

  if (gateway.status === "PAUSED") {
    return {
      tone: "coral",
      label: "Paused",
      detail: "Paused · messages will queue",
      reachable: false,
    };
  }

  if (
    gateway.status === "OFFLINE" ||
    gateway.networkType === "NONE" ||
    isGatewayStale(gateway.lastHeartbeatMs, nowMs)
  ) {
    return {
      tone: "coral",
      label: "Offline",
      detail: "Gateway Offline",
      reachable: false,
    };
  }

  const carrierSuffix = gateway.carrierName ? ` · ${gateway.carrierName}` : "";

  if (gateway.networkType === "CELLULAR") {
    return {
      tone: "amber",
      label: "4G Backup",
      detail: `4G LTE${carrierSuffix}`,
      reachable: true,
    };
  }

  return {
    tone: "mint",
    label: "Online",
    detail: `Wi-Fi${carrierSuffix}`,
    reachable: true,
  };
}

export function normalizeJoinCode(rawCode: string): string {
  return rawCode.trim().toUpperCase();
}

export function deriveDefaultNickname(displayName: string): string {
  const firstWord = displayName.trim().split(/\s+/)[0] ?? "";
  return (firstWord || "Family").slice(0, 16);
}

export function maskPhoneE164(phoneE164: string): string {
  const cleaned = phoneE164.replace(/\s+/g, "");
  const phMatch = /^\+63(\d{3})\d{3}(\d{4})$/.exec(cleaned);
  if (phMatch) {
    return `+63 ${phMatch[1]} *** ${phMatch[2]}`;
  }
  if (cleaned.length > 6) {
    return `${cleaned.slice(0, 4)} *** ${cleaned.slice(-4)}`;
  }
  return phoneE164;
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
  params: {
    familyId: string;
    senderUid: string;
    senderName: string;
    text: string;
    retryOfMessageId: string | null;
  },
  deps: GatewayApiDeps
): Promise<{ messageId: string; notified: boolean }> {
  const trimmedText = params.text.trim();
  if (!trimmedText) {
    throw new Error("Message cannot be empty.");
  }

  const nowMs = (deps.now ?? Date.now)();
  const messageId = (deps.generateId ?? (() => crypto.randomUUID()))();
  const metrics = calculateSmsMetrics(params.senderName, trimmedText);

  const payload: OutboundMessageWrite = {
    direction: "OUTBOUND",
    senderUid: params.senderUid,
    senderName: params.senderName,
    text: trimmedText,
    smsFormattedText: metrics.formattedText,
    encoding: metrics.encoding,
    segmentCount: metrics.segmentCount,
    status: "QUEUED",
    retryCount: 0,
    errorCode: null,
    errorReason: null,
    retryOfMessageId: params.retryOfMessageId,
    createdAtMs: nowMs,
    queuedOnGatewayAtMs: null,
    sentAtMs: null,
    deliveredAtMs: null,
    statusUpdatedAtMs: nowMs,
    gatewayNetworkAtSend: null,
  };

  await deps.store.createOutboundMessage(params.familyId, messageId, payload);

  // Best-effort member activity refresh; never blocks sending.
  try {
    await deps.store.updateMemberProfile(params.familyId, params.senderUid, {
      lastActiveMs: nowMs,
    });
  } catch {
    // Non-fatal: Gateway catch-up does not depend on lastActiveAt.
  }

  let notified = false;
  try {
    const idToken = await deps.getIdToken();
    if (idToken) {
      notified = await deps.notifyGateway(params.familyId, messageId, idToken);
    }
  } catch {
    // Resilient fallback: QUEUED message is already in Firestore for Gateway catch-up.
    notified = false;
  }

  return { messageId, notified };
}

export async function sendOutboundMessage(
  params: {
    familyId: string;
    senderUid: string;
    senderName: string;
    text: string;
  },
  deps: GatewayApiDeps
): Promise<{ messageId: string; notified: boolean }> {
  return dispatchOutbound({ ...params, retryOfMessageId: null }, deps);
}

export async function retryFailedMessage(
  failedMessage: ChatMessageDoc,
  params: {
    familyId: string;
    senderUid: string;
    senderName: string;
  },
  deps: GatewayApiDeps
): Promise<{ messageId: string; notified: boolean }> {
  if (failedMessage.status !== "FAILED") {
    throw new Error("Only FAILED messages can be retried.");
  }

  return dispatchOutbound(
    {
      ...params,
      text: failedMessage.text,
      retryOfMessageId: failedMessage.id,
    },
    deps
  );
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
    });
  }

  return familyId;
}
