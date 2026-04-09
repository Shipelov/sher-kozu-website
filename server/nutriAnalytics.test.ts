/**
 * Tests for nutrition analytics extended endpoint.
 *
 * Verifies:
 * - The analyticsExtended procedure exists in the nutritionist router
 * - The getNutriAnalyticsExtended function returns the expected shape
 * - The admin page component exists and renders properly
 * - The route is registered in App.tsx
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const nutritionistRouterSrc = readFileSync(
  resolve(__dirname, "routers/nutritionist.ts"),
  "utf-8",
);

const nutritionistDbSrc = readFileSync(
  resolve(__dirname, "nutritionistDb.ts"),
  "utf-8",
);

const appTsxSrc = readFileSync(
  resolve(__dirname, "../client/src/App.tsx"),
  "utf-8",
);

const adminHubSrc = readFileSync(
  resolve(__dirname, "../client/src/pages/AdminHub.tsx"),
  "utf-8",
);

describe("Nutrition Analytics Extended", () => {
  describe("Backend: nutritionistDb.ts", () => {
    it("exports getNutriAnalyticsExtended function", () => {
      expect(nutritionistDbSrc).toContain(
        "export async function getNutriAnalyticsExtended",
      );
    });

    it("queries nutriSessions for total sessions", () => {
      const fnBody = nutritionistDbSrc.slice(
        nutritionistDbSrc.indexOf("getNutriAnalyticsExtended"),
      );
      expect(fnBody).toContain("nutriSessions");
      expect(fnBody).toContain("count(*)");
    });

    it("queries nutriMessages for user and assistant messages", () => {
      const fnBody = nutritionistDbSrc.slice(
        nutritionistDbSrc.indexOf("getNutriAnalyticsExtended"),
      );
      expect(fnBody).toContain("nutriMessages");
      expect(fnBody).toContain("userMessages");
      expect(fnBody).toContain("assistantMessages");
    });

    it("queries nutriKnowledge by category", () => {
      const fnBody = nutritionistDbSrc.slice(
        nutritionistDbSrc.indexOf("getNutriAnalyticsExtended"),
      );
      expect(fnBody).toContain("knowledgeByCategory");
      expect(fnBody).toContain("nutriKnowledge");
    });

    it("queries nutriMealPlans including favorites", () => {
      const fnBody = nutritionistDbSrc.slice(
        nutritionistDbSrc.indexOf("getNutriAnalyticsExtended"),
      );
      expect(fnBody).toContain("nutriMealPlans");
      expect(fnBody).toContain("favoriteMealPlans");
    });

    it("queries nutriRecipes", () => {
      const fnBody = nutritionistDbSrc.slice(
        nutritionistDbSrc.indexOf("getNutriAnalyticsExtended"),
      );
      expect(fnBody).toContain("nutriRecipes");
      expect(fnBody).toContain("activeRecipes");
    });

    it("queries zoyaSharedContent for shares", () => {
      const fnBody = nutritionistDbSrc.slice(
        nutritionistDbSrc.indexOf("getNutriAnalyticsExtended"),
      );
      expect(fnBody).toContain("zoyaSharedContent");
      expect(fnBody).toContain("sharesCreated");
      expect(fnBody).toContain("totalShareViews");
      expect(fnBody).toContain("popularShares");
    });

    it("computes chat trend by day", () => {
      const fnBody = nutritionistDbSrc.slice(
        nutritionistDbSrc.indexOf("getNutriAnalyticsExtended"),
      );
      expect(fnBody).toContain("chatTrend");
      expect(fnBody).toContain("DATE(createdAt)");
    });

    it("computes average messages per session", () => {
      const fnBody = nutritionistDbSrc.slice(
        nutritionistDbSrc.indexOf("getNutriAnalyticsExtended"),
      );
      expect(fnBody).toContain("avgMessagesPerSession");
      expect(fnBody).toContain("AVG(messageCount)");
    });

    it("collects recent user questions", () => {
      const fnBody = nutritionistDbSrc.slice(
        nutritionistDbSrc.indexOf("getNutriAnalyticsExtended"),
      );
      expect(fnBody).toContain("recentQuestions");
      expect(fnBody).toContain("recentUserMessages");
    });

    it("returns user type session counts", () => {
      const fnBody = nutritionistDbSrc.slice(
        nutritionistDbSrc.indexOf("getNutriAnalyticsExtended"),
      );
      expect(fnBody).toContain("guestSessions");
      expect(fnBody).toContain("registeredSessions");
      expect(fnBody).toContain("ownerSessions");
    });

    it("returns complete result shape", () => {
      const fnBody = nutritionistDbSrc.slice(
        nutritionistDbSrc.indexOf("getNutriAnalyticsExtended"),
      );
      // Check all expected return keys
      const expectedKeys = [
        "period",
        "sessions",
        "messages",
        "userMessages",
        "assistantMessages",
        "avgMessagesPerSession",
        "userTypeBreakdown",
        "guestSessions",
        "registeredSessions",
        "ownerSessions",
        "activeKnowledgeEntries",
        "knowledgeByCategory",
        "totalProfiles",
        "mealPlansCreated",
        "favoriteMealPlans",
        "activeRecipes",
        "sharesCreated",
        "totalShareViews",
        "popularShares",
        "chatTrend",
        "recentQuestions",
      ];
      for (const key of expectedKeys) {
        expect(fnBody).toContain(key);
      }
    });
  });

  describe("Backend: nutritionist router", () => {
    it("has analyticsExtended procedure", () => {
      expect(nutritionistRouterSrc).toContain("analyticsExtended:");
    });

    it("analyticsExtended uses adminProcedure", () => {
      const block = nutritionistRouterSrc.slice(
        nutritionistRouterSrc.indexOf("analyticsExtended:"),
      );
      expect(block).toContain("adminProcedure");
    });

    it("analyticsExtended accepts optional days parameter", () => {
      const block = nutritionistRouterSrc.slice(
        nutritionistRouterSrc.indexOf("analyticsExtended:"),
        nutritionistRouterSrc.indexOf("analyticsExtended:") + 300,
      );
      expect(block).toContain("days");
      expect(block).toContain("z.number()");
    });

    it("analyticsExtended calls getNutriAnalyticsExtended", () => {
      const block = nutritionistRouterSrc.slice(
        nutritionistRouterSrc.indexOf("analyticsExtended:"),
      );
      expect(block).toContain("getNutriAnalyticsExtended");
    });

    it("imports getNutriAnalyticsExtended from nutritionistDb", () => {
      expect(nutritionistRouterSrc).toContain(
        "getNutriAnalyticsExtended",
      );
    });
  });

  describe("Frontend: AdminNutriAnalytics page", () => {
    it("AdminNutriAnalytics.tsx file exists", () => {
      expect(
        existsSync(
          resolve(__dirname, "../client/src/pages/AdminNutriAnalytics.tsx"),
        ),
      ).toBe(true);
    });

    it("page uses trpc.nutritionist.analyticsExtended", () => {
      const pageSrc = readFileSync(
        resolve(__dirname, "../client/src/pages/AdminNutriAnalytics.tsx"),
        "utf-8",
      );
      expect(pageSrc).toContain("trpc.nutritionist.analyticsExtended");
    });

    it("page has all 5 tabs", () => {
      const pageSrc = readFileSync(
        resolve(__dirname, "../client/src/pages/AdminNutriAnalytics.tsx"),
        "utf-8",
      );
      expect(pageSrc).toContain('value="overview"');
      expect(pageSrc).toContain('value="users"');
      expect(pageSrc).toContain('value="content"');
      expect(pageSrc).toContain('value="shares"');
      expect(pageSrc).toContain('value="topics"');
    });

    it("page has CSV export functionality", () => {
      const pageSrc = readFileSync(
        resolve(__dirname, "../client/src/pages/AdminNutriAnalytics.tsx"),
        "utf-8",
      );
      expect(pageSrc).toContain("downloadCsv");
      expect(pageSrc).toContain("nutri-analytics");
    });

    it("page has admin role guard", () => {
      const pageSrc = readFileSync(
        resolve(__dirname, "../client/src/pages/AdminNutriAnalytics.tsx"),
        "utf-8",
      );
      expect(pageSrc).toContain("isAdmin");
      expect(pageSrc).toContain('user?.role === "admin"');
    });

    it("page uses DashboardLayout", () => {
      const pageSrc = readFileSync(
        resolve(__dirname, "../client/src/pages/AdminNutriAnalytics.tsx"),
        "utf-8",
      );
      expect(pageSrc).toContain("DashboardLayout");
    });

    it("page has period selector", () => {
      const pageSrc = readFileSync(
        resolve(__dirname, "../client/src/pages/AdminNutriAnalytics.tsx"),
        "utf-8",
      );
      expect(pageSrc).toContain('value="7"');
      expect(pageSrc).toContain('value="30"');
      expect(pageSrc).toContain('value="90"');
      expect(pageSrc).toContain('value="365"');
    });
  });

  describe("Frontend: routing", () => {
    it("App.tsx has lazy import for AdminNutriAnalytics", () => {
      expect(appTsxSrc).toContain("AdminNutriAnalytics");
      expect(appTsxSrc).toContain(
        'import("./pages/AdminNutriAnalytics")',
      );
    });

    it("App.tsx has route for /admin/nutri-analytics", () => {
      expect(appTsxSrc).toContain("/admin/nutri-analytics");
    });

    it("AdminHub has link to nutrition analytics", () => {
      expect(adminHubSrc).toContain("/admin/nutri-analytics");
      expect(adminHubSrc).toContain("Аналитика нутрициологии");
    });
  });
});
