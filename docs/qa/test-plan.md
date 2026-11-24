# CS 312 Part 5 QA Test Plan: Lola Gateway

**Course:** CS 312 Mobile Computing (CS3103, Group 1, BatStateU Alangilan)
**QA Lead:** Jyvhan Earl D. Ponce
**Target Hardware:** 1 Android Gateway phone (`adb install`), 1 physical keypad phone (record 2G/3G/4G VoLTE), 2 PH SIMs (Globe & Smart with text promos + Gateway prepaid data), 1 laptop/phone running the Family Web Chat PWA (`?qa=1`).

---

## 1. Quantitative Success Targets

| Trial Suite | Sample Size | Measurement Method | Success Target |
|---|---|---|---|
| **R1 Outbound Latency** | 100 trials (50 Globe + 50 Smart) | Web `?qa=1` send timestamp / reference clock to SMS arrival on keypad phone | <= 60s in >= 90% of trials |
| **R2 Inbound Reply Latency** | 100 trials (50 Globe + 50 Smart) | Keypad SMS send to bubble visible in Family Web Chat | <= 30s in >= 90% of trials |
| **R3 Connectivity & Handoff** | 30 trials (10 Wi-Fi->4G, 10 Wi-Fi outages, 10 full outages) | Compare sent, received, and duplicate counts after 5 min + Android `handoffs.csv` | 0 lost, 0 duplicates, resume <= 60s |
| **R4 Status Accuracy** | 100 messages (including keypad OFF & invalid number) | Compare Web/Android UI status against physical handset result + timestamps | 100% accurate, reflected <= 5s |
| **Gateway Battery Use** | 1 run (8 hours, screen off, unplugged, 50 messages) | Android Battery Settings usage delta for `Lola Gateway` | <= 15% battery consumed |

---

## 2. Pre-Test Setup Checklist
- [ ] Complete physical bench check in `docs/qa/day1-hardware-check.md` (5 live SMS: 3 keypad ON, 2 keypad OFF).
- [ ] Verify Gateway Android phone has SMS, Notification, Phone State, and Battery Optimization Exemption granted.
- [ ] Confirm Android SMS send-rate limit note: pace batch trials (>= 2s gap) or raise `sms_outgoing_check_max_count` via `adb` only for the 100-trial burst and document it in the report.
- [ ] Open Family Web Chat with `?qa=1` enabled to capture browser timestamps, and unlock hidden QA Diagnostics on Android (Settings -> tap app version 5 times) for CSV export.

---

## 3. Execution Protocols

### Suite A: Outbound & Inbound Latency (200 Trials)
1. **Batch 1 (Telco 1, e.g. Globe):** Send 50 web messages (include short GSM-7, >160-char multipart, and 5 UCS-2/emoji texts); record arrival on keypad phone. Send 50 keypad replies back; record arrival in Web Chat.
2. **Batch 2 (Telco 2, e.g. Smart):** Switch active SIM (or select SIM 2 in Settings) and repeat 50 outbound + 50 inbound trials.
3. Export `lola-messages.csv` from Android Diagnostics and browser CSV from `?qa=1`; save to `docs/qa/trial-logs/`.

### Suite B: Status Accuracy (100 Messages)
1. Verify `Queued -> Sent -> Delivered` on 80 normal messages (keypad ON).
2. Power keypad phone OFF and send 10 messages; verify status advances `Queued -> Sent -> Pending` (within 10s grace window) and never auto-resends duplicates; power keypad back ON and record any delayed `Delivered` update.
3. Trigger 10 invalid-number sends via Android QA Diagnostics (`Run invalid-number test`); verify status flips to `Failed` in Web Chat within 5 seconds.

### Suite C: Connectivity & Handoff Reliability (30 Trials)
1. **10 Wi-Fi-to-4G switches:** Turn off Wi-Fi on Gateway mid-send; verify 4G LTE takes over, `handoffs.csv` logs recovery <= 60s, 0 lost, 0 duplicates.
2. **10 Wi-Fi outages (no 4G data):** Disable Wi-Fi with mobile data off, send 1 web message + 1 keypad reply, restore Wi-Fi after 60s; verify both drain cleanly with 0 lost/duplicates.
3. **10 full internet outages (Airplane mode / router off):** Queue messages while offline, restore connectivity; verify catch-up finishes <= 60s.

### Suite D: 8-Hour Screen-Off Battery Test
1. Charge Gateway phone to 100%, unplug, turn screen off, leave on Wi-Fi with active SIM.
2. Relay 50 messages spaced across 8 hours (mix of outbound and inbound).
3. Record exact battery percentage drop and Android Battery Settings breakdown in `docs/qa/trial-logs/battery-8h-report.md`.
