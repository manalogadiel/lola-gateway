import { useState, type FormEvent } from "react";
import { GoogleIcon } from "../components/Icons";

interface OnboardingScreenProps {
  firebaseConfigured: boolean;
  signedInUser: { uid: string; displayName: string; email: string } | null;
  busy: boolean;
  errorMessage: string | null;
  onGoogleSignIn: () => Promise<void>;
  onSwitchAccount: () => Promise<void>;
  onJoinFamily: (joinCode: string, smsNickname: string) => Promise<void>;
}

export function OnboardingScreen({
  firebaseConfigured,
  signedInUser,
  busy,
  errorMessage,
  onGoogleSignIn,
  onSwitchAccount,
  onJoinFamily,
}: OnboardingScreenProps) {
  const [roleTab, setRoleTab] = useState<"family" | "gateway">("family");
  const [joinCode, setJoinCode] = useState("");
  const [smsNickname, setSmsNickname] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (roleTab !== "family" || !signedInUser || busy) {
      return;
    }
    await onJoinFamily(joinCode, smsNickname);
  };

  return (
    <main className="onboard-screen">
      <div className="onboard-canopy">
        <h1 className="onboard-wordmark">lola gateway</h1>
        <p className="onboard-sub">Keep Lola in the family chat</p>
        <img
          className="lola-hero-img"
          src="/assets/lola-welcome.jpg"
          alt="Smiling Lola mascot waving hello"
        />
      </div>

      <div className="onboard-body">
        <div>
          <h2 className="onboard-title">
            {roleTab === "family" ? "Welcome home" : "Set up Gateway Phone"}
          </h2>
          <p className="onboard-desc">
            {roleTab === "family"
              ? "Sign in with Google, then join with your family code."
              : "The household Gateway phone runs the Lola Gateway Android app to bridge SMS."}
          </p>

          <div className="role-switch" role="tablist" aria-label="Device role">
            <button
              type="button"
              role="tab"
              aria-selected={roleTab === "family"}
              className={`role-btn${roleTab === "family" ? " active" : ""}`}
              onClick={() => setRoleTab("family")}
            >
              Family Member
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={roleTab === "gateway"}
              className={`role-btn${roleTab === "gateway" ? " active" : ""}`}
              onClick={() => setRoleTab("gateway")}
            >
              Gateway Phone
            </button>
          </div>

          {!firebaseConfigured && (
            <div className="inline-banner warn" role="status" style={{ marginBottom: 12 }}>
              This family chat link is not configured yet. Ask your family host
              for the live app link to sign in.
            </div>
          )}

          {errorMessage && (
            <div className="inline-banner error" role="alert" style={{ marginBottom: 12 }}>
              {errorMessage}
            </div>
          )}

          {roleTab === "gateway" ? (
            <div className="inline-banner info">
              Install the <strong>Lola Gateway</strong> Android APK on your household
              SIM phone to create a family group and link Lola&apos;s keypad number.
              Once set up, relatives join here with the generated code.
            </div>
          ) : (
            <form id="join-family-form" className="field-stack" onSubmit={handleSubmit}>
              <input
                className="soft-input tnum"
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Family code (e.g. LOLA-4821)"
                aria-label="Family join code"
                autoComplete="off"
                autoCapitalize="characters"
                disabled={!firebaseConfigured || busy}
              />
              <input
                className="soft-input"
                type="text"
                value={smsNickname}
                onChange={(e) => setSmsNickname(e.target.value)}
                placeholder="Short SMS name (optional, e.g. Seb)"
                aria-label="Optional short SMS nickname"
                maxLength={16}
                disabled={!firebaseConfigured || busy}
              />
            </form>
          )}
        </div>

        <div>
          {roleTab === "family" && (
            <>
              {signedInUser ? (
                <div className="signed-in-chip">
                  <span>Signed in as {signedInUser.displayName}</span>
                  <button
                    type="button"
                    className="signed-in-switch"
                    onClick={onSwitchAccount}
                    disabled={busy}
                  >
                    Switch
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="pill-cta pill-cta-white"
                  style={{ marginBottom: 10 }}
                  onClick={onGoogleSignIn}
                  disabled={!firebaseConfigured || busy}
                >
                  <GoogleIcon />
                  <span>{busy ? "Signing in..." : "Continue with Google"}</span>
                </button>
              )}

              <button
                type="submit"
                form="join-family-form"
                className="pill-cta"
                disabled={
                  !firebaseConfigured ||
                  !signedInUser ||
                  !joinCode.trim() ||
                  busy
                }
              >
                {busy ? "Joining family..." : "Join Family Chat"}
              </button>
            </>
          )}
          <span className="quiet-link">
            No app needed on Lola&apos;s keypad phone
          </span>
        </div>
      </div>
    </main>
  );
}
