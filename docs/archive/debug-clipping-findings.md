# Key Finding: Sidebar overflow-hidden

Line 484 of sidebar.tsx:
The `sidebarMenuButtonVariants` has `overflow-hidden` in its base class. This is the standard shadcn/ui sidebar behavior.

The `[&>svg]:shrink-0` ensures SVG icons don't shrink, but the `overflow-hidden` on the button itself could clip icons if the button is too narrow.

When sidebar is collapsed (`group-data-[collapsible=icon]`), the button becomes `size-8!` (32px) and `p-2!` (8px padding). The icon is `size-4` (16px). So 8+16+8=32 which exactly fits.

The issue is likely NOT in the sidebar itself but in the overall page layout. The user said "на всех страницах" (on all pages), including the Navbar.

Possible root cause: The global `.flex { min-width: 0; min-height: 0; }` rule in index.css combined with tight containers. When flex containers have `min-width: 0`, they can shrink below their content size, and if a parent has `overflow: hidden`, the content gets clipped.

The fix should be adding `shrink-0` to all icon containers that are inside flex rows. Already done for Navbar and AboutFarm. Also need to check if there's a broader issue with the `overflow: hidden` on the page-level wrapper.

Note: AboutFarm.tsx line 152 has `overflow-hidden` on the root div: `<div className="min-h-screen overflow-hidden bg-background text-foreground">`. This could clip elements that extend beyond the viewport.
