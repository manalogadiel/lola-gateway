# Team Distribution & Zero-Conflict Git Workflow

**Project:** Lola Gateway (CS 312 Mobile Computing, Group 1, CS3103)
**Target Demo Window:** November 30 to December 4, 2026

Each member owns separate directories and branches so all three of us can work in parallel without merge conflicts.

---

## 1. Directory & Feature Ownership (No Overlap)

| Member | Role | Exclusive Folders | Branch Name | Core Deliverables |
|---|---|---|---|---|
| **Manalo, Gadiel Gospel L.** | Lead Full Stack Developer | `android-gateway/`<br>`worker/` | `feat/android-gateway`<br>`feat/worker-push` | Plain Kotlin + Jetpack Compose Android Gateway app (`SmsManager`, `BroadcastReceiver`, E.164 allow-list, Room queue, WorkManager retry, `NetworkMonitor` handoff recovery, FCM wake, hidden 5-tap QA CSV export), Cloudflare Worker `/notify` FCM HTTP v1 trigger, Firebase project setup, system integration, final demo lead. |
| **Bueno, Sebastian Miguel A.** | Full Stack Developer | `web-chat/`<br>`firebase/` | `feat/web-chat`<br>`feat/firebase-rules` | Standalone React + Vite PWA family web chat (Google Sign-In, Join Code flow, real-time Firestore chat & People view, live GSM-7/UCS-2 SMS counter, inline delivery statuses, Gateway health indicator), `firestore.rules` + `firestore.indexes.json`, final project documentation. |
| **Ponce, Jyvhan Earl D.** | Quality Assurance | `docs/qa/` | `qa/evaluation-trials` | Test plan & checklists, defect log, 100 outbound latency trials (50/telco), 100 inbound reply trials (50/telco), 30 handoff/outage trials (10 Wi-Fi-to-4G, 10 Wi-Fi outages, 10 full outages), 100 status accuracy trials (`Pending` keypad off + `Failed` invalid number), 8-hour screen-off battery test (<=15%), final evaluation summary. |

**Shared Docs (Coordinate Before Editing):**
- `README.md`
- `docs/superpowers/specs/2026-11-20-lola-gateway-design.md` (single source of truth for schema and API)

---

## 2. Frozen Integration Contract (Manalo <-> Bueno)

Both apps build against this exact contract so Android and Web work together immediately on Integration Day. **Do not rename any collection, field, or status enum without updating the spec and notifying the group first.**

### Firestore Paths
- `joinCodes/{joinCode}` -> `{ familyId }`
- `families/{familyId}` -> `{ name, joinCode, seniorName, seniorPhoneE164, allowListE164, gateway: { uid, deviceId, fcmToken, status, networkType, carrierName, signalDbm, batteryPercent, isCharging, lastHeartbeatAt } }`
- `families/{familyId}/members/{uid}` -> `{ displayName, smsNickname, role, lastActiveAt, joinedAt }`
- `families/{familyId}/messages/{messageId}` -> `{ direction, senderUid, senderName, text, smsFormattedText, encoding, segmentCount, status, retryCount, errorCode, errorReason, retryOfMessageId, createdAt, queuedOnGatewayAt, sentAt, deliveredAt, statusUpdatedAt, gatewayNetworkAtSend }`

### Exact Enum Values (Case-Sensitive)
- `direction`: `"OUTBOUND"` | `"INBOUND"`
- `encoding`: `"GSM-7"` | `"UCS-2"`
- `status`: `"QUEUED"` | `"SENT"` | `"PENDING"` | `"DELIVERED"` | `"FAILED"`
- `gateway.status`: `"ONLINE"` | `"OFFLINE"` | `"PAUSED"`
- `gateway.networkType`: `"WIFI"` | `"CELLULAR"` | `"NONE"`
- `member.role`: `"GATEWAY"` | `"MEMBER"`

