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
  serverTimestamp,
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

const BASE_EPOCH_MS = 1795300000000;
const timestampAt = (offsetMs = 0) => Timestamp.fromMillis(BASE_EPOCH_MS + offsetMs);

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
      lastHeartbeatAt: timestampAt(),
    },
    ...overrides,
  };
}

function makeMemberDoc(role, displayName, smsNickname, joinCode) {
  return {
    displayName,
    smsNickname,
    role,
    joinedAt: timestampAt(),
    lastActiveAt: timestampAt(),
    ...(joinCode !== undefined ? { joinCode } : {}),
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
    createdAt: timestampAt(),
    queuedOnGatewayAt: null,
    sentAt: null,
    deliveredAt: null,
    statusUpdatedAt: timestampAt(),
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
    createdAt: timestampAt(),
    queuedOnGatewayAt: timestampAt(),
    sentAt: timestampAt(),
    deliveredAt: timestampAt(),
    statusUpdatedAt: timestampAt(),
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
      makeMemberDoc("GATEWAY", "Gadiel Manalo", "Gadiel")
    );
    await setDoc(
      doc(db, "families", FAMILY_ID, "members", MEMBER_UID),
      makeMemberDoc("MEMBER", "Sebastian Bueno", "Seb")
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

  it("allows the gateway host (Android createFamily shape) to create a family, joinCode, and 5-field GATEWAY member without joinCode", async () => {
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
      makeMemberDoc("GATEWAY", "New Host", "")
    );

    await assertSucceeds(batch.commit());
  });

  it("denies mismatched join code creation, unauthorized creation, updates, and deletes", async () => {
    const gatewayDb = testEnv.authenticatedContext(GATEWAY_UID).firestore();
    await assertFails(
      setDoc(doc(gatewayDb, "joinCodes", "WRONG-999"), { familyId: FAMILY_ID })
    );
    await assertFails(deleteDoc(doc(gatewayDb, "joinCodes", JOIN_CODE)));

    const outsiderDb = testEnv.authenticatedContext(OUTSIDER_UID).firestore();
    await assertFails(
      setDoc(doc(outsiderDb, "joinCodes", "SPOOF-123"), { familyId: FAMILY_ID })
    );
    await assertFails(
      updateDoc(doc(outsiderDb, "joinCodes", JOIN_CODE), {
        familyId: "other-fam",
      })
    );
  });
});

