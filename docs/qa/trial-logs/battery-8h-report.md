# Lola Gateway: 8-Hour Screen-Off Battery Consumption Benchmark

**Course:** CS 312 Mobile Computing (CS3103, Group 1, BatStateU Alangilan)  
**QA Lead:** Jyvhan Earl D. Ponce  
**Gateway Engineer:** Gadiel Manalo  
**Target Metric:** <= 15% battery consumed over 8 hours (Screen-off, Unplugged, 50 relayed SMS messages)  
**Status:** Protocol Ready / Awaiting Physical Bench Execution  

---

## 1. Test Device & Environment Specification

| Parameter | Specification / Test Value |
|---|---|
| **Device Model** | *(e.g., Xiaomi Redmi Note 10 / Samsung Galaxy A12)* |
| **Android Version** | Android 14 (API 34) / Android 13 |
| **Battery Capacity** | *(e.g., 5000 mAh)* |
| **Cellular Network (SIM)** | Globe Telecom / Smart Communications (4G LTE active) |
| **Wi-Fi Network** | 2.4 GHz / 5.0 GHz WPA2 Home/Lab Network |
| **App Build** | `app-debug.apk` (Commit: `338062e` or later) |
| **Battery Optimization** | Unrestricted / Battery Optimization Exempt (`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` granted) |
| **Foreground Service** | `GatewaySyncService` running with sticky notification |
| **Screen State** | Display OFF throughout the entire 8-hour window |

---

## 2. Benchmark Protocol & Pacing

1. **Pre-test Conditioning:**
   - Charge the Gateway phone to 100% on AC power.
   - Disconnect charger at `T = 0h 00m`.
   - Ensure background apps are closed except Lola Gateway.
   - Turn screen OFF immediately.
2. **Message Traffic Profile (50 messages total):**
   - 25 Outbound messages (sent from Family Web Chat PWA -> relayed via Gateway SMS).
   - 25 Inbound messages (sent from physical Lola Keypad phone -> received by Gateway -> synced to Cloud Firestore).
   - Message spacing: Approximately 6-7 messages per hour across the 8-hour period.
3. **Measurement Points:**
   - Record system battery percentage every 1 hour (briefly wake screen to check percentage or record via `adb shell dumpsys battery`).
   - At the conclusion of Hour 8, inspect **Settings > Battery > Lola Gateway** usage details.

---

## 3. Hourly Drain Log

| Elapsed Time | Clock Time | Battery Level (%) | Delta (% drop) | Relayed Messages (Out / In) | Network State | Notes / Observations |
|---|---|---|---|---|---|---|
| **0h 00m** | 00:00 | 100% | 0% | 0 / 0 | Wi-Fi + 4G | Charger disconnected, screen OFF |
| **1h 00m** | 01:00 | --% | --% | 3 / 3 | Wi-Fi + 4G | Normal background keep-alive |
| **2h 00m** | 02:00 | --% | --% | 3 / 3 | Wi-Fi + 4G | Firestore listener active |
| **3h 00m** | 03:00 | --% | --% | 4 / 3 | Wi-Fi + 4G | SMS receiver processed wake |
| **4h 00m** | 04:00 | --% | --% | 3 / 3 | Wi-Fi + 4G | Midpoint check |
| **5h 00m** | 05:00 | --% | --% | 3 / 4 | Wi-Fi + 4G | Heartbeat ping normal |
| **6h 00m** | 06:00 | --% | --% | 3 / 3 | Wi-Fi + 4G | No ANR / Service retained |
| **7h 00m** | 07:00 | --% | --% | 3 / 3 | Wi-Fi + 4G | Steady state |
| **8h 00m** | 08:00 | --% | --% | 3 / 3 | Wi-Fi + 4G | Final trial endpoint |

---

## 4. Android System Battery Usage Breakdown (Hour 8)

*From Android System Settings > Battery > Battery Usage > Lola Gateway:*

- **Total App Battery Consumed:** `____%`
- **CPU Foreground Time:** `____ min`
- **CPU Background Time:** `____ min`
- **Mobile Network / Radio Time:** `____ min`
- **Total System Discharge (Start - End):** `100% - ____% = ____%`

---

## 5. Verification Verdict

| Evaluation Item | Target Threshold | Actual Measured | Verdict |
|---|---|---|---|
| **Total 8-Hour Battery Discharge** | `<= 15.0%` | `____%` | `[ PENDING / PASS / FAIL ]` |
| **Gateway App Specific Consumption** | `<= 8.0%` | `____%` | `[ PENDING / PASS / FAIL ]` |
| **Foreground Service Persistence** | 100% (No crash / restart) | `____%` | `[ PENDING / PASS / FAIL ]` |
| **Message Relay Success Rate** | 50/50 (100%) | `__/50` | `[ PENDING / PASS / FAIL ]` |

---

## 6. QA Sign-Off

- **Tester Signature:** Jyvhan Earl D. Ponce (QA Lead)  
- **Date Executed:** `[YYYY-MM-DD]`  
- **Remarks:**
