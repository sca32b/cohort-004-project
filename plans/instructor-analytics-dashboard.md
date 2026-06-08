# Plan: Instructor Analytics Dashboard

> Source PRD: [docs/prd/instructor-analytics-dashboard.md](../docs/prd/instructor-analytics-dashboard.md)

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: `/instructor/analytics` (overview), `/instructor/:courseId/analytics` (per-course drill-down) — registered inside the `layout.app.tsx` layout alongside existing instructor routes
- **Schema**: No changes — all required data exists in `purchases`, `enrollments`, `lessonProgress`, `modules`, `lessons`
- **Key models**: Period type (`'7d' | '30d' | '90d' | 'all'`), revenue stats aggregate, time-series bucket, lesson drop-off entry, country breakdown entry
- **Auth**: Cookie-based session via `getCurrentUserId` + role check (instructor) + course ownership verification for drill-down — same pattern as existing instructor routes
- **Charting**: shadcn/ui Chart components (Recharts wrapper) — consistent with existing component library
- **Time filter**: URL search param `?period=30d`, each page manages its own filter independently
- **Auto granularity**: 7d/30d = daily buckets, 90d = weekly buckets, all = monthly buckets — determined by the service layer based on requested period

---

## Phase 1: Revenue Stats for a Single Course

**User stories**: 7, 10, 11, 12, 16

### What to build

A per-course analytics page at `/instructor/:courseId/analytics` that shows revenue, purchase count, and average price for the selected time period. The page includes time filter buttons (7d, 30d, 90d, All) that update via search params. Access control verifies the current user is an instructor and owns the course.

This is the thinnest possible end-to-end slice: a service query aggregating from `purchases`, a route with a loader calling that query, and a UI rendering stat cards with a period filter.

### Acceptance criteria

- [ ] Route registered and accessible at `/instructor/:courseId/analytics`
- [ ] Loader returns 403 if user is not an instructor or doesn't own the course
- [ ] Stat cards display total revenue (formatted as currency from cents), purchase count, and average price
- [ ] Time filter buttons update `?period` search param and re-filter data
- [ ] Defaults to "Last 30 days" when no period param is present
- [ ] Service query correctly filters purchases by `createdAt` within the period
- [ ] Tests cover: aggregation with multiple purchases, time boundary filtering, empty state returns zeros

---

## Phase 2: Revenue-Over-Time Chart

**User stories**: 8, 9

### What to build

Install shadcn/ui chart component (which adds Recharts). Add a service query that returns revenue bucketed by the appropriate time granularity (daily for 7d/30d, weekly for 90d, monthly for all). Render a bar/area chart below the stat cards on the drill-down page showing revenue over time.

### Acceptance criteria

- [ ] shadcn/ui chart component installed and Recharts available as a dependency
- [ ] Service query returns array of `{ date, revenue, purchases }` bucketed by auto granularity
- [ ] Chart renders on the drill-down page below the stat cards
- [ ] Chart updates when the time period filter changes
- [ ] Tests cover: correct bucketing for each period preset, empty periods show zero

---

## Phase 3: Completion Rate on Drill-Down

**User stories**: 13

### What to build

A service query calculating course completion rate (enrollments with non-null `completedAt` / total enrollments). Display as an additional stat card on the existing drill-down page alongside revenue stats.

### Acceptance criteria

- [ ] Completion rate stat card shows percentage on the drill-down page
- [ ] Calculation uses `enrollments.completedAt` is not null / total enrollments for the course
- [ ] Shows 0% (not NaN or error) when no enrollments exist
- [ ] Tests cover: mixed completed/incomplete enrollments, zero enrollments

---

## Phase 4: Lesson Drop-Off Chart

**User stories**: 14

### What to build

A service query that returns, for each lesson in course order (sorted by `modules.position` then `lessons.position`), the percentage of enrolled students who completed that lesson. Render as a bar chart on the drill-down page — x-axis is lesson sequence, y-axis is completion percentage. The downward slope reveals where students stop.

### Acceptance criteria

- [ ] Service query returns ordered array with lesson title, module title, and completion percentage
- [ ] Lessons are ordered by module position then lesson position (canonical course order)
- [ ] Bar chart renders on the drill-down page below the revenue chart
- [ ] Percentage is calculated against total enrolled students for the course
- [ ] Tests cover: partial progress across lessons, correct ordering, zero enrollments

---

## Phase 5: Country Breakdown

**User stories**: 15

### What to build

A service query grouping purchases for the selected course and period by `purchases.country`, returning revenue sum and purchase count per country. Render as a table at the bottom of the drill-down page, sorted by revenue descending. Null country values display as "Unknown".

### Acceptance criteria

- [ ] Country breakdown table renders on the drill-down page
- [ ] Table shows country name, revenue (formatted), and purchase count
- [ ] Sorted by revenue descending
- [ ] Null countries grouped under "Unknown"
- [ ] Respects the selected time period filter
- [ ] Tests cover: multiple countries, null country handling, period filtering

---

## Phase 6: Overview Page with Aggregates and Course Table

**User stories**: 1, 2, 3, 4, 5, 6, 7, 17

### What to build

A new route at `/instructor/analytics` showing cross-course aggregates: total revenue, total purchases, average price, and overall completion rate as stat cards. Below that, a sortable table listing each of the instructor's courses with columns for course name, revenue, purchases, and completion rate. Each row links to that course's drill-down page. Includes time filter and a navigation link accessible from the instructor area.

### Acceptance criteria

- [ ] Route registered and accessible at `/instructor/analytics`
- [ ] Aggregate stat cards show totals across all instructor's courses for the selected period
- [ ] Course table is sortable by revenue, purchases, and completion rate
- [ ] Each table row links to `/instructor/:courseId/analytics`
- [ ] Time filter buttons work the same as on the drill-down page
- [ ] Navigation link added to the instructor area (visible from `/instructor`)
- [ ] Access control: only instructors can access
- [ ] Tests cover: aggregation across multiple courses, sorting correctness

---

## Phase 7: Empty States and Polish

**User stories**: 18

### What to build

Meaningful empty states for every section when no data exists (no purchases, no enrollments, no progress). Currency formatting utility for displaying cents as dollars. Responsive layout pass ensuring stat cards stack on mobile, charts resize properly, and the country table scrolls horizontally on small screens.

### Acceptance criteria

- [ ] Each section shows a helpful empty state message when there's no data
- [ ] All revenue values display as formatted currency (e.g. "$49.99" from 4999 cents)
- [ ] Stat cards stack vertically on mobile breakpoints
- [ ] Charts are responsive and resize with their container
- [ ] Country table scrolls horizontally on narrow viewports
- [ ] Empty state is distinct from loading state
