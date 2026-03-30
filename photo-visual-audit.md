# Visual Photo Audit

## Catalog (/animals)

### Мира (коза)
- Photo shown: Brown alpine goat = alpine-1-cropped.jpg (this IS the correct cover photo from DB)
- coverImageUrl in animals table matches the isCover photo in animalPhotos
- Status: **CORRECT** — the catalog card shows the right photo from the DB
- Note: The photo filename says 'alpine' but the breed is listed as 'Зааненская' (Saanen). This is a data issue, not a code issue.

### Руфа (овца)
- Photo shown: White sheep face photo (lacaune-2-cropped.jpg) - matches coverImageUrl in DB
- Status: **CORRECT**

### Злата (овца)
- Photo shown: White sheep face photo (ostfriesian-1-cropped.jpg) - matches coverImageUrl in DB
- Status: **CORRECT**

## Catalog Summary: All 3 animals show correct cover photos from DB.

## Tracker (/tracker)

### Мира (/tracker?animal=mira)
- Hero photo: Brown alpine goat (alpine-1-cropped.jpg) - matches coverImageUrl in DB
- Animal card photo: Same brown alpine goat
- Animal switcher: Shows Mira avatar correctly
- Status: **CORRECT**

### Руфа (/tracker?animal=Rufa)
- Hero photo: White sheep face (lacaune-2-cropped.jpg) - matches coverImageUrl in DB
- Animal card photo: Same white sheep
- Animal switcher: Shows Rufa avatar correctly
- Status: **CORRECT**

### Злата (/tracker?animal=zlata)
- Hero photo: White sheep face (ostfriesian-1-cropped.jpg) - matches coverImageUrl in DB
- Animal card photo: Same white sheep
- Animal switcher: Shows Zlata avatar correctly
- Status: **CORRECT**

## Tracker Summary: All 3 animals show correct cover photos.

## Next: Check Club, Profile, Dashboard
