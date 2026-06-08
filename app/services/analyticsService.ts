import { eq, and, gte, sql } from "drizzle-orm";
import { db } from "~/db";
import { purchases, courses, enrollments } from "~/db/schema";

export type Period = "7d" | "30d" | "90d" | "all";

export interface RevenueStats {
  totalRevenue: number;
  purchaseCount: number;
  averagePrice: number;
}

export function getPeriodStartDate(period: Period): string | null {
  if (period === "all") return null;
  const now = new Date();
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  now.setDate(now.getDate() - days);
  return now.toISOString();
}

export function getRevenueStatsForCourse(
  courseId: number,
  period: Period
): RevenueStats {
  const startDate = getPeriodStartDate(period);

  const conditions = [eq(purchases.courseId, courseId)];
  if (startDate) {
    conditions.push(gte(purchases.createdAt, startDate));
  }

  const result = db
    .select({
      totalRevenue: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)`,
      purchaseCount: sql<number>`count(*)`,
    })
    .from(purchases)
    .where(and(...conditions))
    .get()!;

  const totalRevenue = Number(result.totalRevenue);
  const purchaseCount = Number(result.purchaseCount);
  const averagePrice =
    purchaseCount > 0 ? Math.round(totalRevenue / purchaseCount) : 0;

  return { totalRevenue, purchaseCount, averagePrice };
}

export type Granularity = "daily" | "weekly" | "monthly";

export interface TimeSeriesBucket {
  date: string;
  revenue: number;
  purchases: number;
}

export function getGranularity(period: Period): Granularity {
  if (period === "7d" || period === "30d") return "daily";
  if (period === "90d") return "weekly";
  return "monthly";
}

function formatDateForGranularity(
  dateStr: string,
  granularity: Granularity
): string {
  const d = new Date(dateStr);
  if (granularity === "daily") {
    return d.toISOString().slice(0, 10);
  }
  if (granularity === "weekly") {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    return monday.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 7);
}

function generateBuckets(period: Period, granularity: Granularity): string[] {
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
  } else if (granularity === "weekly") {
    const weeks = 13;
    const day = today.getDay();
    const startMonday = new Date(today);
    startMonday.setDate(today.getDate() - day + (day === 0 ? -6 : 1));
    for (let i = weeks - 1; i >= 0; i--) {
      const d = new Date(startMonday);
      d.setDate(d.getDate() - i * 7);
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

export function getRevenueTimeSeries(
  courseId: number,
  period: Period
): TimeSeriesBucket[] {
  const startDate = getPeriodStartDate(period);
  const granularity = getGranularity(period);

  const conditions = [eq(purchases.courseId, courseId)];
  if (startDate) {
    conditions.push(gte(purchases.createdAt, startDate));
  }

  const rows = db
    .select({
      createdAt: purchases.createdAt,
      pricePaid: purchases.pricePaid,
    })
    .from(purchases)
    .where(and(...conditions))
    .all();

  const bucketMap = new Map<string, { revenue: number; purchases: number }>();

  const allBuckets =
    period === "all" ? [] : generateBuckets(period, granularity);
  for (const bucket of allBuckets) {
    bucketMap.set(bucket, { revenue: 0, purchases: 0 });
  }

  for (const row of rows) {
    const key = formatDateForGranularity(row.createdAt, granularity);
    const existing = bucketMap.get(key);
    if (existing) {
      existing.revenue += row.pricePaid;
      existing.purchases += 1;
    } else {
      bucketMap.set(key, { revenue: row.pricePaid, purchases: 1 });
    }
  }

  const entries = Array.from(bucketMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }));

  return entries;
}

export function getCompletionRateForCourse(courseId: number): number {
  const result = db
    .select({
      total: sql<number>`count(*)`,
      completed: sql<number>`sum(case when ${enrollments.completedAt} is not null then 1 else 0 end)`,
    })
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId))
    .get()!;

  const total = Number(result.total);
  if (total === 0) return 0;
  return Math.round((Number(result.completed) / total) * 100);
}

export function getCourseByIdForAnalytics(courseId: number) {
  return db
    .select({
      id: courses.id,
      title: courses.title,
      instructorId: courses.instructorId,
    })
    .from(courses)
    .where(eq(courses.id, courseId))
    .get();
}