describe("users/{uid}", () => {
  const pointer = () => ({ familyId: FAMILY_ID, updatedAt: serverTimestamp() });

  async function seedPointer(uid) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users", uid), pointer());
    });
  }

  it("denies unauthenticated get, list, create, update, and delete", async () => {
    await seedPointer(MEMBER_UID);
    const db = testEnv.unauthenticatedContext().firestore();
    const ref = doc(db, "users", MEMBER_UID);

    await assertFails(getDoc(ref));
    await assertFails(getDocs(collection(db, "users")));
    await assertFails(setDoc(doc(db, "users", OTHER_MEMBER_UID), pointer()));
    await assertFails(updateDoc(ref, { updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(ref));
  });

  for (const uid of [MEMBER_UID, GATEWAY_UID]) {
    it(`allows ${uid} to create, get, update, and delete their own pointer`, async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      const ref = doc(db, "users", uid);

      await assertSucceeds(setDoc(ref, pointer()));
      const created = await assertSucceeds(getDoc(ref));
      assert.equal(created.data().familyId, FAMILY_ID);
      assert.ok(created.data().updatedAt instanceof Timestamp);

      await assertSucceeds(updateDoc(ref, { updatedAt: timestampAt(1) }));
      const updated = await assertSucceeds(getDoc(ref));
      assert.equal(updated.data().updatedAt.toMillis(), timestampAt(1).toMillis());

      await assertSucceeds(deleteDoc(ref));
      assert.equal((await assertSucceeds(getDoc(ref))).exists(), false);
    });
  }

  it("allows a new member to join and save their pointer in one batch", async () => {
    const uid = OTHER_MEMBER_UID;
    const db = testEnv.authenticatedContext(uid).firestore();
    const memberRef = doc(db, "families", FAMILY_ID, "members", uid);
    const pointerRef = doc(db, "users", uid);
    const batch = writeBatch(db);
    batch.set(memberRef, makeMemberDoc("MEMBER", "Marites", "Tess", JOIN_CODE));
    batch.set(pointerRef, pointer());

    await assertSucceeds(batch.commit());
    assert.equal((await assertSucceeds(getDoc(memberRef))).data().role, "MEMBER");
    assert.equal((await assertSucceeds(getDoc(pointerRef))).data().familyId, FAMILY_ID);
  });

  it("allows a returning member to update their profile and save a pointer in one batch", async () => {
    const db = testEnv.authenticatedContext(MEMBER_UID).firestore();
    const memberRef = doc(db, "families", FAMILY_ID, "members", MEMBER_UID);
    const pointerRef = doc(db, "users", MEMBER_UID);
    const batch = writeBatch(db);
    batch.update(memberRef, { smsNickname: "Sebby", lastActiveAt: timestampAt(1) });
    batch.set(pointerRef, pointer());

    await assertSucceeds(batch.commit());
    assert.equal((await assertSucceeds(getDoc(memberRef))).data().smsNickname, "Sebby");
    assert.equal((await assertSucceeds(getDoc(pointerRef))).data().familyId, FAMILY_ID);
  });

  it("allows a new Gateway host to create a family, join code, member, and pointer in one batch", async () => {
    const hostUid = "uid-new-host";
    const familyId = "fam-new";
    const joinCode = "LOLA-9911";
    const db = testEnv.authenticatedContext(hostUid).firestore();
    const pointerRef = doc(db, "users", hostUid);
    const batch = writeBatch(db);
    batch.set(
      doc(db, "families", familyId),
      makeFamilyDoc({
        joinCode,
        gateway: { ...makeFamilyDoc().gateway, uid: hostUid },
      })
    );
    batch.set(doc(db, "joinCodes", joinCode), { familyId });
    batch.set(
      doc(db, "families", familyId, "members", hostUid),
      makeMemberDoc("GATEWAY", "New Host", "")
    );
    batch.set(pointerRef, { familyId, updatedAt: serverTimestamp() });

    await assertSucceeds(batch.commit());
    assert.equal((await assertSucceeds(getDoc(pointerRef))).data().familyId, familyId);
  });

  it("allows a Gateway host without a member document to save their own pointer", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(doc(ctx.firestore(), "families", FAMILY_ID, "members", GATEWAY_UID));
    });
    const db = testEnv.authenticatedContext(GATEWAY_UID).firestore();
    await assertSucceeds(setDoc(doc(db, "users", GATEWAY_UID), pointer()));
  });

  for (const [callerUid, targetUid] of [
    [MEMBER_UID, OTHER_MEMBER_UID],
    [MEMBER_UID, GATEWAY_UID],
    [GATEWAY_UID, MEMBER_UID],
  ]) {
    it(`denies ${callerUid} access to ${targetUid}'s pointer`, async () => {
      const db = testEnv.authenticatedContext(callerUid).firestore();
      const ref = doc(db, "users", targetUid);
      await assertFails(setDoc(ref, pointer()));

      await seedPointer(targetUid);
      await assertFails(getDoc(ref));
      await assertFails(updateDoc(ref, { updatedAt: serverTimestamp() }));
      await assertFails(deleteDoc(ref));
    });
  }

  it("denies listing pointers for all signed-in roles", async () => {
    for (const uid of [MEMBER_UID, OTHER_MEMBER_UID, GATEWAY_UID, OUTSIDER_UID]) {
      const db = testEnv.authenticatedContext(uid).firestore();
      await assertFails(getDocs(collection(db, "users")));
    }
  });

  it("denies saving a pointer before joining or in a batch with a wrong join code", async () => {
    const db = testEnv.authenticatedContext(OUTSIDER_UID).firestore();
    const pointerRef = doc(db, "users", OUTSIDER_UID);
    const memberRef = doc(db, "families", FAMILY_ID, "members", OUTSIDER_UID);
    await assertFails(setDoc(pointerRef, pointer()));

    const batch = writeBatch(db);
    batch.set(memberRef, makeMemberDoc("MEMBER", "Outsider", "Outsider", "WRONG"));
    batch.set(pointerRef, pointer());
    await assertFails(batch.commit());
    assert.equal((await assertSucceeds(getDoc(pointerRef))).exists(), false);
    assert.equal((await assertSucceeds(getDoc(memberRef))).exists(), false);
  });

  it("denies switching a pointer to an unjoined or nonexistent family", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "families", "fam-other"), makeFamilyDoc({ joinCode: "LOLA-2200" }));
    });
    await seedPointer(MEMBER_UID);
    const db = testEnv.authenticatedContext(MEMBER_UID).firestore();
    const ref = doc(db, "users", MEMBER_UID);

    await assertFails(updateDoc(ref, { familyId: "fam-other" }));
    await assertFails(updateDoc(ref, { familyId: "fam-ghost" }));
  });

  it("denies invalid pointer payloads on create and update", async () => {
    const db = testEnv.authenticatedContext(MEMBER_UID).firestore();
    const ref = doc(db, "users", MEMBER_UID);
    const invalidPointers = [
      { updatedAt: timestampAt() },
      { familyId: FAMILY_ID },
      { ...pointer(), familyId: "" },
      { ...pointer(), updatedAt: BASE_EPOCH_MS },
      { ...pointer(), extra: true },
    ];

    for (const invalid of invalidPointers) {
      await assertFails(setDoc(ref, invalid));
    }
    await assertSucceeds(setDoc(ref, pointer()));
    for (const invalid of invalidPointers) {
      await assertFails(setDoc(ref, invalid));
    }
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
        "gateway.lastHeartbeatAt": timestampAt(900_000),
      })
    );
  });

  it("denies invalid gateway enums, gateway.uid reassignment, or joinCode mutation", async () => {
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
    await assertFails(
      updateDoc(doc(db, "families", FAMILY_ID), {
        joinCode: "LOLA-0000",
      })
    );
  });
});

