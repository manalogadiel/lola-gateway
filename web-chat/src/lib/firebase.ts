import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type DocumentData,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import {
  notifyWorkerPush,
  type GatewayApiDeps,
  type GatewayStore,
} from "./gatewayApi";
import type {
  ChatMessageDoc,
  ErrorCode,
  FamilyDoc,
  FamilyMemberDoc,
  GatewayHealth,
  GatewayNetworkType,
  GatewayStatus,
  MemberCreateWrite,
  MemberRole,
  MessageDirection,
  MessageStatus,
  OutboundMessageWrite,
  SmsEncoding,
} from "./types";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId
  );
}

export function getWorkerNotifyUrl(): string {
  return (import.meta.env.VITE_WORKER_NOTIFY_URL ?? "").trim();
}

let cachedApp: FirebaseApp | null = null;

function getFirebaseApp(): FirebaseApp {
  if (cachedApp) {
    return cachedApp;
  }
  const existing = getApps()[0];
  cachedApp = existing ?? initializeApp(firebaseConfig);
  return cachedApp;
}

export function getFirebaseServices(): { auth: Auth; db: Firestore } | null {
  if (!isFirebaseConfigured()) {
    return null;
  }
  const app = getFirebaseApp();
  return {
    auth: getAuth(app),
    db: getFirestore(app),
  };
}

export async function signInWithGoogle(auth: Auth): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutUser(auth: Auth): Promise<void> {
  await signOut(auth);
}

export function observeAuth(
  auth: Auth,
  callback: (user: User | null) => void
): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

function toMillis(value: unknown): number | null {
  if (value instanceof Timestamp) {
    return value.toMillis();
  }
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof value === "number") {
    return value;
  }
  return null;
}

function parseGatewayHealth(raw: DocumentData | undefined): GatewayHealth {
  const status = raw?.status as GatewayStatus | undefined;
  const networkType = raw?.networkType as GatewayNetworkType | undefined;
  return {
    uid: typeof raw?.uid === "string" ? raw.uid : "",
    deviceId: typeof raw?.deviceId === "string" ? raw.deviceId : "",
    fcmToken: typeof raw?.fcmToken === "string" ? raw.fcmToken : "",
    status:
      status === "ONLINE" || status === "OFFLINE" || status === "PAUSED"
        ? status
        : "OFFLINE",
    networkType:
      networkType === "WIFI" ||
      networkType === "CELLULAR" ||
      networkType === "NONE"
        ? networkType
        : "NONE",
    carrierName: typeof raw?.carrierName === "string" ? raw.carrierName : "",
    signalDbm: typeof raw?.signalDbm === "number" ? raw.signalDbm : null,
    batteryPercent:
      typeof raw?.batteryPercent === "number" ? raw.batteryPercent : 0,
    isCharging: Boolean(raw?.isCharging),
    lastHeartbeatMs: toMillis(raw?.lastHeartbeatAt),
  };
}

function parseMemberDoc(uid: string, raw: DocumentData): FamilyMemberDoc {
  const role: MemberRole = raw.role === "GATEWAY" ? "GATEWAY" : "MEMBER";
  return {
    uid,
    displayName: typeof raw.displayName === "string" ? raw.displayName : "Member",
    smsNickname: typeof raw.smsNickname === "string" ? raw.smsNickname : "",
    role,
    joinedAtMs: toMillis(raw.joinedAt),
    lastActiveMs: toMillis(raw.lastActiveAt),
  };
}

function parseMessageDoc(id: string, raw: DocumentData): ChatMessageDoc {
  const direction: MessageDirection =
    raw.direction === "INBOUND" ? "INBOUND" : "OUTBOUND";
  const encoding: SmsEncoding = raw.encoding === "UCS-2" ? "UCS-2" : "GSM-7";
  const rawStatus = raw.status as MessageStatus | undefined;
  const status: MessageStatus =
    rawStatus === "QUEUED" ||
    rawStatus === "SENT" ||
    rawStatus === "PENDING" ||
    rawStatus === "DELIVERED" ||
    rawStatus === "FAILED"
      ? rawStatus
      : "QUEUED";

  return {
    id,
    direction,
    senderUid: typeof raw.senderUid === "string" ? raw.senderUid : "",
    senderName: typeof raw.senderName === "string" ? raw.senderName : "Family",
    text: typeof raw.text === "string" ? raw.text : "",
    smsFormattedText:
      typeof raw.smsFormattedText === "string" ? raw.smsFormattedText : "",
    encoding,
    segmentCount: typeof raw.segmentCount === "number" ? raw.segmentCount : 1,
    status,
    retryCount: typeof raw.retryCount === "number" ? raw.retryCount : 0,
    errorCode: (raw.errorCode as ErrorCode | null) ?? null,
    errorReason: typeof raw.errorReason === "string" ? raw.errorReason : null,
    retryOfMessageId:
      typeof raw.retryOfMessageId === "string" ? raw.retryOfMessageId : null,
    createdAtMs: toMillis(raw.createdAt),
    queuedOnGatewayAtMs: toMillis(raw.queuedOnGatewayAt),
    sentAtMs: toMillis(raw.sentAt),
    deliveredAtMs: toMillis(raw.deliveredAt),
    statusUpdatedAtMs: toMillis(raw.statusUpdatedAt),
    gatewayNetworkAtSend:
      raw.gatewayNetworkAtSend === "WIFI" ||
      raw.gatewayNetworkAtSend === "CELLULAR"
        ? raw.gatewayNetworkAtSend
        : null,
  };
}

