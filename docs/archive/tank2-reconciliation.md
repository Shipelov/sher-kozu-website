# Tank 2 (Sheep) Reconciliation

## Active Receptions for Tank 2 (sheep, accepted):
- id=8: session 4, sheep, accepted 17000ml → tank 2
- id=11: session 5, sheep, accepted 34000ml → tank 2
- id=24: session 8, sheep, REJECTED 30000ml → no tank (correct!)

## Sum of accepted sheep receptions: 17000 + 34000 = 51000ml

## Tank 2 Movements:
- id=3: +57000 → 57000 (old, cancelled)
- id=8: -27000 → 30000 (old, cancelled)
- id=11: -30000 → 0 (old, cancelled)
- id=14: +17000 → 17000 (session 4, rec 8) ✓
- id=17: +34000 → 51000 (session 5, rec 11) ✓
- id=22: adjustment -27000 → 0 (admin delete reception #14)
  ← BUG! This deleted reception #14 which was for tank 1 (goat), NOT tank 2!
  Wait - "Удаление приёмки #14 админом" - reception id 14 doesn't exist anymore.
  But the movement was for tankId=2... 
  
  Actually looking at the earlier movements data:
  - Movement id=22: tankId=2, adjustment -27000, tankVolumeAfterMl=0
  - Note: "Удаление приёмки #14 админом"
  
  The old reception #14 was probably a sheep reception that was deleted.
  But the adjustment removed 27000ml when the tank should have had 51000ml.
  After adjustment: 51000 - 27000 = 24000, but tankVolumeAfterMl shows 0.
  
  WAIT - this was from the old bug where the code was broken.
  The adjustment set tankVolumeAfterMl=0 incorrectly.

- id=25: +18000 → 18000 (session 7, rec 21, later cancelled)
- id=28: -18000 → 0 (cancel session 7, rec 21)

## Current tank volume: 0ml
## Expected tank volume based on accepted receptions: 51000ml

## ROOT CAUSE:
Movement id=22 (adjustment for deleting reception #14) incorrectly set the tank volume.
The tank had 51000ml, the adjustment was -27000ml, but tankVolumeAfterMl was set to 0 instead of 24000.
This was caused by the earlier bug in the deleteReception code.

Additionally, the movements from sessions 7 (add then cancel) net to 0, so they don't affect the final result.

## FIX NEEDED:
Tank 2 currentVolumeMl should be 51000ml (17000 + 34000 from accepted receptions 8 and 11).
Need to correct the tank volume in the database.

## Tank 1 (Goat) Check:
Accepted goat receptions: 
- id=7: 17000ml (session 4)
- id=10: 8000ml (session 5)  
- id=23: 14000ml (session 8)
Total: 39000ml ← matches currentVolumeMl=39000 ✓

## Tank 3 (Cow) Check:
Accepted cow receptions:
- id=9: 30000ml (session 4)
- id=12: 9000ml (session 5)
- id=25: 20000ml (session 8)
Total: 59000ml ← but currentVolumeMl=68000! MISMATCH!

Wait let me recheck movements for tank 3:
- id=15: +30000 → 30000 (session 4, rec 9) ✓
- id=18: +9000 → 39000 (session 5, rec 12) ✓
- id=21: +9000 → 48000 (session 6, rec 15) ← session 6 reception 15!
- id=26: +15000 → 63000 (session 7, rec 22, later cancelled)
- id=29: -15000 → 48000 (cancel session 7, rec 22)
- id=31: +20000 → 68000 (session 8, rec 25) ✓

So tank 3 has movement id=21 from session 6, reception 15.
But reception 15 was deleted from the receptions table!
The milk was added to tank 3 but the reception no longer exists.

So tank 3 should be: 30000 + 9000 + 20000 = 59000ml (from existing accepted receptions)
But it shows 68000ml because of the orphaned movement from deleted reception 15 (+9000ml).

## SUMMARY OF FIXES:
1. Tank 2: currentVolumeMl should be 51000 (not 0) — lost 51000ml due to buggy adjustment
2. Tank 3: currentVolumeMl should be 59000 (not 68000) — has 9000ml from orphaned reception 15
