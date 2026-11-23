import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import type { MainTab } from "./components/IconBottomDock";
import {
  createLiveGatewayApiDeps,
  getFirebaseServices,
  isFirebaseConfigured,
  observeAuth,
  signInWithGoogle,
  signOutUser,
  subscribeFamily,
  subscribeMembers,
  subscribeMessages,
} from "./lib/firebase";
import { deriveDefaultNickname, getMemberPrefix } from "./lib/formatters";
import {
  deriveGatewayDisplayState,
  joinFamilyByCode,
  retryFailedMessage,
  sendOutboundMessage,
} from "./lib/gatewayApi";
import {
  createQaRecorder,
  downloadQaCsv,
  isQaModeEnabled,
} from "./lib/qaLogger";
import {
  applyDocumentTheme,
  loadThemePreference,
  resolveTheme,
  saveThemePreference,
} from "./lib/theme";
import type {
  ChatMessageDoc,
  FamilyDoc,
  FamilyMemberDoc,
  QaProps,
  SenderContext,
  ThemePreference,
} from "./lib/types";
import { ChatScreen } from "./screens/ChatScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LoadingScreen } from "./screens/LoadingScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { PeopleScreen } from "./screens/PeopleScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

type AppView = MainTab | "chat";

function familyStorageKey(uid: string): string {
  return `lola_gateway_family_${uid}`;
}

function readStoredFamilyId(uid: string): string | null {
  try {
    return window.localStorage.getItem(familyStorageKey(uid));
  } catch {
    return null;
  }
}

function writeStoredFamilyId(uid: string, familyId: string | null): void {
  try {
    if (familyId) {
      window.localStorage.setItem(familyStorageKey(uid), familyId);
    } else {
      window.localStorage.removeItem(familyStorageKey(uid));
    }
  } catch {
    // Ignore storage access failures in private browsing.
  }
}

