import type { SmsEncoding } from "./types";

const GSM7_BASIC_CHARS = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
);

const GSM7_EXTENDED_CHARS = new Set("^{}\\[~]|€\f");

const GSM7_SINGLE_LIMIT = 160;
const GSM7_MULTI_LIMIT = 153;
const UCS2_SINGLE_LIMIT = 70;
const UCS2_MULTI_LIMIT = 67;

export interface SmsMetrics {
  formattedText: string;
  encoding: SmsEncoding;
  segmentCount: number;
  used: number;
  limit: number;
}

export function formatSmsPayload(senderName: string, body: string): string {
  if (body.length === 0) {
    return "";
  }
  const cleanName = senderName.trim();
  return cleanName ? `${cleanName}: ${body}` : body;
}

/**
 * Counts multipart SMS segments without splitting a 2-unit symbol across a
 * segment boundary, matching Android's SmsManager.divideMessage() behavior
 * for GSM-7 extended characters (2 septets) and UCS-2 surrogate pairs (2 code units).
 */
function countMultipartSegments(
  units: readonly number[],
  multiLimit: number
): number {
  let segments = 1;
  let currentUsed = 0;

  for (const unitSize of units) {
    if (currentUsed + unitSize > multiLimit) {
      segments += 1;
      currentUsed = unitSize;
    } else {
      currentUsed += unitSize;
    }
  }

  return segments;
}

export function calculateSmsMetrics(
  senderName: string,
  body: string
): SmsMetrics {
  if (body.length === 0) {
    return {
      formattedText: "",
      encoding: "GSM-7",
      segmentCount: 0,
      used: 0,
      limit: GSM7_SINGLE_LIMIT,
    };
  }

  const formattedText = formatSmsPayload(senderName, body);
  const gsmUnits: number[] = [];
  let totalSeptets = 0;
  let isGsm7 = true;

  for (const ch of formattedText) {
    if (GSM7_BASIC_CHARS.has(ch)) {
      gsmUnits.push(1);
      totalSeptets += 1;
    } else if (GSM7_EXTENDED_CHARS.has(ch)) {
      gsmUnits.push(2);
      totalSeptets += 2;
    } else {
      isGsm7 = false;
      break;
    }
  }

  if (isGsm7) {
    const segmentCount =
      totalSeptets <= GSM7_SINGLE_LIMIT
        ? 1
        : countMultipartSegments(gsmUnits, GSM7_MULTI_LIMIT);
    const limit =
      segmentCount === 1
        ? GSM7_SINGLE_LIMIT
        : segmentCount * GSM7_MULTI_LIMIT;
    return {
      formattedText,
      encoding: "GSM-7",
      segmentCount,
      used: totalSeptets,
      limit,
    };
  }

  const ucsUnits: number[] = [];
  for (const codePoint of formattedText) {
    ucsUnits.push(codePoint.length);
  }
  const totalCodeUnits = formattedText.length;
  const segmentCount =
    totalCodeUnits <= UCS2_SINGLE_LIMIT
      ? 1
      : countMultipartSegments(ucsUnits, UCS2_MULTI_LIMIT);
  const limit =
    segmentCount === 1 ? UCS2_SINGLE_LIMIT : segmentCount * UCS2_MULTI_LIMIT;

  return {
    formattedText,
    encoding: "UCS-2",
    segmentCount,
    used: totalCodeUnits,
    limit,
  };
}
