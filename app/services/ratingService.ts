import { eq, and, avg, count, sql } from "drizzle-orm";
import { db } from "~/db";
import { courseRatings } from "~/db/schema";

const x: number = "hello";

export function getUserRating(userId: number, courseId: number) {
  return db
    .select()
    .from(courseRatings)
    .where(
      and(
        eq(courseRatings.userId, userId),
        eq(courseRatings.courseId, courseId)
      )
    )
    .get();
}

export function upsertRating(userId: number, courseId: number, rating: number) {
  const existing = getUserRating(userId, courseId);
  if (existing) {
    return db
      .update(courseRatings)
      .set({ rating, updatedAt: new Date().toISOString() })
      .where(eq(courseRatings.id, existing.id))
      .run();
  }
  return db.insert(courseRatings).values({ userId, courseId, rating }).run();
}

export function getCourseRatingStats(courseId: number) {
  const result = db
    .select({
      average: avg(courseRatings.rating),
      count: count(courseRatings.id),
    })
    .from(courseRatings)
    .where(eq(courseRatings.courseId, courseId))
    .get();

  return {
    average: result?.average ? parseFloat(result.average) : null,
    count: result?.count ?? 0,
  };
}

export function getCourseRatingStatsMultiple(courseIds: number[]) {
  if (courseIds.length === 0)
    return new Map<number, { average: number | null; count: number }>();

  const results = db
    .select({
      courseId: courseRatings.courseId,
      average: avg(courseRatings.rating),
      count: count(courseRatings.id),
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

  const map = new Map<number, { average: number | null; count: number }>();
  for (const row of results) {
    map.set(row.courseId, {
      average: row.average ? parseFloat(row.average) : null,
      count: row.count,
    });
  }
  return map;
}
