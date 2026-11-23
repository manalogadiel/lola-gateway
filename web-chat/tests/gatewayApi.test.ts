import { describe, expect, it } from "vitest";
import { maskPhoneE164 } from "../src/lib/formatters";
import {
  GATEWAY_STALE_MS,
  deriveGatewayDisplayState,
  isGatewayStale,
  joinFamilyByCode,
  notifyWorkerPush,
  retryFailedMessage,
  sendOutboundMessage,
  type GatewayApiDeps,
} from "../src/lib/gatewayApi";
import type {
  ChatMessageDoc,
  FamilyMemberDoc,
  GatewayHealth,
  OutboundMessageWrite,
} from "../src/lib/types";

function makeFakeDeps(options?: {
  joinCodes?: Record<string, string>;
  existingMembers?: Record<string, FamilyMemberDoc>;
  failNotify?: boolean;
  ids?: string[];
  nowMs?: number;
}) {
  const createdMessages: Array<{
    familyId: string;
    messageId: string;
    payload: OutboundMessageWrite;
  }> = [];
  const createdMembers: Array<{
    familyId: string;
    uid: string;
    displayName: string;
    smsNickname: string;
  }> = [];
  const updatedMembers: Array<{
    familyId: string;
    uid: string;
    updates: { smsNickname?: string; lastActiveMs: number };
  }> = [];
  const notifyCalls: Array<{
    familyId: string;
    messageId: string;
    idToken: string;
  }> = [];

  const idQueue = [
    ...(options?.ids ?? ["11111111-1111-4111-8111-111111111111"]),
  ];
  const joinCodes = options?.joinCodes ?? { "LOLA-4821": "fam-manalo" };
  const existingMembers = options?.existingMembers ?? {};

  const deps: GatewayApiDeps = {
    now: () => options?.nowMs ?? 1_795_300_000_000,
    generateId: () => idQueue.shift() ?? "22222222-2222-4222-8222-222222222222",
    getIdToken: async () => "firebase-id-token-abc",
    store: {
      resolveJoinCode: async (code) => joinCodes[code] ?? null,
      getMember: async (_familyId, uid) => existingMembers[uid] ?? null,
      createMember: async (familyId, uid, data) => {
        createdMembers.push({ familyId, uid, ...data });
      },
      updateMemberProfile: async (familyId, uid, updates) => {
        updatedMembers.push({ familyId, uid, updates });
      },
      createOutboundMessage: async (familyId, messageId, payload) => {
        createdMessages.push({ familyId, messageId, payload });
      },
    },
    notifyGateway: async (familyId, messageId, idToken) => {
      notifyCalls.push({ familyId, messageId, idToken });
      if (options?.failNotify) {
        throw new Error("Worker unreachable");
      }
      return true;
    },
  };

  return {
    deps,
    createdMessages,
    createdMembers,
    updatedMembers,
    notifyCalls,
  };
}

