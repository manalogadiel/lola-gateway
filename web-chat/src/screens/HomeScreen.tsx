import { useMemo, useState } from "react";
import type { MainTab } from "../components/IconBottomDock";
import { SearchIcon } from "../components/Icons";
import { StatusDot } from "../components/StatusDot";
import {
  formatThreadTime,
  getFirstName,
  getInitials,
  getMemberPrefix,
  isMemberActive,
  pickAvatarTone,
} from "../lib/formatters";
import type { GatewayDisplayState } from "../lib/gatewayApi";
import type {
  ChatMessageDoc,
  FamilyDoc,
  FamilyMemberDoc,
} from "../lib/types";

interface HomeScreenProps {
  family: FamilyDoc;
  members: FamilyMemberDoc[];
  messages: ChatMessageDoc[];
  gatewayDisplay: GatewayDisplayState;
  nowMs: number;
  onSelectTab?: (tab: MainTab) => void;
  onOpenChat: () => void;
}

export function HomeScreen({
  family,
  members,
  messages,
  gatewayDisplay,
  nowMs,
  onOpenChat,
}: HomeScreenProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;

  const filteredMembers = useMemo(() => {
    if (!normalizedQuery) {
      return members;
    }
    return members.filter(
      (member) =>
        member.displayName.toLowerCase().includes(normalizedQuery) ||
        member.smsNickname.toLowerCase().includes(normalizedQuery)
    );
  }, [members, normalizedQuery]);

  const showLolaChip =
    !normalizedQuery ||
    family.seniorName.toLowerCase().includes(normalizedQuery) ||
    "lola".includes(normalizedQuery);

  const groupPreviewText = latestMessage
    ? `${latestMessage.direction === "INBOUND" ? family.seniorName : latestMessage.senderName}: ${latestMessage.text}`
    : `Say hello to ${family.seniorName} over SMS`;

  const showGroupRow =
    !normalizedQuery ||
    family.name.toLowerCase().includes(normalizedQuery) ||
    family.seniorName.toLowerCase().includes(normalizedQuery) ||
    groupPreviewText.toLowerCase().includes(normalizedQuery);

  const totalPeople = members.length + 1;

  return (
    <>
      <header className="top-chrome">
        <div className="nav-bar brand-nav-bar">
          <div className="brand-header-left">
            <div className="brand-mascot-wrap">
              <img
                className="brand-mascot-img"
                src="/assets/lola-avatar.jpg"
                alt="Lola Gateway"
              />
              <span className="brand-online-ping" aria-hidden="true" />
            </div>
            <div>
              <span className="brand-eyebrow">LOLA GATEWAY</span>
              <h1 className="app-h1">{family.name}</h1>
            </div>
          </div>
          <StatusDot tone={gatewayDisplay.tone} label={gatewayDisplay.label} compact />
        </div>
      </header>

      <main className="scroll-area">
        <div className="search-wrap">
          <SearchIcon />
          <input
            className="search-input"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search family or chats"
            aria-label="Search family or chats"
          />
        </div>

        {/* Ambient Lola SMS Status Card */}
        <div
          className="ambient-banner"
          onClick={onOpenChat}
          role="button"
          tabIndex={0}
          aria-label={`Open family chat with ${family.seniorName}`}
        >
          <div className="ambient-banner-mascot">
            <img src="/assets/lola-avatar.jpg" alt={family.seniorName} />
          </div>
          <div className="ambient-banner-content">
            <div className="ambient-banner-heading">
              <span>{family.seniorName}</span>
              <span className="ambient-status-tag">Keypad SMS</span>
            </div>
            <p className="ambient-banner-text">
              {gatewayDisplay.state === "online"
                ? `Direct SMS bridge connected · Texts sync with ${family.name}`
                : gatewayDisplay.label}
            </p>
          </div>
        </div>

        <div className="section-row-head">
          <span className="section-label">Family Circle</span>
          <span className="section-meta tnum">{totalPeople} members</span>
        </div>

        <div className="people-strip">
          {showLolaChip && (
            <button
              type="button"
              className="person-chip"
              onClick={onOpenChat}
              aria-label={`Open family chat with ${family.seniorName}`}
            >
              <span className="avatar-wrap">
                <img
                  className="avatar-img lola-ring"
                  src="/assets/lola-avatar.jpg"
                  alt={family.seniorName}
                />
                <span
                  className="presence-dot marigold"
                  title="Keypad SMS Active"
                  aria-hidden="true"
                />
              </span>
              <span className="person-name">
                {getFirstName(family.seniorName, "Lola")}
              </span>
            </button>
          )}

          {filteredMembers.map((member) => {
            const tone = pickAvatarTone(member.uid);
            const active = isMemberActive(member.lastActiveMs, nowMs);
            return (
              <button
                type="button"
                key={member.uid}
                className="person-chip"
                onClick={onOpenChat}
                aria-label={`Open family chat with ${member.displayName}`}
              >
                <span className="avatar-wrap">
                  <span className={`avatar-init avatar-tone-${tone}`}>
                    {getInitials(member.displayName)}
                  </span>
                  {active && <span className="presence-dot" aria-hidden="true" />}
                </span>
                <span className="person-name">{getMemberPrefix(member)}</span>
              </button>
            );
          })}
        </div>

        <div className="section-row-head">
          <span className="section-label">Family Chat</span>
          <span className="section-meta">Live SMS Bridge</span>
        </div>

        <div className="chat-list">
          {showGroupRow && (
            <button
              type="button"
              className="thread-row active-thread"
              onClick={onOpenChat}
            >
              <div className="group-avatar-stack">
                <img
                  className="group-av-main"
                  src="/assets/lola-avatar.jpg"
                  alt={family.seniorName}
                />
                <span className="group-av-sub tnum">+{members.length}</span>
              </div>
              <div className="thread-mid">
                <div className="thread-top">
                  <div className="thread-title-wrap">
                    <span className="thread-title">{family.name}</span>
                    <span className="sms-pill-badge" title="Bridge connected to Lola's phone">
                      Lola&rsquo;s SMS
                    </span>
                  </div>
                  <span className="thread-time tnum">
                    {formatThreadTime(latestMessage?.createdAtMs ?? null, nowMs)}
                  </span>
                </div>
                <div className="thread-bottom">
                  <p className="thread-preview">{groupPreviewText}</p>
                </div>
              </div>
            </button>
          )}

          {!showGroupRow && (
            <div className="empty-state">
              No chats match &ldquo;{searchQuery}&rdquo;.
            </div>
          )}
        </div>
      </main>
    </>
  );
}
