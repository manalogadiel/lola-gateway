# Lola Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and evaluate Lola Gateway, a plain Kotlin Android SMS gateway paired with a zero-card Cloudflare Worker push trigger, Firebase Spark backend, and standalone React PWA family group chat.

**Architecture:** Relatives send messages in a standalone React PWA that writes a `QUEUED` document to Firestore and calls a Cloudflare Worker (`POST /notify`) to fire a high-priority FCM HTTP v1 wake push to the household Android Gateway phone. The Kotlin Android app persists messages in Room with an atomic dispatch lock, sends single or multipart SMS via `SmsManager` (Dual-SIM safe), tracks `Sent` / `Pending` / `Delivered` / `Failed` callbacks, filters inbound SMS through an E.164 allow-list, and recovers from Wi-Fi/4G handoffs via `NetworkCallback` + `WorkManager` Firestore catch-up.

**Tech Stack:** Plain Kotlin + Jetpack Compose + Room (KSP) + WorkManager + DataStore + Firebase BoM (Auth, Firestore, Messaging) + Android Credential Manager (`minSdk 26`, `compileSdk 35`, `targetSdk 35`); TypeScript Cloudflare Worker (`wrangler`, Vitest); Firebase Spark (`firestore.rules`); React + Vite + TypeScript PWA (Vitest).

**Spec:** `docs/superpowers/specs/2026-11-20-lola-gateway-design.md`

---

## Global Constraints

- **Backend Cost Ceiling:** Strictly zero-card free tier (`Firebase Spark` + `Cloudflare Workers` free tier). Never introduce Blaze-only features (Firebase Cloud Functions, Firebase Phone Auth, Realtime Database sockets).
- **Android Platform Floors:** `minSdk = 26`, `compileSdk = 35`, `targetSdk = 35`, JDK 21 LTS, manual `AppContainer` DI (no Hilt/KAPT). Install via `adb install`.
- **Single Shared Family Chat & Role Split:** One SMS-linked family group chat (`families/{familyId}/messages/{messageId}`); tapping Lola or Compose opens that shared chat. The Kotlin Android app runs on the Gateway phone (including full Family Chat UI for the host); relatives use the React PWA.
- **Zero-Duplicate SMS & Privacy Rules:** Never auto-resend an SMS solely because a delivery report is missing (hold in `PENDING`). Never store inbound SMS body text from numbers outside `allowListE164` (RA 10173 compliance).
- **UI & Copy Rules:** Borderless elevated surfaces, Light Cream (`#F8F5EF`) & Dark Twilight (`#0E0D16`) themes, cute Lola mascot assets (`docs/ui/assets/`), icon-only 3-tab bottom dock (`Chats`, `People`, `Settings`) with right Compose button, no Queue tab, user-only Settings (QA diagnostics strictly hidden behind 5-tap version gesture), SMS segment meter hidden until typing.
- **Public Repo Hygiene:** Never commit `.env`, `.dev.vars`, `*service-account*.json`, `local.properties`, or signing keystores.

## Review Focus

1. **Multipart inbound SMS PDU reassembly:** An inbound reply from Lola longer than 160 GSM-7 chars arrives as multiple PDUs in one `SMS_RECEIVED` broadcast; the receiver must concatenate parts by originating address before hashing `in_<sha256>` and saving to Room, or one reply duplicates into multiple chat bubbles (pinned in **Task 7**).
2. **Concurrent FCM wake + `NetworkMonitor` catch-up race:** If FCM and `SyncEngineWorker` process the same `QUEUED` `messageId` simultaneously, Room's `OnConflictStrategy.IGNORE` plus an atomic `@Transaction` claim (`READY -> DISPATCHING`) must ensure `SmsSender.send()` runs strictly once (pinned in **Task 6**).
3. **Cross-client GSM-7 vs. UCS-2 segment parity:** Non-GSM characters (smart quotes, emojis, special symbols) shrink SMS capacity from 160/153 to 70/67; Kotlin `SmsSegmentCalculator` and React `smsCounter.ts` must compute identical encoding and part counts including the `"Name: "` prefix (pinned in **Tasks 4 & 9**).
4. **Philippine phone number normalization mismatch:** User input (`0917 123 4567`) vs. telco PDU sender (`+639171234567` or `639171234567`) must normalize identically to strict `+639XXXXXXXXX` E.164 before allow-list checks, or Lola's replies get silently dropped (pinned in **Tasks 4 & 7**).
5. **Android 14+ explicit `PendingIntent` & multipart `requestCode` collision:** Every `SmsManager` part must use an explicit `Intent` (`setPackage`) and a unique `requestCode` (`messageId.hashCode() * 31 + partIndex`) so Android 14+ does not throw `SecurityException` and Part 2 never overwrites Part 1's extras (pinned in **Task 7**).

---

## Team Parallel Schedule (Who Works When)

