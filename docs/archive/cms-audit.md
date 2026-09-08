# CMS Content Blocks Audit

## Home Page (Home.tsx)

### Images (CDN object)
1. `home.hero_image` — Hero photo (CDN.hero)
2. `home.goat_image` — Goat portrait (CDN.goat)
3. `home.milk_image` — Milk products photo (CDN.milk)
4. `home.family_image` — Family/sheep photo (CDN.family)
5. `home.club_image` — Club event photo (CDN.club)
6. `home.masha_avatar` — Masha AI avatar image
7. `home.masha_video` — Masha intro video URL

### Section 1 — Hero
8. `home.hero_badge` — "Первый в России клуб персонального фермерства"
9. `home.hero_title` — "Ваша ферма. Ваше молоко. Ваша история."
10. `home.hero_subtitle` — Long description paragraph
11. `home.hero_cta_primary` — "Выбрать животное"
12. `home.hero_cta_secondary` — "Как это устроено"
13. `home.hero_image_caption` — "Конкретная ферма — конкретное животное..."
14. `home.hero_stats` — Array: [{value:"4", label:"породы"}, {value:"24ч", label:"доставка"}, ...]

### Section 2 — How It Works (steps array)
15. `home.howit_title` — "Как это работает"
16. `home.howit_heading` — "Три шага — от выбора животного..."
17. `home.howit_subtitle` — Description paragraph
18. `home.steps` — Array of 3 steps: [{index, title, text}]

### Section 3 — For Whom (audiences array)
19. `home.forwhom_title` — "Для кого это"
20. `home.forwhom_heading` — "Для тех, кому важна не только еда..."
21. `home.forwhom_subtitle` — Description paragraph
22. `home.audiences` — Array of 4 audiences: [{title, text}]

### Section 4 — Gallery Preview
23. `home.gallery_title` — "Галерея животных"
24. `home.gallery_heading` — "Познакомьтесь с животными фермы"
25. `home.gallery_subtitle` — Description paragraph
26. `home.goats_card_title` — "Англо-нубийские и альпийские козы"
27. `home.goats_card_text` — Description
28. `home.sheep_card_title` — "Овцы Остфриз и Лакон"
29. `home.sheep_card_text` — Description

### Section 5 — Why Us (values array)
30. `home.whyus_title` — "Почему Шерь Козу"
31. `home.whyus_heading` — "Не просто продукты — личная история с фермой"
32. `home.values` — Array of 4 values: [{title, text, stat, statLabel}]
33. `home.testimonials` — Array of 3 testimonials: [{text, author, role}]

### Section 6 — Product Preview
34. `home.products_title` — "Что вы получаете"
35. `home.products_heading` — "Что внутри именной коробки"
36. `home.products_subtitle` — Description paragraph
37. `home.products` — Array of 3 products: [{label, desc}]
38. `home.products_card_caption` — "Каждый продукт — с историей..."

### Section 7 — Final CTA
39. `home.cta_title` — "Начните сейчас"
40. `home.cta_heading` — "Станьте частью первого в России клуба..."
41. `home.cta_subtitle` — Description paragraph

## Catalog Page (AnimalsCatalog.tsx)

### Header Block
42. `catalog.badge` — "Каталог животных"
43. `catalog.heading` — "Найдите своё животное элитной породы"
44. `catalog.subtitle` — Description paragraph

### Status Cards (3 colored cards)
45. `catalog.status_relationship` — "В отношениях" description
46. `catalog.status_available` — "На выданье" description
47. `catalog.status_shared` — "Доступно для участия" description

## Design Decision
- Use a single `cmsBlocks` table with page + blockKey as composite key
- Store content as JSON to handle both simple strings and arrays
- Keep current hardcoded values as fallbacks when DB has no override
- Admin UI groups blocks by page and section for easy navigation