### Cloudflare Worker Push Endpoint (Owned by Manalo, Called by Bueno's Web Chat)
- **URL:** `POST https://<worker-subdomain>.workers.dev/notify`
- **Headers:** `Authorization: Bearer <Firebase ID Token>`, `Content-Type: application/json`
- **Request Body:** `{ "familyId": "<familyId>", "messageId": "<uuidv4>" }`
- **Success Response:** `200 OK` with `{ "ok": true }`
- **Flow:** Web app writes `families/{familyId}/messages/{messageId}` (`status = "QUEUED"`) first, then calls `POST /notify`. Even if `/notify` fails, the Gateway catch-up sync picks up the `QUEUED` message automatically.

---

## 3. Parallel Build & QA Schedule (Nov 20 to Dec 4)

| Dates | Manalo (`android-gateway/`, `worker/`) | Bueno (`web-chat/`, `firebase/`) | Ponce (`docs/qa/`) |
|---|---|---|---|
| **Nov 20-21** | Create Firebase Spark project + Cloudflare account; run 5-SMS live PH telco DLR smoke test on real Android + keypad phone. | Review UI wireframes + spec; scaffold React + Vite PWA and draft `firestore.rules`. | Prepare hardware (keypad phone + 2 SIMs with text promos + Gateway data) and write `docs/qa/test-plan.md`. |
| **Nov 21-23** | Scaffold Kotlin app; build `SmsSender`, `SmsStatusReceiver`, `SmsInboundReceiver`, Room DB, `WorkManager` retry, and deploy Cloudflare Worker `/notify`. | Build Google Sign-In, Join Code onboarding, Messaging Home, People tab, Family Group Chat, live GSM-7/UCS-2 meter, and Settings; deploy `firestore.rules`. | Test individual features as PRs merge; log defects in `docs/qa/defect-log.md`. |
| **Nov 24-25** | Finish `NetworkMonitor` Wi-Fi/4G catch-up, Dual-SIM support, all 6 Compose screens, and hidden 5-tap CSV exporter. | Connect web chat to live `/notify` endpoint, verify inline statuses (`Queued`, `Sent`, `Pending`, `Delivered`, `Failed`), and verify Dark/Light modes. | Run end-to-end smoke test across Web -> Worker -> FCM -> Gateway -> Keypad -> Web. |
| **Nov 26-29** | Fix Android/Worker bugs found during QA; support handoff trials. | Fix Web/Rules bugs found during QA; start compiling final project report. | Run 100 outbound trials (50/telco), 100 reply trials (50/telco), 30 handoff/outage trials, and 100 status accuracy checks; save CSVs in `docs/qa/trial-logs/`. |
| **Nov 29-Dec 4** | Final bug fixes; lead live final demonstration. | Finish final documentation (replace legacy `Pakonek` diagram with `docs/diagrams/lola-gateway-backend-workflow.png`). | Complete 8-hour screen-off battery test (<=15%) and publish `docs/qa/evaluation-summary.md`. |

---

## 4. Zero-Conflict Git Rules

1. **Stay in your own folder:** Only edit files inside your assigned folder(s). If you need a change in another member's folder, ask them or open a separate small PR.
2. **Work on your branch, merge via PR:** Never force-push `main`. Pull latest `main` before opening a PR (`git fetch origin && git rebase origin/main`).
3. **Never commit secrets:** This repository is public. Never commit `.env`, `.dev.vars`, `*service-account*.json`, `local.properties`, or signing keystores. Keep Cloudflare Worker secrets strictly in `wrangler secret put`.
4. **Short, clear commit messages:** Prefix with scope, for example:
   - `feat(android): add multipart sms delivery tracking`
   - `feat(web): add live gsm7 segment counter`
   - `feat(worker): verify firebase id token on /notify`
   - `docs(qa): add globe 50-trial latency csv`
5. **No surprise contract edits:** Any change to Firestore collections, status names, or `/notify` payloads must be agreed in group chat and updated in `docs/superpowers/specs/2026-11-20-lola-gateway-design.md` first.
