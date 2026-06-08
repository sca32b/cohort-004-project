import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  getRevenueStatsForCourse,
  getRevenueTimeSeries,
  getPeriodStartDate,
  getGranularity,
  getCompletionRateForCourse,
} from "./analyticsService";

describe("analyticsService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("getPeriodStartDate", () => {
    it("returns null for 'all'", () => {
      expect(getPeriodStartDate("all")).toBeNull();
    });

    it("returns a date string for '7d'", () => {
      const result = getPeriodStartDate("7d");
      expect(result).not.toBeNull();
      const date = new Date(result!);
      const now = new Date();
      const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(7, 0);
    });

    it("returns a date string for '30d'", () => {
      const result = getPeriodStartDate("30d");
      expect(result).not.toBeNull();
      const date = new Date(result!);
      const now = new Date();
      const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(30, 0);
    });

    it("returns a date string for '90d'", () => {
      const result = getPeriodStartDate("90d");
      expect(result).not.toBeNull();
      const date = new Date(result!);
      const now = new Date();
      const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(90, 0);
    });
  });

  describe("getRevenueStatsForCourse", () => {
    it("returns zeros when no purchases exist", () => {
      const stats = getRevenueStatsForCourse(base.course.id, "all");
      expect(stats.totalRevenue).toBe(0);
      expect(stats.purchaseCount).toBe(0);
      expect(stats.averagePrice).toBe(0);
    });

    it("aggregates revenue from multiple purchases", () => {
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
        })
        .run();
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
          pricePaid: 2500,
          country: "IN",
        })
        .run();

      const stats = getRevenueStatsForCourse(base.course.id, "all");
      expect(stats.totalRevenue).toBe(7499);
      expect(stats.purchaseCount).toBe(2);
      expect(stats.averagePrice).toBe(3750);
    });

    it("filters purchases by time period", () => {
      // Recent purchase (today)
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: new Date().toISOString(),
        })
        .run();

      // Old purchase (60 days ago)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
          pricePaid: 2500,
          country: "IN",
          createdAt: oldDate.toISOString(),
        })
        .run();

      const stats7d = getRevenueStatsForCourse(base.course.id, "7d");
      expect(stats7d.totalRevenue).toBe(4999);
      expect(stats7d.purchaseCount).toBe(1);

      const stats30d = getRevenueStatsForCourse(base.course.id, "30d");
      expect(stats30d.totalRevenue).toBe(4999);
      expect(stats30d.purchaseCount).toBe(1);

      const stats90d = getRevenueStatsForCourse(base.course.id, "90d");
      expect(stats90d.totalRevenue).toBe(7499);
      expect(stats90d.purchaseCount).toBe(2);

      const statsAll = getRevenueStatsForCourse(base.course.id, "all");
      expect(statsAll.totalRevenue).toBe(7499);
      expect(statsAll.purchaseCount).toBe(2);
    });

    it("does not include purchases from other courses", () => {
      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "Another course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
        })
        .run();
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: otherCourse.id,
          pricePaid: 9999,
          country: "US",
        })
        .run();

      const stats = getRevenueStatsForCourse(base.course.id, "all");
      expect(stats.totalRevenue).toBe(4999);
      expect(stats.purchaseCount).toBe(1);
    });

    it("handles purchase at period boundary", () => {
      // Purchase 6 days ago (inside 7d window)
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 6);
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: recentDate.toISOString(),
        })
        .run();

      // Purchase 8 days ago (outside 7d window)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 8);
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
          pricePaid: 2500,
          country: "GB",
          createdAt: oldDate.toISOString(),
        })
        .run();

      const stats = getRevenueStatsForCourse(base.course.id, "7d");
      expect(stats.purchaseCount).toBe(1);
      expect(stats.totalRevenue).toBe(4999);
    });
  });

  describe("getCompletionRateForCourse", () => {
    it("returns 0 when no enrollments exist", () => {
      const rate = getCompletionRateForCourse(base.course.id);
      expect(rate).toBe(0);
    });

    it("returns 100 when all enrollments are completed", () => {
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          completedAt: new Date().toISOString(),
        })
        .run();
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
          completedAt: new Date().toISOString(),
        })
        .run();

      const rate = getCompletionRateForCourse(base.course.id);
      expect(rate).toBe(100);
    });

    it("returns correct percentage for mixed completed/incomplete enrollments", () => {
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          completedAt: new Date().toISOString(),
        })
        .run();
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
          completedAt: null,
        })
        .run();

      const rate = getCompletionRateForCourse(base.course.id);
      expect(rate).toBe(50);
    });

    it("does not include enrollments from other courses", () => {
      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "Another course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          completedAt: new Date().toISOString(),
        })
        .run();
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: otherCourse.id,
          completedAt: null,
        })
        .run();

      const rate = getCompletionRateForCourse(base.course.id);
      expect(rate).toBe(100);
    });

    it("rounds to nearest integer", () => {
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          completedAt: new Date().toISOString(),
        })
        .run();
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
          completedAt: null,
        })
        .run();

      const thirdUser = testDb
        .insert(schema.users)
        .values({
          name: "Third",
          email: "third@test.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();
      testDb
        .insert(schema.enrollments)
        .values({
          userId: thirdUser.id,
          courseId: base.course.id,
          completedAt: null,
        })
        .run();

      const rate = getCompletionRateForCourse(base.course.id);
      expect(rate).toBe(33);
    });
  });

  describe("getGranularity", () => {
    it("returns daily for 7d", () => {
      expect(getGranularity("7d")).toBe("daily");
    });

    it("returns daily for 30d", () => {
      expect(getGranularity("30d")).toBe("daily");
    });

    it("returns weekly for 90d", () => {
      expect(getGranularity("90d")).toBe("weekly");
    });

    it("returns monthly for all", () => {
      expect(getGranularity("all")).toBe("monthly");
    });
  });

  describe("getRevenueTimeSeries", () => {
    it("returns empty array when no purchases exist for 'all' period", () => {
      const result = getRevenueTimeSeries(base.course.id, "all");
      expect(result).toEqual([]);
    });

    it("returns pre-filled zero buckets for bounded periods with no purchases", () => {
      const result = getRevenueTimeSeries(base.course.id, "7d");
      expect(result.length).toBe(7);
      for (const bucket of result) {
        expect(bucket.revenue).toBe(0);
        expect(bucket.purchases).toBe(0);
      }
    });

    it("buckets purchases into correct daily slots for 7d", () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: today.toISOString(),
        })
        .run();

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
          pricePaid: 2500,
          country: "IN",
          createdAt: yesterday.toISOString(),
        })
        .run();

      const result = getRevenueTimeSeries(base.course.id, "7d");
      expect(result.length).toBe(7);

      const todayBucket = result.find(
        (b) => b.date === today.toISOString().slice(0, 10)
      );
      expect(todayBucket).toBeDefined();
      expect(todayBucket!.revenue).toBe(4999);
      expect(todayBucket!.purchases).toBe(1);

      const yesterdayBucket = result.find(
        (b) => b.date === yesterday.toISOString().slice(0, 10)
      );
      expect(yesterdayBucket).toBeDefined();
      expect(yesterdayBucket!.revenue).toBe(2500);
      expect(yesterdayBucket!.purchases).toBe(1);
    });

    it("aggregates multiple purchases in the same bucket", () => {
      const today = new Date();
      today.setHours(10, 0, 0, 0);
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: today.toISOString(),
        })
        .run();
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
          pricePaid: 2500,
          country: "IN",
          createdAt: today.toISOString(),
        })
        .run();

      const result = getRevenueTimeSeries(base.course.id, "7d");
      const todayBucket = result.find(
        (b) => b.date === today.toISOString().slice(0, 10)
      );
      expect(todayBucket!.revenue).toBe(7499);
      expect(todayBucket!.purchases).toBe(2);
    });

    it("returns monthly buckets for 'all' period", () => {
      const date1 = new Date(2024, 0, 15);
      const date2 = new Date(2024, 2, 10);
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: date1.toISOString(),
        })
        .run();
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
          pricePaid: 2500,
          country: "IN",
          createdAt: date2.toISOString(),
        })
        .run();

      const result = getRevenueTimeSeries(base.course.id, "all");
      expect(result.length).toBe(2);
      expect(result[0].date).toBe("2024-01");
      expect(result[0].revenue).toBe(4999);
      expect(result[1].date).toBe("2024-03");
      expect(result[1].revenue).toBe(2500);
    });

    it("returns weekly buckets for 90d period", () => {
      const result = getRevenueTimeSeries(base.course.id, "90d");
      expect(result.length).toBe(13);
      for (const bucket of result) {
        expect(bucket.revenue).toBe(0);
        expect(bucket.purchases).toBe(0);
        // each bucket date should be a Monday (use UTC to avoid timezone issues)
        const day = new Date(bucket.date + "T00:00:00").getDay();
        expect(day).toBe(1);
      }
    });

    it("respects time period filtering", () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: today.toISOString(),
        })
        .run();

      // 60 days ago - outside 30d but inside 90d
      const oldDate = new Date(today);
      oldDate.setDate(oldDate.getDate() - 60);
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
          pricePaid: 2500,
          country: "IN",
          createdAt: oldDate.toISOString(),
        })
        .run();

      const result30d = getRevenueTimeSeries(base.course.id, "30d");
      const totalRevenue30d = result30d.reduce((sum, b) => sum + b.revenue, 0);
      expect(totalRevenue30d).toBe(4999);

      const result90d = getRevenueTimeSeries(base.course.id, "90d");
      const totalRevenue90d = result90d.reduce((sum, b) => sum + b.revenue, 0);
      expect(totalRevenue90d).toBe(7499);
    });
  });
});
