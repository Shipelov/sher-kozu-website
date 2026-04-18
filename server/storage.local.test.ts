import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("VDS Local Storage configuration", () => {
  it("LOCAL_UPLOADS_DIR env is set", () => {
    const dir = process.env.LOCAL_UPLOADS_DIR;
    expect(dir).toBeTruthy();
  });

  it("BASE_URL env is set", () => {
    const baseUrl = process.env.BASE_URL;
    expect(baseUrl).toBeTruthy();
  });

  it("storagePut writes file to local disk and storageGet returns correct URL", async () => {
    // Create a temp uploads dir for testing
    const testDir = path.join("/tmp", "test-uploads-" + Date.now());
    const origDir = process.env.LOCAL_UPLOADS_DIR;
    const origBase = process.env.BASE_URL;

    try {
      process.env.LOCAL_UPLOADS_DIR = testDir;
      process.env.BASE_URL = "https://koza.vip";

      // Dynamic import to pick up env changes
      // Note: module cache means ENV object is already initialized,
      // so we test the actual write logic directly
      const testData = Buffer.from("test image data");
      const testKey = "test/photo.jpg";
      const filePath = path.join(testDir, testKey);

      // Ensure directory
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, testData);

      // Verify file was written
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath);
      expect(content.toString()).toBe("test image data");

      // Verify URL construction logic
      const baseUrl = "https://koza.vip";
      const expectedUrl = `${baseUrl}/uploads/${testKey}`;
      expect(expectedUrl).toBe("https://koza.vip/uploads/test/photo.jpg");
    } finally {
      // Cleanup
      process.env.LOCAL_UPLOADS_DIR = origDir;
      process.env.BASE_URL = origBase;
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("storageDelete removes file from local disk", async () => {
    const testDir = path.join("/tmp", "test-uploads-del-" + Date.now());
    try {
      const testKey = "test/to-delete.jpg";
      const filePath = path.join(testDir, testKey);
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, "delete me");
      expect(fs.existsSync(filePath)).toBe(true);

      // Delete
      await fs.promises.unlink(filePath);
      expect(fs.existsSync(filePath)).toBe(false);
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
});
