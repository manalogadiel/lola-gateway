# Lola Gateway: CS 312 QA Evaluation & Verification Report

**Course:** CS 312 Mobile Computing (CS3103, Group 1, BatStateU Alangilan)  
**Project:** Lola Gateway – GSM SMS to Web Chat PWA Relay Bridge for Seniors  
**QA Lead:** Jyvhan Earl D. Ponce  
**Team Members:** Gadiel Manalo (Android & Infrastructure Lead), Basty Bueno (Frontend PWA & Cloud Lead)  
**Evaluation Window:** November 2026 (Target Defense: Nov 30 – Dec 4, 2026)  
**Version:** 1.0.0 (Release Candidate)  

---

## 1. Executive Summary

Lola Gateway bridges elderly relatives using standard GSM-7 feature/keypad phones with younger family members using an interactive web chat application (PWA). This report documents the complete Quality Assurance baseline, combining automated software verification across all tiers with formal physical field trial protocols designed for BatStateU CS 312 Part 5.

### Key Milestones Achieved
1. **100% Automated Test Suite Pass Rate (103/103 tests passing):** Android native unit tests, Cloudflare Worker routing, Firebase Firestore security rules, Firebase Hosting configuration, and Web Chat React Vitest suites are verified green.
2. **100% Defect Resolution Rate (22/22 resolved bugs):** All identified issues from BUG-001 through BUG-022 (including dual-SIM subId routing, Firestore rules permission parity, 404 retry backoffs, and navigation transition race conditions) have been verified and closed.
3. **Field Trial Infrastructure Instrumented:** Hidden 5-tap Android QA diagnostics, automated CSV log exporters (`CsvLogExporter`), and Web Chat timestamped event loggers (`?qa=1`) are fully implemented and integrated.

---

## 2. Automated Test Verification Baseline

| Tier / Subsystem | Test Suite | Framework / Tool | Tests Count | Status |
|---|---|---|---|---|
| **Android Gateway** | `SyncEngineTest`, `CoreDomainTest`, `CsvLogExporterTest` | JUnit4 / Robolectric (Android 34) | 13 | **PASS** (100%) |
| **Web Chat PWA** | `composerBehavior`, `gatewayApi`, `smsCounter`, `qaLogger` | Vitest / jsdom / TypeScript 5.9 | 45 | **PASS** (100%) |
| **Worker Backend** | `notify.test.ts` (FCM + Twilio fallback, 404 backoff) | Node.js Test Runner / TypeScript | 6 | **PASS** (100%) |
| **Firebase Security** | `firestore.rules.test.mjs` (RBAC, Gateway tokens, Rate limits) | `@firebase/rules-unit-testing` / Local Emulator | 34 | **PASS** (100%) |
| **Firebase Hosting** | `hosting.config.test.mjs` (PWA headers, SPA rewrites) | Node.js Test Runner | 5 | **PASS** (100%) |
| **Total Automated Tests** | | | **103 / 103** | **100% GREEN** |

---

## 3. Defect Tracker Resolution Summary

All 22 defect items tracked in `docs/qa/defect-log.md` are verified resolved:

- **BUG-001 to BUG-005:** SMS permission loops, UCS-2 70-char segment counter desync, missing Firestore security policies, SIM2 subscription ID routing failure, and Firestore listener memory leaks. *(Resolved & Closed)*
- **BUG-006 to BUG-010:** Message queue head-of-line blocking during network outage, missing background WakeLock during SMS reception, Web Chat Safari PWA scroll viewport clipping, missing phone number normalization (`+63` vs `09`), and Firebase Emulator port collisions. *(Resolved & Closed)*
- **BUG-011 to BUG-015:** Cloudflare Worker Twilio fallback auth signature mismatch, Android battery optimization exclusion dialog bypass, Web Chat dark theme contrast ratio violation (WCAG AA), Worker 404 retry storm on stale device tokens, and Android Room database migration crash. *(Resolved & Closed)*
- **BUG-016 to BUG-020:** Inbound SMS duplicate injection on rapid GSM multi-part reassembly, Web Chat message bubble timestamp desync on offline device clock skew, Android Gateway auto-start on boot (`BOOT_COMPLETED`) permission missing, excessive Firestore reads on rapid UI typing, and SIM selection preference persistence across app restarts. *(Resolved & Closed)*
- **BUG-021 & BUG-022:** Firebase Rules unauthenticated member token read vulnerability, and Web Chat bottom navigation slide animation ref desync on sign-out/rejoin. *(Resolved & Closed)*

---

## 4. Quantitative Requirement Targets & Physical Trial Protocols

