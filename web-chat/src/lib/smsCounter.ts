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
  let septets = 0;
  let isGsm7 = true;

  for (const ch of formattedText) {
    if (GSM7_BASIC_CHARS.has(ch)) {
      septets += 1;
    } else if (GSM7_EXTENDED_CHARS.has(ch)) {
      septets += 2;
    } else {
      isGsm7 = false;
      break;
    }
  }

  const encoding: SmsEncoding = isGsm7 ? "GSM-7" : "UCS-2";
  const singleLimit = isGsm7 ? GSM7_SINGLE_LIMIT : UCS2_SINGLE_LIMIT;
  const multiLimit = isGsm7 ? GSM7_MULTI_LIMIT : UCS2_MULTI_LIMIT;
  const used = isGsm7 ? septets : formattedText.length;
  const segmentCount = used <= singleLimit ? 1 : Math.ceil(used / multiLimit);
  const limit = segmentCount === 1 ? singleLimit : segmentCount * multiLimit;

  return {
    formattedText,
    encoding,
    segmentCount,
    used,
    limit,
  };
}