| Wave & Dates | Manalo (`android-gateway/`, `worker/`) | Bueno (`web-chat/`, `firebase/`) | Ponce (`docs/qa/`) | Sync Point / Unlock |
|---|---|---|---|---|
| **Wave 0 (Nov 20-21)** | **Task 1:** Provision Firebase Spark + Cloudflare account; run 5-SMS live PH telco DLR smoke test. | Read spec + `docs/TEAM_DISTRIBUTION.md`; prep local Node/Firebase CLI. | **Task 1 (co-own):** Prep keypad phone + 2 SIMs (Globe/Smart text promos + Gateway data); start **Task 5** test plan. | Firebase config + real telco DLR behavior confirmed. |
| **Wave 1 (Nov 21-22)** | **Task 3:** Cloudflare Worker `/notify` (`feat/worker-push`).<br>**Task 4:** Kotlin scaffold + pure domain models (`feat/android-gateway`). | **Task 2:** `firestore.rules` + indexes + rule tests (`feat/firebase-rules`). | **Task 5:** Finish `docs/qa/test-plan.md` & `defect-log.md` (`qa/evaluation-trials`). | Merge Tasks 2, 3, 4, 5 to `main`. Worker URL live for Bueno. |
| **Wave 2 (Nov 22-24)** | **Task 6:** Room queue + atomic lock.<br>**Task 7:** `SmsSender`, Dual-SIM, receivers, allow-list, 10s `Pending`.<br>**Task 8:** FCM wake, short FGS, `SyncEngineWorker`, `NetworkMonitor`. | **Task 9:** Standalone React PWA Family Chat (Google Sign-In, Home, People, Chat, live SMS meter, inline statuses, Retry, `?qa=1` logger) (`feat/web-chat`). | Review merged features; verify emulator/device setup for trials. | Core Android engine + full Web PWA working independently. |
| **Wave 3 (Nov 24-25)** | **Task 10:** 6 Jetpack Compose screens + hidden 5-tap QA CSV exporter + Host local-send path. | Connect Web PWA to live Worker URL & deployed `firestore.rules`; verify Light/Dark mobile responsiveness. | Run pre-integration UI & permission checklist on Gateway phone. | Merge Tasks 9 & 10 to `main`. |
| **Wave 4 (Nov 25-26)** | **Task 11 (All):** Full end-to-end integration test (Web -> Worker -> FCM -> Gateway -> Keypad -> Gateway -> Web, Pause/Resume drain, Retry, Dual-SIM). | **Task 11 (All):** Fix web/rules integration bugs. | **Task 11 (All):** Sign off integration smoke test before formal trials. | Release candidate APK (`adb install`) + hosted PWA ready. |
| **Wave 5 (Nov 26-Dec 4)** | Support handoff trials; fix defects; lead final demo. | Fix defects; compile final project report (use updated `Lola Gateway` diagrams). | **Task 12:** Run 100 outbound + 100 inbound (2 telcos), 30 handoff/outage, 100 status checks, 8-hr battery test; publish `docs/qa/evaluation-summary.md`. | Final report submitted & live demo delivered. |

---

## Wave 0: Hardware Gate & Cloud Provisioning (Nov 20-21)

### Task 1: Provision Firebase Spark, Cloudflare Account & Live Telco DLR Smoke Test
**Owner:** Manalo + Ponce | **Branch:** N/A (Ops & Docs)

**Files:**
- Create: `docs/qa/day1-hardware-check.md`

**Interfaces:**
- Produces: Firebase Web config (`VITE_FIREBASE_*` env keys), Android `google-services.json` (kept local, shared privately with team), Cloudflare Worker deploy account, and recorded PH telco DLR baseline (Globe & Smart).

- [ ] **Step 1: Create Firebase Spark project `lola-gateway`**
  Enable Authentication (Google provider), Cloud Firestore (production mode, `asia-southeast1`), and Cloud Messaging (FCM). Add Android app (`dev.lolagateway` + debug SHA-1) and Web app (`lola-gateway-web`).
- [ ] **Step 2: Download Service Account JSON locally (outside repo)**
  Store outside `lola-gateway/` so Git never tracks it. Keep `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` ready for `wrangler secret put` in Task 3.
- [ ] **Step 3: Run 5-SMS live hardware & telco DLR smoke test**
  Verify Gateway Android phone, keypad phone cellular signal (record 2G/3G/4G VoLTE), and 2 SIM cards (Globe + Smart) with text promos and Gateway prepaid data. Send 3 test SMS with keypad ON and 2 with keypad OFF; observe whether carrier delivery reports arrive on each SIM.
- [ ] **Step 4: Record findings in `docs/qa/day1-hardware-check.md` and commit**
  Document handset models, Android version, carrier network types, and observed DLR timing.
  ```bash
  git add docs/qa/day1-hardware-check.md
  git commit -m "docs(qa): record day 1 hardware and telco dlr check"
  ```

---

## Wave 1: Parallel Foundations (Nov 21-22)

### Task 2: Firestore Security Rules & Composite Indexes
**Owner:** Bueno | **Branch:** `feat/firebase-rules`

**Files:**
- Create: `firebase/firebase.json`
- Create: `firebase/firestore.rules`
- Create: `firebase/firestore.indexes.json`
- Create: `firebase/package.json`
- Test: `firebase/tests/firestore.rules.test.mjs`

**Interfaces:**
- Produces: Enforced Firestore schema contract from Spec Section 6.2 & 6.7 (`joinCodes/{code}`, `families/{familyId}`, `members/{uid}`, `messages/{messageId}`).

