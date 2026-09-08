# Clipping Issue Analysis

The user reports that icons/avatars appear "slightly clipped" across all pages.

## Potential causes:

1. **`.flex { min-width: 0; min-height: 0; }` in index.css** — This global override affects ALL flex containers. While it prevents flex items from overflowing, it can cause content to be clipped when combined with `overflow: hidden` on parent elements.

2. **`overflow: hidden` on SidebarMenuButton** — The sidebar menu button has `overflow-hidden` in its class, which clips any content that extends beyond the button boundaries.

3. **`overflow: hidden` on Avatar** — The Avatar component has `overflow-hidden rounded-full` which is correct for avatars but if the sizing is tight, content can be clipped.

4. **`maximum-scale=1` in viewport meta** — This prevents zooming but shouldn't cause clipping.

## Most likely cause:
The `.flex { min-width: 0; min-height: 0; }` global rule combined with tight sizing on icon containers. When a flex container has `min-width: 0`, its children can shrink below their intrinsic size, causing icons to appear clipped.

## Fix approach:
- Add `shrink-0` to icon containers that shouldn't shrink
- Check if Avatar components have sufficient size
- Ensure icon containers in the sidebar have `overflow-visible` where needed
