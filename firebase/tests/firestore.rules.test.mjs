import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { before, after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
} from "firebase/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(__dirname, "..", "firestore.rules");

const PROJECT_ID = "demo-lola-gateway";
const FAMILY_ID = "fam-manalo";
const JOIN_CODE = "LOLA-4821";
const GATEWAY_UID = "uid-gateway-host";
const MEMBER_UID = "uid-member-seb";
const OTHER_MEMBER_UID = "uid-member-marites";
const OUTSIDER_UID = "uid-outsider";

const now = () => Timestamp.fromMillis(1795300000000);

function makeFamilyDoc(overrides = {}) {
  return {
    name: "Manalo Family",
    joinCode: JOIN_CODE,
    seniorName: "Lola Elena",
    seniorPhoneE164: "+639171234567",
    allowListE164: ["+639171234567"],
    gateway: {
      uid: GATEWAY_UID,
      deviceId: "pixel-gateway-01",
      fcmToken: "fcm-token-initial",
      status: "ONLINE",
      networkType: "WIFI",
      carrierName: "Globe",
      signalDbm: -78,
      batteryPercent: 94,
      isCharging: false,
      lastHeartbeatAt: now(),
    },
    ...overrides,
  };
}

function makeMemberDoc(uid, role, displayName, smsNickname) {
  return {
    displayName,
    smsNickname,
    role,
    joinedAt: now(),
    lastActiveAt: now(),
  };
}

function makeOutboundMessage(senderUid, overrides = {}) {
  return {
    direction: "OUTBOUND",
    senderUid,
    senderName: "Seb",
    text: "Kumusta po Lola?",
    smsFormattedText: "Seb: Kumusta po Lola?",
    encoding: "GSM-7",
    segmentCount: 1,
    status: "QUEUED",
    retryCount: 0,
    errorCode: null,
    errorReason: null,
    retryOfMessageId: null,
    createdAt: now(),
    queuedOnGatewayAt: null,
    sentAt: null,
    deliveredAt: null,
    statusUpdatedAt: now(),
    gatewayNetworkAtSend: null,
    ...overrides,
  };
}

function makeInboundMessage(overrides = {}) {
  return {
    direction: "INBOUND",
    senderUid: "senior",
    senderName: "Lola Elena",
    text: "Kumain na ako apo",
    smsFormattedText: "Kumain na ako apo",
    encoding: "GSM-7",
    segmentCount: 1,
    status: "DELIVERED",
    retryCount: 0,
    errorCode: null,
    errorReason: null,
    retryOfMessageId: null,
    createdAt: now(),
    queuedOnGatewayAt: now(),
    sentAt: now(),
    deliveredAt: now(),
    statusUpdatedAt: now(),
    gatewayNetworkAtSend: "WIFI",
    ...overrides,
  };
}

let testEnv;

before(async () => {
  const rules = readFileSync(RULES_PATH, "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules,
    },
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "joinCodes", JOIN_CODE), { familyId: FAMILY_ID });
    await setDoc(doc(db, "families", FAMILY_ID), makeFamilyDoc());
    await setDoc(
      doc(db, "families", FAMILY_ID, "members", GATEWAY_UID),
      makeMemberDoc(GATEWAY_UID, "GATEWAY", "Gadiel Manalo", "Gadiel")
    );
    await setDoc(
      doc(db, "families", FAMILY_ID, "members", MEMBER_UID),
      makeMemberDoc(MEMBER_UID, "MEMBER", "Sebastian Bueno", "Seb")
    );
    await setDoc(
      doc(db, "families", FAMILY_ID, "messages", "msg-queued-1"),
      makeOutboundMessage(MEMBER_UID)
    );
    await setDoc(
      doc(db, "families", FAMILY_ID, "messages", "msg-failed-1"),
      makeOutboundMessage(MEMBER_UID, {
        status: "FAILED",
        retryCount: 4,
        errorCode: "NO_SERVICE",
        errorReason: "No cellular signal",
      })
    );
    await setDoc(
      doc(db, "families", FAMILY_ID, "messages", "in_abc123"),
      makeInboundMessage()
    );
  });
});

