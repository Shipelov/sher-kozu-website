# Tracker Bug Analysis

## Key Finding
User "Andrey Shipelov" (openId: jP5iBYMcdYguBWJPw5Sruu) has:
- primaryAnimalId = 270001 (Руфа, slug: "Rufa")
- Ownerships for Мира (30001, slug: "mira") and Злата (180005, slug: "zlata")

## Bug Root Cause
The user's `primaryAnimalId` is set to 270001 (Руфа). 
When the Dashboard loads, `ownerDashboard` returns Руфа as the primary animal.
The Dashboard then generates `trackerHref = /tracker?animal=Rufa`.

In ProductTracker.tsx:
1. `requestedAnimalSlug = getRequestedAnimalSlug()` → gets "Rufa" from URL
2. But if user navigates from Мира's cabinet, the URL should have `?animal=mira`

## The Real Issue
The user says "в кабинете Мира трекер перекидывает на Руфу".
This means when viewing Мира's dashboard/profile, clicking tracker link goes to Руфа.

Looking at Dashboard.tsx line 319:
```
const trackerHref = currentAnimal ? `/tracker?animal=${currentAnimal.slug}` : "/tracker";
```

The `currentAnimal` comes from `dashboard?.animal` which is resolved by `getOwnerDashboardData`.
Since primaryAnimalId = 270001 (Руфа), the dashboard always shows Руфа as the primary animal.

## Root Cause Summary

1. **AnimalProfile.tsx line 985**: Tracker link is `/tracker` without `?animal=` parameter.
   Club link correctly uses `/club?animal=${animalSlug}` but tracker doesn't. FIXED.

2. **ProductTracker.tsx line 222-224**: When no `?animal=` param in URL:
   - `requestedAnimalSlug` = null
   - Falls back to `ownerAnimalSlug` from `ownerDashboard` query
   - `ownerDashboard` returns primary animal = Руфа (id=270001)
   - So tracker always shows Руфа when no explicit animal param

3. **Dashboard.tsx line 319**: `trackerHref` correctly uses `currentAnimal.slug`.
   But `currentAnimal` comes from `ownerDashboard` which respects `primaryAnimalId`.
   Since primaryAnimalId=270001 (Руфа), Dashboard always links to Руфа's tracker.

4. **Navbar.tsx line 97**: `/tracker` link has no animal context.

## Fixes Applied
- AnimalProfile.tsx: `/tracker` → `/tracker?animal=${animalSlug}` ✅
- Need to also ensure Dashboard context switching works properly
- Navbar tracker link should use primary animal context or be generic