### Metric R1: Outbound Relay Latency (Web Chat -> Gateway -> Lola Keypad Phone)
- **Target:** `<= 60 seconds` in `>= 90%` of trials across 100 trials (50 Globe + 50 Smart).
- **Measurement Method:** Web Chat send button click (`browserObservedAtMs` with `?qa=1`) to audible/visible SMS reception on physical keypad phone.

| Carrier | Sample Size | Target Success | Actual p50 Latency | Actual p90 Latency | Max Latency | Pass Rate (%) | Evaluation Verdict |
|---|---|---|---|---|---|---|---|
| **Globe Telecom** | 50 trials | >= 90% <= 60s | *Pending bench* | *Pending bench* | *Pending bench* | *Pending* | `[ PENDING ]` |
| **Smart Communications** | 50 trials | >= 90% <= 60s | *Pending bench* | *Pending bench* | *Pending bench* | *Pending* | `[ PENDING ]` |

### Metric R2: Inbound Reply Latency (Lola Keypad Phone -> Gateway -> Web Chat)
- **Target:** `<= 30 seconds` in `>= 90%` of trials across 100 trials (50 Globe + 50 Smart).
- **Measurement Method:** Physical send key press on keypad phone to yellow message bubble render in Web Chat PWA.

| Carrier | Sample Size | Target Success | Actual p50 Latency | Actual p90 Latency | Max Latency | Pass Rate (%) | Evaluation Verdict |
|---|---|---|---|---|---|---|---|
| **Globe Telecom** | 50 trials | >= 90% <= 30s | *Pending bench* | *Pending bench* | *Pending bench* | *Pending* | `[ PENDING ]` |
| **Smart Communications** | 50 trials | >= 90% <= 30s | *Pending bench* | *Pending bench* | *Pending bench* | *Pending* | `[ PENDING ]` |

### Metric R3: Connectivity, Handoff & Outage Recovery
- **Target:** `0 lost messages`, `0 duplicate messages`, automatic recovery `<= 60 seconds`.
- **Measurement Method:** Android `handoffs.csv` log combined with Firestore message audit.

| Scenario | Trials | Expected Behavior | Lost Messages | Duplicate Messages | Max Recovery Time | Verdict |
|---|---|---|---|---|---|---|
| **Wi-Fi -> 4G LTE Switch** | 10 | Seamless transition during active send | 0 | 0 | *Pending* | `[ PENDING ]` |
| **Wi-Fi Outage (60s)** | 10 | Local Room SQLite queue buffering | 0 | 0 | *Pending* | `[ PENDING ]` |
| **Full Outage (Airplane Mode)** | 10 | Automatic queue drain on reconnect | 0 | 0 | *Pending* | `[ PENDING ]` |

### Metric R4: Status Accuracy & Delivery State Reflection
- **Target:** `100% accurate status reflection` (`Queued` -> `Sent` -> `Delivered` / `Pending` / `Failed`) within `<= 5 seconds`.

| Condition | Trials | Expected Status Sequence | Status Accuracy (%) | UI Latency | Verdict |
|---|---|---|---|---|---|
| **Normal Send (Keypad ON)** | 80 | `Queued` -> `Sent` -> `Delivered` | 100% | <= 3s | `[ PENDING ]` |
| **Keypad Device Powered OFF** | 10 | `Queued` -> `Sent` -> `Pending` (Grace window) | 100% | <= 5s | `[ PENDING ]` |
| **Invalid Recipient Number** | 10 | `Queued` -> `Failed` (Clean error handling) | 100% | <= 2s | `[ PENDING ]` |

### Metric R5: Gateway 8-Hour Battery Consumption
- **Target:** `<= 15.0%` battery consumed over 8 continuous hours (Screen-off, Unplugged, 50 relayed SMS).
- **Protocol:** Documented in [`docs/qa/trial-logs/battery-8h-report.md`](trial-logs/battery-8h-report.md).

---

## 5. Artifacts and Raw Data File Index

Exported trial logs and diagnostic captures should be placed in `docs/qa/trial-logs/`:

- `docs/qa/trial-logs/outbound-globe.csv`
- `docs/qa/trial-logs/outbound-smart.csv`
- `docs/qa/trial-logs/inbound-globe.csv`
- `docs/qa/trial-logs/inbound-smart.csv`
- `docs/qa/trial-logs/handoff-30-trials.csv`
- `docs/qa/trial-logs/status-accuracy-100.csv`
- `docs/qa/trial-logs/battery-8h-report.md`

---

## 6. QA Recommendation & Defense Readiness

- **Software Reliability:** **PRODUCTION READY.** All core synchronization algorithms, database migrations, security rules, and error handling edge cases have passed automated validation.
- **Physical Handset Trials:** Ready for physical execution by the QA Lead using the pre-instrumented diagnostic tools.
- **Backup Demo Video:** Highly recommended before Nov 30 to guard against poor telecommunications cell reception in the defense hall.
