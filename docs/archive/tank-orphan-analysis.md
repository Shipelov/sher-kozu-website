# Tank Orphan Analysis — April 23, 2026

## Problem
After user deleted all sessions (milkSessions), the reconciliation shows negative expected values.

## Root Cause
- Sessions: 0, Receptions: 0, Tank movements: 39
- All sessions and receptions were deleted, but 39 tank movements remain as orphans
- The reconciliation calculates: expected = SUM(accepted receptions) - SUM(outflows)
- Since receptions = 0, accepted sum = 0
- But outflows (waste + adjustment) still exist → expected = 0 - outflows = NEGATIVE

## Two fixes needed:

### Fix 1: Clean orphaned tank movements from production DB
Since all sessions and receptions are deleted, all tank movements are orphans.
Tank volumes are already 0. Just DELETE all movements.

### Fix 2: Improve session deletion to cascade-delete related data
When a session is deleted (admin), it should also:
1. Delete related receptions (milkReceptions where sessionId = X)
2. Delete related tank movements (milkTankMovements where sessionId = X)
3. Reset tank volumes properly

Currently the deleteSession code probably doesn't clean up tank movements.

### Fix 3: Reconciliation should handle orphaned movements gracefully
The reconciliation should also account for adjustment movements in the expected calculation,
or at minimum show a warning when orphaned movements exist.
