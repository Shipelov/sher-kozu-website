# Audit: Rejected Volumes Counted as Accepted

## Problem
When cheesemaker rejects milk in ARM Sыродел, the rejected volumes are still counted
in tanks and reports as if they were accepted.

## Root Cause Analysis

### 1. TANKS — currentVolumeMl
**Status: OK** — The reject procedure in milkReception.ts does NOT add volume to any tank.
Only the accept procedure adds volume. So tank `currentVolumeMl` should be correct.

BUT WAIT: Let me check if the tank volume was already added BEFORE rejection.
Looking at the flow:
- Milker creates session → no tank movement
- Session goes to pending_confirm → no tank movement
- Cheesemaker accepts → adds to tank ✅
- Cheesemaker rejects → does NOT add to tank ✅

So the tank volume itself should be correct. The issue must be elsewhere.

### 2. ADMIN OVERVIEW STATS (milkAdmin.overview)
**BUG FOUND**: The overview stats query sums from `milkSessions` table directly:
```
goatMl: COALESCE(SUM(milkSessions.goatVolumeMl), 0)
```
This sums ALL sessions regardless of reception status. If a session has 3 milk types
and 2 are rejected, the overview still shows all 3 volumes in the totals.

The `netL` (Нетто) calculation is: volume - feeding - losses
This does NOT account for rejected volumes at all.

The `receptionToday` section does show accepted vs rejected separately, but the
main period stats (today/week/month) don't distinguish.

### 3. MILKER ARM REPORT (milkSession.reportData)
**BUG FOUND**: Same issue — reportData returns raw session volumes without any
reference to reception status. The report shows total milked volume as "Нетто"
without subtracting rejected portions.

### 4. ADMIN OVERVIEW EXPORT (Excel/PDF)
**BUG FOUND**: Uses the same overview data from milkAdmin.overview, so same problem.
The "Нетто" column shows volume - feeding - losses, NOT accounting for rejections.

### 5. MILKER ARM REPORT EXPORT (Excel/PDF)
**BUG FOUND**: Uses reportData which has same issue. The "Нетто" and per-type
volumes don't account for rejections.

## What Needs to Change

### Option A: Add "accepted volume" columns alongside raw volumes
The current "Нетто" = Надой - Выпойка - Потери (what goes to cheesemaker)
We need a new concept: "Принято" = actually accepted by cheesemaker

### Option B: Show rejection info in the stats
Add rejected volumes to the overview stats so admin can see the full picture.

### Recommended Fix:
1. **milkAdmin.overview**: Add per-type accepted/rejected volumes from milkReceptions table
2. **milkAdmin.overview**: Add a new "acceptedNetL" field that shows only accepted volumes
3. **reportData**: Include reception status per milk type in session data
4. **Reports**: Add "Принято" column and "Отклонено" column
5. **Tank display**: Tank volumes are correct (only accepted milk goes in), but the
   overview "Нетто" misleadingly suggests all net milk was accepted

## Key Insight
The "Нетто" (net) calculation represents what the milker SENT to the cheesemaker.
The "Принято" (accepted) represents what the cheesemaker actually accepted into tanks.
These are different numbers and both should be shown.

Currently only "Нетто" is shown, making it look like all milk was accepted.
