# Lola Gateway QA Defect Log

**Repository:** `lola-gateway`  
**QA Lead:** Jyvhan Earl D. Ponce  
**Last Updated:** November 23, 2026  
**Scope:** Frontend (React PWA), Android Gateway (Plain Kotlin + Compose), Cloudflare Worker (`/notify`), Firestore Security Rules & Integrations.

---

## Defect Summary Dashboard

| Defect ID | Component | Severity | Description | Status |
|---|---|---|---|---|
| **BUG-001** | `web-chat` | High | Missing `interactive-widget=resizes-content` in viewport meta causing keyboard overlap on mobile | **RESOLVED** |
| **BUG-002** | `web-chat` | High | `ChatScreen` auto-scroll only attached to message count; misses in-place status updates and mount scroll | **RESOLVED** |
| **BUG-003** | `web-chat` | Medium | `PeopleScreen` "+ Invite" button only copied raw code without app URL or context | **RESOLVED** |
| **BUG-004** | `web-chat` | Medium | Floating dock obscuring bottom content in short-height viewports (sign-out and copy banners) | **RESOLVED** |
| **BUG-005** | `web-chat` | Low | Peeking Lola loading stage had bright `#E9EAFC` arch glitching in Dark Twilight theme | **RESOLVED** |
| **BUG-006** | `web-chat` | Low | Lola incoming bubble in dark mode had low contrast text against translucent amber background | **RESOLVED** |
| **BUG-007** | `worker` | High | `ALLOWED_ORIGINS` in `wrangler.toml` blocked local dev ports (`5174`, `127.0.0.1`) with 403 | **RESOLVED** |
| **BUG-008** | `android-gateway` | High | `SmsTransport` `PendingIntent` lacked `FLAG_UPDATE_CURRENT` & retry `attempt` in `requestCode`, dropping retry status callbacks | **RESOLVED** |
| **BUG-009** | `android-gateway` | High | Battery optimization button lacked try-catch; threw uncaught `ActivityNotFoundException` on customized OEM skins | **RESOLVED** |
| **BUG-010** | `android-gateway` | Medium | System back button in `ChatScreen` exited/backgrounded app instead of navigating to `HOME` tab | **RESOLVED** |
| **BUG-011** | `android-gateway` | High | `PhoneNormalizer` rejected common Philippine mobile format with redundant leading zero (`+6309...`) | **RESOLVED** |
| **BUG-012** | `web-chat` | Medium | Single-line `<input>` in chat composer restricts multiline composition for multi-part SMS | **RESOLVED** |
| **BUG-013** | `web-chat` | High | Cleared `localStorage` locks out existing family members due to lack of `families` collection list permissions | **RESOLVED** |
| **BUG-014** | `worker` | High | Potential 404 race condition between Web Client Firestore write and Worker REST API lookup | **RESOLVED** |
| **BUG-015** | `android-gateway` | Medium | Dual observation of Room and Firestore remote Flow in `MainActivity` causes redundant UI thread re-merges | **RESOLVED** |
| **BUG-016** | `android-gateway` | Medium | Unthrottled heartbeat publishing on every sync cycle creates redundant Firestore document writes | **RESOLVED** |
| **BUG-017** | `web-chat` | Medium | Bottom navigation tabs and screen views lacked spatial slide animations | **RESOLVED** |
| **BUG-018** | `web-chat` | Low | Buttons lacked tactile depth, elevation drop, and spring physics | **RESOLVED** |
| **BUG-019** | `web-chat` | Low | Generic OS system font stack without brand identity | **RESOLVED** |
| **BUG-020** | `web-chat` | Medium | Sterile interface lacking Lola Gateway branding & mascot presence | **RESOLVED** |
| **BUG-021** | `web-chat` | Medium | Duplicate chat rows and redundant helper labels in Home and People screens | **RESOLVED** |
| **BUG-022** | `web-chat` | Low | Navigation ref retaining stale previous view index across auth sign-out and rejoin | **RESOLVED** |

---

## Detailed Defect Reports & Applied Fixes

### BUG-001: Mobile Viewport Height & Keyboard Overlap
- **Component:** `web-chat/index.html`
- **Root Cause:** Standard `height: 100dvh` does not shrink when mobile software keyboards deploy unless `interactive-widget=resizes-content` is declared.
- **Resolution:** Added `interactive-widget=resizes-content` to `<meta name="viewport">`.

### BUG-002: Chat Stream Auto-Scroll on Message Lifecycle
- **Component:** `web-chat/src/screens/ChatScreen.tsx`
- **Root Cause:** `streamRef.scrollTop = streamRef.scrollHeight` only executed when `messages.length` changed. Status changes (`QUEUED` -> `SENT` -> `DELIVERED`) and initial cached loads did not scroll down.
- **Resolution:** Added `messagesEndRef` and smooth scroll anchor executing on `[messages]` state changes.

