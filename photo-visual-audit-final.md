# Photo Visual Audit - All Animals Across All Sections

## Database State (verified via SQL)
- **Mira**: coverImageUrl = alpine-1-cropped.jpg (CDN), animalPhotos isCover=1 matches ✅
- **Rufa**: coverImageUrl = sheep_portrait_a2f8d31e.jpg (CDN), animalPhotos isCover=1 matches ✅  
- **Zlata**: coverImageUrl = zlata-sheep-portrait.jpg (CDN), animalPhotos isCover=1 just set ✅

## Visual Verification Results

### Animal Profile Pages
- **Mira** (/animal/mira): Shows brown goat photo ✅ (matches coverImageUrl)
- **Rufa** (/animal/Rufa): Shows sheep with blue eyes ✅ (matches coverImageUrl)
- **Zlata** (/animal/zlata): Shows light-colored sheep ✅ (matches coverImageUrl)

### Catalog (/animals)
- All three animals show correct photos in their cards ✅

### Tracker (/tracker?animal=X)
- **Mira**: Shows correct brown goat photo ✅
- **Rufa**: Shows correct sheep photo ✅
- **Zlata**: Shows correct sheep photo ✅

### Dashboard (/dashboard)
- Hero shows Rufa (primary animal) photo ✅
- Animal cards at bottom show thumbnails for Zlata, Rufa, Mira ✅

### Club (/club)
- Need to verify - but club uses same data source as catalog

### Club (/club)
- Hero section shows farm event photo (generic, not animal-specific) ✅
- Right sidebar shows Rufa sheep photo in "Персональный ритуал" event card ✅
- "Маршруты сообщества" section shows Rufa photo ✅
- "Уведомления клуба" section shows farm path photo ✅
- Club feed posts show Admin avatar, not animal photos (expected behavior) ✅

## Summary
All photos are consistent across all verified sections. No discrepancies found.
- Mira: correct brown goat photo everywhere (profile, catalog, tracker, dashboard)
- Rufa: correct sheep with blue eyes photo everywhere (profile, catalog, tracker, dashboard, club)
- Zlata: correct light sheep photo everywhere (profile, catalog, tracker, dashboard)
- coverImageUrl in animals table is now synced with animalPhotos isCover for all 3 animals
