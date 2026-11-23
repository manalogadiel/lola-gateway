import type {
  ChatMessageDoc,
  MessageDirection,
  MessageStatus,
  SmsEncoding,
} from "./types";

export interface QaTrialEvent {
  messageId: string;
  direction: MessageDirection;
  encoding: SmsEncoding;
  segments: number;
  network: string;
  createdAtMs: number | null;
  sentAtMs: number | null;
  deliveredAtMs: number | null;
  statusUpdatedAtMs: number | null;
  status: MessageStatus;
  retryCount: number;
  errorCode: string;
  browserObservedAtMs: number;
}

const CSV_HEADER =
  "messageId,direction,encoding,segments,network,createdAtMs,sentAtMs,deliveredAtMs,statusUpdatedAtMs,status,retryCount,errorCode,browserObservedAtMs";

export function isQaModeEnabled(search: string): boolean {
  return new URLSearchParams(search).get("qa") === "1";
}

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null) {
    return "";
  }
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

export function formatQaEventsCsv(events: readonly QaTrialEvent[]): string {
  const rows = events.map((event) =>
    [
      event.messageId,
      event.direction,
      event.encoding,
      event.segments,
      event.network,
      event.createdAtMs,
      event.sentAtMs,
      event.deliveredAtMs,
      event.statusUpdatedAtMs,
      event.status,
      event.retryCount,
      event.errorCode,
      event.browserObservedAtMs,
    ]
      .map(escapeCsvCell)
      .join(",")
  );

  return [CSV_HEADER, ...rows].join("\n");
}

export function createQaRecorder() {
  const seenKeys = new Set<string>();
  const events: QaTrialEvent[] = [];

  return {
    observeMessages(
      messages: readonly ChatMessageDoc[],
      observedAtMs: number = Date.now(),
      options?: { seedOnly?: boolean }
    ) {
      for (const msg of messages) {
        const key = `${msg.id}::${msg.status}::${msg.retryCount}`;
        if (seenKeys.has(key)) {
          continue;
        }
        seenKeys.add(key);
        if (options?.seedOnly) {
          continue;
        }
        events.push({
          messageId: msg.id,
          direction: msg.direction,
          encoding: msg.encoding,
          segments: msg.segmentCount,
          network: msg.gatewayNetworkAtSend ?? "",
          createdAtMs: msg.createdAtMs,
          sentAtMs: msg.sentAtMs,
          deliveredAtMs: msg.deliveredAtMs,
          statusUpdatedAtMs: msg.statusUpdatedAtMs,
          status: msg.status,
          retryCount: msg.retryCount,
          errorCode: msg.errorCode ?? "",
          browserObservedAtMs: observedAtMs,
        });
      }
    },
    getEvents(): readonly QaTrialEvent[] {
      return events;
    },
  };
}

export function downloadQaCsv(
  events: readonly QaTrialEvent[],
  filename = `lola-web-qa-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`
): void {
  const csv = formatQaEventsCsv(events);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
