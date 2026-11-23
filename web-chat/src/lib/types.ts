export type MessageDirection = "OUTBOUND" | "INBOUND";
export type SmsEncoding = "GSM-7" | "UCS-2";
export type MessageStatus =
  | "QUEUED"
  | "SENT"
  | "PENDING"
  | "DELIVERED"
  | "FAILED";
export type GatewayStatus = "ONLINE" | "OFFLINE" | "PAUSED";
export type GatewayNetworkType = "WIFI" | "CELLULAR" | "NONE";
export type MemberRole = "GATEWAY" | "MEMBER";
export type ErrorCode =
  | "NO_SERVICE"
  | "RADIO_OFF"
  | "GENERIC_FAILURE"
  | "INVALID_NUMBER";
export type ThemePreference = "auto" | "light" | "dark";

export interface GatewayHealth {
  uid: string;
  deviceId: string;
  fcmToken: string;
  status: GatewayStatus;
  networkType: GatewayNetworkType;
  carrierName: string;
  signalDbm: number | null;
  batteryPercent: number;
  isCharging: boolean;
  lastHeartbeatMs: number | null;
}

export interface FamilyDoc {
  id: string;
  name: string;
  joinCode: string;
  seniorName: string;
  seniorPhoneE164: string;
  allowListE164: string[];
  gateway: GatewayHealth;
}

export interface FamilyMemberDoc {
  uid: string;
  displayName: string;
  smsNickname: string;
  role: MemberRole;
  lastActiveMs: number | null;
  joinedAtMs: number | null;
}

export interface ChatMessageDoc {
  id: string;
  direction: MessageDirection;
  senderUid: string;
  senderName: string;
  text: string;
  smsFormattedText: string;
  encoding: SmsEncoding;
  segmentCount: number;
  status: MessageStatus;
  retryCount: number;
  errorCode: ErrorCode | null;
  errorReason: string | null;
  retryOfMessageId: string | null;
  createdAtMs: number | null;
  queuedOnGatewayAtMs: number | null;
  sentAtMs: number | null;
  deliveredAtMs: number | null;
  statusUpdatedAtMs: number | null;
  gatewayNetworkAtSend: "WIFI" | "CELLULAR" | null;
}

export interface OutboundMessageWrite {
  direction: "OUTBOUND";
  senderUid: string;
  senderName: string;
  text: string;
  smsFormattedText: string;
  encoding: SmsEncoding;
  segmentCount: number;
  status: "QUEUED";
  retryCount: 0;
  errorCode: null;
  errorReason: null;
  retryOfMessageId: string | null;
  createdAtMs: number;
  queuedOnGatewayAtMs: null;
  sentAtMs: null;
  deliveredAtMs: null;
  statusUpdatedAtMs: number;
  gatewayNetworkAtSend: null;
}
