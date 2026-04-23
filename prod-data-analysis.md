# Production Data Analysis

## Sessions
| ID | Code | Goat ml | Sheep ml | Cow ml | GoatFeed | SheepFeed | CowFeed | GoatLoss | SheepLoss | CowLoss | Status |
|----|------|---------|----------|--------|----------|-----------|---------|----------|-----------|---------|--------|
| 4 | SK-220426-M | 20000 | 20000 | 50000 | 1000 | 1000 | 10000 | 2000 | 2000 | 10000 | confirmed |
| 5 | SK-220426-E | 20000 | 45000 | 20000 | 10000 | 10000 | 10000 | 2000 | 1000 | 1000 | confirmed |
| 6 | SK-230426-M | 20000 | 30000 | 20000 | 2000 | 1000 | 10000 | 1000 | 2000 | 1000 | confirmed |
| 7 | SK-230426-E | 20000 | 20000 | 20000 | 5000 | 1000 | 5000 | 1000 | 1000 | 0 | confirmed |

## Receptions
| ID | Session | Type | Status | Accepted ml | Rejected ml | Tank |
|----|---------|------|--------|-------------|-------------|------|
| 7 | 4 | goat | accepted | 17000 | 0 | 1 |
| 8 | 4 | sheep | accepted | 17000 | 0 | 2 |
| 9 | 4 | cow | accepted | 30000 | 0 | 3 |
| 10 | 5 | goat | accepted | 8000 | 2000 | 1 |
| 11 | 5 | sheep | accepted | 34000 | 0 | 2 |
| 12 | 5 | cow | accepted | 9000 | 0 | 3 |
| 16 | 6 | goat | REJECTED | 0 | 20000 | - |
| 18 | 6 | sheep | REJECTED | 0 | 30000 | - |
| 19 | 6 | cow | REJECTED | 0 | 20000 | - |
| 20 | 7 | goat | accepted | 14000 | 0 | 1 |
| 21 | 7 | sheep | accepted | 18000 | 0 | 2 |
| 22 | 7 | cow | accepted | 15000 | 0 | 3 |

## Tank Volumes (actual)
| Tank | Type | Current ml |
|------|------|------------|
| 1 | goat | 39000 |
| 2 | sheep | 18000 |
| 3 | cow | 63000 |

## Tank Volumes (expected = sum of accepted)
- Goat: 17000 + 8000 + 14000 = 39000 ✅ CORRECT
- Sheep: 17000 + 34000 + 18000 = 69000 ❌ WRONG (actual: 18000, diff: -51000)
- Cow: 30000 + 9000 + 15000 = 54000 ❌ WRONG (actual: 63000, diff: +9000)

Wait — sheep tank shows 18000 but should be 69000. This is very wrong.
Cow tank shows 63000 but should be 54000. Also wrong.

These discrepancies might be from admin edits/deletes that were done earlier.
The tank movements table would show the full history.

## Key Finding for the Current Bug
Session 6 (SK-230426-M) had ALL milk rejected:
- Goat: 20000ml rejected (net was 17000ml = 20000-2000-1000)
- Sheep: 30000ml rejected (net was 27000ml = 30000-1000-2000)
- Cow: 20000ml rejected (net was 9000ml = 20000-10000-1000)

But in the overview stats, session 6 volumes are still counted in totals!
The overview sums goatVolumeMl from milkSessions directly, not from milkReceptions.

## Fix needed
The overview should add "Принято" row that sums acceptedVolumeMl from milkReceptions.
The "Нетто" row stays as is (it shows what milker sent).
Add "Принято" and "Отклонено" rows from milkReceptions to show the actual accepted volumes.