describe("Default deny & unauthenticated access", () => {
  it("denies unauthenticated reads and writes across all collections", async () => {
    const db = testEnv.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(db, "joinCodes", JOIN_CODE)));
    await assertFails(getDoc(doc(db, "families", FAMILY_ID)));
    await assertFails(
      getDoc(doc(db, "families", FAMILY_ID, "members", MEMBER_UID))
    );
    await assertFails(
      getDoc(doc(db, "families", FAMILY_ID, "messages", "msg-queued-1"))
    );
    await assertFails(
      setDoc(
        doc(db, "families", FAMILY_ID, "messages", "unauth-msg"),
        makeOutboundMessage("anon")
      )
    );
    await assertFails(getDoc(doc(db, "arbitraryCollection", "doc-1")));
  });
});

describe("joinCodes/{joinCode}", () => {
  it("allows an authenticated non-member to get a specific join code", async () => {
    const db = testEnv.authenticatedContext(OUTSIDER_UID).firestore();
    const snap = await assertSucceeds(getDoc(doc(db, "joinCodes", JOIN_CODE)));
    assert.equal(snap.data().familyId, FAMILY_ID);
  });

  it("denies listing joinCodes even for authenticated users", async () => {
    const db = testEnv.authenticatedContext(MEMBER_UID).firestore();
    await assertFails(getDocs(collection(db, "joinCodes")));
  });

  it("allows the gateway host to create a family and its join code in a batch", async () => {
    const newHostUid = "uid-new-host";
    const newFamilyId = "fam-new";
    const newCode = "LOLA-9911";
    const db = testEnv.authenticatedContext(newHostUid).firestore();

    const batch = writeBatch(db);
    batch.set(
      doc(db, "families", newFamilyId),
      makeFamilyDoc({
        joinCode: newCode,
        gateway: {
          ...makeFamilyDoc().gateway,
          uid: newHostUid,
        },
      })
    );
    batch.set(doc(db, "joinCodes", newCode), { familyId: newFamilyId });
    batch.set(
      doc(db, "families", newFamilyId, "members", newHostUid),
      makeMemberDoc(newHostUid, "GATEWAY", "New Host", "Host")
    );

    await assertSucceeds(batch.commit());
  });

  it("denies a non-gateway user from creating or updating a join code", async () => {
    const db = testEnv.authenticatedContext(OUTSIDER_UID).firestore();
    await assertFails(
      setDoc(doc(db, "joinCodes", "SPOOF-123"), { familyId: FAMILY_ID })
    );
    await assertFails(
      updateDoc(doc(db, "joinCodes", JOIN_CODE), { familyId: "other-fam" })
    );
  });
});

describe("families/{familyId}", () => {
  it("allows a verified family member to read their family doc but denies listing all families", async () => {
    const db = testEnv.authenticatedContext(MEMBER_UID).firestore();
    const snap = await assertSucceeds(getDoc(doc(db, "families", FAMILY_ID)));
    assert.equal(snap.data().seniorName, "Lola Elena");

    await assertFails(getDocs(collection(db, "families")));
  });

  it("denies an authenticated outsider from reading another family", async () => {
    const db = testEnv.authenticatedContext(OUTSIDER_UID).firestore();
    await assertFails(getDoc(doc(db, "families", FAMILY_ID)));
  });

  it("denies a non-gateway member from updating family or gateway fields", async () => {
    const db = testEnv.authenticatedContext(MEMBER_UID).firestore();
    await assertFails(
      updateDoc(doc(db, "families", FAMILY_ID), {
        allowListE164: ["+639171234567", "+639189999999"],
      })
    );
    await assertFails(
      updateDoc(doc(db, "families", FAMILY_ID), {
        "gateway.status": "PAUSED",
      })
    );
  });

  it("allows the gateway UID to update gateway health, allowListE164, and senior fields", async () => {
    const db = testEnv.authenticatedContext(GATEWAY_UID).firestore();
    await assertSucceeds(
      updateDoc(doc(db, "families", FAMILY_ID), {
        allowListE164: ["+639171234567", "+639170001111"],
        seniorName: "Lola Elena M.",
        "gateway.status": "PAUSED",
        "gateway.networkType": "CELLULAR",
        "gateway.batteryPercent": 88,
        "gateway.lastHeartbeatAt": Timestamp.fromMillis(1795300900000),
      })
    );
  });

  it("denies the gateway UID from setting invalid gateway enums or reassigning gateway.uid", async () => {
    const db = testEnv.authenticatedContext(GATEWAY_UID).firestore();
    await assertFails(
      updateDoc(doc(db, "families", FAMILY_ID), {
        "gateway.status": "ACTIVE",
      })
    );
    await assertFails(
      updateDoc(doc(db, "families", FAMILY_ID), {
        "gateway.networkType": "5G",
      })
    );
    await assertFails(
      updateDoc(doc(db, "families", FAMILY_ID), {
        "gateway.uid": MEMBER_UID,
      })
    );
  });
});

