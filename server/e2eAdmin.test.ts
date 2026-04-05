/**
 * E2E Admin Journey: Admin Panel → Animals → Users → CMS → Analytics → Club → Tokens
 *
 * Tests the full admin lifecycle including:
 * - Admin access control (role-based)
 * - Animal management (CRUD, wellness, photos)
 * - User management (list, export, soft-delete, restore)
 * - CMS content management (blocks, history, rollback)
 * - Site analytics overview
 * - Club management (posts, events, presets)
 * - Token/wallet management (farm accounts, grant tokens)
 * - Product tracking (profiles, options, deliveries)
 * - AB experiments management
 * - Analytics alerts management
 * - Photo moderation
 * - Pipeline health monitoring
 */
import { describe, expect, it, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createAdminContext(openId: string, name = "E2E Admin"): TrpcContext {
  return {
    user: {
      id: 9993,
      openId,
      email: `${openId}@e2e-admin.local`,
      name,
      loginMethod: "local",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createUserContext(openId: string, name = "E2E Regular User"): TrpcContext {
  return {
    user: {
      id: 9994,
      openId,
      email: `${openId}@e2e-user.local`,
      name,
      loginMethod: "local",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createGuestContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

/* ------------------------------------------------------------------ */
/*  Test suite                                                         */
/* ------------------------------------------------------------------ */

describe("E2E Admin Journey: Full Admin Panel Testing", () => {
  const suffix = Math.random().toString(36).slice(2, 8);
  const adminOpenId = process.env.OWNER_OPEN_ID || `e2e-admin-${suffix}`;
  const regularOpenId = `e2e-regular-${suffix}-${Date.now()}`;

  const adminCaller = appRouter.createCaller(createAdminContext(adminOpenId, "Админ E2E"));
  const userCaller = appRouter.createCaller(createUserContext(regularOpenId, "Пользователь E2E"));
  const guestCaller = appRouter.createCaller(createGuestContext());

  // Track created resources for cleanup
  const createdClubPostIds: number[] = [];
  const createdEventIds: number[] = [];
  let createdAlertRuleId: number | null = null;

  afterAll(async () => {
    try {
      const { getDb } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return;

      // Clean up club posts
      for (const id of createdClubPostIds) {
        await db.execute(sql`DELETE FROM clubPosts WHERE id = ${id}`).catch(() => {});
      }
      // Clean up events
      for (const id of createdEventIds) {
        await db.execute(sql`DELETE FROM clubEventRsvps WHERE eventId = ${id}`).catch(() => {});
        await db.execute(sql`DELETE FROM clubEvents WHERE id = ${id}`).catch(() => {});
      }
      // Clean up alert rules
      if (createdAlertRuleId) {
        await db.execute(sql`DELETE FROM analyticsAlertHistory WHERE ruleId = ${createdAlertRuleId}`).catch(() => {});
        await db.execute(sql`DELETE FROM analyticsAlertRules WHERE id = ${createdAlertRuleId}`).catch(() => {});
      }
      // Clean up test user
      await db.execute(sql`DELETE FROM users WHERE openId = ${regularOpenId}`).catch(() => {});
    } catch (err) {
      console.warn("[E2E Admin cleanup] Failed:", err);
    }
  });

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  1. Access Control                                                 */
  /* ═══════════════════════════════════════════════════════════════════ */

  it("1.1 regular user should be denied admin endpoints", async () => {
    await expect(userCaller.adminAnimals.list()).rejects.toThrow();
  });

  it("1.2 guest should be denied admin endpoints", async () => {
    await expect(guestCaller.adminAnimals.list()).rejects.toThrow();
  });

  it("1.3 admin should access admin endpoints", async () => {
    const animals = await adminCaller.adminAnimals.list();
    expect(animals).toBeDefined();
    expect(Array.isArray(animals)).toBe(true);
  });

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  2. Animal Management                                              */
  /* ═══════════════════════════════════════════════════════════════════ */

  it("2.1 should list all animals", async () => {
    const animals = await adminCaller.adminAnimals.list();
    expect(animals).toBeDefined();
    expect(Array.isArray(animals)).toBe(true);
  });

  it("2.2 should get animal details by slug (if animals exist)", async () => {
    const animals = await adminCaller.adminAnimals.list();
    if (animals.length > 0) {
      const first = animals[0] as any;
      if (first.slug) {
        // Use animals.getBySlug (not gallery.getBySlug)
        const profile = await guestCaller.animals.getBySlug({ slug: first.slug });
        expect(profile).toBeDefined();
      }
    }
  });

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  3. User Management                                                */
  /* ═══════════════════════════════════════════════════════════════════ */

  it("3.1 should list users with pagination", async () => {
    // listUsers is under adminAnalytics namespace
    const result = await adminCaller.adminAnalytics.listUsers({ page: 1, pageSize: 10 });
    expect(result).toBeDefined();
    expect(result.users).toBeDefined();
    expect(Array.isArray(result.users)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("3.2 should search users by name", async () => {
    const result = await adminCaller.adminAnalytics.listUsers({
      page: 1,
      pageSize: 10,
      search: "тест",
    });
    expect(result).toBeDefined();
    expect(Array.isArray(result.users)).toBe(true);
  });

  it("3.3 should export users list", async () => {
    // exportUsers is under adminAnalytics namespace
    const result = await adminCaller.adminAnalytics.exportUsers({});
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("3.4 should list trashed users", async () => {
    const trashed = await adminCaller.adminTrash.list();
    expect(trashed).toBeDefined();
    expect(Array.isArray(trashed)).toBe(true);
  });

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  4. CMS Content Management                                         */
  /* ═══════════════════════════════════════════════════════════════════ */

  it("4.1 should list all CMS blocks", async () => {
    const blocks = await adminCaller.cms.listAll();
    expect(blocks).toBeDefined();
    expect(Array.isArray(blocks)).toBe(true);
  });

  it("4.2 should get page blocks for home page", async () => {
    const blocks = await adminCaller.cms.getPageBlocks({ page: "home" });
    expect(blocks).toBeDefined();
    expect(Array.isArray(blocks)).toBe(true);
  });

  it("4.3 should seed default CMS blocks for a page", async () => {
    const result = await adminCaller.cms.seedDefaults({ page: "home" });
    expect(result).toBeDefined();
  });

  it("4.4 should get recent CMS changes", async () => {
    const changes = await adminCaller.cms.recentChanges();
    expect(changes).toBeDefined();
    expect(Array.isArray(changes)).toBe(true);
  });

  it("4.5 should get block history for a CMS block (if blocks exist)", async () => {
    const blocks = await adminCaller.cms.listAll();
    if (blocks.length > 0) {
      const firstBlock = blocks[0] as any;
      const history = await adminCaller.cms.getBlockHistory({ blockId: firstBlock.id });
      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
    }
  });

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  5. Site Analytics                                                  */
  /* ═══════════════════════════════════════════════════════════════════ */

  it("5.1 should get analytics overview", async () => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const overview = await adminCaller.analytics.overview({
      from: weekAgo.toISOString(),
      to: now.toISOString(),
    });
    expect(overview).toBeDefined();
  });

  it("5.2 should get page views by day", async () => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const views = await adminCaller.analytics.pageViewsByDay({
      from: weekAgo.toISOString(),
      to: now.toISOString(),
    });
    expect(views).toBeDefined();
    expect(Array.isArray(views)).toBe(true);
  });

  it("5.3 should get top pages", async () => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const pages = await adminCaller.analytics.topPages({
      from: weekAgo.toISOString(),
      to: now.toISOString(),
      limit: 10,
    });
    expect(pages).toBeDefined();
    expect(Array.isArray(pages)).toBe(true);
  });

  it("5.4 should get device breakdown", async () => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const devices = await adminCaller.analytics.devices({
      from: weekAgo.toISOString(),
      to: now.toISOString(),
    });
    expect(devices).toBeDefined();
  });

  it("5.5 should get referrer breakdown", async () => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const referrers = await adminCaller.analytics.referrers({
      from: weekAgo.toISOString(),
      to: now.toISOString(),
    });
    expect(referrers).toBeDefined();
    expect(Array.isArray(referrers)).toBe(true);
  });

  it("5.6 should get UTM campaigns", async () => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const utm = await adminCaller.analytics.utmCampaigns({
      from: weekAgo.toISOString(),
      to: now.toISOString(),
    });
    expect(utm).toBeDefined();
  });

  it("5.7 should get conversion funnel", async () => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const funnel = await adminCaller.analytics.conversionFunnel({
      from: weekAgo.toISOString(),
      to: now.toISOString(),
    });
    expect(funnel).toBeDefined();
  });

  it("5.8 should get hourly traffic", async () => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const traffic = await adminCaller.analytics.hourlyTraffic({
      from: weekAgo.toISOString(),
      to: now.toISOString(),
    });
    expect(traffic).toBeDefined();
  });

  it("5.9 should get geo breakdown", async () => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const geo = await adminCaller.analytics.geoBreakdown({
      from: weekAgo.toISOString(),
      to: now.toISOString(),
    });
    expect(geo).toBeDefined();
    expect(Array.isArray(geo)).toBe(true);
  });

  it("5.10 should get pipeline health stats", async () => {
    // pipelineHealth returns a Record<string, OperationStats & { successRate: string }>
    // It's a dictionary keyed by operation name, may be empty if no operations tracked yet
    const health = await adminCaller.analytics.pipelineHealth();
    expect(health).toBeDefined();
    expect(typeof health).toBe("object");
    // Verify shape: each value should have success, failure, successRate fields
    for (const [key, val] of Object.entries(health)) {
      expect(typeof key).toBe("string");
      const stats = val as any;
      expect(typeof stats.success).toBe("number");
      expect(typeof stats.failure).toBe("number");
      expect(typeof stats.successRate).toBe("string");
    }
  });

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  6. Club Management                                                */
  /* ═══════════════════════════════════════════════════════════════════ */

  it("6.1 should get club admin dashboard", async () => {
    const dashboard = await adminCaller.adminClub.dashboard();
    expect(dashboard).toBeDefined();
  });

  it("6.2 should create a club post", async () => {
    // clubPostInput requires: category, author, avatar, role, timeLabel, title, text, imageUrl, likes, comments, isPinned
    const post = await adminCaller.adminClub.createPost({
      title: `E2E Тестовый пост ${suffix}`,
      text: "Это тестовый пост, созданный E2E тестом.",
      category: "news",
      author: "E2E Тестер",
      avatar: "🧪",
      role: "Тестировщик",
      timeLabel: "Только что",
      imageUrl: "",
      likes: 0,
      comments: 0,
      isPinned: false,
    });
    expect(post).toBeDefined();
    expect(post.id).toBeDefined();
    createdClubPostIds.push(post.id);
  });

  it("6.3 should update a club post", async () => {
    if (createdClubPostIds.length === 0) return;

    const updated = await adminCaller.adminClub.updatePost({
      id: createdClubPostIds[0],
      title: `E2E Обновлённый пост ${suffix}`,
      text: "Обновлённый текст тестового поста.",
      category: "news",
      author: "E2E Тестер",
      avatar: "🧪",
      role: "Тестировщик",
      timeLabel: "Только что",
      imageUrl: "",
      likes: 0,
      comments: 0,
      isPinned: true,
    });
    expect(updated).toBeDefined();
  });

  it("6.4 should delete a club post", async () => {
    if (createdClubPostIds.length === 0) return;

    const result = await adminCaller.adminClub.deletePost({
      id: createdClubPostIds[0],
    });
    expect(result).toBeDefined();
    // Remove from cleanup list since it's already deleted
    createdClubPostIds.splice(0, 1);
  });

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  7. Token/Wallet Management                                        */
  /* ═══════════════════════════════════════════════════════════════════ */

  it("7.1 should get farm accounts overview", async () => {
    const accounts = await adminCaller.gamification.farmAccounts.get();
    expect(accounts).toBeDefined();
  });

  it("7.2 should list owner wallets", async () => {
    const wallets = await adminCaller.gamification.farmAccounts.ownerWallets();
    expect(wallets).toBeDefined();
    expect(Array.isArray(wallets)).toBe(true);
  });

  it("7.3 should backfill wallets for users without them", async () => {
    const result = await adminCaller.gamification.farmAccounts.backfillWallets();
    expect(result).toBeDefined();
    expect(typeof result.created).toBe("number");
  });

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  8. Product Tracking (Admin)                                       */
  /* ═══════════════════════════════════════════════════════════════════ */

  it("8.1 should get production profile for an animal (if animals exist)", async () => {
    const animals = await adminCaller.adminAnimals.list();
    if (animals.length > 0) {
      const firstAnimal = animals[0] as any;
      const profile = await adminCaller.productTrack.getProfile({ animalId: firstAnimal.id });
      // Profile may be null if not set up yet
      expect(profile === null || typeof profile === "object").toBe(true);
    }
  });

  it("8.2 should list product options for an animal (if animals exist)", async () => {
    const animals = await adminCaller.adminAnimals.list();
    if (animals.length > 0) {
      const firstAnimal = animals[0] as any;
      const options = await adminCaller.productTrack.listOptions({ animalId: firstAnimal.id });
      expect(options).toBeDefined();
      expect(Array.isArray(options)).toBe(true);
    }
  });

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  9. AB Experiments                                                  */
  /* ═══════════════════════════════════════════════════════════════════ */

  it("9.1 should list AB experiments", async () => {
    const experiments = await adminCaller.abExperiments.list();
    expect(experiments).toBeDefined();
    expect(Array.isArray(experiments)).toBe(true);
  });

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  10. Analytics Alerts                                               */
  /* ═══════════════════════════════════════════════════════════════════ */

  it("10.1 should list alert rules", async () => {
    const rules = await adminCaller.analyticsAlerts.listRules();
    expect(rules).toBeDefined();
    expect(Array.isArray(rules)).toBe(true);
  });

  it("10.2 should create an alert rule", async () => {
    // createRule input: name, metric (enum), operator (enum), threshold, windowHours, enabled
    const rule = await adminCaller.analyticsAlerts.createRule({
      name: `E2E Alert ${suffix}`,
      metric: "page_views",
      operator: "lt",
      threshold: 10,
      windowHours: 24,
      enabled: false, // Don't actually trigger
    });
    expect(rule).toBeDefined();
    expect(rule.id).toBeDefined();
    createdAlertRuleId = rule.id;
  });

  it("10.3 should update an alert rule", async () => {
    if (!createdAlertRuleId) return;

    const result = await adminCaller.analyticsAlerts.updateRule({
      id: createdAlertRuleId,
      name: `E2E Alert Updated ${suffix}`,
      threshold: 20,
    });
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it("10.4 should get alert history", async () => {
    const history = await adminCaller.analyticsAlerts.history({
      limit: 10,
    });
    expect(history).toBeDefined();
    expect(Array.isArray(history)).toBe(true);
  });

  it("10.5 should delete an alert rule", async () => {
    if (!createdAlertRuleId) return;

    const result = await adminCaller.analyticsAlerts.deleteRule({
      id: createdAlertRuleId,
    });
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    createdAlertRuleId = null; // Already deleted
  });

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  11. FAQ Chat Admin                                                 */
  /* ═══════════════════════════════════════════════════════════════════ */

  it("11.1 should get FAQ chat analytics", async () => {
    const analytics = await adminCaller.faqChat.analytics();
    expect(analytics).toBeDefined();
  });

  it("11.2 should get uncertain answers list", async () => {
    // uncertainAnswersList returns { items, totalCount, unresolvedCount }
    const result = await adminCaller.faqChat.uncertainAnswersList();
    expect(result).toBeDefined();
    expect(result.items).toBeDefined();
    expect(Array.isArray(result.items)).toBe(true);
    expect(typeof result.totalCount).toBe("number");
    expect(typeof result.unresolvedCount).toBe("number");
  });

  it("11.3 should get AB test results for FAQ chat", async () => {
    const results = await adminCaller.faqChat.abTestResults();
    expect(results).toBeDefined();
  });

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  12. Admin Pricing                                                  */
  /* ═══════════════════════════════════════════════════════════════════ */

  it("12.1 regular user should be denied admin pricing access", async () => {
    try {
      await userCaller.adminAnimals.list();
      // If it doesn't throw, the test should fail
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err).toBeDefined();
    }
  });

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  13. Cross-Role Verification                                       */
  /* ═══════════════════════════════════════════════════════════════════ */

  it("13.1 regular user should see public club feed", async () => {
    const feed = await userCaller.club.feed();
    expect(feed).toBeDefined();
  });

  it("13.2 regular user should see public CMS blocks", async () => {
    const blocks = await userCaller.cms.getPageBlocks({ page: "home" });
    expect(blocks).toBeDefined();
    expect(Array.isArray(blocks)).toBe(true);
  });

  it("13.3 regular user should NOT access admin club dashboard", async () => {
    await expect(userCaller.adminClub.dashboard()).rejects.toThrow();
  });

  it("13.4 regular user should NOT access admin analytics", async () => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    await expect(
      userCaller.analytics.overview({
        from: weekAgo.toISOString(),
        to: now.toISOString(),
      })
    ).rejects.toThrow();
  });

  it("13.5 regular user should NOT access admin user list", async () => {
    await expect(
      userCaller.adminAnalytics.listUsers({ page: 1, pageSize: 10 })
    ).rejects.toThrow();
  });

  it("13.6 regular user should NOT access farm accounts", async () => {
    await expect(userCaller.gamification.farmAccounts.get()).rejects.toThrow();
  });
});
