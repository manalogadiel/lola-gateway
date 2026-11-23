import type { FamilyMemberDoc } from "./types";

const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

export function getFirstName(name: string, fallback = "Family"): string {
  const firstWord = name.trim().split(/\s+/)[0] ?? "";
  return firstWord || fallback;
}

export function deriveDefaultNickname(displayName: string): string {
  return getFirstName(displayName, "Family").slice(0, 16);
}

export function getMemberPrefix(
  member: Pick<FamilyMemberDoc, "displayName" | "smsNickname">
): string {
  return member.smsNickname.trim() || getFirstName(member.displayName, "Family");
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

export function formatTimeShort(timestampMs: number | null): string {
  if (!timestampMs) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestampMs));
}

export function formatThreadTime(
  timestampMs: number | null,
  nowMs: number = Date.now()
): string {
  if (!timestampMs) {
    return "";
  }
  const date = new Date(timestampMs);
  const now = new Date(nowMs);

  if (date.toDateString() === now.toDateString()) {
    return formatTimeShort(timestampMs);
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function isMemberActive(
  lastActiveMs: number | null,
  nowMs: number = Date.now()
): boolean {
  if (!lastActiveMs) {
    return false;
  }
  return nowMs - lastActiveMs <= ACTIVE_WINDOW_MS;
}

export function formatMemberPresence(
  lastActiveMs: number | null,
  nowMs: number = Date.now()
): string {
  if (!lastActiveMs) {
    return "Joined";
  }
  const diffMs = Math.max(0, nowMs - lastActiveMs);
  if (diffMs <= ACTIVE_WINDOW_MS) {
    return "Online";
  }
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) {
    return `Last seen ${mins}m ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `Last seen ${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `Last seen ${days}d ago`;
}

export function getInitials(name: string): string {
  const cleaned = name.trim();
  return cleaned ? cleaned[0].toUpperCase() : "?";
}

export type AvatarTone = "periwinkle" | "coral" | "mint" | "marigold";

const AVATAR_TONES: AvatarTone[] = ["periwinkle", "coral", "mint", "marigold"];

export function pickAvatarTone(seed: string): AvatarTone {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}