- [ ] **Step 1: Write failing Firestore rules tests in `firebase/tests/firestore.rules.test.mjs`**
  Use `@firebase/rules-unit-testing` to assert:
  1. Unauthenticated reads/writes are denied everywhere.
  2. Authenticated non-member can `get` `joinCodes/LOLA-4821` but `list` on `joinCodes` is denied.
  3. Family member can read `families/{id}` and create an `OUTBOUND` message where `senderUid == auth.uid` and `status == "QUEUED"`, but is denied `update` on any message or `create` with `direction == "INBOUND"`.
  4. Gateway UID (`families/{id}.gateway.uid`) can update `gateway` fields, `allowListE164`, message statuses (`SENT`, `PENDING`, `DELIVERED`, `FAILED`), and create `INBOUND` messages.
- [ ] **Step 2: Run tests to verify they fail**
  Run: `cd firebase && firebase emulators:exec --only firestore "npm test"`
  Expected: FAIL (missing `firestore.rules`).
- [ ] **Step 3: Implement `firebase/firestore.rules` and `firebase/firestore.indexes.json`**
  Add composite index on `messages` (`direction ASC, status ASC, createdAt ASC`) for Gateway catch-up queries and (`createdAt ASC`) for chat streams. Enforce every rule pinned in Step 1.
- [ ] **Step 4: Run tests to verify all pass**
  Run: `cd firebase && firebase emulators:exec --only firestore "npm test"`
  Expected: PASS (all rule assertions green).
- [ ] **Step 5: Deploy rules to Firebase Spark and commit**
  Run: `cd firebase && firebase deploy --only firestore:rules,firestore:indexes`
  ```bash
  git add firebase/
  git commit -m "feat(firebase): add firestore security rules and tests"
  ```

### Task 3: Cloudflare Worker FCM HTTP v1 Push Trigger
**Owner:** Manalo | **Branch:** `feat/worker-push`

**Files:**
- Create: `worker/package.json`
- Create: `worker/wrangler.toml`
- Create: `worker/tsconfig.json`
- Create: `worker/src/auth.ts`
- Create: `worker/src/fcm.ts`
- Create: `worker/src/index.ts`
- Test: `worker/tests/notify.test.ts`

**Interfaces:**
- Consumes: Firestore REST API (`families/{familyId}`, `members/{uid}`), Google JWKS certs, FCM HTTP v1 endpoint.
- Produces: `POST /notify` accepting `Authorization: Bearer <Firebase ID Token>` and `{ familyId: string, messageId: string }`, returning `200 { ok: true, skipped?: "PAUSED" | "NO_TOKEN" }` or `401`/`403`/`400`.

- [ ] **Step 1: Write failing Worker unit tests in `worker/tests/notify.test.ts`**
  Using Vitest with mocked `fetch` and token verifier, assert:
  1. Missing or invalid `Authorization` header returns `401`.
  2. Authenticated caller not in `families/{familyId}/members/{uid}` returns `403`.
  3. Valid member when `gateway.status == "PAUSED"` returns `200 { ok: true, skipped: "PAUSED" }` without calling FCM.
  4. Valid member when gateway is `ONLINE` calls FCM HTTP v1 with `android.priority = "HIGH"` and `data: { familyId, messageId }`, returning `200 { ok: true }`.
  5. `OPTIONS` preflight returns CORS headers for allowed web origin.
- [ ] **Step 2: Run tests to verify they fail**
  Run: `cd worker && npm test`
  Expected: FAIL (modules not found).
- [ ] **Step 3: Implement `verifyFirebaseIdToken` (`auth.ts`), `mintGoogleAccessToken` & `sendHighPriorityFcm` (`fcm.ts`), and `fetch` handler (`index.ts`)**
  Use Web Crypto API (`crypto.subtle` RS256) with zero Node polyfills so Worker cold start stays ~0.2s.
- [ ] **Step 4: Run tests to verify all pass**
  Run: `cd worker && npm test`
  Expected: PASS.
