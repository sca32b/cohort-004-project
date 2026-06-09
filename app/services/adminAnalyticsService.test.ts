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
  getPlatformRevenueTimeSeries,
  getAdminPeriodStartDate,
  getCourseBreakdown,
  getInstructorsWithCourses,
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

  describe("getPlatformRevenueTimeSeries", () => {
    it("returns empty array when no purchases exist and period is all", () => {
      const result = getPlatformRevenueTimeSeries("all");
      expect(result).toEqual([]);
    });

    it("returns pre-filled zero buckets for 7d period", () => {
      const result = getPlatformRevenueTimeSeries("7d");
      expect(result).toHaveLength(7);
      expect(result.every((b) => b.revenue === 0)).toBe(true);
    });

    it("returns pre-filled zero buckets for 30d period", () => {
      const result = getPlatformRevenueTimeSeries("30d");
      expect(result).toHaveLength(30);
      expect(result.every((b) => b.revenue === 0)).toBe(true);
    });

    it("returns 12 monthly buckets for 12m period", () => {
      const result = getPlatformRevenueTimeSeries("12m");
      expect(result).toHaveLength(12);
      expect(result[0].date).toMatch(/^\d{4}-\d{2}$/);
    });

    it("aggregates revenue into correct daily buckets", () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 3000,
          country: "US",
          createdAt: today.toISOString(),
        })
        .run();
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
          pricePaid: 2000,
          country: "GB",
          createdAt: today.toISOString(),
        })
        .run();

      const result = getPlatformRevenueTimeSeries("7d");
      const todayBucket = result[result.length - 1];
      expect(todayBucket.revenue).toBe(5000);
    });

    it("aggregates revenue across multiple courses", () => {
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

      const today = new Date();
      today.setHours(12, 0, 0, 0);

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 1000,
          country: "US",
          createdAt: today.toISOString(),
        })
        .run();
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: secondCourse.id,
          pricePaid: 4000,
          country: "US",
          createdAt: today.toISOString(),
        })
        .run();

      const result = getPlatformRevenueTimeSeries("7d");
      const todayBucket = result[result.length - 1];
      expect(todayBucket.revenue).toBe(5000);
    });

    it("uses monthly granularity for 'all' period", () => {
      const today = new Date();
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 5000,
          country: "US",
          createdAt: today.toISOString(),
        })
        .run();

      const result = getPlatformRevenueTimeSeries("all");
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].date).toMatch(/^\d{4}-\d{2}$/);
    });

    it("includes zero-revenue days between purchases", () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);

      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 1000,
          country: "US",
          createdAt: today.toISOString(),
        })
        .run();
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 2000,
          country: "US",
          createdAt: threeDaysAgo.toISOString(),
        })
        .run();

      const result = getPlatformRevenueTimeSeries("7d");
      const zeroBuckets = result.filter((b) => b.revenue === 0);
      expect(zeroBuckets.length).toBe(5);
    });
  });

  describe("getInstructorsWithCourses", () => {
    it("returns instructors who have at least one course", () => {
      const result = getInstructorsWithCourses();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Test Instructor");
    });

    it("does not return instructors without courses", () => {
      testDb
        .insert(schema.users)
        .values({
          name: "No Courses Instructor",
          email: "nocourses@example.com",
          role: schema.UserRole.Instructor,
        })
        .run();

      const result = getInstructorsWithCourses();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Test Instructor");
    });

    it("returns multiple instructors with courses", () => {
      const secondInstructor = testDb
        .insert(schema.users)
        .values({
          name: "Another Instructor",
          email: "another@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      testDb
        .insert(schema.courses)
        .values({
          title: "Another Course",
          slug: "another-course",
          description: "Another course",
          instructorId: secondInstructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .run();

      const result = getInstructorsWithCourses();
      expect(result).toHaveLength(2);
    });
  });

  describe("getCourseBreakdown", () => {
    it("returns empty array when no courses exist", () => {
      // Delete the seeded course first
      testDb.delete(schema.courses).run();
      const result = getCourseBreakdown("all");
      expect(result).toEqual([]);
    });

    it("returns all courses with their details", () => {
      const result = getCourseBreakdown("all");
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Test Course");
      expect(result[0].instructorName).toBe("Test Instructor");
      expect(result[0].revenue).toBe(0);
      expect(result[0].sales).toBe(0);
      expect(result[0].enrollments).toBe(0);
      expect(result[0].averageRating).toBeNull();
    });

    it("includes revenue and sales from purchases", () => {
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
          pricePaid: 2999,
          country: "GB",
        })
        .run();

      const result = getCourseBreakdown("all");
      expect(result[0].revenue).toBe(7998);
      expect(result[0].sales).toBe(2);
    });

    it("includes enrollment count", () => {
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
        })
        .run();

      const result = getCourseBreakdown("all");
      expect(result[0].enrollments).toBe(1);
    });

    it("includes average rating", () => {
      testDb
        .insert(schema.courseRatings)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          rating: 4,
        })
        .run();
      testDb
        .insert(schema.courseRatings)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
          rating: 5,
        })
        .run();

      const result = getCourseBreakdown("all");
      expect(result[0].averageRating).toBe(4.5);
    });

    it("filters by instructor when instructorId is provided", () => {
      const secondInstructor = testDb
        .insert(schema.users)
        .values({
          name: "Second Instructor",
          email: "instructor2@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      testDb
        .insert(schema.courses)
        .values({
          title: "Second Course",
          slug: "second-course",
          description: "Second course",
          instructorId: secondInstructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .run();

      const allCourses = getCourseBreakdown("all");
      expect(allCourses).toHaveLength(2);

      const filtered = getCourseBreakdown("all", base.instructor.id);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe("Test Course");
    });

    it("respects time period for revenue and enrollments", () => {
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
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
          enrolledAt: oldDate.toISOString(),
        })
        .run();

      const result7d = getCourseBreakdown("7d");
      expect(result7d[0].revenue).toBe(4999);
      expect(result7d[0].sales).toBe(1);
      expect(result7d[0].enrollments).toBe(1);

      const resultAll = getCourseBreakdown("all");
      expect(resultAll[0].revenue).toBe(7499);
      expect(resultAll[0].sales).toBe(2);
      expect(resultAll[0].enrollments).toBe(2);
    });

    it("shows list price from course", () => {
      testDb
        .update(schema.courses)
        .set({ price: 9999 })
        .run();

      const result = getCourseBreakdown("all");
      expect(result[0].listPrice).toBe(9999);
    });
  });
});