describe("isGatewayStale and deriveGatewayDisplayState", () => {
  it("flags heartbeats older than 20 minutes as stale", () => {
    const nowMs = 1_795_300_000_000;
    expect(isGatewayStale(nowMs - GATEWAY_STALE_MS, nowMs)).toBe(false);
    expect(isGatewayStale(nowMs - GATEWAY_STALE_MS - 1, nowMs)).toBe(true);
    expect(isGatewayStale(null, nowMs)).toBe(true);
  });

  it("maps Online, 4G Backup, Paused, and Offline (>20m stale, including stale PAUSED) states accurately", () => {
    const nowMs = 1_795_300_000_000;
    const base: GatewayHealth = {
      uid: "gw-1",
      deviceId: "pixel-1",
      fcmToken: "tok",
      status: "ONLINE",
      networkType: "WIFI",
      carrierName: "Globe",
      signalDbm: -75,
      batteryPercent: 92,
      isCharging: false,
      lastHeartbeatMs: nowMs - 60_000,
    };

    expect(deriveGatewayDisplayState(base, nowMs)).toEqual({
      state: "online",
      tone: "mint",
      label: "Online",
      detail: "Wi-Fi · Globe",
      reachable: true,
    });

    expect(
      deriveGatewayDisplayState({ ...base, networkType: "CELLULAR" }, nowMs)
    ).toEqual({
      state: "cellular_backup",
      tone: "amber",
      label: "4G Backup",
      detail: "4G LTE · Globe",
      reachable: true,
    });

    expect(
      deriveGatewayDisplayState({ ...base, status: "PAUSED" }, nowMs)
    ).toEqual({
      state: "paused",
      tone: "coral",
      label: "Paused",
      detail: "Paused · messages will queue",
      reachable: false,
    });

    expect(
      deriveGatewayDisplayState(
        {
          ...base,
          status: "PAUSED",
          lastHeartbeatMs: nowMs - 21 * 60 * 1000,
        },
        nowMs
      )
    ).toEqual({
      state: "offline",
      tone: "coral",
      label: "Offline",
      detail: "Gateway Offline",
      reachable: false,
    });
  });
});

