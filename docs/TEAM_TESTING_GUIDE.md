# Lola Gateway: Team Testing & Next Steps Guide

This guide explains how **Basty (Bueno)** and **Georgie (Ponce)** can each set up Lola Gateway on their own Android phone, test end-to-end with their own keypad/secondary phone, and complete the remaining items before the **Nov 30 to Dec 4, 2026** defense.

## Shared Links

- **Repository (`main`):** https://github.com/manalogadiel/lola-gateway
- **Live Family Web Chat PWA:** https://lola-gateway.web.app
- **Android Gateway APK:** Ask Gadiel for the pre-built `app-debug.apk` (bundled with Firebase config and registered debug SHA-1 so Google Sign-In works immediately without extra Firebase setup).

> Note: If you build the Android APK from source on your own laptop instead of using Gadiel's pre-built `app-debug.apk`, your laptop's debug keystore SHA-1 must be added to the `lola-gateway` Firebase project first for Google Sign-In to work.

---

## Step 1: Independent Setup (Both Basty and Georgie)

Each teammate can run an independent family bridge using their own phone:

1. **Install the APK:** Install `app-debug.apk` on your own Android phone (allow "Install unknown apps" if prompted).
2. **Sign in and create your family:**
   - Open **Lola Gateway** and tap **Continue with Google**.
   - Enter your Family Name, your Lola's name, and a **separate** keypad or secondary phone number (do not use a SIM inside the same Android phone for live trials).
3. **Grant permissions & pick SIM:**
   - Approve SMS, Phone State, Notifications, and Battery Optimization prompts.
   - In **Settings > Send SMS using**, select the SIM that has an active text promo or load.
4. **Join from Web Chat:**
   - Open https://lola-gateway.web.app on another phone or laptop.
   - Sign in with Google and enter **your own Family Join Code** from your Gateway app (found on Home or Settings).
   - Send a message and confirm it arrives on Lola's phone via SMS and that Lola's SMS reply appears back in the shared chat.

---

## Step 2: Tasks for Basty (Web Chat PWA & Firebase Hosting)

### What to test
- Test https://lola-gateway.web.app on both mobile browser (also install via **Add to Home Screen** as a PWA) and desktop browser while connected to your own Gateway phone.
- Verify:
  - Light and Dark theme parity with the Android app.
  - Real-time message status transitions (`Queued` -> `Sent` -> `Delivered`).
  - Lola's inbound SMS replies render as warm yellow bubbles on the left.
  - The SMS character/segment counter stays hidden until typing and warns properly on long messages (>160 GSM-7 chars) and emojis (UCS-2).
  - Offline banner and automatic reconnect recovery when toggling Wi-Fi/data.

### What to do further
1. Pull the latest `main` branch (`git pull origin main`) to include commit `e662209` (`BUG-022`).
2. Re-deploy Firebase Hosting once ready so the latest `web-chat` changes are live:
   ```bash
   cd firebase
   firebase deploy --only hosting --project lola-gateway
   ```
3. Capture clean mobile and desktop Web Chat screenshots for the presentation slides and fix any UI or reconnect edge cases discovered during live testing.

---

## Step 3: Tasks for Georgie (QA, Live Trials & Evidence)

### What to test
Run the 5 live scenarios from `docs/qa/test-plan.md` using your own Android phone as the Gateway and a separate keypad/secondary phone as Lola:

1. **Round-trip SMS (10 trials):** Send from Web Chat -> your Gateway phone -> Lola's phone, then reply from Lola's phone -> confirm it appears in both Gateway app and Web Chat. Record send/receive latency.
2. **Long & Emoji SMS:** Send a >160-character plain text message and an emoji message; confirm multipart delivery and accurate segment counter.
3. **Wi-Fi / 4G Handoff & Offline Recovery:** Turn off Wi-Fi or toggle Airplane Mode on the Gateway phone, send a message from Web Chat, then restore internet and verify automatic queue drain.
4. **Pause Bridge & Unknown-Sender Block:**
   - Toggle **SMS Bridge** off in Settings and verify outbound messages stay queued without sending.
   - Text your Gateway SIM from a phone number that is NOT on Lola's allow-list and verify it is blocked and never appears in chat.
5. **Hidden QA Diagnostics & CSV Export:**
   - In Settings, tap `Lola Gateway 1.0` 5 times to open QA Diagnostics.
   - Run the invalid-number test and verify clean failure handling.
   - Tap **Export message CSV** (`lola-messages.csv`) and **Export handoff CSV** (`lola-handoffs.csv`).

### What to do further
1. Commit the exported CSV logs and trial screenshots into `docs/qa/trial-logs/` via a pull request to `main`.
2. Fill in the final trial summary table (average round-trip latency, delivery rate, handoff recovery time) in `docs/qa/`.
3. Record a 1-to-2-minute backup demo video showing **Web Chat -> Gateway -> Keypad Phone -> Reply** before the Nov 30 to Dec 4 defense in case classroom cellular signal is weak.
