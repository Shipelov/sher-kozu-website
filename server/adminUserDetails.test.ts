import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// Read source files for static analysis
const routersSrc = readFileSync(
  path.resolve(__dirname, "routers.ts"),
  "utf-8"
);
const dbSrc = readFileSync(path.resolve(__dirname, "db.ts"), "utf-8");
const drawerSrc = readFileSync(
  path.resolve(__dirname, "../client/src/components/UserDetailDrawer.tsx"),
  "utf-8"
);
const adminUsersSrc = readFileSync(
  path.resolve(__dirname, "../client/src/pages/AdminUsers.tsx"),
  "utf-8"
);

describe("User Detail Card Feature", () => {
  describe("DB Function: getUserDetailsAdmin", () => {
    it("should export getUserDetailsAdmin function", () => {
      expect(dbSrc).toContain("export async function getUserDetailsAdmin");
    });

    it("should accept userOpenId parameter", () => {
      const fnStart = dbSrc.indexOf("export async function getUserDetailsAdmin");
      const fnSignature = dbSrc.slice(fnStart, fnStart + 200);
      expect(fnSignature).toContain("userOpenId: string");
    });

    it("should fetch user profile with all required fields", () => {
      const fnStart = dbSrc.indexOf("export async function getUserDetailsAdmin");
      const fnBody = dbSrc.slice(fnStart, fnStart + 1500);
      expect(fnBody).toContain("users.id");
      expect(fnBody).toContain("users.openId");
      expect(fnBody).toContain("users.name");
      expect(fnBody).toContain("users.email");
      expect(fnBody).toContain("users.phone");
      // plainPassword removed for security — no longer selected
      expect(fnBody).toContain("users.role");
      expect(fnBody).toContain("users.createdAt");
      expect(fnBody).toContain("users.lastSignedIn");
      expect(fnBody).toContain("users.bitrix24ContactId");
      expect(fnBody).toContain("users.loginMethod");
      expect(fnBody).toContain("users.deletedAt");
    });

    it("should return null when user not found", () => {
      const fnStart = dbSrc.indexOf("export async function getUserDetailsAdmin");
      const fnBody = dbSrc.slice(fnStart, fnStart + 1500);
      expect(fnBody).toContain("return null");
    });

    it("should fetch animal ownerships with animal info", () => {
      const fnStart = dbSrc.indexOf("export async function getUserDetailsAdmin");
      const fnBody = dbSrc.slice(fnStart, fnStart + 3000);
      expect(fnBody).toContain("animalOwnerships");
      expect(fnBody).toContain("animals.name");
      expect(fnBody).toContain("animalOwnerships.status");
      expect(fnBody).toContain("animalOwnerships.priceMinor");
    });

    it("should fetch product plans", () => {
      const fnStart = dbSrc.indexOf("export async function getUserDetailsAdmin");
      const fnBody = dbSrc.slice(fnStart, fnStart + 4000);
      expect(fnBody).toContain("ownerProductPlans");
      expect(fnBody).toContain("ownerProductPlans.status");
      expect(fnBody).toContain("totalMilkUsed");
    });

    it("should fetch delivery schedule", () => {
      const fnStart = dbSrc.indexOf("export async function getUserDetailsAdmin");
      const fnBody = dbSrc.slice(fnStart, fnStart + 5000);
      expect(fnBody).toContain("deliverySchedule");
      expect(fnBody).toContain("deliverySchedule.status");
      expect(fnBody).toContain("deliveredAt");
    });

    it("should fetch chat messages (limited to 50)", () => {
      const fnStart = dbSrc.indexOf("export async function getUserDetailsAdmin");
      const fnBody = dbSrc.slice(fnStart, fnStart + 6000);
      expect(fnBody).toContain("chatMessages");
      expect(fnBody).toContain(".limit(50)");
    });

    it("should fetch plan change log (limited to 30)", () => {
      const fnStart = dbSrc.indexOf("export async function getUserDetailsAdmin");
      const fnBody = dbSrc.slice(fnStart, fnStart + 7000);
      expect(fnBody).toContain("planChangeLog");
      expect(fnBody).toContain(".limit(30)");
    });

    it("should fetch wallet and wallet transactions", () => {
      const fnStart = dbSrc.indexOf("export async function getUserDetailsAdmin");
      const fnBody = dbSrc.slice(fnStart, fnStart + 8000);
      expect(fnBody).toContain("wallets");
      expect(fnBody).toContain("walletTransactions");
      expect(fnBody).toContain("balanceMinor");
    });

    it("should return structured result with all sections", () => {
      const fnStart = dbSrc.indexOf("export async function getUserDetailsAdmin");
      const fnBody = dbSrc.slice(fnStart, fnStart + 8500);
      expect(fnBody).toContain("user,");
      expect(fnBody).toContain("ownerships:");
      expect(fnBody).toContain("productPlans:");
      expect(fnBody).toContain("deliveries:");
      expect(fnBody).toContain("chatMessages:");
      expect(fnBody).toContain("changeLog:");
      expect(fnBody).toContain("wallets:");
      expect(fnBody).toContain("walletTransactions:");
    });
  });

  describe("Router Procedure: adminUserDetails.getDetails", () => {
    it("should have adminUserDetails router", () => {
      expect(routersSrc).toContain("adminUserDetails: router({");
    });

    it("should have getDetails procedure", () => {
      const section = routersSrc.slice(
        routersSrc.indexOf("adminUserDetails: router({"),
        routersSrc.indexOf("adminUserDetails: router({") + 800
      );
      expect(section).toContain("getDetails:");
    });

    it("should require userOpenId input", () => {
      const section = routersSrc.slice(
        routersSrc.indexOf("adminUserDetails: router({"),
        routersSrc.indexOf("adminUserDetails: router({") + 800
      );
      expect(section).toContain("userOpenId: z.string()");
    });

    it("should use adminProcedure", () => {
      const section = routersSrc.slice(
        routersSrc.indexOf("adminUserDetails: router({"),
        routersSrc.indexOf("adminUserDetails: router({") + 800
      );
      expect(section).toContain("adminProcedure");
    });

    it("should throw NOT_FOUND when user does not exist", () => {
      const section = routersSrc.slice(
        routersSrc.indexOf("adminUserDetails: router({"),
        routersSrc.indexOf("adminUserDetails: router({") + 800
      );
      expect(section).toContain("NOT_FOUND");
    });

    it("should call getUserDetailsAdmin with userOpenId", () => {
      const section = routersSrc.slice(
        routersSrc.indexOf("adminUserDetails: router({"),
        routersSrc.indexOf("adminUserDetails: router({") + 800
      );
      expect(section).toContain("getUserDetailsAdmin(input.userOpenId)");
    });
  });

  describe("UserDetailDrawer Component", () => {
    it("should accept userOpenId and onClose props", () => {
      expect(drawerSrc).toContain("userOpenId: string | null");
      expect(drawerSrc).toContain("onClose: () => void");
    });

    it("should call adminUserDetails.getDetails query", () => {
      expect(drawerSrc).toContain("trpc.adminUserDetails.getDetails.useQuery");
    });

    it("should only enable query when userOpenId is provided", () => {
      expect(drawerSrc).toContain("enabled: !!userOpenId");
    });

    it("should show loading spinner while fetching", () => {
      expect(drawerSrc).toContain("isLoading");
      expect(drawerSrc).toContain("animate-spin");
    });

    it("should show error state", () => {
      expect(drawerSrc).toContain("error");
      expect(drawerSrc).toContain("Ошибка загрузки");
    });

    it("should display user profile information", () => {
      expect(drawerSrc).toContain("data.user.name");
      expect(drawerSrc).toContain("data.user.email");
      expect(drawerSrc).toContain("data.user.phone");
      expect(drawerSrc).toContain("data.user.role");
    });

    it("should have tabs for all data sections", () => {
      expect(drawerSrc).toContain('value="ownerships"');
      expect(drawerSrc).toContain('value="plans"');
      expect(drawerSrc).toContain('value="deliveries"');
      expect(drawerSrc).toContain('value="chat"');
      expect(drawerSrc).toContain('value="wallet"');
      expect(drawerSrc).toContain('value="log"');
    });

    it("should show ownerships with animal names", () => {
      expect(drawerSrc).toContain("data.ownerships");
      expect(drawerSrc).toContain("o.animalName");
    });

    it("should show product plans", () => {
      expect(drawerSrc).toContain("data.productPlans");
      expect(drawerSrc).toContain("p.animalName");
    });

    it("should show deliveries", () => {
      expect(drawerSrc).toContain("data.deliveries");
      expect(drawerSrc).toContain("d.animalName");
    });

    it("should show chat messages with sender distinction", () => {
      expect(drawerSrc).toContain("data.chatMessages");
      expect(drawerSrc).toContain('m.sender === "admin"');
    });

    it("should show wallet balance and transactions", () => {
      expect(drawerSrc).toContain("data.wallets");
      expect(drawerSrc).toContain("data.walletTransactions");
      expect(drawerSrc).toContain("w.balanceMinor");
    });

    it("should show change log entries", () => {
      expect(drawerSrc).toContain("data.changeLog");
      expect(drawerSrc).toContain("entry.action");
    });

    it("should have close button", () => {
      expect(drawerSrc).toContain("onClose");
    });

    it("should NOT show plainPassword (removed for security)", () => {
      expect(drawerSrc).not.toContain("data.user.plainPassword");
    });

    it("should show Bitrix24 contact ID badge", () => {
      expect(drawerSrc).toContain("data.user.bitrix24ContactId");
      expect(drawerSrc).toContain("Bitrix #");
    });

    it("should show deleted status badge when user is in trash", () => {
      expect(drawerSrc).toContain("data.user.deletedAt");
      expect(drawerSrc).toContain("В корзине");
    });

    it("should have overlay backdrop for closing", () => {
      expect(drawerSrc).toContain("bg-black/40");
      expect(drawerSrc).toContain("backdrop-blur");
    });

    it("should have empty state components for each tab", () => {
      expect(drawerSrc).toContain("EmptyState");
      expect(drawerSrc).toContain("Нет владений");
      expect(drawerSrc).toContain("Нет продуктовых планов");
      expect(drawerSrc).toContain("Нет доставок");
      expect(drawerSrc).toContain("Нет сообщений");
      expect(drawerSrc).toContain("Нет транзакций");
      expect(drawerSrc).toContain("Нет записей в логе");
    });
  });

  describe("AdminUsers Integration", () => {
    it("should import UserDetailDrawer", () => {
      expect(adminUsersSrc).toContain(
        'import UserDetailDrawer from "@/components/UserDetailDrawer"'
      );
    });

    it("should have selectedUserOpenId state", () => {
      expect(adminUsersSrc).toContain("selectedUserOpenId");
      expect(adminUsersSrc).toContain("setSelectedUserOpenId");
    });

    it("should set selectedUserOpenId on row click", () => {
      expect(adminUsersSrc).toContain(
        "onClick={() => setSelectedUserOpenId(u.openId)"
      );
    });

    it("should render UserDetailDrawer with correct props", () => {
      expect(adminUsersSrc).toContain("<UserDetailDrawer");
      expect(adminUsersSrc).toContain("userOpenId={selectedUserOpenId}");
      expect(adminUsersSrc).toContain(
        "onClose={() => setSelectedUserOpenId(null)}"
      );
    });

    it("should have cursor-pointer on table rows", () => {
      expect(adminUsersSrc).toContain("cursor-pointer");
    });

    it("should stop propagation on action buttons to prevent drawer opening", () => {
      expect(adminUsersSrc).toContain("e.stopPropagation()");
    });

    it("should stop propagation on action buttons", () => {
      expect(adminUsersSrc).toContain("stopPropagation");
    });
  });
});
