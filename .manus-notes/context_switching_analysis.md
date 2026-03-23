# Context Switching Architecture Analysis

## Current State

### Dashboard (Dashboard.tsx)
- Calls `trpc.animals.ownerDashboard.useQuery()` → `getOwnerDashboardData(openId)`
- `getOwnerDashboardData` already respects `primaryAnimalId` from users table
- Returns: ownership, animal, productSummary, clubSummary, nextSteps, quickLinks, allOwnerships
- `setPrimaryAnimal` mutation only invalidates `utils.animals.ownerDashboard`

### ProductTracker (ProductTracker.tsx)
- Calls `trpc.animals.ownerDashboard.useQuery()` to get `ownerAnimalSlug`
- Then calls `trpc.productTracker.getByAnimal.useQuery({ animalSlug: fallbackAnimalSlug })`
- `fallbackAnimalSlug` = requestedAnimalSlug (from URL ?animal=) ?? ownerAnimalSlug ?? "marta"
- `ownerAnimalSlug` comes from `ownerDashboardQuery.data?.animal?.slug`
- **Key insight**: ProductTracker already depends on ownerDashboard data for the animal slug!
  So if we invalidate ownerDashboard, the ownerAnimalSlug will update, but the productTracker query
  won't re-fetch because its input (animalSlug) is computed from the stale cached data.

### ClubFeed (ClubFeed.tsx)
- Calls `trpc.animals.ownerDashboard.useQuery()` to get `ownerAnimal`
- Calls `trpc.club.feed.useQuery()` for club data
- `activeAnimalSlug` = ownerAnimal?.slug ?? requestedAnimalSlug ?? fallbackAnimal?.slug ?? "marta"
- Club feed data is NOT animal-specific (it's owner-level), but the animal context (name, links) comes from ownerDashboard
- **Key insight**: Club data doesn't change per animal, but the displayed animal context does.

## Plan

### 1. Dashboard setPrimaryAnimal onSuccess
Add invalidation of:
- `utils.productTracker.getByAnimal.invalidate()` — to force re-fetch with new animal slug
- `utils.club.feed.invalidate()` — to refresh club context
- `utils.animals.ownerDashboard.invalidate()` — already done

### 2. ProductTracker
- The ProductTracker uses `ownerDashboardQuery.data?.animal?.slug` as the default animal
- When ownerDashboard is invalidated, the query will refetch and return the new primary animal
- But the `trackerQuery` input depends on `fallbackAnimalSlug` which is derived from the dashboard data
- React Query should handle this: when ownerDashboard refetches, the component re-renders with new ownerAnimalSlug, which changes fallbackAnimalSlug, which triggers a new trackerQuery

### 3. ClubFeed
- Similar to ProductTracker: ownerDashboard invalidation will update the animal context
- Club data itself (posts, events, members) is owner-level, not animal-specific
- The animal name/links in the UI will update when ownerDashboard refetches

## Conclusion
The main change needed is in Dashboard.tsx: add invalidation of productTracker and club queries in the setPrimaryAnimal onSuccess handler. The downstream pages already derive their animal context from ownerDashboard data, so they will automatically update when that cache is invalidated.

However, there's a subtlety: ProductTracker's `trackerQuery` uses `fallbackAnimalSlug` as input. When ownerDashboard refetches, the component will re-render with the new slug, and React Query will fetch the new tracker data. This should work correctly.

To make the UX smoother, we should also:
1. Invalidate all related queries in one go
2. Consider showing a brief loading state on ProductTracker/ClubFeed when the context switches