### BUG-003: "+ Invite" Button Missing App URL & Native Share
- **Component:** `web-chat/src/screens/PeopleScreen.tsx`
- **Root Cause:** Clicking `+ Invite` only copied `family.joinCode` (e.g. `LOLA-4821`). Relatives receiving the clipboard string received no website link or onboarding instructions.
- **Resolution:** Updated handler to invoke `navigator.share` on mobile devices with title, message, and URL; falls back to copying a formatted invitation string with `window.location.origin` and join code.

### BUG-004: Bottom Floating Dock Content Clearance
- **Component:** `web-chat/src/styles/app.css`
- **Root Cause:** `.dock-wrap` is `position: absolute; bottom: 16px; z-index: 12`. On shorter tablet or landscape viewports, the bottom of `.scroll-area` was occluded.
- **Resolution:** Expanded `.scroll-area` padding-bottom from `98px` to `112px`.

### BUG-005 & BUG-006: Dark Mode Contrast & Stage Glitch
- **Component:** `web-chat/src/styles/app.css` & `tokens.css`
- **Root Cause:** Hardcoded light background `#E9EAFC` on `.peeking-stage` created a jarring white arch in dark mode. Translucent amber bubbles had low contrast with white text.
- **Resolution:** Changed dark `.peeking-stage` background to `rgba(126, 135, 245, 0.14)` and added `#FFF2C7` with border outline to dark mode Lola bubbles.

### BUG-007: Cloudflare Worker Local Dev CORS Block
- **Component:** `worker/wrangler.toml`
- **Root Cause:** Strict `ALLOWED_ORIGINS` only permitted port 5173 on localhost. Running Vite on port 5174 or accessing via `127.0.0.1` returned HTTP 403 `ORIGIN_NOT_ALLOWED`.
- **Resolution:** Added `http://localhost:5174`, `http://127.0.0.1:5173`, and `http://127.0.0.1:5174` to allowed origins list.

### BUG-008: Android SMS PendingIntent Retry Attempt Caching Trap
- **Component:** `android-gateway/.../sms/SmsTransport.kt`
- **Root Cause:** `PendingIntent.getBroadcast` requestCode did not factor in `attempt`, and lacked `PendingIntent.FLAG_UPDATE_CURRENT`. Retried SMS transmissions (attempt > 0) reused cached attempt 0 callbacks, which were dropped by `SmsStatusHandler`.
- **Resolution:** Updated requestCode to `(messageId.hashCode() * 31 + attempt) * 31 + part` and added `PendingIntent.FLAG_UPDATE_CURRENT`.

### BUG-009: Battery Optimization Intent Crash on Customized OEMs
- **Component:** `android-gateway/.../MainActivity.kt`
- **Root Cause:** Calling `startActivity(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)` without try-catch causes unhandled `ActivityNotFoundException` on Xiaomi, Oppo, and Vivo devices where this activity is stripped or rebranded.
- **Resolution:** Wrapped with try-catch fallback to application details settings and informative toast.

### BUG-010: Android Hardware Back Navigation in Chat
- **Component:** `android-gateway/.../MainActivity.kt`
- **Root Cause:** Pressing Android hardware back button while in `GatewayTab.CHAT` exited the application rather than returning to `GatewayTab.HOME`.
- **Resolution:** Added `BackHandler(enabled = tab != GatewayTab.HOME) { tab = GatewayTab.HOME }`.

### BUG-011: Strict Phone Normalization Format (`+6309...`)
- **Component:** `android-gateway/.../data/model/PhoneNormalizer.kt`
- **Root Cause:** Regex `(?:\\+?63|0)?(9[0-9]{9})` failed to normalize user inputs where both `+63` and leading `0` were entered (`+6309171234567`).
- **Resolution:** Adjusted regex to `(?:\\+?63\\s*0?|0)?(9[0-9]{9})` and added verification test cases in `CoreDomainTest.kt`.

