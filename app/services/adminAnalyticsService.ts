import { and, gte, sql } from "drizzle-orm";
import { db } from "~/db";
import { purchases, courses, enrollments, users } from "~/db/schema";

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
