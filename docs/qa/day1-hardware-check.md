# Day 1 hardware and delivery-report check

Preflight on November 23, 2026 (Asia/Manila). The debug APK launched on an Android 15 emulator. ADB showed no physical Gateway handset, so the five carrier SMS trials remain pending.

## Hardware to record at the bench

| Item | Preflight result |
| --- | --- |
| Android Gateway handset model and Android version | Pending physical handset |
| Keypad handset model and radio mode (2G, 3G, or LTE/VoLTE) | Pending physical handset |
| Globe prepaid SMS and data | Pending physical SIM |
| Smart prepaid SMS and data | Pending physical SIM |

## Five live SMS trials

Use the Android Gateway and a consenting test recipient on the keypad handset. Record the SIM and radio mode for each trial. Start timing when Android reports `SENT`. Log the actual arrival of the delivery report, including any report received after the keypad phone is powered back on. If no report arrives within the observation window, record its length and whether the app moved to `PENDING`.

| Trial | Keypad power during send | SIM used | Sent time | Report received, delay, and app status |
| --- | --- | --- | --- | --- |
| 1 | On | Globe | Pending | Pending |
| 2 | On | Smart | Pending | Pending |
| 3 | On | Repeat the carrier with unclear results | Pending | Pending |
| 4 | Off | Globe | Pending | Pending |
| 5 | Off | Smart | Pending | Pending |