describe("families/{familyId}/members/{uid}", () => {
  it("allows a new relative to join as MEMBER and update their own nickname and lastActiveAt", async () => {
    const db = testEnv.authenticatedContext(OTHER_MEMBER_UID).firestore();
    const memberRef = doc(
      db,
      "families",
      FAMILY_ID,
      "members",
      OTHER_MEMBER_UID
    );

    await assertSucceeds(
      setDoc(
        memberRef,
        makeMemberDoc(OTHER_MEMBER_UID, "MEMBER", "Tita Marites", "Marites")
      )
    );
    await assertSucceeds(
      updateDoc(memberRef, {
        smsNickname: "Tita M",
        lastActiveAt: Timestamp.fromMillis(1795301200000),
      })
    );
  });

  it("denies a relative from self-assigning role GATEWAY or editing another member", async () => {
    const db = testEnv.authenticatedContext(OTHER_MEMBER_UID).firestore();

    await assertFails(
      setDoc(
        doc(db, "families", FAMILY_ID, "members", OTHER_MEMBER_UID),
        makeMemberDoc(OTHER_MEMBER_UID, "GATEWAY", "Tita Marites", "Marites")
      )
    );
    await assertFails(
      updateDoc(doc(db, "families", FAMILY_ID, "members", MEMBER_UID), {
        smsNickname: "Hijacked",
      })
    );

    const memberDb = testEnv.authenticatedContext(MEMBER_UID).firestore();
    await assertFails(
      updateDoc(doc(memberDb, "families", FAMILY_ID, "members", MEMBER_UID), {
        role: "GATEWAY",
      })
    );
  });

  it("allows verified members to list family members and denies outsiders", async () => {
    const memberDb = testEnv.authenticatedContext(MEMBER_UID).firestore();
    const snaps = await assertSucceeds(
      getDocs(collection(memberDb, "families", FAMILY_ID, "members"))
    );
    assert.equal(snaps.size, 2);

    const outsiderDb = testEnv.authenticatedContext(OUTSIDER_UID).firestore();
    await assertFails(
      getDocs(collection(outsiderDb, "families", FAMILY_ID, "members"))
    );
  });
});