describe("families/{familyId}/members/{uid}", () => {
  it("allows a new relative to join as MEMBER with the matching joinCode (including empty optional nickname) and update own profile", async () => {
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
        makeMemberDoc("MEMBER", "Tita Marites", "", JOIN_CODE)
      )
    );
    await assertSucceeds(
      updateDoc(memberRef, {
        smsNickname: "Tita M",
        lastActiveAt: timestampAt(1_200_000),
      })
    );
    await assertFails(
      updateDoc(memberRef, {
        joinCode: "TAMPER-1",
      })
    );
  });

  it("denies self-enrollment without joinCode or with a wrong joinCode even if familyId is known", async () => {
    const db = testEnv.authenticatedContext(OUTSIDER_UID).firestore();
    const outsiderRef = doc(db, "families", FAMILY_ID, "members", OUTSIDER_UID);

    await assertFails(
      setDoc(outsiderRef, makeMemberDoc("MEMBER", "Random Outsider", "Rand"))
    );
    await assertFails(
      setDoc(
        outsiderRef,
        makeMemberDoc("MEMBER", "Random Outsider", "Rand", "WRONG-999")
      )
    );
    await assertFails(
      setDoc(
        outsiderRef,
        makeMemberDoc("MEMBER", "Random Outsider", "Rand", "")
      )
    );
  });

  it("allows an existing pre-fix member without joinCode on their member doc to continue using the app", async () => {
    const db = testEnv.authenticatedContext(MEMBER_UID).firestore();
    const memberRef = doc(db, "families", FAMILY_ID, "members", MEMBER_UID);

    const familySnap = await assertSucceeds(
      getDoc(doc(db, "families", FAMILY_ID))
    );
    assert.equal(familySnap.data().joinCode, JOIN_CODE);

    await assertSucceeds(
      updateDoc(memberRef, {
        smsNickname: "Basty",
        lastActiveAt: timestampAt(1_500_000),
      })
    );

    await assertSucceeds(
      setDoc(
        doc(db, "families", FAMILY_ID, "messages", "msg-existing-member"),
        makeOutboundMessage(MEMBER_UID)
      )
    );
  });

  it("denies a relative from self-assigning role GATEWAY or editing another member", async () => {
    const db = testEnv.authenticatedContext(OTHER_MEMBER_UID).firestore();

    await assertFails(
      setDoc(
        doc(db, "families", FAMILY_ID, "members", OTHER_MEMBER_UID),
        makeMemberDoc("GATEWAY", "Tita Marites", "Marites", JOIN_CODE)
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
  it("allows a family member to read messages and create a QUEUED OUTBOUND message (including retries of FAILED)", async () => {
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

  it("denies retrying a non-FAILED message, spoofing senderUid, forging status, creating INBOUND, or updating/deleting", async () => {
    const db = testEnv.authenticatedContext(MEMBER_UID).firestore();

    await assertFails(
      setDoc(
        doc(db, "families", FAMILY_ID, "messages", "bad-retry-ref"),
        makeOutboundMessage(MEMBER_UID, { retryOfMessageId: "msg-queued-1" })
      )
    );
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

  it("allows the gateway UID to query QUEUED catch-up, advance statuses, sync offline host sends, and create/merge INBOUND", async () => {
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
        queuedOnGatewayAt: timestampAt(),
        sentAt: timestampAt(),
        statusUpdatedAt: timestampAt(),
        gatewayNetworkAtSend: "WIFI",
      })
    );
    await assertSucceeds(
      updateDoc(msgRef, {
        status: "PENDING",
        statusUpdatedAt: timestampAt(10_000),
      })
    );
    await assertSucceeds(
      updateDoc(msgRef, {
        status: "DELIVERED",
        deliveredAt: timestampAt(15_000),
        statusUpdatedAt: timestampAt(15_000),
      })
    );

    await assertSucceeds(
      setDoc(
        doc(db, "families", FAMILY_ID, "messages", "host-offline-send"),
        makeOutboundMessage(GATEWAY_UID, {
          senderName: "Gadiel",
          smsFormattedText: "Gadiel: Pauwi na po ako",
          text: "Pauwi na po ako",
          status: "DELIVERED",
          queuedOnGatewayAt: timestampAt(),
          sentAt: timestampAt(2_000),
          deliveredAt: timestampAt(5_000),
          statusUpdatedAt: timestampAt(5_000),
          gatewayNetworkAtSend: "CELLULAR",
        })
      )
    );

    const inboundRef = doc(db, "families", FAMILY_ID, "messages", "in_def456");
    const inboundPayload = makeInboundMessage({ text: "Ingat palagi apo" });
    await assertSucceeds(setDoc(inboundRef, inboundPayload));
    await assertSucceeds(setDoc(inboundRef, inboundPayload, { merge: true }));
  });

  it("denies tampering with immutable text, invalid status/errorCode enums, or regressing message status", async () => {
    const db = testEnv.authenticatedContext(GATEWAY_UID).firestore();
    const msgRef = doc(db, "families", FAMILY_ID, "messages", "msg-queued-1");

    await assertFails(
      updateDoc(msgRef, {
        text: "Tampered body",
        statusUpdatedAt: timestampAt(),
      })
    );
    await assertFails(
      updateDoc(msgRef, {
        status: "UNKNOWN_STATUS",
        statusUpdatedAt: timestampAt(),
      })
    );
    await assertFails(
      updateDoc(msgRef, {
        status: "FAILED",
        errorCode: "SOME_FAKE_ERROR",
        statusUpdatedAt: timestampAt(),
      })
    );

    await assertSucceeds(
      updateDoc(msgRef, {
        status: "SENT",
        sentAt: timestampAt(1_000),
        statusUpdatedAt: timestampAt(1_000),
      })
    );
    await assertFails(
      updateDoc(msgRef, {
        status: "QUEUED",
        statusUpdatedAt: timestampAt(2_000),
      })
    );

    await assertFails(
      updateDoc(doc(db, "families", FAMILY_ID, "messages", "in_abc123"), {
        status: "FAILED",
        statusUpdatedAt: timestampAt(3_000),
      })
    );
    await assertFails(deleteDoc(msgRef));
  });
});
