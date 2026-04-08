import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const CONTACT_EMAIL = "info@sherkozu.ru";

/**
 * Verify that the contact email is present in key UI components.
 * These are source-level checks to prevent accidental removal of contact info.
 */
describe("Contact email visibility", () => {
  const clientSrc = path.resolve(import.meta.dirname, "..", "client", "src");

  it("Footer component contains the contact email", () => {
    const footerPath = path.join(clientSrc, "components", "Footer.tsx");
    const content = fs.readFileSync(footerPath, "utf-8");
    expect(content).toContain(CONTACT_EMAIL);
    // Footer uses template literal `mailto:${CONTACT_EMAIL}` so check for the pattern
    expect(content).toContain("mailto:");
    expect(content).toContain(CONTACT_EMAIL);
  });

  it("Navbar component contains the contact email", () => {
    const navbarPath = path.join(clientSrc, "components", "Navbar.tsx");
    const content = fs.readFileSync(navbarPath, "utf-8");
    expect(content).toContain(CONTACT_EMAIL);
    expect(content).toContain("mailto:" + CONTACT_EMAIL);
  });

  it("Home page contains the contact email section", () => {
    const homePath = path.join(clientSrc, "pages", "Home.tsx");
    const content = fs.readFileSync(homePath, "utf-8");
    expect(content).toContain(CONTACT_EMAIL);
    expect(content).toContain("mailto:" + CONTACT_EMAIL);
  });

  it("Footer component is imported in key pages", () => {
    const pages = [
      "Home.tsx",
      "AboutFarm.tsx",
      "FAQ.tsx",
      "Partners.tsx",
      "Pricing.tsx",
      "PricingCalculator.tsx",
      "PricingCompare.tsx",
      "PricingTierDetail.tsx",
    ];

    for (const page of pages) {
      const pagePath = path.join(clientSrc, "pages", page);
      const content = fs.readFileSync(pagePath, "utf-8");
      expect(content, `${page} should import Footer`).toContain(
        'import Footer from "@/components/Footer"'
      );
      expect(content, `${page} should use <Footer />`).toContain("<Footer />");
    }
  });

  it("Footer component has response time hint", () => {
    const footerPath = path.join(clientSrc, "components", "Footer.tsx");
    const content = fs.readFileSync(footerPath, "utf-8");
    expect(content).toContain("Ответим в течение дня");
  });
});