- [ ] **Step 5: Set secrets via Wrangler, deploy, and commit**
  Run: `cd worker && npx wrangler secret put FIREBASE_PROJECT_ID` (repeat for `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) then `npx wrangler deploy`.
  ```bash
  git add worker/
  git commit -m "feat(worker): add zero-card fcm http v1 notify worker"
  ```

### Task 4: Plain Kotlin Android Scaffold & Core Pure Domain Logic
**Owner:** Manalo | **Branch:** `feat/android-gateway`

**Files:**
- Create: `android-gateway/settings.gradle.kts`, `build.gradle.kts`, `gradle/libs.versions.toml`
- Create: `android-gateway/app/build.gradle.kts`, `app/src/main/AndroidManifest.xml`
- Create: `android-gateway/app/src/main/java/dev/lolagateway/data/model/MessageStatus.kt`
- Create: `android-gateway/app/src/main/java/dev/lolagateway/data/model/PhoneNormalizer.kt`
- Create: `android-gateway/app/src/main/java/dev/lolagateway/data/model/SmsSegmentCalculator.kt`
- Create: `android-gateway/app/src/main/java/dev/lolagateway/data/model/InboundIdGenerator.kt`
- Test: `android-gateway/app/src/test/java/dev/lolagateway/data/model/CoreDomainTest.kt`

**Interfaces:**
- Produces:
  - `enum class MessageStatus { QUEUED, SENT, PENDING, DELIVERED, FAILED }` + `fun MessageStatus.canTransitionTo(next: MessageStatus): Boolean`
  - `object PhoneNormalizer { fun toPhE164(raw: String): String?; fun isAllowListed(raw: String, allowListE164: Set<String>): Boolean }`
  - `data class SmsSegmentation(val encoding: SmsEncoding, val segmentCount: Int, val parts: List<String>, val formattedText: String)`
  - `object SmsSegmentCalculator { fun formatAndSegment(senderName: String, body: String): SmsSegmentation }`
  - `object InboundIdGenerator { fun generate(senderE164: String, smsTimestampMs: Long, body: String): String }`

- [ ] **Step 1: Scaffold Gradle Kotlin DSL Android project (`minSdk = 26`, `compileSdk = 35`, `targetSdk = 35`)**
  Configure Jetpack Compose BOM, Material 3, Room (KSP), WorkManager, DataStore, Firebase BOM, Credential Manager, Coroutines, and JUnit 5/4 unit tests. Copy `docs/ui/assets/lola-*.jpg` into `app/src/main/res/drawable-nodpi/`.
- [ ] **Step 2: Write failing domain tests in `CoreDomainTest.kt` (Review Focus #3 & #4)**
  Assert:
  1. `PhoneNormalizer.toPhE164` converts `"0917-123-4567"`, `"9171234567"`, `"639171234567"`, `"+63 917 123 4567"` -> `"+639171234567"`, and rejects `"12345"` / `"abc"` -> `null`.
  2. `SmsSegmentCalculator.formatAndSegment("Gadiel", msg)` selects `GSM_7` (160 single / 153 multi) for plain ASCII/basic GSM chars and switches to `UCS_2` (70 single / 67 multi) when emojis or curly quotes appear, including `"Gadiel: "` in the character count.
  3. `InboundIdGenerator.generate("+639171234567", 1700000000000L, "Kumain na ako")` starts with `"in_"` and is deterministic across repeated calls.
  4. `MessageStatus.SENT.canTransitionTo(MessageStatus.QUEUED)` is `false` (no silent resend); `SENT -> PENDING -> DELIVERED` and `QUEUED -> FAILED` are `true`.
- [ ] **Step 3: Run unit tests to verify they fail**
  Run: `cd android-gateway && ./gradlew :app:testDebugUnitTest`
  Expected: FAIL (unresolved symbols).
- [ ] **Step 4: Implement `MessageStatus.kt`, `PhoneNormalizer.kt`, `SmsSegmentCalculator.kt`, and `InboundIdGenerator.kt`**
- [ ] **Step 5: Run unit tests to verify all pass and commit**
  Run: `cd android-gateway && ./gradlew :app:testDebugUnitTest`
  Expected: PASS.
  ```bash
  git add android-gateway/
  git commit -m "feat(android): scaffold kotlin app and core domain models"
  ```

### Task 5: QA Test Plan, Defect Log & Trial Sheet Templates
**Owner:** Ponce | **Branch:** `qa/evaluation-trials`

**Files:**
- Create: `docs/qa/test-plan.md`
- Create: `docs/qa/defect-log.md`
- Create: `docs/qa/trial-logs/README.md`

**Interfaces:**
- Consumes: CS 312 Part 5 metrics (Spec Section 3) and `docs/qa/day1-hardware-check.md`.
- Produces: Step-by-step execution scripts for 100 outbound trials (50/telco), 100 inbound trials (50/telco), 30 handoff/outage trials, 100 status accuracy checks, and 8-hour screen-off battery measurement, plus CSV column schema matching Android `CsvLogExporter` (`messageId,direction,encoding,segments,network,createdAtMs,sentAtMs,deliveredAtMs,status,retryCount,errorCode`).

- [ ] **Step 1: Write `docs/qa/test-plan.md`, `docs/qa/defect-log.md`, and `docs/qa/trial-logs/README.md`**
- [ ] **Step 2: Cross-check all 5 quantitative targets against Spec Section 3**
- [ ] **Step 3: Commit and open PR to `main`**
  ```bash
  git add docs/qa/
  git commit -m "docs(qa): add cs 312 test plan and trial templates"
  ```

---

## Wave 2: Core Engines in Parallel (Nov 22-24)

### Task 6: Room Durable Queue & Atomic Anti-Duplicate Dispatch Lock
**Owner:** Manalo | **Branch:** `feat/android-gateway`

**Files:**
- Create: `android-gateway/app/src/main/java/dev/lolagateway/data/local/LocalEntities.kt`
- Create: `android-gateway/app/src/main/java/dev/lolagateway/data/local/GatewayDaos.kt`
- Create: `android-gateway/app/src/main/java/dev/lolagateway/data/local/AppDatabase.kt`
- Create: `android-gateway/app/src/main/java/dev/lolagateway/data/local/GatewayPrefsStore.kt`
- Create: `android-gateway/app/src/main/java/dev/lolagateway/data/local/LocalDispatchClaimer.kt`
- Test: `android-gateway/app/src/test/java/dev/lolagateway/data/local/LocalDispatchClaimerTest.kt`

**Interfaces:**
- Consumes: `MessageStatus`, `SmsEncoding` (Task 4).
- Produces:
  - Entities: `LocalMessageEntity(messageId, direction, senderName, text, smsFormattedText, encoding, segmentCount, status, localDispatchState, syncDirty, retryCount, nextRetryAtMs, errorCode, errorReason, createdAtMs, queuedOnGatewayAtMs, sentAtMs, deliveredAtMs, gatewayNetwork)`
  - `LocalSmsPartEntity(messageId, partIndex, sentResultCode, deliveryStatus)`
  - `HandoffLogEntity(id, oldTransport, newTransport, transitionedAtMs, recoveredAtMs)`
  - `LocalDispatchClaimer.claimNextReady(nowMs: Long, isPaused: Boolean): LocalMessageEntity?`
  - `GatewayPrefsStore`: persists `familyId`, `joinCode`, `seniorName`, `seniorPhoneE164`, `allowListE164`, `selectedSubId`, `isBridgePaused`, `blockedUnknownCount`, `themeMode`.

- [ ] **Step 1: Write failing tests in `LocalDispatchClaimerTest.kt` (Review Focus #2)**
  Using an in-memory Room DB (Robolectric) or coroutine concurrency test, assert:
  1. Inserting the same `messageId` twice with `OnConflictStrategy.IGNORE` keeps exactly 1 row.
  2. Two concurrent coroutines calling `claimNextReady()` on one `READY` outbound message return the row to strictly ONE caller and `null` to the other (`localDispatchState` flipped atomically to `DISPATCHING`).
  3. When `isPaused = true`, `claimNextReady()` returns `null` and leaves outbound rows `QUEUED` (never `FAILED`).
  4. Rows with `nextRetryAtMs > nowMs` are skipped until backoff expires.
- [ ] **Step 2: Run unit tests to verify they fail**
  Run: `cd android-gateway && ./gradlew :app:testDebugUnitTest --tests "*LocalDispatchClaimerTest"`
  Expected: FAIL.
- [ ] **Step 3: Implement Room entities, DAOs, `AppDatabase`, `GatewayPrefsStore`, and `LocalDispatchClaimer`**
- [ ] **Step 4: Run unit tests to verify all pass and commit**
  Run: `cd android-gateway && ./gradlew :app:testDebugUnitTest --tests "*LocalDispatchClaimerTest"`
  Expected: PASS.
  ```bash
  git add android-gateway/app/src/
  git commit -m "feat(android): add room queue and atomic dispatch lock"
  ```

### Task 7: Android Telephony Engine (Dual-SIM `SmsSender`, Receivers, Allow-List & 10s `Pending`)
**Owner:** Manalo | **Branch:** `feat/android-gateway`

**Files:**
- Create: `android-gateway/app/src/main/java/dev/lolagateway/sms/SmsTransport.kt`
- Create: `android-gateway/app/src/main/java/dev/lolagateway/sms/SmsSender.kt`
- Create: `android-gateway/app/src/main/java/dev/lolagateway/sms/SmsStatusReceiver.kt`
- Create: `android-gateway/app/src/main/java/dev/lolagateway/sms/SmsInboundReceiver.kt`
- Create: `android-gateway/app/src/main/java/dev/lolagateway/sms/PendingStatusWorker.kt`
- Modify: `android-gateway/app/src/main/AndroidManifest.xml` (declare receivers & permissions: `SEND_SMS`, `RECEIVE_SMS`, `READ_PHONE_STATE`, `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_REMOTE_MESSAGING`, `ACCESS_NETWORK_STATE`, `INTERNET`)
- Test: `android-gateway/app/src/test/java/dev/lolagateway/sms/SmsPipelineTest.kt`

**Interfaces:**
- Consumes: `PhoneNormalizer`, `SmsSegmentCalculator`, `InboundIdGenerator` (Task 4), `AppDatabase`, `GatewayPrefsStore` (Task 6).
- Produces:
  - `interface SmsTransport { fun sendParts(destinationE164: String, parts: List<String>, messageId: String, subscriptionId: Int?) }`
  - `SmsSender.dispatch(message: LocalMessageEntity, destinationE164: String)` (2s minimum send throttle + explicit `PendingIntent` with `requestCode = messageId.hashCode() * 31 + partIndex`)
  - `SmsStatusHandler.onPartSent(messageId, partIndex, resultCode)` & `onPartDelivered(messageId, partIndex, tpStatus)`
  - `SmsInboundHandler.onIncomingPdus(partsBySender: Map<String, Pair<Long, String>>)`

- [ ] **Step 1: Write failing tests in `SmsPipelineTest.kt` (Review Focus #1, #4 & #5)**
  Assert:
  1. Multipart inbound PDUs from `"+639171234567"` concatenate into ONE message before generating `in_<sha256>` and saving to Room.
  2. Inbound SMS from an unlisted number (`"+639189999999"`) inserts 0 rows into Room and increments `blockedUnknownCount` only (zero message body persisted).
  3. Outbound 2-part SMS generates distinct `requestCode` per part (`partIndex = 0` vs `1`), stays `QUEUED` until BOTH parts report `RESULT_OK`, then moves to `SENT`, schedules 10s `PendingStatusWorker`, and moves to `DELIVERED` only when BOTH parts report `tpStatus == 0`.
  4. Transient send error (`RESULT_ERROR_NO_SERVICE`) increments `retryCount` and sets backoff `10s -> 20s -> 40s -> 60s`; after 4th failure marks `FAILED`. Invalid phone number marks `FAILED` immediately without retry.
  5. `PendingStatusWorker` transitions `SENT -> PENDING` if still undelivered after 10s, and is a no-op if already `DELIVERED`.
- [ ] **Step 2: Run unit tests to verify they fail**
  Run: `cd android-gateway && ./gradlew :app:testDebugUnitTest --tests "*SmsPipelineTest"`
  Expected: FAIL.
- [ ] **Step 3: Implement `SmsTransport`, `SmsSender` (with `SubscriptionManager` Dual-SIM selector), `SmsStatusReceiver`, `SmsInboundReceiver`, `PendingStatusWorker`, and manifest declarations**
- [ ] **Step 4: Run unit tests to verify all pass and commit**
  Run: `cd android-gateway && ./gradlew :app:testDebugUnitTest --tests "*SmsPipelineTest"`
  Expected: PASS.
  ```bash
  git add android-gateway/app/src/
  git commit -m "feat(android): add dual-sim sms sender, receivers, and allow-list"
  ```

### Task 8: Cloud Sync, High-Priority FCM Wake, Short FGS & Wi-Fi/4G Handoff Recovery
**Owner:** Manalo | **Branch:** `feat/android-gateway`

**Files:**
- Create: `android-gateway/app/src/main/java/dev/lolagateway/data/remote/GatewayCloudClient.kt`
- Create: `android-gateway/app/src/main/java/dev/lolagateway/data/remote/FirestoreGatewayRepo.kt`
- Create: `android-gateway/app/src/main/java/dev/lolagateway/sync/GatewayFcmService.kt`
- Create: `android-gateway/app/src/main/java/dev/lolagateway/sync/GatewayBurstService.kt`
- Create: `android-gateway/app/src/main/java/dev/lolagateway/sync/SyncEngineWorker.kt`
- Create: `android-gateway/app/src/main/java/dev/lolagateway/sync/NetworkMonitor.kt`
- Create: `android-gateway/app/src/main/java/dev/lolagateway/LolaGatewayApp.kt`
- Test: `android-gateway/app/src/test/java/dev/lolagateway/sync/SyncEngineTest.kt`

**Interfaces:**
- Consumes: `AppDatabase`, `LocalDispatchClaimer` (Task 6), `SmsSender` (Task 7).
- Produces:
  - `GatewayCloudClient` (`fetchQueuedOutbound(familyId)`, `upsertMessageStatus(familyId, msg)`, `uploadInboundReply(familyId, msg)`, `publishHeartbeat(familyId, heartbeat)`)
  - `SyncEngine.runCatchUpAndDrain()` (pulls missed Firestore `QUEUED` docs into Room, drains ready outbound queue via `SmsSender`, pushes dirty status updates & pending inbound replies via idempotent `set(merge)`, updates heartbeat)
  - `NetworkMonitor` (`ConnectivityManager.NetworkCallback` logging Wi-Fi <-> 4G transitions into `handoff_logs` and enqueueing `SyncEngineWorker` immediately)
  - `GatewayFcmService` (updates `fcmToken` on `onNewToken`; on data push `{ familyId, messageId }`, starts short `GatewayBurstService` / `SyncEngineWorker` to process immediately even from Doze)

- [ ] **Step 1: Write failing sync & handoff tests in `SyncEngineTest.kt`**
  With a fake `GatewayCloudClient`, assert:
  1. Missed Firestore `QUEUED` messages pulled during reconnect catch-up are inserted idempotently and dispatched once.
  2. Dirty inbound replies accumulated while offline upload cleanly on reconnect and clear `syncDirty = false`.
  3. Switching `PAUSED -> ONLINE` drains held outbound and inbound items in FIFO order.
  4. `NetworkMonitor` records `WIFI -> CELLULAR` handoff entry with non-null `recoveredAtMs` after `SyncEngine` finishes.
- [ ] **Step 2: Run unit tests to verify they fail**
  Run: `cd android-gateway && ./gradlew :app:testDebugUnitTest --tests "*SyncEngineTest"`
  Expected: FAIL.
- [ ] **Step 3: Implement `FirestoreGatewayRepo`, `SyncEngineWorker`, `GatewayFcmService`, `GatewayBurstService` (`remoteMessaging` short FGS), `NetworkMonitor`, and `LolaGatewayApp` (`AppContainer`)**
- [ ] **Step 4: Run unit tests to verify all pass and commit**
  Run: `cd android-gateway && ./gradlew :app:testDebugUnitTest`
  Expected: PASS.
  ```bash
  git add android-gateway/app/src/
  git commit -m "feat(android): add fcm wake, sync worker, and wifi-4g handoff recovery"
  ```

### Task 9: Standalone Family Chat Web App (React + Vite PWA)
**Owner:** Bueno | **Branch:** `feat/web-chat`

**Files:**
- Create: `web-chat/package.json`, `vite.config.ts`, `index.html`, `public/manifest.webmanifest`
- Copy assets: `docs/ui/assets/lola-*.jpg` -> `web-chat/public/assets/`
- Create: `web-chat/src/lib/firebase.ts`
- Create: `web-chat/src/lib/smsCounter.ts`
- Create: `web-chat/src/lib/gatewayApi.ts` (writes `QUEUED` doc + calls `POST /notify` with Firebase ID Token; retry creates new UUID doc with `retryOfMessageId`)
- Create: `web-chat/src/lib/qaLogger.ts` (hidden `?qa=1` browser CSV export)
- Create: `web-chat/src/styles/tokens.css` (exact Light Cream & Dark Twilight tokens from `docs/ui/lola-gateway-wireframes.html`)
- Create: `web-chat/src/screens/OnboardingScreen.tsx`
- Create: `web-chat/src/screens/HomeScreen.tsx`
- Create: `web-chat/src/screens/PeopleScreen.tsx`
- Create: `web-chat/src/screens/ChatScreen.tsx`
- Create: `web-chat/src/screens/LoadingScreen.tsx`
- Create: `web-chat/src/screens/SettingsScreen.tsx`
- Test: `web-chat/tests/smsCounter.test.ts`, `web-chat/tests/gatewayApi.test.ts`

**Interfaces:**
- Consumes: Firestore contract (Task 2), Cloudflare Worker `POST /notify` (Task 3), locked 6-screen design (`docs/ui/lola-gateway-wireframes.html`).
- Produces: Installable mobile-first React PWA hosted on Firebase Hosting or Cloudflare Pages (zero card).

- [ ] **Step 1: Write failing Vitest unit tests in `web-chat/tests/smsCounter.test.ts` and `gatewayApi.test.ts` (Review Focus #3)**
  Assert:
  1. `calculateSmsMetrics("Gadiel", "Kumusta po?")` returns `{ encoding: "GSM-7", segmentCount: 1, used: 19, limit: 160 }`, matching Kotlin `SmsSegmentCalculator` on 160/153 GSM-7 and 70/67 UCS-2 boundary cases (including emojis and curly quotes).
  2. `isGatewayStale(lastHeartbeatMs, nowMs)` returns `true` when `> 20 * 60 * 1000` ms old.
  3. `retryFailedMessage()` generates a brand-new UUIDv4 with `status: "QUEUED"` and `retryOfMessageId` set to the old ID (never mutating the failed doc).
- [ ] **Step 2: Run Vitest to verify failure**
  Run: `cd web-chat && npm test`
  Expected: FAIL.
- [ ] **Step 3: Implement `smsCounter.ts`, `firebase.ts`, `gatewayApi.ts`, `qaLogger.ts`, and all 6 screens matching `docs/ui/lola-gateway-wireframes.html`**
  Ensure SMS segment meter stays hidden when composer input is empty, Gateway health shows `Online` / `4G Backup` / `Paused` / `Offline (>20m stale)`, and Light/Dark modes follow `prefers-color-scheme` with manual override in Settings.
- [ ] **Step 4: Run Vitest + production build to verify zero errors**
  Run: `cd web-chat && npm test && npm run build`
  Expected: PASS and clean `dist/` bundle.
- [ ] **Step 5: Commit and open PR to `main`**
  ```bash
  git add web-chat/
  git commit -m "feat(web): build standalone family chat react pwa"
  ```

---

## Wave 3: Android Compose UI & Hidden QA Diagnostics (Nov 24-25)

### Task 10: Plain Kotlin Jetpack Compose 6-Screen UI & Hidden 5-Tap QA CSV Exporter
**Owner:** Manalo | **Branch:** `feat/android-gateway`

**Files:**
- Create: `android-gateway/app/src/main/java/dev/lolagateway/ui/theme/LolaTheme.kt`
- Create: `android-gateway/app/src/main/java/dev/lolagateway/ui/components/LolaComponents.kt` (`StatusDot`, `IconBottomDock`, `BridgeStatusStrip`)
- Create: `android-gateway/app/src/main/java/dev/lolagateway/ui/onboarding/OnboardingScreen.kt` (Google Credential Manager sign-in + Family/Lola setup + SMS/Notification/Battery Exemption permissions)
- Create: `android-gateway/app/src/main/java/dev/lolagateway/ui/home/HomeScreen.kt`
- Create: `android-gateway/app/src/main/java/dev/lolagateway/ui/people/PeopleScreen.kt`
- Create: `android-gateway/app/src/main/java/dev/lolagateway/ui/chat/ChatScreen.kt` (includes Host local-send path: writes `QUEUED` doc to Firestore + inserts into Room + dispatches locally without FCM self-push!)
- Create: `android-gateway/app/src/main/java/dev/lolagateway/ui/loading/LoadingScreen.kt` (Peeking Lola with seamless Light & Dark Twilight arch)
- Create: `android-gateway/app/src/main/java/dev/lolagateway/ui/settings/SettingsScreen.kt` (clean user-only settings + Dual-SIM picker if 2 SIMs present + hidden 5-tap version footer unlocking QA Diagnostics sheet)
- Create: `android-gateway/app/src/main/java/dev/lolagateway/diagnostics/CsvLogExporter.kt`
- Modify: `android-gateway/app/src/main/java/dev/lolagateway/MainActivity.kt`
- Test: `android-gateway/app/src/test/java/dev/lolagateway/diagnostics/CsvLogExporterTest.kt`

**Interfaces:**
- Consumes: `AppContainer` (`AppDatabase`, `GatewayPrefsStore`, `FirestoreGatewayRepo`, `SyncEngine`, `SmsSender`) from Tasks 6-8.
- Produces: Complete installable debug APK (`app-debug.apk`) matching all 6 screens in `docs/ui/lola-gateway-wireframes.html`, plus hidden QA CSV export matching Ponce's schema in Task 5.

- [ ] **Step 1: Write failing tests in `CsvLogExporterTest.kt`**
  Assert `CsvLogExporter.formatMessagesCsv(rows)` emits exact header `messageId,direction,encoding,segments,network,createdAtMs,sentAtMs,deliveredAtMs,status,retryCount,errorCode` and escapes commas/quotes safely.
- [ ] **Step 2: Run unit test to verify it fails**
  Run: `cd android-gateway && ./gradlew :app:testDebugUnitTest --tests "*CsvLogExporterTest"`
  Expected: FAIL.
- [ ] **Step 3: Implement `CsvLogExporter.kt`, `LolaTheme.kt`, shared components, all 6 Compose screens, hidden 5-tap QA Diagnostics sheet (Test SMS + Invalid-Number Test + CSV Share), and `MainActivity.kt`**
- [ ] **Step 4: Build debug APK and run full Android unit test suite**
  Run: `cd android-gateway && ./gradlew :app:testDebugUnitTest :app:assembleDebug`
  Expected: PASS and `app/build/outputs/apk/debug/app-debug.apk` built cleanly.
- [ ] **Step 5: Commit and open PR to `main`**
  ```bash
  git add android-gateway/
  git commit -m "feat(android): add 6-screen compose ui and hidden qa csv export"
  ```

---

## Wave 4: Full-Stack Integration Gate (Nov 25-26)

### Task 11: End-to-End Hardware Integration & Reliability Smoke Test
**Owner:** Manalo + Bueno + Ponce | **Branch:** `main` (after merging Tasks 2-10)

**Files:**
- Modify: `docs/qa/defect-log.md` (log any integration issues found)

- [ ] **Step 1: Merge all feature PRs into `main` and deploy live endpoints**
  Deploy `firebase/firestore.rules`, `worker/` (Cloudflare Worker), and `web-chat/` (Firebase Hosting or Cloudflare Pages). Install Gateway APK via `adb install -r android-gateway/app/build/outputs/apk/debug/app-debug.apk`.
- [ ] **Step 2: Execute full hardware round-trip checklist**
  1. Host signs in with Google on Android Gateway -> creates family + enters Lola's keypad phone number -> grants SMS, Notification, and Battery Optimization exemption.
  2. Relative signs in with Google on React PWA -> enters Family Join Code -> sends message -> verify SMS arrives on keypad phone as `Name: message` and status advances `Queued -> Sent -> Delivered` (or `Pending` if keypad off).
  3. Lola replies by normal SMS -> verify reply appears in React PWA in warm marigold bubble (`Lola · via SMS`) within 30s.
  4. Send an SMS from an unlisted phone -> verify zero message appears in chat and unknown text is not saved.
  5. Toggle Gateway `SMS Bridge` OFF (`PAUSED`) -> send 2 web messages & 1 keypad reply -> toggle back ON -> verify all 3 drain cleanly with 0 lost and 0 duplicates.
  6. Turn Wi-Fi off mid-session -> verify automatic 4G LTE handoff catch-up resumes within 60s.
- [ ] **Step 3: Fix any blocking integration defects and commit**

---

## Wave 5: Formal CS 312 Evaluation & Final Demo (Nov 26-Dec 4)

### Task 12: Execute CS 312 Part 5 Evaluation Suite & Compile Final Report
**Owner:** Ponce (Lead QA) + Manalo (Gateway/Demo) + Bueno (Final Report) | **Branch:** `qa/evaluation-trials`

**Files:**
- Create: `docs/qa/trial-logs/outbound-telco1.csv`, `outbound-telco2.csv`
- Create: `docs/qa/trial-logs/inbound-telco1.csv`, `inbound-telco2.csv`
- Create: `docs/qa/trial-logs/handoff-30-trials.csv`
- Create: `docs/qa/trial-logs/status-accuracy-100.csv`
- Create: `docs/qa/trial-logs/battery-8h-report.md`
- Create: `docs/qa/evaluation-summary.md`

- [ ] **Step 1: Run 100 outbound + 100 inbound trials across 2 telcos (Nov 26-28)**
  50 outbound + 50 inbound on Telco 1 (e.g., Globe), 50 + 50 on Telco 2 (e.g., Smart). Export CSVs via hidden 5-tap Android Diagnostics + web `?qa=1`. Verify `<= 60s` outbound in `>= 90%` and `<= 30s` inbound in `>= 90%`.
- [ ] **Step 2: Run 100 status accuracy checks + 30 handoff/outage trials (Nov 28-29)**
  Include keypad OFF (`Pending`) and invalid destination via Diagnostics (`Failed` within 5s). Run 10 Wi-Fi-to-4G switches, 10 Wi-Fi outages, and 10 full internet outages; verify `0 lost`, `0 duplicates`, and `<= 60s` recovery.
- [ ] **Step 3: Run 8-hour screen-off battery test (Nov 29-30)**
  Unplug fully charged Gateway phone, screen off, relay 50 messages over 8 hours, record Android Battery Settings percentage (target `<= 15%`).
- [ ] **Step 4: Publish `docs/qa/evaluation-summary.md`, update final paper (replacing legacy `Pakonek` labels with `docs/diagrams/lola-gateway-backend-workflow.png`), and commit**
  ```bash
  git add docs/qa/
  git commit -m "docs(qa): add final cs 312 trial logs and evaluation summary"
  ```
