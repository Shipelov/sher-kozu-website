# Core Flow Debug — Root Cause Found

## Database State
- **plans**: 1 row — id=1, ownerOpenId=jP5iBYMcdYguBWJPw5Sruu, planStatus=active
- **planDurations**: 0 rows — EMPTY TABLE
- **mira-goat**: id=30001, ownerOpenId=jP5iBYMcdYguBWJPw5Sruu (matches plan)

## Root Cause
`getAnimalBySlug` finds plan id=1 correctly, but `planDurations` table is empty.
So `plans[0].durations` = [] → client checks `defaultPlan?.durations?.[0]` → undefined → toast "Сценарий временно недоступен".

## Fix Strategy
1. Repair seed: ensure planDurations are created for existing plans if missing
2. Make client resilient: if no durations, use plan-level defaults or show helpful message
3. Add seed verification that planDurations exist for every active plan
