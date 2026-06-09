import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "~/db";
import {
  purchases,
  courses,
  enrollments,
  users,
  courseRatings,
  UserRole,
} from "~/db/schema";

export type AdminPeriod = "7d" | "30d" | "12m" | "all";

export interface PlatformRevenueStats {
  totalRevenue: number;
  totalEnrollments: number;
  topCourse: { title: string; revenue: number } | null;
}

export function getAdminPeriodStartDate(period: AdminPeriod): string | null {
  if (period === "all") return null;
  const now = new Date();
  if (period === "12m") {
    now.setFullYear(now.getFullYear() - 1);
  } else {
    const days = period === "7d" ? 7 : 30;
    now.setDate(now.getDate() - days);
  }
  return now.toISOString();
}

export function getPlatformRevenueStats(
  period: AdminPeriod
): PlatformRevenueStats {
  const startDate = getAdminPeriodStartDate(period);

  const purchaseConditions = startDate
    ? [gte(purchases.createdAt, startDate)]
    : [];

  const revenueResult = db
    .select({
      totalRevenue: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)`,
    })
    .from(purchases)
    .where(
      purchaseConditions.length > 0 ? and(...purchaseConditions) : undefined
    )
    .get()!;

  const enrollmentConditions = startDate
    ? [gte(enrollments.enrolledAt, startDate)]
    : [];

  const enrollmentResult = db
    .select({
      totalEnrollments: sql<number>`count(*)`,
    })
    .from(enrollments)
    .where(
      enrollmentConditions.length > 0 ? and(...enrollmentConditions) : undefined
    )
    .get()!;

  const topCourseResult = db
    .select({
      title: courses.title,
      revenue: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)`,
    })
    .from(purchases)
    .innerJoin(courses, sql`${purchases.courseId} = ${courses.id}`)
    .where(
      purchaseConditions.length > 0 ? and(...purchaseConditions) : undefined
    )
    .groupBy(purchases.courseId)
    .orderBy(sql`sum(${purchases.pricePaid}) desc`)
    .limit(1)
    .get();

  return {
    totalRevenue: Number(revenueResult.totalRevenue),
    totalEnrollments: Number(enrollmentResult.totalEnrollments),
    topCourse: topCourseResult
      ? {
          title: topCourseResult.title,
          revenue: Number(topCourseResult.revenue),
        }
      : null,
  };
}

export interface PlatformTimeSeriesBucket {
  date: string;
  revenue: number;
}

type Granularity = "daily" | "monthly";

function getAdminGranularity(period: AdminPeriod): Granularity {
  return period === "7d" || period === "30d" ? "daily" : "monthly";
}

function formatDateForGranularity(
  dateStr: string,
  granularity: Granularity
): string {
  const d = new Date(dateStr);
  if (granularity === "daily") {
    return d.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 7);
}

function generateAdminBuckets(
  period: AdminPeriod,
  granularity: Granularity
): string[] {
  const buckets: string[] = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (granularity === "daily") {
    const days = period === "7d" ? 7 : 30;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      buckets.push(d.toISOString().slice(0, 10));
    }
  } else {
    const months = 12;
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      buckets.push(d.toISOString().slice(0, 7));
    }
  }

  return buckets;
}

export function getPlatformRevenueTimeSeries(
  period: AdminPeriod
): PlatformTimeSeriesBucket[] {
  const startDate = getAdminPeriodStartDate(period);
  const granularity = getAdminGranularity(period);

  const conditions = startDate ? [gte(purchases.createdAt, startDate)] : [];

  const rows = db
    .select({
      createdAt: purchases.createdAt,
      pricePaid: purchases.pricePaid,
    })
    .from(purchases)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .all();

  const bucketMap = new Map<string, number>();

  const allBuckets =
    period === "all" ? [] : generateAdminBuckets(period, granularity);
  for (const bucket of allBuckets) {
    bucketMap.set(bucket, 0);
  }

  for (const row of rows) {
    const key = formatDateForGranularity(row.createdAt, granularity);
    bucketMap.set(key, (bucketMap.get(key) ?? 0) + row.pricePaid);
  }

  return Array.from(bucketMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue }));
}

