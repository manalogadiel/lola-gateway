# QA Trial Logs Directory

Save exported CSV and battery reports from CS 312 Part 5 testing here:

- `outbound-globe.csv` / `outbound-smart.csv`
- `inbound-globe.csv` / `inbound-smart.csv`
- `handoff-30-trials.csv`
- `status-accuracy-100.csv`
- `battery-8h-report.md`

### Android CSV Columns (`CsvLogExporter`)
`messageId,direction,encoding,segments,network,createdAtMs,sentAtMs,deliveredAtMs,status,retryCount,errorCode`

### Handoff CSV Columns (`CsvLogExporter`)
`id,oldTransport,newTransport,transitionedAtMs,recoveredAtMs,recoveryMs`
