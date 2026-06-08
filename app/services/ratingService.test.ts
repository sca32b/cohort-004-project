import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  getUserRating,
  upsertRating,
  getCourseRatingStats,
  getCourseRatingStatsMultiple,
} from "./ratingService";

describe("ratingService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("upsertRating", () => {
    it("creates a new rating", () => {
      upsertRating(base.user.id, base.course.id, 4);

      const rating = getUserRating(base.user.id, base.course.id);
      expect(rating).not.toBeNull();
      expect(rating!.rating).toBe(4);
    });

    it("updates an existing rating", () => {
      upsertRating(base.user.id, base.course.id, 3);
      upsertRating(base.user.id, base.course.id, 5);

      const rating = getUserRating(base.user.id, base.course.id);
      expect(rating!.rating).toBe(5);
    });
  });

  describe("getUserRating", () => {
    it("returns null when no rating exists", () => {
      const rating = getUserRating(base.user.id, base.course.id);
      expect(rating).toBeUndefined();
    });
  });

  describe("getCourseRatingStats", () => {
    it("returns null average and 0 count when no ratings", () => {
      const stats = getCourseRatingStats(base.course.id);
      expect(stats.average).toBeNull();
      expect(stats.count).toBe(0);
    });

    it("calculates average and count correctly", () => {
      upsertRating(base.user.id, base.course.id, 4);
      upsertRating(base.instructor.id, base.course.id, 2);

      const stats = getCourseRatingStats(base.course.id);
      expect(stats.average).toBe(3);
      expect(stats.count).toBe(2);
    });
  });

  describe("getCourseRatingStatsMultiple", () => {
    it("returns empty map for empty input", () => {
      const map = getCourseRatingStatsMultiple([]);
      expect(map.size).toBe(0);
    });

    it("returns stats keyed by courseId", () => {
      upsertRating(base.user.id, base.course.id, 5);

      const map = getCourseRatingStatsMultiple([base.course.id]);
      const stats = map.get(base.course.id);
      expect(stats).toBeDefined();
      expect(stats!.average).toBe(5);
      expect(stats!.count).toBe(1);
    });
  });
});
