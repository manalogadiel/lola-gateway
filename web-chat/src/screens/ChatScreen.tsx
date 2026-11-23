import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { BackChevronIcon, SendArrowIcon } from "../components/Icons";
import { StatusDot, type DotTone } from "../components/StatusDot";
import { formatTimeShort, getFirstName } from "../lib/formatters";
import type { GatewayDisplayState } from "../lib/gatewayApi";
import { calculateSmsMetrics } from "../lib/smsCounter";
import type { ChatMessageDoc, FamilyDoc, QaProps } from "../lib/types";

interface ChatScreenProps {
  family: FamilyDoc;
  messages: ChatMessageDoc[];
  currentUid: string;
  senderSmsNickname: string;
  gatewayDisplay: GatewayDisplayState;
  qa: QaProps;
  onBack: () => void;
  onSendMessage: (text: string) => Promise<void>;
  onRetryMessage: (message: ChatMessageDoc) => Promise<void>;
}

function getOutboundStatusDisplay(msg: ChatMessageDoc): {
  tone: DotTone;
  text: string;
} {
  switch (msg.status) {
    case "QUEUED":
      return { tone: "amber", text: "Queued" };
    case "SENT":
      return {
        tone: "peri",
        text: msg.sentAtMs ? `Sent · ${formatTimeShort(msg.sentAtMs)}` : "Sent",
      };
    case "PENDING":
      return { tone: "amber", text: "Pending · keypad may be off" };
    case "DELIVERED":
      return {
        tone: "mint",
        text: msg.deliveredAtMs
          ? `Delivered · ${formatTimeShort(msg.deliveredAtMs)}`
          : "Delivered",
      };
    case "FAILED":
      return {
        tone: "coral",
        text: msg.errorReason ? `Failed (${msg.errorReason})` : "Failed",
      };
  }
}

function getHeaderStatusLabel(
  state: GatewayDisplayState["state"],
  seniorFirstName: string
): string {
  switch (state) {
    case "online":
      return `${seniorFirstName} reachable via SMS`;
    case "cellular_backup":
      return `${seniorFirstName} via 4G Backup SMS`;
    case "paused":
      return "SMS bridge paused";
    case "offline":
      return "Gateway offline";
  }
}