export function createFirestoreGatewayStore(db: Firestore): GatewayStore {
  return {
    async resolveJoinCode(code: string): Promise<string | null> {
      const snap = await getDoc(doc(db, "joinCodes", code));
      if (!snap.exists()) {
        return null;
      }
      const familyId = snap.data().familyId;
      return typeof familyId === "string" && familyId.length > 0
        ? familyId
        : null;
    },

    async getMember(
      familyId: string,
      uid: string
    ): Promise<FamilyMemberDoc | null> {
      const snap = await getDoc(doc(db, "families", familyId, "members", uid));
      if (!snap.exists()) {
        return null;
      }
      return parseMemberDoc(uid, snap.data());
    },

    async createMember(
      familyId: string,
      uid: string,
      data: MemberCreateWrite
    ): Promise<void> {
      await setDoc(doc(db, "families", familyId, "members", uid), {
        displayName: data.displayName,
        smsNickname: data.smsNickname,
        role: "MEMBER",
        joinCode: data.joinCode,
        joinedAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
      });
    },

    async updateMemberProfile(
      familyId: string,
      uid: string,
      updates: {
        smsNickname?: string;
        lastActiveMs: number;
      }
    ): Promise<void> {
      const patch: Record<string, unknown> = {
        lastActiveAt: Timestamp.fromMillis(updates.lastActiveMs),
      };
      if (updates.smsNickname !== undefined) {
        patch.smsNickname = updates.smsNickname;
      }
      await updateDoc(doc(db, "families", familyId, "members", uid), patch);
    },

    async createOutboundMessage(
      familyId: string,
      messageId: string,
      payload: OutboundMessageWrite
    ): Promise<void> {
      await setDoc(doc(db, "families", familyId, "messages", messageId), {
        direction: payload.direction,
        senderUid: payload.senderUid,
        senderName: payload.senderName,
        text: payload.text,
        smsFormattedText: payload.smsFormattedText,
        encoding: payload.encoding,
        segmentCount: payload.segmentCount,
        status: payload.status,
        retryCount: payload.retryCount,
        errorCode: null,
        errorReason: null,
        retryOfMessageId: payload.retryOfMessageId,
        createdAt: Timestamp.fromMillis(payload.createdAtMs),
        queuedOnGatewayAt: null,
        sentAt: null,
        deliveredAt: null,
        statusUpdatedAt: Timestamp.fromMillis(payload.statusUpdatedAtMs),
        gatewayNetworkAtSend: null,
      });
    },
  };
}

export function createLiveGatewayApiDeps(
  auth: Auth,
  db: Firestore
): GatewayApiDeps {
  const workerUrl = getWorkerNotifyUrl();
  return {
    store: createFirestoreGatewayStore(db),
    getIdToken: async () => {
      const user = auth.currentUser;
      return user ? user.getIdToken() : null;
    },
    notifyGateway: (familyId, messageId, idToken) =>
      notifyWorkerPush(workerUrl, familyId, messageId, idToken),
  };
}

export function subscribeFamily(
  db: Firestore,
  familyId: string,
  onData: (family: FamilyDoc | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "families", familyId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const raw = snap.data();
      onData({
        id: snap.id,
        name: typeof raw.name === "string" ? raw.name : "Family",
        joinCode: typeof raw.joinCode === "string" ? raw.joinCode : "",
        seniorName: typeof raw.seniorName === "string" ? raw.seniorName : "Lola",
        seniorPhoneE164:
          typeof raw.seniorPhoneE164 === "string" ? raw.seniorPhoneE164 : "",
        allowListE164: Array.isArray(raw.allowListE164)
          ? raw.allowListE164.filter((item): item is string => typeof item === "string")
          : [],
        gateway: parseGatewayHealth(raw.gateway),
      });
    },
    (err) => onError(err)
  );
}

export function subscribeMembers(
  db: Firestore,
  familyId: string,
  onData: (members: FamilyMemberDoc[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, "families", familyId, "members"),
    (snap) => {
      const members = snap.docs
        .map((docSnap) => parseMemberDoc(docSnap.id, docSnap.data()))
        .sort((a, b) => {
          if (a.role === "GATEWAY" && b.role !== "GATEWAY") return -1;
          if (b.role === "GATEWAY" && a.role !== "GATEWAY") return 1;
          return a.displayName.localeCompare(b.displayName);
        });
      onData(members);
    },
    (err) => onError(err)
  );
}

export function subscribeMessages(
  db: Firestore,
  familyId: string,
  onData: (messages: ChatMessageDoc[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const messagesQuery = query(
    collection(db, "families", familyId, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(
    messagesQuery,
    (snap) => {
      onData(snap.docs.map((docSnap) => parseMessageDoc(docSnap.id, docSnap.data())));
    },
    (err) => onError(err)
  );
}
