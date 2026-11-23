import { useState, type FormEvent } from "react";
import { IconBottomDock, type MainTab } from "../components/IconBottomDock";
import { StatusDot } from "../components/StatusDot";
import {
  formatTimeShort,
  getInitials,
  pickAvatarTone,
} from "../lib/formatters";
import { maskPhoneE164, type GatewayDisplayState } from "../lib/gatewayApi";
import type {
  FamilyDoc,
  FamilyMemberDoc,
  ThemePreference,
} from "../lib/types";

interface SettingsScreenProps {
  family: FamilyDoc;
  currentMember: FamilyMemberDoc | null;
  fallbackDisplayName: string;
  gatewayDisplay: GatewayDisplayState;
  themePref: ThemePreference;
  qaMode: boolean;
  qaEventCount: number;
  onChangeTheme: (pref: ThemePreference) => void;
  onUpdateNickname: (nickname: string) => Promise<void>;
  onExportQaCsv: () => void;
  onSignOut: () => Promise<void>;
  onSelectTab: (tab: MainTab) => void;
  onOpenChat: () => void;
}

export function SettingsScreen({
  family,
  currentMember,
  fallbackDisplayName,
  gatewayDisplay,
  themePref,
  qaMode,
  qaEventCount,
  onChangeTheme,
  onUpdateNickname,
  onExportQaCsv,
  onSignOut,
  onSelectTab,
  onOpenChat,
}: SettingsScreenProps) {
  const displayName = currentMember?.displayName || fallbackDisplayName;
  const currentNickname =
    currentMember?.smsNickname || displayName.split(/\s+/)[0] || "Family";

  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState(currentNickname);
  const [savingNickname, setSavingNickname] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const tone = pickAvatarTone(currentMember?.uid || displayName);

  const handleSaveNickname = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = nicknameDraft.trim();
    if (!trimmed || savingNickname) {
      return;
    }
    setSavingNickname(true);
    setErrorMsg(null);
    try {
      await onUpdateNickname(trimmed);
      setEditingNickname(false);
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "Could not update SMS name."
      );
    } finally {
      setSavingNickname(false);
    }
  };

  const handleCopyCode = async () => {
    if (!family.joinCode) {
      return;
    }
    try {
      await navigator.clipboard.writeText(family.joinCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures in restricted contexts.
    }
  };

  const batteryText = family.gateway.batteryPercent
    ? ` · ${family.gateway.batteryPercent}%${family.gateway.isCharging ? " charging" : ""}`
    : "";

  return (
    <>
      <header className="top-chrome">
        <div className="nav-bar">
          <h1 className="app-h1">Settings</h1>
        </div>
      </header>

      <main className="scroll-area">
        {errorMsg && (
          <div className="inline-banner error" role="alert" style={{ marginBottom: 14 }}>
            {errorMsg}
          </div>
        )}

        <div className="profile-banner">
          <div
            className={`avatar-init avatar-tone-${tone}`}
            style={{ width: 46, height: 46, flexShrink: 0, fontSize: 16 }}
          >
            {getInitials(displayName)}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="setting-title">{displayName}</div>
            {!editingNickname ? (
              <div className="setting-sub">
                Shown to {family.seniorName.split(/\s+/)[0] || "Lola"} as &ldquo;
                {currentNickname}&rdquo;
              </div>
            ) : (
              <form className="nickname-edit-form" onSubmit={handleSaveNickname}>
                <input
                  className="nickname-input"
                  type="text"
                  value={nicknameDraft}
                  onChange={(e) => setNicknameDraft(e.target.value)}
                  maxLength={16}
                  aria-label="Short SMS nickname"
                  autoFocus
                />
                <button
                  type="submit"
                  className="action-link"
                  disabled={savingNickname || !nicknameDraft.trim()}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="action-link"
                  style={{ color: "var(--ink-secondary)" }}
                  onClick={() => {
                    setNicknameDraft(currentNickname);
                    setEditingNickname(false);
                  }}
                >
                  Cancel
                </button>
              </form>
            )}
          </div>
          {!editingNickname && (
            <button
              type="button"
              className="action-link"
              onClick={() => {
                setNicknameDraft(currentNickname);
                setEditingNickname(true);
              }}
            >
              Edit
            </button>
          )}
        </div>

        <div className="section-row-head">
          <span className="section-label">Family &amp; Lola</span>
        </div>
        <div className="group-card">
          <div className="setting-row">
            <div>
              <div className="setting-title">{family.seniorName}</div>
              <div className="setting-sub tnum">
                {maskPhoneE164(family.seniorPhoneE164)} · Allowed sender
              </div>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-title">Family Join Code</div>
              <div className="setting-sub tnum">{family.joinCode}</div>
            </div>
            <button
              type="button"
              className="action-link"
              onClick={handleCopyCode}
              aria-live="polite"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="section-row-head">
          <span className="section-label">Gateway Bridge</span>
        </div>
        <div className="group-card">
          <div className="setting-row">
            <div>
              <div className="setting-title">SMS Bridge Health</div>
              <div className="setting-sub tnum">
                {gatewayDisplay.detail}
                {batteryText}
              </div>
            </div>
            <StatusDot tone={gatewayDisplay.tone} label={gatewayDisplay.label} />
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-title">Last Heartbeat</div>
              <div className="setting-sub tnum">
                {family.gateway.lastHeartbeatMs
                  ? formatTimeShort(family.gateway.lastHeartbeatMs)
                  : "Waiting for Gateway phone"}
              </div>
            </div>
          </div>
        </div>

        <div className="section-row-head">
          <span className="section-label">Preferences</span>
        </div>
        <div className="group-card">
          <div className="setting-row">
            <div>
              <div className="setting-title">Appearance</div>
              <div className="setting-sub">
                {themePref === "auto"
                  ? "Follows system theme"
                  : themePref === "light"
                    ? "Light Cream"
                    : "Dark Twilight"}
              </div>
            </div>
            <div className="theme-seg" role="radiogroup" aria-label="Theme">
              {(["auto", "light", "dark"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={themePref === option}
                  className={`theme-seg-btn${themePref === option ? " active" : ""}`}
                  onClick={() => onChangeTheme(option)}
                >
                  {option[0].toUpperCase() + option.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {qaMode && (
          <>
            <div className="section-row-head">
              <span className="section-label">QA Trial Logger (?qa=1)</span>
            </div>
            <div className="group-card">
              <div className="setting-row">
                <div>
                  <div className="setting-title">Browser Latency Log</div>
                  <div className="setting-sub tnum">
                    {qaEventCount} observed message events
                  </div>
                </div>
                <button
                  type="button"
                  className="action-link"
                  onClick={onExportQaCsv}
                >
                  Export CSV
                </button>
              </div>
            </div>
          </>
        )}

        <button type="button" className="signout-btn" onClick={onSignOut}>
          Sign Out
        </button>
      </main>

      <IconBottomDock
        activeTab="settings"
        onSelectTab={onSelectTab}
        onCompose={onOpenChat}
      />
    </>
  );
}
