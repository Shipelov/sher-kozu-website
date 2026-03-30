# Photo Audit Results

## Мира (slug: mira)
- animals.coverImageUrl: alpine-1-cropped.jpg ✅
- animalPhotos isCover=1: alpine-1-cropped.jpg ✅
- Status: **SYNCED** — both match after previous fix

## Злата (slug: zlata)
- animals.coverImageUrl: ostfriesian-1-cropped.jpg ✅
- animalPhotos isCover=1: NONE (isCover=0 on the only photo)
- Issue: Photo exists (id=90005) but isCover=0. The animals table has the correct URL though.
- The photo URL in animals.coverImageUrl matches the photo in animalPhotos.
- Fix needed: Set isCover=1 on photo 90005 so the gallery shows it as cover.

## Руфа (slug: Rufa)
- animals.coverImageUrl: lacaune-2-cropped.jpg ✅
- animalPhotos isCover=1: lacaune-2-cropped.jpg ✅
- Status: **SYNCED** — both match