describe("families/{familyId}/messages/{messageId}", () => {
  it("allows a family member to read messages and create a QUEUED OUTBOUND message (including retries)", async () => {
    const db = testEnv.authenticatedContext(MEMBER_UID).firestore();

    const stream = await assertSucceeds(
      getDocs(
        query(
          collection(db, "families", FAMILY_ID, "messages"),
          orderBy("createdAt", "asc")
        )
      )
    );
    assert.equal(stream.size, 3);

    await assertSucceeds(
      setDoc(
        doc(db, "families", FAMILY_ID, "messages", "msg-new-uuid"),
        makeOutboundMessage(MEMBER_UID)
      )
    );

    await assertSucceeds(
      setDoc(
        doc(db, "families", FAMILY_ID, "messages", "msg-retry-uuid"),
        makeOutboundMessage(MEMBER_UID, { retryOfMessageId: "msg-failed-1" })
      )
    );
  });

  it("denies a family member from spoofing senderUid, forging status, creating INBOUND, or updating/deleting messages", async () => {
    const db = testEnv.authenticatedContext(MEMBER_UID).firestore();

    await assertFails(
      setDoc(
        doc(db, "families", FAMILY_ID, "messages", "spoof-sender"),
        makeOutboundMessage(GATEWAY_UID)
      )
    );
    await assertFails(
      setDoc(
        doc(db, "families", FAMILY_ID, "messages", "forged-status"),
        makeOutboundMessage(MEMBER_UID, { status: "DELIVERED" })
      )
    );
    await assertFails(
      setDoc(
        doc(db, "families", FAMILY_ID, "messages", "forged-inbound"),
        makeInboundMessage()
      )
    );
    await assertFails(
      updateDoc(doc(db, "families", FAMILY_ID, "messages", "msg-queued-1"), {
        status: "DELIVERED",
      })
    );
    await assertFails(
      deleteDoc(doc(db, "families", FAMILY_ID, "messages", "msg-queued-1"))
    );
  });

  it("denies outsiders from reading or creating messages", async () => {
    const db = testEnv.authenticatedContext(OUTSIDER_UID).firestore();
    await assertFails(
      getDoc(doc(db, "families", FAMILY_ID, "messages", "msg-queued-1"))
    );
    await assertFails(
      setDoc(
        doc(db, "families", FAMILY_ID, "messages", "outsider-msg"),
        makeOutboundMessage(OUTSIDER_UID)
      )
    );
  });

  it("allows the gateway UID to query QUEUED outbound catch-up, advance delivery statuses, and create/merge INBOUND messages", async () => {
    const db = testEnv.authenticatedContext(GATEWAY_UID).firestore();

    const catchUp = await assertSucceeds(
      getDocs(
        query(
          collection(db, "families", FAMILY_ID, "messages"),
          where("direction", "==", "OUTBOUND"),
          where("status", "==", "QUEUED"),
          orderBy("createdAt", "asc")
        )
      )
    );
    assert.equal(catchUp.size, 1);

    const msgRef = doc(db, "families", FAMILY_ID, "messages", "msg-queued-1");
    await assertSucceeds(
      updateDoc(msgRef, {
        status: "SENT",
        queuedOnGatewayAt: now(),
        sentAt: now(),
        statusUpdatedAt: now(),
        gatewayNetworkAtSend: "WIFI",
      })
    );
    await assertSucceeds(
      updateDoc(msgRef, {
        status: "PENDING",
        statusUpdatedAt: Timestamp.fromMillis(1795300010000),
      })
    );
    await assertSucceeds(
      updateDoc(msgRef, {
        status: "DELIVERED",
        deliveredAt: Timestamp.fromMillis(1795300015000),
        statusUpdatedAt: Timestamp.fromMillis(1795300015000),
      })
    );

    const inboundRef = doc(db, "families", FAMILY_ID, "messages", "in_def456");
    const inboundPayload = makeInboundMessage({ text: "Ingat palagi apo" });
    await assertSucceeds(setDoc(inboundRef, inboundPayload));
    await assertSucceeds(setDoc(inboundRef, inboundPayload, { merge: true }));
  });

  it("denies the gateway UID from tampering with immutable message text or writing invalid status enums", async () => {
    const db = testEnv.authenticatedContext(GATEWAY_UID).firestore();
    const msgRef = doc(db, "families", FAMILY_ID, "messages", "msg-queued-1");

    await assertFails(
      updateDoc(msgRef, {
        text: "Tampered body",
        statusUpdatedAt: now(),
      })
    );
    await assertFails(
      updateDoc(msgRef, {
        status: "UNKNOWN_STATUS",
        statusUpdatedAt: now(),
      })
    );
    await assertFails(deleteDoc(msgRef));
  });
});
