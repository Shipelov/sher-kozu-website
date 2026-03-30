# Visual Audit Findings — Summary

## Critical Issues (cause white screen / broken UX)

### 1. Dashboard (/dashboard) — 401 redirect for unauthenticated users
- `ownerDashboard` and `badges.myBadges` are protectedProcedure
- Called unconditionally without auth check
- Global 401 handler in main.tsx redirects to login
- Dashboard has guest handling (isGuestJourney) but it never fires because 401 redirect happens first
- FIX: Make ownerDashboard and myBadges conditional on isAuthenticated

### 2. ProductTracker (/tracker) — same 401 redirect issue
- `ownerDashboard` (protected) called unconditionally
- `productTracker.getByAnimal` (protected) called unconditionally  
- Has guest journey handling but 401 redirect fires first
- FIX: Make both queries conditional on isAuthenticated

### 3. Leaderboard (/leaderboard) — 401 redirect for unauthenticated users
- All 4 queries (herd, owners, myRating, ratingHistory) are protectedProcedure
- No auth check, no enabled guard
- FIX: Either make leaderboard procedures public, or add auth guard

### 4. AnimalCompare (/compare) — 401 redirect for unauthenticated users
- Uses `gamification.leaderboard.herd` (protectedProcedure)
- No auth check
- FIX: Make herd query conditional or change to publicProcedure

## Medium Issues (accessibility / i18n)

### 5. DashboardLayout — English text for Russian site
- "Sign in to continue" and "Sign in" button should be in Russian
- FIX: Translate to Russian

### 6. Images without alt text — 32 instances
- Accessibility issue across multiple pages
- FIX: Add descriptive alt text to all images

## Minor Issues (cosmetic)

### 7. Club post text overflow
- Post title and text rendered without line-clamp or overflow control
- Could cause layout issues with very long content

### 8. Z-index stacking
- Navbar z-50, MashaChat z-50, DashboardLayout header z-40
- Could cause overlap issues in edge cases
