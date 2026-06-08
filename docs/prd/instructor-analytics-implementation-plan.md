# Implementation Plan: Instructor Analytics Dashboard

Based on [instructor-analytics-dashboard.md](./instructor-analytics-dashboard.md)

---

## Phase 1: Analytics Service Layer

Build the data foundation — all aggregate query functions and their tests.

### 1.1 Create `app/services/analyticsService.ts`

Functions to implement:

- `getRevenueStats(instructorId, period)` — returns `{ totalRevenue, purchaseCount, averagePrice }` for all courses owned by the instructor within the period
- `getRevenueStatsForCourse(courseId, period)` — same but scoped to a single course
- `getRevenueOverTime(courseId, period)` — returns an array of `{ date, revenue, purchases }` bucketed by auto granularity (daily/weekly/monthly based on period)
- `getCompletionRate(instructorId)` — returns overall completion rate across all instructor's courses
- `getCompletionRateForCourse(courseId)` — returns completion rate for a single course
- `getCourseAnalyticsTable(instructorId, period)` — returns per-course rows: `{ courseId, title, slug, revenue, purchases, completionRate }` for the overview table
- `getLessonDropOff(courseId)` — returns ordered array of `{ lessonId, lessonTitle, moduleTitle, position, completionPercent }` for enrolled students
- `getCountryBreakdown(courseId, period)` — returns `{ country, revenue, purchases }[]` grouped by country

Helper:

- `getPeriodStartDate(period: '7d' | '30d' | '90d' | 'all')` — converts period preset to an ISO date string cutoff

### 1.2 Create `app/services/analyticsService.test.ts`

Follow `purchaseService.test.ts` pattern:

- `createTestDb()` + `vi.mock("~/db")` + `seedBaseData(testDb)` in `beforeEach`
- Seed additional data per test: multiple purchases at different dates, enrollments with mixed completion, lesson progress records
- Test each function with:
  - Happy path (data exists, correct aggregation)
  - Time boundary filtering (purchase at edge of period)
  - Empty state (no purchases/enrollments returns zeros)
  - Country null handling ("Unknown" bucket)
  - Lesson ordering (respects module.position then lesson.position)

---

## Phase 2: Install Chart Dependencies

### 2.1 Add shadcn/ui chart component

```bash
npx shadcn@latest add chart
```

This installs the Chart component wrapper and adds Recharts as a dependency.

### 2.2 Verify Recharts is available

Confirm `recharts` appears in `package.json` dependencies after the shadcn add.

---

## Phase 3: Overview Route (`/instructor/analytics`)

### 3.1 Register the route

Add `instructor.analytics.tsx` to `app/routes.ts` route config.

### 3.2 Create `app/routes/instructor.analytics.tsx`

**Loader:**

- Get current user from session
- Verify user is an instructor (403 if not)
- Read `?period` search param (default `30d`)
- Call `getRevenueStats(instructorId, period)`
- Call `getCompletionRate(instructorId)`
- Call `getCourseAnalyticsTable(instructorId, period)`
- Return all data

**Component:**

- Time period filter (4 buttons/tabs: 7d, 30d, 90d, All — links with search params)
- Stat cards row: Total Revenue, Total Purchases, Average Price, Completion Rate
- Sortable table: Course Name, Revenue, Purchases, Completion % — each row links to `/instructor/$courseId/analytics`
- Empty state when no courses exist

---

## Phase 4: Per-Course Drill-Down Route (`/instructor/$courseId/analytics`)

### 4.1 Register the route

Add `instructor.$courseId.analytics.tsx` to `app/routes.ts` route config.

### 4.2 Create `app/routes/instructor.$courseId.analytics.tsx`

**Loader:**

- Get current user from session
- Verify user is an instructor and owns the course (403 if not)
- Read `?period` search param (default `30d`)
- Call `getRevenueStatsForCourse(courseId, period)`
- Call `getRevenueOverTime(courseId, period)`
- Call `getCompletionRateForCourse(courseId)`
- Call `getLessonDropOff(courseId)`
- Call `getCountryBreakdown(courseId, period)`
- Return all data

**Component (single scrollable page):**

- Breadcrumb: Home / My Courses / [Course Title] / Analytics
- Time period filter
- Stat cards row: Revenue, Purchases, Avg Price, Completion Rate
- Revenue-over-time chart (shadcn/ui BarChart or AreaChart)
- Lesson drop-off chart (BarChart — x-axis is lesson sequence, y-axis is % completed)
- Country breakdown table: Country, Revenue, Purchases (sorted by revenue desc)
- Empty states per section when no data

---

## Phase 5: Navigation & Polish

### 5.1 Add analytics link to instructor navigation

Add an "Analytics" link visible from the instructor area that navigates to `/instructor/analytics`.

### 5.2 Add drill-down link on course edit page

On the existing `/instructor/$courseId` page, add an "Analytics" button/link alongside the "Edit Course" actions.

### 5.3 Format currency values

Create a shared `formatCurrency(cents: number)` utility (or inline) that renders prices as `$XX.XX` from the integer cents stored in the database.

### 5.4 Responsive design pass

Ensure stat cards stack on mobile, charts resize, and the table scrolls horizontally on small screens.

---

## Phase Summary

| Phase | Deliverable                                  | Dependencies |
| ----- | -------------------------------------------- | ------------ |
| 1     | `analyticsService.ts` + tests                | None         |
| 2     | shadcn/ui chart component installed          | None         |
| 3     | `/instructor/analytics` overview page        | Phase 1, 2   |
| 4     | `/instructor/$courseId/analytics` drill-down | Phase 1, 2   |
| 5     | Navigation links, formatting, polish         | Phase 3, 4   |

Phases 1 and 2 can be done in parallel. Phases 3 and 4 can be done in parallel after 1+2 complete. Phase 5 follows last.
