import { useMemo, useState } from "react";
import { IconBottomDock, type MainTab } from "../components/IconBottomDock";
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
  onSelectTab: (tab: MainTab) => void;
  onOpenChat: () => void;
}

export function HomeScreen({
  family,
  members,
  messages,
  gatewayDisplay,
  nowMs,
  onSelectTab,
  onOpenChat,
}: HomeScreenProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const latestInbound = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].direction === "INBOUND") {
        return messages[i];
      }
    }
    return null;
  }, [messages]);

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

  const showLolaRow =
    !normalizedQuery ||
    family.seniorName.toLowerCase().includes(normalizedQuery) ||
    "sms".includes(normalizedQuery) ||
    (latestInbound?.text.toLowerCase().includes(normalizedQuery) ?? false);

  const totalPeople = members.length + 1;

  return (
    <>
      <header className="top-chrome">
        <div className="nav-bar">
          <h1 className="app-h1">Messages</h1>
          <StatusDot tone={gatewayDisplay.tone} label={gatewayDisplay.label} />
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
            placeholder="Search people or chats"
            aria-label="Search people or chats"
          />
        </div>

        <div className="section-row-head">
          <span className="section-label">People</span>
          <span className="section-meta tnum">{totalPeople} in family</span>
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
                  className="avatar-img"
                  src="/assets/lola-avatar.jpg"
                  alt={family.seniorName}
                />
                <span
                  className="presence-dot marigold"
                  title="Keypad SMS"
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
          <span className="section-label">Chats</span>
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
                  alt={family.name}
                />
                <span className="group-av-sub tnum">+{members.length}</span>
              </div>
              <div className="thread-mid">
                <div className="thread-top">
                  <span className="thread-title">{family.name}</span>
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

          {showLolaRow && (
            <button
              type="button"
              className="thread-row"
              onClick={onOpenChat}
            >
              <img
                className="avatar-img"
                style={{ width: 48, height: 48, flexShrink: 0 }}
                src="/assets/lola-avatar.jpg"
                alt={family.seniorName}
              />
              <div className="thread-mid">
                <div className="thread-top">
                  <span className="thread-title">{family.seniorName}</span>
                  <span className="thread-time tnum">
                    {formatThreadTime(latestInbound?.createdAtMs ?? null, nowMs)}
                  </span>
                </div>
                <div className="thread-bottom">
                  <p className="thread-preview">
                    {latestInbound
                      ? latestInbound.text
                      : "Replies from keypad SMS appear in family chat"}
                  </p>
                  <span className="sms-tag-inline">SMS</span>
                </div>
              </div>
            </button>
          )}

          {!showGroupRow && !showLolaRow && (
            <div className="empty-state">
              No chats match &ldquo;{searchQuery}&rdquo;.
            </div>
          )}
        </div>
      </main>

      <IconBottomDock
        activeTab="home"
        onSelectTab={onSelectTab}
        onCompose={onOpenChat}
      />
    </>
  );
}
