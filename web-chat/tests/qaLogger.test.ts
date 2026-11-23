import { describe, expect, it } from "vitest";
import {
  createQaRecorder,
  formatQaEventsCsv,
  isQaModeEnabled,
} from "../src/lib/qaLogger";
import type { ChatMessageDoc } from "../src/lib/types";

describe("qaLogger", () => {
  it("enables QA logging only when ?qa=1 is present", () => {
    expect(isQaModeEnabled("?qa=1")).toBe(true);
    expect(isQaModeEnabled("?foo=bar&qa=1")).toBe(true);
    expect(isQaModeEnabled("?qa=0")).toBe(false);
    expect(isQaModeEnabled("")).toBe(false);
  });

  it("seeds initial history without logging it, then records live status transitions without duplicates", () => {
    const recorder = createQaRecorder();
    const historicalMsg: ChatMessageDoc = {
      id: "msg-old",
      direction: "INBOUND",
      senderUid: "senior",
      senderName: "Lola Elena",
      text: "Old text",
      smsFormattedText: "Old text",
      encoding: "GSM-7",
      segmentCount: 1,
      status: "DELIVERED",
      retryCount: 0,
      errorCode: null,
      errorReason: null,
      retryOfMessageId: null,
      createdAtMs: 500,
      queuedOnGatewayAtMs: 500,
      sentAtMs: 500,
      deliveredAtMs: 500,
      statusUpdatedAtMs: 500,
      gatewayNetworkAtSend: "WIFI",
    };

    const liveMsg: ChatMessageDoc = {
      id: "msg-1",
      direction: "OUTBOUND",
      senderUid: "uid-seb",
      senderName: "Seb",
      text: "Hello",
      smsFormattedText: "Seb: Hello",
      encoding: "GSM-7",
      segmentCount: 1,
      status: "QUEUED",
      retryCount: 0,
      errorCode: null,
      errorReason: null,
      retryOfMessageId: null,
      createdAtMs: 1000,
      queuedOnGatewayAtMs: null,
      sentAtMs: null,
      deliveredAtMs: null,
      statusUpdatedAtMs: 1000,
      gatewayNetworkAtSend: null,
    };

    recorder.observeMessages([historicalMsg], 900, { seedOnly: true });
    expect(recorder.getEvents()).toHaveLength(0);

    recorder.observeMessages([historicalMsg, liveMsg], 1050);
    recorder.observeMessages([historicalMsg, liveMsg], 1100);
    recorder.observeMessages(
      [
        historicalMsg,
        {
          ...liveMsg,
          status: "DELIVERED",
          sentAtMs: 2500,
          deliveredAtMs: 4200,
          statusUpdatedAtMs: 4200,
          gatewayNetworkAtSend: "WIFI",
        },
      ],
      4500
    );

    const events = recorder.getEvents();
    expect(events).toHaveLength(2);
    expect(events[0].messageId).toBe("msg-1");
    expect(events[0].status).toBe("QUEUED");
    expect(events[0].statusUpdatedAtMs).toBe(1000);
    expect(events[0].browserObservedAtMs).toBe(1050);
    expect(events[1].status).toBe("DELIVERED");
    expect(events[1].statusUpdatedAtMs).toBe(4200);
    expect(events[1].browserObservedAtMs).toBe(4500);
  });

  it("formats RFC-4180 CSV with Task 5 columns plus statusUpdatedAtMs and browserObservedAtMs", () => {
    const csv = formatQaEventsCsv([
      {
        messageId: "msg-1",
        direction: "OUTBOUND",
        encoding: "GSM-7",
        segments: 1,
        network: "WIFI",
        createdAtMs: 1000,
        sentAtMs: 2500,
        deliveredAtMs: 4200,
        statusUpdatedAtMs: 4200,
        status: "DELIVERED",
        retryCount: 0,
        errorCode: "",
        browserObservedAtMs: 4500,
      },
      {
        messageId: 'msg-"quoted",2',
        direction: "OUTBOUND",
        encoding: "UCS-2",
        segments: 2,
        network: "",
        createdAtMs: 5000,
        sentAtMs: null,
        deliveredAtMs: null,
        statusUpdatedAtMs: 5100,
        status: "FAILED",
        retryCount: 4,
        errorCode: "NO_SERVICE",
        browserObservedAtMs: 5200,
      },
    ]);

    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "messageId,direction,encoding,segments,network,createdAtMs,sentAtMs,deliveredAtMs,statusUpdatedAtMs,status,retryCount,errorCode,browserObservedAtMs"
    );
    expect(lines[1]).toBe(
      "msg-1,OUTBOUND,GSM-7,1,WIFI,1000,2500,4200,4200,DELIVERED,0,,4500"
    );
    expect(lines[2]).toBe(
      '"msg-""quoted"",2",OUTBOUND,UCS-2,2,,5000,,,5100,FAILED,4,NO_SERVICE,5200'
    );
  });
});