export interface CourseBreakdownRow {
  courseId: number;
  title: string;
  instructorId: number;
  instructorName: string;
  listPrice: number;
  revenue: number;
  sales: number;
  enrollments: number;
  averageRating: number | null;
}

export interface InstructorOption {
  id: number;
  name: string;
}

export function getInstructorsWithCourses(): InstructorOption[] {
  const rows = db
    .select({
      id: users.id,
      name: users.name,
    })
    .from(users)
    .innerJoin(courses, eq(courses.instructorId, users.id))
    .groupBy(users.id)
    .orderBy(users.name)
    .all();

  return rows;
}

export function getCourseBreakdown(
  period: AdminPeriod,
  instructorId?: number
): CourseBreakdownRow[] {
  const startDate = getAdminPeriodStartDate(period);

  const courseConditions = instructorId
    ? [eq(courses.instructorId, instructorId)]
    : [];

  const allCourses = db
    .select({
      id: courses.id,
      title: courses.title,
      instructorId: courses.instructorId,
      listPrice: courses.price,
    })
    .from(courses)
    .where(courseConditions.length > 0 ? and(...courseConditions) : undefined)
    .all();

  if (allCourses.length === 0) return [];

  const courseIds = allCourses.map((c) => c.id);
  const instructorIds = [...new Set(allCourses.map((c) => c.instructorId))];

  const instructorRows = db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(
      sql`${users.id} IN (${sql.join(
        instructorIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    )
    .all();
  const instructorMap = new Map(instructorRows.map((r) => [r.id, r.name]));

  const purchaseConditions = [
    sql`${purchases.courseId} IN (${sql.join(
      courseIds.map((id) => sql`${id}`),
      sql`, `
    )})`,
  ];
  if (startDate) {
    purchaseConditions.push(gte(purchases.createdAt, startDate));
  }

  const revenueRows = db
    .select({
      courseId: purchases.courseId,
      revenue: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)`,
      sales: sql<number>`count(*)`,
    })
    .from(purchases)
    .where(and(...purchaseConditions))
    .groupBy(purchases.courseId)
    .all();
  const revenueMap = new Map(
    revenueRows.map((r) => [r.courseId, { revenue: Number(r.revenue), sales: Number(r.sales) }])
  );

  const enrollmentConditions = [
    sql`${enrollments.courseId} IN (${sql.join(
      courseIds.map((id) => sql`${id}`),
      sql`, `
    )})`,
  ];
  if (startDate) {
    enrollmentConditions.push(gte(enrollments.enrolledAt, startDate));
  }

  const enrollmentRows = db
    .select({
      courseId: enrollments.courseId,
      count: sql<number>`count(*)`,
    })
    .from(enrollments)
    .where(and(...enrollmentConditions))
    .groupBy(enrollments.courseId)
    .all();
  const enrollmentMap = new Map(
    enrollmentRows.map((r) => [r.courseId, Number(r.count)])
  );

  const ratingRows = db
    .select({
      courseId: courseRatings.courseId,
      average: sql<string>`avg(${courseRatings.rating})`,
    })
    .from(courseRatings)
    .where(
      sql`${courseRatings.courseId} IN (${sql.join(
        courseIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    )
    .groupBy(courseRatings.courseId)
    .all();
  const ratingMap = new Map(
    ratingRows.map((r) => [r.courseId, r.average ? parseFloat(r.average) : null])
  );

  return allCourses.map((course) => ({
    courseId: course.id,
    title: course.title,
    instructorId: course.instructorId,
    instructorName: instructorMap.get(course.instructorId) ?? "Unknown",
    listPrice: course.listPrice,
    revenue: revenueMap.get(course.id)?.revenue ?? 0,
    sales: revenueMap.get(course.id)?.sales ?? 0,
    enrollments: enrollmentMap.get(course.id) ?? 0,
    averageRating: ratingMap.get(course.id) ?? null,
  }));
}
