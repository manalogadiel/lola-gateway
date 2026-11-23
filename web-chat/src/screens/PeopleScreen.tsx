import { IconBottomDock, type MainTab } from "../components/IconBottomDock";
import { ChatIcon } from "../components/Icons";
import { StatusDot } from "../components/StatusDot";
import {
  formatMemberPresence,
  getInitials,
  getMemberPrefix,
  isMemberActive,
  maskPhoneE164,
  pickAvatarTone,
} from "../lib/formatters";
import type { GatewayDisplayState } from "../lib/gatewayApi";
import { useCopyFeedback } from "../lib/useCopyFeedback";
import type { FamilyDoc, FamilyMemberDoc } from "../lib/types";

interface PeopleScreenProps {
  family: FamilyDoc;
  members: FamilyMemberDoc[];
  currentUid: string;
  gatewayDisplay: GatewayDisplayState;
  nowMs: number;
  onSelectTab: (tab: MainTab) => void;
  onOpenChat: () => void;
}

const SENIOR_STATUS_BY_STATE: Record<GatewayDisplayState["state"], string> = {
  online: "Reachable via SMS",
  cellular_backup: "Reachable via 4G SMS",
  paused: "Paused · texts queue",
  offline: "Gateway offline",
};

export function PeopleScreen({
  family,
  members,
  currentUid,
  gatewayDisplay,
  nowMs,
  onSelectTab,
  onOpenChat,
}: PeopleScreenProps) {
  const { copied, copy } = useCopyFeedback();

  return (
    <>
      <header className="top-chrome">
        <div className="nav-bar">
          <h1 className="app-h1">People</h1>
          <button
            type="button"
            className="invite-text-btn"
            onClick={() => copy(family.joinCode)}
          >
            {copied ? "Code Copied" : "+ Invite"}
          </button>
        </div>
      </header>

      <main className="scroll-area">
        <div className="section-row-head">
          <span className="section-label">Linked Keypad Senior</span>
        </div>

        <div className="senior-card">
          <img
            className="senior-card-avatar"
            src="/assets/lola-avatar.jpg"
            alt={family.seniorName}
          />
          <div className="senior-card-mid">
            <div className="senior-card-name">{family.seniorName}</div>
            <div className="senior-card-num tnum">
              {maskPhoneE164(family.seniorPhoneE164)}
            </div>
            <StatusDot
              tone={gatewayDisplay.tone}
              label={SENIOR_STATUS_BY_STATE[gatewayDisplay.state]}
              compact
            />
          </div>
          <button
            type="button"
            className="msg-icon-btn"
            aria-label={`Message ${family.seniorName}`}
            onClick={onOpenChat}
          >
            <ChatIcon filled />
          </button>
        </div>

        <div className="section-row-head">
          <span className="section-label">Family Members</span>
          <span className="section-meta tnum">{members.length} joined</span>
        </div>

        <div className="group-card">
          {members.map((member) => {
            const tone = pickAvatarTone(member.uid);
            const active = isMemberActive(member.lastActiveMs, nowMs);
            const prefix = getMemberPrefix(member);
            const parts: string[] = [];
            if (member.uid === currentUid) {
              parts.push("You");
            }
            if (member.role === "GATEWAY") {
              parts.push("Gateway Host");
            } else if (member.uid !== currentUid) {
              parts.push(formatMemberPresence(member.lastActiveMs, nowMs));
            }
            parts.push(`SMS: "${prefix}"`);

            return (
              <div key={member.uid} className="member-row">
                <div className={`member-av avatar-tone-${tone}`}>
                  {getInitials(member.displayName)}
                  {active && <span className="member-dot" aria-hidden="true" />}
                </div>
                <div className="member-mid">
                  <div className="member-name">{member.displayName}</div>
                  <div className="member-role">{parts.join(" · ")}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="invite-card">
          <div>
            <div className="setting-sub" style={{ margin: 0 }}>
              Family Join Code
            </div>
            <div className="invite-code-val tnum">{family.joinCode}</div>
          </div>
          <button
            type="button"
            className="copy-pill-sm"
            onClick={() => copy(family.joinCode)}
            aria-live="polite"
          >
            {copied ? "Copied" : "Copy Code"}
          </button>
        </div>
      </main>

      <IconBottomDock
        activeTab="people"
        onSelectTab={onSelectTab}
        onCompose={onOpenChat}
      />
    </>
  );
}
