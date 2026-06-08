# PRD: Instructor Analytics Dashboard

## Problem Statement

Instructors on the platform have no visibility into how their courses are performing. They can see enrollment counts and lesson counts on the course management page, but they cannot answer questions like: "How much revenue did I make this month?", "Which lessons are causing students to drop off?", or "What percentage of students actually complete my course?" Without these insights, instructors cannot make informed decisions about pricing, content improvements, or course marketing.

## Solution

Add an Instructor Analytics dashboard with two views:

1. **Overview page** (`/instructor/analytics`) — aggregated metrics across all of an instructor's courses, with a sortable per-course comparison table.
2. **Per-course drill-down** (`/instructor/$courseId/analytics`) — detailed sales, completion, and engagement metrics for a single course including revenue-over-time charts and lesson-level drop-off visualization.

Both pages include time period filters (Last 7 days, Last 30 days, Last 90 days, All time) defaulting to Last 30 days.

## User Stories

1. As an instructor, I want to see my total revenue across all courses for a selected time period, so that I can track my overall income.
2. As an instructor, I want to see the total number of purchases across all courses for a selected time period, so that I can understand sales volume.
3. As an instructor, I want to see the average purchase price across all courses, so that I can understand how PPP discounts affect my actual earnings.
4. As an instructor, I want to see an overall course completion rate across all my courses, so that I can gauge whether my content is retaining students.
5. As an instructor, I want to see a sortable table comparing all my courses by revenue, purchases, and completion rate, so that I can quickly identify which courses need attention.
6. As an instructor, I want to click a course in the overview table to drill down into its detailed analytics, so that I can investigate specific issues.
7. As an instructor, I want to filter analytics by preset time periods (7d, 30d, 90d, all time), so that I can view trends at different scales.
8. As an instructor, I want to see a revenue-over-time chart for a specific course, so that I can identify sales trends and spikes.
9. As an instructor, I want the chart granularity to adjust automatically (daily for 7d/30d, weekly for 90d, monthly for all time), so that the visualization stays readable regardless of the time range.
10. As an instructor, I want to see the total revenue for a specific course in the selected period, so that I can evaluate individual course performance.
11. As an instructor, I want to see the purchase count for a specific course in the selected period, so that I can track conversion.
12. As an instructor, I want to see the average purchase price for a specific course, so that I can understand the real revenue per sale after PPP.
13. As an instructor, I want to see the completion rate for a specific course, so that I can evaluate content effectiveness.
14. As an instructor, I want to see a lesson drop-off chart showing the percentage of enrolled students who completed each lesson in sequence, so that I can identify exactly where students lose interest.
15. As an instructor, I want to see a country breakdown of purchases for a specific course, so that I can understand my geographic audience and PPP impact.
16. As an instructor, I want the analytics pages to be access-controlled so only the course's instructor can see its data, so that my revenue and engagement data stays private.
17. As an instructor, I want the analytics overview to be accessible from the instructor navigation, so that I can find it without memorizing URLs.
18. As an instructor, I want the analytics pages to show meaningful empty states when I have no data yet, so that I understand what the page will show once students enroll and purchase.

## Implementation Decisions

- **Routing:** Two new route files — `/instructor/analytics` (overview) and `/instructor/$courseId/analytics` (drill-down). These sit alongside existing instructor routes as siblings.
- **Service layer:** A single new `analyticsService` module containing all aggregate query functions. This keeps analytics-specific read queries separate from the transactional CRUD in existing services.
- **Charting:** Use shadcn/ui Chart components (built on Recharts) for the revenue-over-time and lesson drop-off charts. This matches the existing component library.
- **Time filtering:** Implemented via URL search params (`?period=7d|30d|90d|all`). Each page manages its own filter state independently — no cross-route state sharing.
- **Auto granularity:** The service layer returns data bucketed by the appropriate granularity (daily/weekly/monthly) based on the requested period. The UI does not re-bucket.
- **Completion rate:** Calculated as `enrollments with non-null completedAt / total enrollments` per course. The overview aggregates across all of the instructor's courses.
- **Lesson drop-off:** For each lesson in course order (by module position, then lesson position), calculate `count of students who completed that lesson / total enrolled students`. Returns an ordered array suitable for direct chart rendering.
- **Country breakdown:** Grouped aggregation on `purchases.country` with sum of `pricePaid` and count, for the selected course and time period.
- **Layout:** Single scrollable page for the drill-down — stat cards at top, revenue chart, lesson drop-off chart, country table at bottom.
- **Access control:** Both routes verify the current user is an instructor and owns the course (for the drill-down). Reuses existing session/auth patterns from the instructor routes.

## Testing Decisions

- **What makes a good test:** Tests exercise the service's public function interface with known seed data and assert on returned aggregate values. They do not test SQL construction or internal helpers — only the contract visible to callers.
- **Module under test:** `analyticsService` — all analytics query functions tested via the in-memory SQLite pattern (`createTestDb()` + `vi.mock("~/db")`).
- **Prior art:** `purchaseService.test.ts` — same structure of `beforeEach` creating a fresh DB, `seedBaseData()` for common fixtures, then test cases that insert specific records and assert on function output.
- **Key test scenarios:** Revenue aggregation with multiple purchases at different dates, completion rate with mixed completed/incomplete enrollments, lesson drop-off with partial progress, country breakdown grouping, time period filtering at boundaries, empty state (no data).

## Out of Scope

- Video-level audience retention (within a single lesson's video)
- Per-module completion breakdown
- Funnel visualization (enrollment → first lesson → completion)
- Coupon/team purchase analytics
- Custom date range picker
- User-selectable chart granularity toggle
- Quiz performance analytics
- Course ratings on the analytics page
- Export/download of analytics data
- Real-time or live-updating metrics

## Further Notes

- The `purchases` table stores `pricePaid` in integer cents — all revenue displays should format as currency (divide by 100).
- `purchases.country` can be null — the country breakdown should handle an "Unknown" bucket.
- The lesson drop-off chart orders lessons by `modules.position` then `lessons.position` — this is the canonical course order.
- The `videoWatchEvents` table exists and could power video retention in a future iteration, but is not used in this version.
- shadcn/ui chart components may need to be added to the project via `npx shadcn@latest add chart` before use.