describe("notifyWorkerPush", () => {
  it("POSTs Authorization Bearer token and JSON body to the Cloudflare Worker /notify endpoint", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fakeFetch = (async (
      input: string | URL | Request,
      init?: RequestInit
    ) => {
      requests.push({ url: String(input), init });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;

    const ok = await notifyWorkerPush(
      "https://lola-push.workers.dev/notify",
      "fam-manalo",
      "msg-uuid-1",
      "id-token-xyz",
      fakeFetch
    );

    expect(ok).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://lola-push.workers.dev/notify");
    expect(requests[0].init?.method).toBe("POST");
    expect(requests[0].init?.headers).toEqual({
      Authorization: "Bearer id-token-xyz",
      "Content-Type": "application/json",
    });
    expect(requests[0].init?.body).toBe(
      JSON.stringify({ familyId: "fam-manalo", messageId: "msg-uuid-1" })
    );

    expect(
      await notifyWorkerPush("", "fam-manalo", "msg-uuid-1", "tok", fakeFetch)
    ).toBe(false);
  });
});

describe("sendOutboundMessage and retryFailedMessage", () => {
  it("writes a QUEUED outbound message with SMS metrics and calls /notify", async () => {
    const { deps, createdMessages, notifyCalls, updatedMembers } = makeFakeDeps(
      {
        ids: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
        nowMs: 1_795_300_050_000,
      }
    );

    const result = await sendOutboundMessage(
      {
        familyId: "fam-manalo",
        senderUid: "uid-seb",
        senderName: "Seb",
      },
      "  Kumusta po Lola?  ",
      deps
    );

    expect(result).toEqual({
      messageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      notified: true,
    });
    expect(createdMessages).toHaveLength(1);
    expect(createdMessages[0].payload).toEqual({
      direction: "OUTBOUND",
      senderUid: "uid-seb",
      senderName: "Seb",
      text: "Kumusta po Lola?",
      smsFormattedText: "Seb: Kumusta po Lola?",
      encoding: "GSM-7",
      segmentCount: 1,
      status: "QUEUED",
      retryCount: 0,
      retryOfMessageId: null,
      createdAtMs: 1_795_300_050_000,
      statusUpdatedAtMs: 1_795_300_050_000,
    });
    expect(notifyCalls).toEqual([
      {
        familyId: "fam-manalo",
        messageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        idToken: "firebase-id-token-abc",
      },
    ]);
    expect(updatedMembers).toHaveLength(1);
  });

  it("still succeeds cleanly when /notify fails because Firestore catch-up owns delivery", async () => {
    const { deps, createdMessages } = makeFakeDeps({ failNotify: true });

    const result = await sendOutboundMessage(
      {
        familyId: "fam-manalo",
        senderUid: "uid-seb",
        senderName: "Seb",
      },
      "Ingat po!",
      deps
    );

    expect(createdMessages).toHaveLength(1);
    expect(result.notified).toBe(false);
  });

  it("creates a brand-new UUID document with retryOfMessageId and blocks retrying another sender's message", async () => {
    const { deps, createdMessages, notifyCalls } = makeFakeDeps({
      ids: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
    });

    const failedMsg: ChatMessageDoc = {
      id: "old-failed-uuid",
      direction: "OUTBOUND",
      senderUid: "uid-seb",
      senderName: "Seb",
      text: "Nakarating na po kami",
      smsFormattedText: "Seb: Nakarating na po kami",
      encoding: "GSM-7",
      segmentCount: 1,
      status: "FAILED",
      retryCount: 4,
      errorCode: "NO_SERVICE",
      errorReason: "No cellular signal",
      retryOfMessageId: null,
      createdAtMs: 1_795_299_900_000,
      queuedOnGatewayAtMs: null,
      sentAtMs: null,
      deliveredAtMs: null,
      statusUpdatedAtMs: 1_795_299_950_000,
      gatewayNetworkAtSend: null,
    };

    const result = await retryFailedMessage(
      failedMsg,
      {
        familyId: "fam-manalo",
        senderUid: "uid-seb",
        senderName: "Seb",
      },
      deps
    );

    expect(result.messageId).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(result.messageId).not.toBe(failedMsg.id);
    expect(createdMessages).toHaveLength(1);
    expect(createdMessages[0].payload.status).toBe("QUEUED");
    expect(createdMessages[0].payload.retryCount).toBe(0);
    expect(createdMessages[0].payload.retryOfMessageId).toBe("old-failed-uuid");
    expect(notifyCalls[0].messageId).toBe(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    );

    await expect(
      retryFailedMessage(
        failedMsg,
        {
          familyId: "fam-manalo",
          senderUid: "uid-other-member",
          senderName: "Marites",
        },
        deps
      )
    ).rejects.toThrow("own failed messages");
  });
});

describe("joinFamilyByCode and maskPhoneE164", () => {
  it("normalizes join code, creates a new MEMBER with default first-name SMS nickname", async () => {
    const { deps, createdMembers } = makeFakeDeps();

    const familyId = await joinFamilyByCode(
      " lola-4821 ",
      { uid: "uid-seb", displayName: "Sebastian Bueno" },
      "",
      deps
    );

    expect(familyId).toBe("fam-manalo");
    expect(createdMembers).toEqual([
      {
        familyId: "fam-manalo",
        uid: "uid-seb",
        displayName: "Sebastian Bueno",
        smsNickname: "Sebastian",
      },
    ]);
  });

  it("updates lastActiveAt instead of recreating when a returning member re-joins", async () => {
    const { deps, createdMembers, updatedMembers } = makeFakeDeps({
      existingMembers: {
        "uid-seb": {
          uid: "uid-seb",
          displayName: "Sebastian Bueno",
          smsNickname: "Seb",
          role: "MEMBER",
          joinedAtMs: 1_795_200_000_000,
          lastActiveMs: 1_795_250_000_000,
        },
      },
    });

    const familyId = await joinFamilyByCode(
      "LOLA-4821",
      { uid: "uid-seb", displayName: "Sebastian Bueno" },
      "",
      deps
    );

    expect(familyId).toBe("fam-manalo");
    expect(createdMembers).toHaveLength(0);
    expect(updatedMembers).toHaveLength(1);
    expect(updatedMembers[0].updates.smsNickname).toBeUndefined();
  });

  it("throws a clear error on unknown join code and formats masked PH numbers", async () => {
    const { deps } = makeFakeDeps();
    await expect(
      joinFamilyByCode(
        "NOPE-9999",
        { uid: "uid-seb", displayName: "Sebastian Bueno" },
        "Seb",
        deps
      )
    ).rejects.toThrow("Family code not found");

    expect(maskPhoneE164("+639171234567")).toBe("+63 917 *** 4567");
  });
});
