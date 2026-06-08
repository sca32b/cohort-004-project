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
  getPlatformRevenueStats,
  getAdminPeriodStartDate,
} from "./adminAnalyticsService";

describe("adminAnalyticsService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("getAdminPeriodStartDate", () => {
    it("returns null for 'all'", () => {
      expect(getAdminPeriodStartDate("all")).toBeNull();
    });

    it("returns a date string for '7d'", () => {
      const result = getAdminPeriodStartDate("7d");
      expect(result).not.toBeNull();
      const date = new Date(result!);
      const now = new Date();
      const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(7, 0);
    });

    it("returns a date string for '30d'", () => {
      const result = getAdminPeriodStartDate("30d");
      expect(result).not.toBeNull();
      const date = new Date(result!);
      const now = new Date();
      const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(30, 0);
    });

    it("returns a date roughly 1 year ago for '12m'", () => {
      const result = getAdminPeriodStartDate("12m");
      expect(result).not.toBeNull();
      const date = new Date(result!);
      const now = new Date();
      const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(365, 1);
    });
  });

  describe("getPlatformRevenueStats", () => {
    it("returns zeros when no purchases or enrollments exist", () => {
      const stats = getPlatformRevenueStats("all");
      expect(stats.totalRevenue).toBe(0);
      expect(stats.totalEnrollments).toBe(0);
      expect(stats.topCourse).toBeNull();
    });

    it("aggregates revenue across all courses", () => {
      const secondCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Second Course",
          slug: "second-course",
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
          courseId: secondCourse.id,
          pricePaid: 2999,
          country: "US",
        })
        .run();

      const stats = getPlatformRevenueStats("all");
      expect(stats.totalRevenue).toBe(7998);
    });

    it("counts total enrollments across all courses", () => {
      const secondCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Second Course",
          slug: "second-course",
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
        })
        .run();
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: secondCourse.id,
        })
        .run();

      const stats = getPlatformRevenueStats("all");
      expect(stats.totalEnrollments).toBe(2);
    });

    it("identifies the top earning course", () => {
      const secondCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Popular Course",
          slug: "popular-course",
          description: "A popular course",
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
          pricePaid: 2000,
          country: "US",
        })
        .run();
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: secondCourse.id,
          pricePaid: 5000,
          country: "US",
        })
        .run();
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.instructor.id,
          courseId: secondCourse.id,
          pricePaid: 5000,
          country: "GB",
        })
        .run();

      const stats = getPlatformRevenueStats("all");
      expect(stats.topCourse).not.toBeNull();
      expect(stats.topCourse!.title).toBe("Popular Course");
      expect(stats.topCourse!.revenue).toBe(10000);
    });

    it("filters by time period", () => {
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

      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          enrolledAt: new Date().toISOString(),
        })
        .run();

      const oldEnrollDate = new Date();
      oldEnrollDate.setDate(oldEnrollDate.getDate() - 60);
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
          enrolledAt: oldEnrollDate.toISOString(),
        })
        .run();

      const stats7d = getPlatformRevenueStats("7d");
      expect(stats7d.totalRevenue).toBe(4999);
      expect(stats7d.totalEnrollments).toBe(1);

      const stats30d = getPlatformRevenueStats("30d");
      expect(stats30d.totalRevenue).toBe(4999);
      expect(stats30d.totalEnrollments).toBe(1);

      const statsAll = getPlatformRevenueStats("all");
      expect(statsAll.totalRevenue).toBe(7499);
      expect(statsAll.totalEnrollments).toBe(2);
    });

    it("aggregates revenue from multiple instructors", () => {
      const secondInstructor = testDb
        .insert(schema.users)
        .values({
          name: "Second Instructor",
          email: "instructor2@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      const secondCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Second Instructor Course",
          slug: "second-instructor-course",
          description: "Course by second instructor",
          instructorId: secondInstructor.id,
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
          pricePaid: 3000,
          country: "US",
        })
        .run();
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: secondCourse.id,
          pricePaid: 7000,
          country: "US",
        })
        .run();

      const stats = getPlatformRevenueStats("all");
      expect(stats.totalRevenue).toBe(10000);
    });
  });
});
