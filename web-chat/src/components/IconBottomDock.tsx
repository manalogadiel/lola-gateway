import { ChatIcon, ComposeIcon, PeopleIcon, SettingsIcon } from "./Icons";

export type MainTab = "home" | "people" | "settings";

interface IconBottomDockProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  onCompose: () => void;
}

export function IconBottomDock({
  activeTab,
  onSelectTab,
  onCompose,
}: IconBottomDockProps) {
  return (
    <div className="dock-wrap">
      <nav className="icon-dock" aria-label="Main navigation">
        <button
          type="button"
          className={`dock-btn${activeTab === "home" ? " active" : ""}`}
          aria-label="Chats"
          aria-current={activeTab === "home" ? "page" : undefined}
          onClick={() => onSelectTab("home")}
        >
          <ChatIcon filled={activeTab === "home"} />
        </button>
        <button
          type="button"
          className={`dock-btn${activeTab === "people" ? " active" : ""}`}
          aria-label="People"
          aria-current={activeTab === "people" ? "page" : undefined}
          onClick={() => onSelectTab("people")}
        >
          <PeopleIcon active={activeTab === "people"} />
        </button>
        <button
          type="button"
          className={`dock-btn${activeTab === "settings" ? " active" : ""}`}
          aria-label="Settings"
          aria-current={activeTab === "settings" ? "page" : undefined}
          onClick={() => onSelectTab("settings")}
        >
          <SettingsIcon active={activeTab === "settings"} />
        </button>
      </nav>
      <button
        type="button"
        className="dock-primary-right"
        aria-label="Open family chat"
        title="Message family"
        onClick={onCompose}
      >
        <ComposeIcon />
      </button>
    </div>
  );
}