### BUG-012: Multiline Chat Composer
- **Component:** `web-chat/src/screens/ChatScreen.tsx`
- **Resolution:** Upgraded composer to an auto-growing multiline `<textarea>` (PR #6, `fix/bug-012-multiline-composer`).

### BUG-013: Family Session Recovery After Cleared Storage
- **Component:** `web-chat/`, `firebase/firestore.rules`
- **Resolution:** Added `users/{uid}` family pointer recovery so returning members restore their family chat automatically even after clearing `localStorage` (PR #8, `fix/bug-013-family-recovery`).

### BUG-014: Worker 404 Race on Freshly Written Messages
- **Component:** `worker/src/index.ts`, `worker/tests/notify.test.ts`
- **Root Cause:** Calling `POST /notify` immediately after Firestore `setDoc` can briefly encounter a `404` on the REST API lookup.
- **Resolution:** Added bounded 404-only retry (`250ms`, `500ms`) in `readMessageWithRetry` before returning `400 INVALID_MESSAGE`, verified with unit tests.

### BUG-015: Redundant UI-Thread Message Re-Merges
- **Component:** `android-gateway/.../MainActivity.kt`
- **Root Cause:** Collecting Room and Firestore flows separately in Compose caused redundant merges on the main thread.
- **Resolution:** Combined Room and Firestore flows via `combine(...).distinctUntilChanged().flowOn(Dispatchers.Default)` into a single collected state.

### BUG-016: Unthrottled Heartbeat Firestore Writes
- **Component:** `android-gateway/.../sync/SyncEngine.kt`, `SyncEngineTest.kt`
- **Root Cause:** Every sync cycle unconditionally called `publishHeartbeat`, wasting Firestore Spark daily writes and battery during message bursts.
- **Resolution:** Throttled routine heartbeats to a 15-minute window while still publishing immediately on first sync, family change, pause toggle, or Wi-Fi/4G transport change; verified in `SyncEngineTest`.

### BUG-017: Bottom navigation tabs and screen views lacked spatial slide animations
- **Severity:** Medium (UX Flow / Delight)
- **Component:** `web-chat/src/App.tsx`, `web-chat/src/styles/app.css`
- **Symptom:** Switching between Home, People, Settings, and Chat was an instant 0ms swap without visual continuity.
- **Resolution:** Added direction-aware tab sliding (`slide-forward`, `slide-backward`) using 220ms `--ease-slide` and vertical push/pop for the Chat view. Anchor dock at root shell to ensure stationary navigation bar.

### BUG-018: Buttons lacked tactile depth, elevation drop, and spring physics
- **Severity:** Low (Visual / Tactile Feedback)
- **Component:** `web-chat/src/styles/app.css`
- **Symptom:** Buttons had a plain flat scale of 0.96 with no elevation shift or spring rebound.
- **Resolution:** Added tactile spring physics (`cubic-bezier(0.34, 1.56, 0.64, 1)`), hover elevation lift (`translateY(-1.5px)`), and active squeeze (`scale(0.95) translateY(1px)`) across all action buttons, FAB, and dock items.

### BUG-019: Generic OS system font stack without brand identity
- **Severity:** Low (Brand Identity / Typography)
- **Component:** `web-chat/index.html`, `web-chat/src/styles/tokens.css`, `web-chat/src/styles/app.css`
- **Symptom:** Default `-apple-system` font felt like an unstyled wireframe placeholder.
- **Resolution:** Imported **Outfit** for bold, circular display headings and **Plus Jakarta Sans** for body text, chat bubbles, and tabular numeric timestamps.

### BUG-020: Sterile interface lacking Lola Gateway branding & mascot presence
- **Severity:** Medium (Brand Experience)
- **Component:** `web-chat/src/screens/HomeScreen.tsx`, `web-chat/src/styles/app.css`
- **Symptom:** Headers were sterile plain text ("Messages"), and mascot assets remained tucked away.
- **Resolution:** Added branded header with Lola mascot avatar and live status ping, "LOLA GATEWAY" brand eyebrow, and ambient Lola SMS bridge card.

### BUG-021: Duplicate chat rows and redundant helper labels
- **Severity:** Medium (User Confusion / Clutter)
- **Component:** `web-chat/src/screens/HomeScreen.tsx`, `web-chat/src/screens/PeopleScreen.tsx`, `web-chat/src/screens/ChatScreen.tsx`
- **Symptom:** HomeScreen rendered two separate chat rows ("Manalo Family" and "Lola Elena") that both opened the exact same chat thread. PeopleScreen repeated `" · SMS: \"Ate\""` on every member row.
- **Resolution:** Consolidated to 1 flagship Family Chat Card with dedicated `Lola's SMS` badge. Replaced repetitive member strings with sleek compact SMS nickname tags. Cleaned up inbound bubble sender tags.

### BUG-022: Navigation State Desynchronization Across Auth & Rejoin
- **Severity:** Low (UX Motion Consistency)
- **Component:** `web-chat/src/App.tsx`
- **Symptom:** When a user was on Settings (tab index 2), signed out, and signed back in or joined a family, `prevViewRef.current` remained at `"settings"`. Navigating to People (tab index 1) caused the view to slide backward instead of forward from Home.
- **Resolution:** Explicitly reset `prevViewRef.current = "home"` and `slideDirection = "forward"` inside `observeAuth` and `handleJoinFamily`.