export function ChatScreen({
  family,
  messages,
  currentUid,
  senderSmsNickname,
  gatewayDisplay,
  qa,
  onBack,
  onSendMessage,
  onRetryMessage,
}: ChatScreenProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const streamRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = streamRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  const retriedMessageIds = useMemo(() => {
    const set = new Set<string>();
    for (const msg of messages) {
      if (msg.retryOfMessageId) {
        set.add(msg.retryOfMessageId);
      }
    }
    return set;
  }, [messages]);

  const trimmedDraft = draft.trim();
  const smsMetrics = trimmedDraft.length > 0
    ? calculateSmsMetrics(senderSmsNickname, trimmedDraft)
    : null;

  const seniorFirstName = getFirstName(family.seniorName, "Lola");
  const headerStatusLabel = getHeaderStatusLabel(
    gatewayDisplay.state,
    seniorFirstName
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!trimmedDraft || sending) {
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      await onSendMessage(trimmedDraft);
      setDraft("");
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : "Could not send message."
      );
    } finally {
      setSending(false);
    }
  };

  const handleRetry = async (msg: ChatMessageDoc) => {
    if (retryingId || retriedMessageIds.has(msg.id)) {
      return;
    }
    setRetryingId(msg.id);
    setSendError(null);
    try {
      await onRetryMessage(msg);
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : "Could not retry message."
      );
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="chat-screen">
      <header className="top-chrome chat-chrome">
        <div className="chat-nav">
          <div className="chat-bar-left">
            <button
              type="button"
              className="bare-back"
              aria-label="Back to messages"
              onClick={onBack}
            >
              <BackChevronIcon />
            </button>
            <div className="chat-title-block">
              <h2>{family.name}</h2>
              <StatusDot
                tone={gatewayDisplay.tone}
                label={headerStatusLabel}
                compact
              />
            </div>
          </div>
          <img
            className="chat-avatar-sm"
            src="/assets/lola-avatar.jpg"
            alt={family.seniorName}
          />
        </div>
      </header>

      <div className="chat-stream" ref={streamRef} role="log" aria-live="polite">
        {messages.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 24 }}>
            Messages you send here are forwarded to{" "}
            <strong>{family.seniorName}</strong> as SMS prefixed with{" "}
            <strong>&ldquo;{senderSmsNickname}:&rdquo;</strong>.
          </div>
        ) : (
          messages.map((msg) => {
            const isInbound = msg.direction === "INBOUND";
            const isMe = !isInbound && msg.senderUid === currentUid;
            const groupKind = isInbound ? "lola" : isMe ? "me" : "other";
            const bubbleKind = isInbound
              ? "bubble-lola"
              : isMe
                ? "bubble-me"
                : "bubble-other";

            const outboundStatus = isInbound
              ? null
              : getOutboundStatusDisplay(msg);
            const alreadyRetried = retriedMessageIds.has(msg.id);

            return (
              <div key={msg.id} className={`msg-group ${groupKind}`}>
                {!isMe && (
                  <span className="msg-sender">
                    {isInbound
                      ? `${family.seniorName} · via SMS`
                      : msg.senderName}
                  </span>
                )}
                <div className={`bubble ${bubbleKind}`}>{msg.text}</div>
                {isInbound ? (
                  <span className="msg-status tnum">
                    {formatTimeShort(msg.createdAtMs)}
                  </span>
                ) : (
                  <span className="msg-status tnum">
                    <span
                      className={`dot dot-${outboundStatus?.tone ?? "amber"}`}
                      aria-hidden="true"
                    />
                    <span>{outboundStatus?.text}</span>
                    {isMe && msg.status === "FAILED" && (
                      <>
                        <span aria-hidden="true">·</span>
                        {alreadyRetried ? (
                          <span>Retried</span>
                        ) : (
                          <button
                            type="button"
                            className="retry-link"
                            disabled={retryingId === msg.id}
                            onClick={() => handleRetry(msg)}
                          >
                            {retryingId === msg.id
                              ? "Retrying..."
                              : "Tap to retry"}
                          </button>
                        )}
                      </>
                    )}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {qa.enabled && (
        <div className="qa-strip tnum">
          <span>QA Log · {qa.eventCount} events</span>
          <button
            type="button"
            className="action-link"
            onClick={qa.onExportCsv}
          >
            Export CSV
          </button>
        </div>
      )}

      {sendError && (
        <div
          className="inline-banner error"
          role="alert"
          style={{ margin: "0 12px 6px" }}
        >
          {sendError}
        </div>
      )}

      <div className="composer-area">
        {smsMetrics && (
          <div
            className={`sms-meter tnum${smsMetrics.encoding === "UCS-2" || smsMetrics.segmentCount > 1 ? " warn" : ""}`}
            aria-live="polite"
          >
            <span>
              {smsMetrics.encoding === "GSM-7"
                ? "GSM-7"
                : "UCS-2 (shorter per SMS)"}
            </span>
            <span>
              {smsMetrics.used}/{smsMetrics.limit} · {smsMetrics.segmentCount}{" "}
              SMS
            </span>
          </div>
        )}

        <form className="composer-bar" onSubmit={handleSubmit}>
          <input
            className="composer-input"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message family..."
            aria-label="Message family"
            autoComplete="off"
            disabled={sending}
          />
          <button
            type="submit"
            className="send-coral"
            aria-label="Send message"
            disabled={sending || !trimmedDraft}
          >
            <SendArrowIcon />
          </button>
        </form>
      </div>
    </div>
  );
}