export function App() {
  const services = useMemo(() => getFirebaseServices(), []);
  const firebaseConfigured = isFirebaseConfigured();
  const apiDeps = useMemo(
    () => (services ? createLiveGatewayApiDeps(services.auth, services.db) : null),
    [services]
  );

  const qaMode = useMemo(() => isQaModeEnabled(window.location.search), []);
  const qaRecorderRef = useRef(createQaRecorder());
  const qaSeededRef = useRef(false);
  const [qaEventCount, setQaEventCount] = useState(0);

  const [themePref, setThemePref] = useState<ThemePreference>(() =>
    loadThemePreference()
  );
  const [authReady, setAuthReady] = useState(() => !services);
  const [user, setUser] = useState<User | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [family, setFamily] = useState<FamilyDoc | null>(null);
  const [members, setMembers] = useState<FamilyMemberDoc[]>([]);
  const [messages, setMessages] = useState<ChatMessageDoc[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [syncingFamily, setSyncingFamily] = useState(false);

  const [activeView, setActiveView] = useState<AppView>("home");
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => {
      applyDocumentTheme(resolveTheme(themePref, media.matches));
    };
    syncTheme();
    media.addEventListener("change", syncTheme);
    return () => media.removeEventListener("change", syncTheme);
  }, [themePref]);

  const handleChangeTheme = useCallback((nextPref: ThemePreference) => {
    setThemePref(nextPref);
    saveThemePreference(nextPref);
  }, []);

  useEffect(() => {
    if (!services) {
      return;
    }
    return observeAuth(services.auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        setFamilyId(readStoredFamilyId(nextUser.uid));
      } else {
        setFamilyId(null);
        setFamily(null);
        setMembers([]);
        setMessages([]);
        setMessagesLoaded(false);
        qaSeededRef.current = false;
        setActiveView("home");
      }
    });
  }, [services]);

  useEffect(() => {
    if (!services || !user || !familyId) {
      setSyncingFamily(false);
      return;
    }

    setSyncingFamily(true);
    setMessagesLoaded(false);
    qaSeededRef.current = false;
    setOnboardingError(null);

    const handleSubError = () => {
      writeStoredFamilyId(user.uid, null);
      setFamilyId(null);
      setFamily(null);
      setMembers([]);
      setMessages([]);
      setMessagesLoaded(false);
      setSyncingFamily(false);
      setOnboardingError(
        "Could not access that family group. Enter your family code to rejoin."
      );
    };

    const unsubFamily = subscribeFamily(
      services.db,
      familyId,
      (docData) => {
        if (!docData) {
          handleSubError();
          return;
        }
        setFamily(docData);
        setSyncingFamily(false);
      },
      handleSubError
    );

    const unsubMembers = subscribeMembers(
      services.db,
      familyId,
      (list) => setMembers(list),
      () => {
        // Family listener owns access revocation recovery.
      }
    );

    const unsubMessages = subscribeMessages(
      services.db,
      familyId,
      (list) => {
        setMessages(list);
        setMessagesLoaded(true);
      },
      () => {
        // Family listener owns access revocation recovery.
      }
    );

    if (apiDeps) {
      void apiDeps.store
        .updateMemberProfile(familyId, user.uid, { lastActiveMs: Date.now() })
        .catch(() => {
          // Non-fatal activity touch.
        });
    }

    return () => {
      unsubFamily();
      unsubMembers();
      unsubMessages();
    };
  }, [services, apiDeps, user, familyId]);

  // Post-render QA timestamp observation: seeds initial history once, then logs live events.
  useEffect(() => {
    if (!qaMode || !messagesLoaded) {
      return;
    }
    const seedOnly = !qaSeededRef.current;
    qaSeededRef.current = true;
    qaRecorderRef.current.observeMessages(messages, Date.now(), { seedOnly });
    setQaEventCount(qaRecorderRef.current.getEvents().length);
  }, [qaMode, messagesLoaded, messages]);

  const currentMember = useMemo(
    () => (user ? members.find((m) => m.uid === user.uid) ?? null : null),
    [members, user]
  );

  const senderSmsNickname = useMemo(() => {
    if (currentMember) {
      return getMemberPrefix(currentMember);
    }
    return deriveDefaultNickname(user?.displayName ?? "Family");
  }, [currentMember, user]);

  const senderContext = useMemo<SenderContext | null>(() => {
    if (!user || !familyId) {
      return null;
    }
    return {
      familyId,
      senderUid: user.uid,
      senderName: senderSmsNickname,
    };
  }, [user, familyId, senderSmsNickname]);

  const gatewayDisplay = useMemo(
    () => deriveGatewayDisplayState(family?.gateway, nowMs),
    [family?.gateway, nowMs]
  );

  const handleExportQaCsv = useCallback(() => {
    downloadQaCsv(qaRecorderRef.current.getEvents());
  }, []);

  const qaProps = useMemo<QaProps>(
    () => ({
      enabled: qaMode,
      eventCount: qaEventCount,
      onExportCsv: handleExportQaCsv,
    }),
    [qaMode, qaEventCount, handleExportQaCsv]
  );

  const handleGoogleSignIn = useCallback(async () => {
    if (!services) {
      return;
    }
    setOnboardingBusy(true);
    setOnboardingError(null);
    try {
      await signInWithGoogle(services.auth);
    } catch (error) {
      setOnboardingError(
        error instanceof Error
          ? error.message
          : "Google Sign-In did not complete."
      );
    } finally {
      setOnboardingBusy(false);
    }
  }, [services]);

  const handleSignOut = useCallback(async () => {
    if (!services) {
      return;
    }
    setOnboardingError(null);
    await signOutUser(services.auth);
  }, [services]);

  const handleJoinFamily = useCallback(
    async (rawCode: string, nicknameInput: string) => {
      if (!apiDeps || !user) {
        return;
      }
      setOnboardingBusy(true);
      setOnboardingError(null);
      try {
        const joinedFamilyId = await joinFamilyByCode(
          rawCode,
          {
            uid: user.uid,
            displayName: user.displayName || user.email || "Family Member",
          },
          nicknameInput,
          apiDeps
        );
        writeStoredFamilyId(user.uid, joinedFamilyId);
        setFamilyId(joinedFamilyId);
        setActiveView("home");
      } catch (error) {
        setOnboardingError(
          error instanceof Error ? error.message : "Could not join family."
        );
      } finally {
        setOnboardingBusy(false);
      }
    },
    [apiDeps, user]
  );

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!apiDeps || !senderContext) {
        return;
      }
      await sendOutboundMessage(senderContext, text, apiDeps);
    },
    [apiDeps, senderContext]
  );

  const handleRetryMessage = useCallback(
    async (failedMessage: ChatMessageDoc) => {
      if (!apiDeps || !senderContext) {
        return;
      }
      await retryFailedMessage(failedMessage, senderContext, apiDeps);
    },
    [apiDeps, senderContext]
  );

  const handleUpdateNickname = useCallback(
    async (nickname: string) => {
      if (!apiDeps || !user || !familyId) {
        return;
      }
      await apiDeps.store.updateMemberProfile(familyId, user.uid, {
        smsNickname: nickname,
        lastActiveMs: Date.now(),
      });
    },
    [apiDeps, user, familyId]
  );

  let screen: React.ReactNode;

  if (!authReady || (user && familyId && (syncingFamily || !family))) {
    screen = <LoadingScreen />;
  } else if (!user || !familyId || !family) {
    screen = (
      <OnboardingScreen
        firebaseConfigured={firebaseConfigured}
        signedInUser={
          user
            ? {
                uid: user.uid,
                displayName: user.displayName || user.email || "Google User",
                email: user.email || "",
              }
            : null
        }
        busy={onboardingBusy}
        errorMessage={onboardingError}
        onGoogleSignIn={handleGoogleSignIn}
        onSwitchAccount={handleSignOut}
        onJoinFamily={handleJoinFamily}
      />
    );
  } else if (activeView === "chat") {
    screen = (
      <ChatScreen
        family={family}
        messages={messages}
        currentUid={user.uid}
        senderSmsNickname={senderSmsNickname}
        gatewayDisplay={gatewayDisplay}
        qa={qaProps}
        onBack={() => setActiveView("home")}
        onSendMessage={handleSendMessage}
        onRetryMessage={handleRetryMessage}
      />
    );
  } else if (activeView === "people") {
    screen = (
      <PeopleScreen
        family={family}
        members={members}
        currentUid={user.uid}
        gatewayDisplay={gatewayDisplay}
        nowMs={nowMs}
        onSelectTab={setActiveView}
        onOpenChat={() => setActiveView("chat")}
      />
    );
  } else if (activeView === "settings") {
    screen = (
      <SettingsScreen
        family={family}
        currentMember={currentMember}
        fallbackDisplayName={user.displayName || user.email || "Family Member"}
        gatewayDisplay={gatewayDisplay}
        themePref={themePref}
        qa={qaProps}
        onChangeTheme={handleChangeTheme}
        onUpdateNickname={handleUpdateNickname}
        onSignOut={handleSignOut}
        onSelectTab={setActiveView}
        onOpenChat={() => setActiveView("chat")}
      />
    );
  } else {
    screen = (
      <HomeScreen
        family={family}
        members={members}
        messages={messages}
        gatewayDisplay={gatewayDisplay}
        nowMs={nowMs}
        onSelectTab={setActiveView}
        onOpenChat={() => setActiveView("chat")}
      />
    );
  }

  return (
    <div className="app-viewport">
      <div className="app-shell">{screen}</div>
    </div>
  );
}
