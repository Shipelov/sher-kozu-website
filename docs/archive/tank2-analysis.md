# Tank 2 Analysis

## Current Tank Volumes
- Tank 1 (Козье): currentVolumeMl = 39000 (39л)
- Tank 2 (Овечье): currentVolumeMl = 0 (0л) ← PROBLEM
- Tank 3 (Коровье): currentVolumeMl = 68000 (68л)

## Tank 2 Movement History
1. id=3: milking_in +57000 → 57000 (session 3, reception 5, SK-220426-E)
2. id=8: waste -27000 → 30000 (admin cancel session 3, reception 5)
3. id=11: waste -30000 → 0 (admin cancel session 2, reception 2)
4. id=14: milking_in +17000 → 17000 (session 4, reception 8, SK-220426-M)
5. id=17: milking_in +34000 → 51000 (session 5, reception 11, SK-220426-E)
6. id=22: adjustment -27000 → 0 (admin delete reception #14) ← SUSPICIOUS
7. id=25: milking_in +18000 → 18000 (session 7, reception 21, SK-230426-E)
8. id=28: waste -18000 → 0 (admin cancel session 7, reception 21)

## Analysis of id=22 (adjustment -27000)
- This was "Удаление приёмки #14 админом"
- Reception #14 was deleted by admin
- But the adjustment removed 27000ml from tank 2
- At that point tank 2 had 51000ml (from movements 14+17)
- After adjustment: tankVolumeAfterMl = 0 ← BUT 51000 - 27000 = 24000, not 0!
- Wait, looking at the data: tankVolumeAfterMl = 0 for id=22
- But 51000 - 27000 = 24000... unless the tank was already at 27000

Actually let me recalculate:
- After id=17: tank2 = 51000
- id=22 adjustment: -27000, tankVolumeAfterMl = 0
- This means the tank was at 27000 before this adjustment, not 51000
- But there's no movement between id=17 and id=22 for tank 2...

Wait - reception #14 was for tank 2. Let me check what reception #14 was.
The note says "Удаление приёмки #14 админом" - reception id 14 was deleted.
Looking at the movements: id=14 was milking_in +17000 for session 4, reception 8.
But the delete says reception #14, not movement #14.

So reception #14 had volume 27000ml and was in tank 2.
The adjustment correctly removed 27000ml.
But tankVolumeAfterMl shows 0, meaning tank was at 27000 before adjustment.

Wait - between id=17 (tank2=51000) and id=22, was there another movement?
No movements for tank 2 between id=17 and id=22.

So the bug is: tankVolumeAfterMl was calculated incorrectly during the adjustment.
The actual tank volume should have been 51000 - 27000 = 24000, but it was set to 0.

OR: The currentVolumeMl in the tank was already wrong at that point.

After id=28 (waste -18000 → 0): tank2 went from 18000 to 0.
id=25 added 18000 → 18000, then id=28 removed 18000 → 0.
So the current 0 is correct based on the last two movements.

But the REAL question is: should there be milk in tank 2?
Looking at accepted receptions that haven't been cancelled:
- Session 4 (SK-220426-M): reception 8 (Овечье, 17000ml) - was this deleted? id=22 says "Удаление приёмки #14" 
- Session 5 (SK-220426-E): reception 11 (Овечье, 34000ml) - still valid?
- Session 7 (SK-230426-E): reception 21 (Овечье, 18000ml) - cancelled by id=28
- Session 8 (SK-230426-M): no Овечье reception!

Need to check which receptions are still active (accepted status).
