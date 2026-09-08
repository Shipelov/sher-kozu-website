import { describe, expect, it, vi } from "vitest";
import {
  backgroundJobCount,
  backgroundJobsEnabled,
  stopBackgroundJobs,
  trackBackgroundJob,
} from "./_core/backgroundJobs";

describe("backgroundJobs", () => {
  it("под vitest фоновые задачи выключены", () => {
    expect(backgroundJobsEnabled()).toBe(false);
  });

  it("stopBackgroundJobs снимает зарегистрированные таймеры", async () => {
    const tick = vi.fn();
    trackBackgroundJob(setInterval(tick, 5));
    trackBackgroundJob(setTimeout(tick, 5));
    expect(backgroundJobCount()).toBe(2);

    stopBackgroundJobs();
    expect(backgroundJobCount()).toBe(0);

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(tick).not.toHaveBeenCalled();
  });
});
