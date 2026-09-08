# Tank Volume Analysis

## Movement trace for Tank 2 (sheep):
1. +30000 (session 2, rec 2) → 30000
2. +27000 (session 3, rec 5) → 57000
3. -27000 waste (admin cancel session 3) → 30000
4. -30000 waste (admin cancel session 2) → 0
5. +17000 (session 4, rec 8) → 17000
6. +34000 (session 5, rec 11) → 51000
7. -27000 adjustment (admin delete rec 14) → 0  ← WAIT, rec 14 was from session 6 goat?!
   Actually rec 14 was the original goat reception for session 6 (before it was deleted)
   But this adjustment is on tank 2 (sheep)... that's wrong!
   
Wait, let me re-check. Movement 22: tank 2, adjustment -27000, note "Удаление приёмки #14 админом"
Reception 14 was deleted (not in current list). It was likely sheep from session 6.
The sheep net for session 6 = 30000 - 1000 - 2000 = 27000. So rec 14 was sheep, 27000ml.

So after movement 22: tank 2 = 51000 - 27000 = 24000... but it shows 0.
Wait, tankVolumeAfterMl = 0. But 51000 - 27000 = 24000, not 0.

Hmm, but then movement 25: +18000 → 18000. If it was 0 + 18000 = 18000, that matches.

So there was already an error: the adjustment set tankVolumeAfterMl to 0 when it should have been 24000.
But the actual currentVolumeMl in the tank is 18000, which = 0 + 18000 from session 7.

This means the delete reception code calculated the wrong tankVolumeAfterMl.
But the actual tank currentVolumeMl was updated correctly (to 24000 at that point).
Then later 18000 was added making it 42000... but actual is 18000.

Wait, I need to check if the tank's currentVolumeMl was also wrong.
Movement 22 says tankVolumeAfterMl = 0. If the code also SET currentVolumeMl = 0, 
then adding 18000 gives 18000 (which matches current).

But the CORRECT value should have been 24000 + 18000 = 42000.

So there's a bug in the deleteReception code that miscalculated the tank volume.
But this is a separate issue from the current task.

## For the current task:
Tank volumes are already wrong due to previous admin operations, but that's a data integrity issue.
The main task is: overview stats and reports should show accepted vs rejected volumes.

## Summary of issues to fix:
1. Overview stats: Add "Принято" and "Отклонено" rows from milkReceptions
2. Reports: Add accepted/rejected columns
3. Tank volumes are incorrect but that's a separate data integrity fix
