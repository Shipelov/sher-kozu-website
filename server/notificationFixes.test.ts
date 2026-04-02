/**
 * Tests for notification fixes:
 * 1. adminApprovePlan sends notification to owner
 * 2. requestPlanChange sends notification to admin
 * 3. adminConfirmPlan clears adminNote
 * 4. ownerConfigurePlan sends notification to admin
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

// ─── 1. Router source code tests (verify notification calls exist) ───

const ROUTER_SRC = fs.readFileSync(
  path.resolve(__dirname, "routers/productTrack.ts"),
  "utf-8"
);

const DB_SRC = fs.readFileSync(
  path.resolve(__dirname, "db.ts"),
  "utf-8"
);

describe("adminApprovePlan notification to owner", () => {
  it("calls createUserNotification after plan approval", () => {
    // Find the adminApprovePlan mutation section
    const approveStart = ROUTER_SRC.indexOf("adminApprovePlan:");
    const approveEnd = ROUTER_SRC.indexOf("requestPlanChange:", approveStart);
    const approveSection = ROUTER_SRC.slice(approveStart, approveEnd);

    expect(approveSection).toContain("createUserNotification");
  });

  it("notification includes plan confirmed title", () => {
    const approveStart = ROUTER_SRC.indexOf("adminApprovePlan:");
    const approveEnd = ROUTER_SRC.indexOf("requestPlanChange:", approveStart);
    const approveSection = ROUTER_SRC.slice(approveStart, approveEnd);

    expect(approveSection).toContain("План подтверждён");
  });

  it("notification type is productPlanUpdate", () => {
    const approveStart = ROUTER_SRC.indexOf("adminApprovePlan:");
    const approveEnd = ROUTER_SRC.indexOf("requestPlanChange:", approveStart);
    const approveSection = ROUTER_SRC.slice(approveStart, approveEnd);

    expect(approveSection).toContain('type: "productPlanUpdate"');
  });

  it("notification includes animal name and delivery schedule info", () => {
    const approveStart = ROUTER_SRC.indexOf("adminApprovePlan:");
    const approveEnd = ROUTER_SRC.indexOf("requestPlanChange:", approveStart);
    const approveSection = ROUTER_SRC.slice(approveStart, approveEnd);

    expect(approveSection).toContain("animalName");
    expect(approveSection).toContain("График доставок сформирован");
  });

  it("notification includes link to animal page", () => {
    const approveStart = ROUTER_SRC.indexOf("adminApprovePlan:");
    const approveEnd = ROUTER_SRC.indexOf("requestPlanChange:", approveStart);
    const approveSection = ROUTER_SRC.slice(approveStart, approveEnd);

    expect(approveSection).toContain("animalSlug");
    expect(approveSection).toContain("link:");
  });

  it("gets animal name and slug for notification", () => {
    const approveStart = ROUTER_SRC.indexOf("adminApprovePlan:");
    const approveEnd = ROUTER_SRC.indexOf("requestPlanChange:", approveStart);
    const approveSection = ROUTER_SRC.slice(approveStart, approveEnd);

    expect(approveSection).toContain("getAnimalNameById");
    expect(approveSection).toContain("getAnimalSlugById");
  });
});

describe("ownerConfigurePlan notification to admin", () => {
  it("calls notifyOwner after plan configuration", () => {
    const configStart = ROUTER_SRC.indexOf("ownerConfigurePlan:");
    const configEnd = ROUTER_SRC.indexOf("adminApprovePlan:", configStart);
    const configSection = ROUTER_SRC.slice(configStart, configEnd);

    expect(configSection).toContain("notifyOwner");
  });

  it("notification includes plan configured title", () => {
    const configStart = ROUTER_SRC.indexOf("ownerConfigurePlan:");
    const configEnd = ROUTER_SRC.indexOf("adminApprovePlan:", configStart);
    const configSection = ROUTER_SRC.slice(configStart, configEnd);

    expect(configSection).toContain("План настроен");
  });

  it("notification includes milk usage info", () => {
    const configStart = ROUTER_SRC.indexOf("ownerConfigurePlan:");
    const configEnd = ROUTER_SRC.indexOf("adminApprovePlan:", configStart);
    const configSection = ROUTER_SRC.slice(configStart, configEnd);

    expect(configSection).toContain("totalMilkUsed");
    expect(configSection).toContain("Подтвердите в админ-панели");
  });
});

describe("requestPlanChange notification to admin", () => {
  it("calls notifyOwner after plan change request", () => {
    const requestStart = ROUTER_SRC.indexOf("requestPlanChange:");
    const requestEnd = ROUTER_SRC.indexOf("canChangePlan:", requestStart);
    const requestSection = ROUTER_SRC.slice(requestStart, requestEnd);

    expect(requestSection).toContain("notifyOwner");
  });

  it("notification includes change request title", () => {
    const requestStart = ROUTER_SRC.indexOf("requestPlanChange:");
    const requestEnd = ROUTER_SRC.indexOf("canChangePlan:", requestStart);
    const requestSection = ROUTER_SRC.slice(requestStart, requestEnd);

    expect(requestSection).toContain("Запрос на изменение плана");
  });

  it("notification includes animal name", () => {
    const requestStart = ROUTER_SRC.indexOf("requestPlanChange:");
    const requestEnd = ROUTER_SRC.indexOf("canChangePlan:", requestStart);
    const requestSection = ROUTER_SRC.slice(requestStart, requestEnd);

    expect(requestSection).toContain("getAnimalNameById");
    expect(requestSection).toContain("animalName");
  });
});

describe("adminConfirmPlan clears adminNote", () => {
  it("sets adminNote to null when confirming plan", () => {
    // Find the adminConfirmPlan function in db.ts
    const confirmStart = DB_SRC.indexOf("export async function adminConfirmPlan");
    const confirmEnd = DB_SRC.indexOf("export async function", confirmStart + 10);
    const confirmSection = DB_SRC.slice(confirmStart, confirmEnd);

    expect(confirmSection).toContain("adminNote: null");
  });

  it("sets status to confirmed", () => {
    const confirmStart = DB_SRC.indexOf("export async function adminConfirmPlan");
    const confirmEnd = DB_SRC.indexOf("export async function", confirmStart + 10);
    const confirmSection = DB_SRC.slice(confirmStart, confirmEnd);

    expect(confirmSection).toContain('status: "confirmed"');
  });

  it("sets confirmedAt timestamp", () => {
    const confirmStart = DB_SRC.indexOf("export async function adminConfirmPlan");
    const confirmEnd = DB_SRC.indexOf("export async function", confirmStart + 10);
    const confirmSection = DB_SRC.slice(confirmStart, confirmEnd);

    expect(confirmSection).toContain("confirmedAt: new Date()");
  });
});

// ─── Complete notification coverage audit ───

describe("notification coverage for all lifecycle mutations", () => {
  const mutations = [
    {
      name: "ownerConfigurePlan",
      endMarker: "adminApprovePlan:",
      expectedNotification: "notifyOwner",
      description: "owner configures plan → admin notified",
    },
    {
      name: "adminApprovePlan",
      endMarker: "requestPlanChange:",
      expectedNotification: "createUserNotification",
      description: "admin approves plan → owner notified",
    },
    {
      name: "requestPlanChange",
      endMarker: "canChangePlan:",
      expectedNotification: "notifyOwner",
      description: "owner requests change → admin notified",
    },
    {
      name: "adminResetPlan",
      endMarker: "getPlanById:",
      expectedNotification: "createUserNotification",
      description: "admin resets plan → owner notified",
    },
  ];

  for (const m of mutations) {
    it(`${m.name}: ${m.description}`, () => {
      const start = ROUTER_SRC.indexOf(`${m.name}:`);
      const end = ROUTER_SRC.indexOf(m.endMarker, start);
      const section = ROUTER_SRC.slice(start, end);

      expect(section).toContain(m.expectedNotification);
    });
  }

  it("all lifecycle mutations have error-safe notification calls (.catch)", () => {
    for (const m of mutations) {
      const start = ROUTER_SRC.indexOf(`${m.name}:`);
      const end = ROUTER_SRC.indexOf(m.endMarker, start);
      const section = ROUTER_SRC.slice(start, end);

      // Notification calls should be fire-and-forget with .catch
      expect(section).toContain(".catch(");
    }
  });
});
