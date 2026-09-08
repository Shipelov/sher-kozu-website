# Fix Plan: Rejected Volumes in Stats and Reports

## Summary of Issues

The core problem: Overview stats and reports show "Нетто" (net) as the final milk figure,
but "Нетто" = Надой - Выпойка - Потери. It does NOT subtract rejected volumes.
This means rejected milk appears as if it was accepted.

## Fixes Required

### 1. Server: milkAdmin.overview — Add reception aggregates per period
Add per-type accepted/rejected volumes from milkReceptions table for each period.
New fields in PeriodData:
- acceptedMl per type (goat/sheep/cow/total)
- rejectedMl per type

### 2. Client: AdminMilkDashboard OverviewSection — Add "Принято сыроделом" row
After the "Нетто" row, add a new highlighted row showing accepted volumes.
Also add "Отклонено" row showing rejected volumes.

### 3. Client: AdminMilkDashboard exports — Add accepted/rejected to Excel/PDF
Add "Принято, л" and "Отклонено, л" rows to buildOverviewRows.

### 4. Server: milkSession.reportData — Add reception info per session
For each session, include per-type reception status and accepted volumes.

### 5. Client: FarmMilkerArm report — Add "Принято" column
Add accepted volume column to the milker report table and exports.

### 6. Client: FarmMilkerArm today summary — Show accepted vs net
Show "Принято: X л" alongside "→ Сыроделу: Y л" when there are receptions.

## Implementation Order
1. Fix server milkAdmin.overview (add reception aggregates)
2. Fix server milkSession.reportData (add reception info)
3. Fix client AdminMilkDashboard (display + exports)
4. Fix client FarmMilkerArm (display + exports)
