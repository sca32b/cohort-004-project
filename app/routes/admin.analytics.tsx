import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/admin.analytics";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { UserRole } from "~/db/schema";
import {
  getPlatformRevenueStats,
  getPlatformRevenueTimeSeries,
  getCourseBreakdown,
  getInstructorsWithCourses,
  type AdminPeriod,
} from "~/services/adminAnalyticsService";
import { formatPrice } from "~/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AlertTriangle, DollarSign, Users, Trophy, Star } from "lucide-react";
import { data, isRouteErrorResponse } from "react-router";

const PERIODS: { value: AdminPeriod; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "12m", label: "12 months" },
  { value: "all", label: "All time" },
];

function isValidPeriod(value: string | null): value is AdminPeriod {
  return (
    value === "7d" || value === "30d" || value === "12m" || value === "all"
  );
}

export function meta() {
  return [
    { title: "Platform Analytics — Cadence" },
    {
      name: "description",
      content: "Platform-wide revenue and enrollment analytics",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to view analytics.", {
      status: 401,
    });
  }

  const currentUser = getUserById(currentUserId);

  if (!currentUser || currentUser.role !== UserRole.Admin) {
    throw data("Only admins can access this page.", {
      status: 403,
    });
  }

  const url = new URL(request.url);
  const periodParam = url.searchParams.get("period");
  const period: AdminPeriod = isValidPeriod(periodParam) ? periodParam : "30d";
  const instructorParam = url.searchParams.get("instructor");
  const instructorId = instructorParam ? parseInt(instructorParam, 10) : undefined;

  const stats = getPlatformRevenueStats(period);
  const timeSeries = getPlatformRevenueTimeSeries(period);
  const courseBreakdown = getCourseBreakdown(
    period,
    instructorId && !isNaN(instructorId) ? instructorId : undefined
  );
  const instructors = getInstructorsWithCourses();

  return { stats, period, timeSeries, courseBreakdown, instructors, instructorId };
}

const revenueChartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(142.1 76.2% 36.3%)",
  },
} satisfies ChartConfig;

export default function AdminAnalytics({ loaderData }: Route.ComponentProps) {
  const { stats, period, timeSeries, courseBreakdown, instructors, instructorId } =
    loaderData;
  const [searchParams] = useSearchParams();

  function periodLink(p: AdminPeriod) {
    const params = new URLSearchParams(searchParams);
    params.set("period", p);
    return `?${params.toString()}`;
  }

  function instructorFilterLink(id: string) {
    const params = new URLSearchParams(searchParams);
    if (id === "all") {
      params.delete("instructor");
    } else {
      params.set("instructor", id);
    }
    return `?${params.toString()}`;
  }

  const hasData = stats.totalRevenue > 0 || stats.totalEnrollments > 0;

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Platform Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Revenue and enrollment metrics across all courses
        </p>
      </div>

      {/* Period filter */}
      <div className="mb-6 flex gap-2">
        {PERIODS.map((p) => (
          <Link key={p.value} to={periodLink(p.value)}>
            <Button
              variant={period === p.value ? "default" : "outline"}
              size="sm"
            >
              {p.label}
            </Button>
          </Link>
        ))}
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              No revenue or enrollment data for this period.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
                  <DollarSign className="size-5 text-green-700 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">
                    {formatPrice(stats.totalRevenue)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                  <Users className="size-5 text-blue-700 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Enrollments
                  </p>
                  <p className="text-2xl font-bold">{stats.totalEnrollments}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30">
                  <Trophy className="size-5 text-amber-700 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Top Earning Course
                  </p>
                  {stats.topCourse ? (
                    <>
                      <p className="text-lg font-bold truncate max-w-48">
                        {stats.topCourse.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatPrice(stats.topCourse.revenue)}
                      </p>
                    </>
                  ) : (
                    <p className="text-2xl font-bold">—</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue over time chart */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Revenue Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {timeSeries.length > 0 ? (
              <ChartContainer
                config={revenueChartConfig}
                className="h-[300px] w-full"
              >
                <LineChart data={timeSeries} accessibilityLayer>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value: string) => {
                      if (value.length === 7) {
                        return new Date(value + "-01").toLocaleDateString(
                          "en-US",
                          { month: "short", year: "2-digit" }
                        );
                      }
                      return new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      });
                    }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value: number) =>
                      `$${(value / 100).toFixed(0)}`
                    }
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) =>
                          `$${(Number(value) / 100).toFixed(2)}`
                        }
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-revenue)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <p className="py-8 text-center text-muted-foreground">
                No revenue data for this period.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Course breakdown table */}
        <Card className="mt-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Course Breakdown</CardTitle>
              <Select
                value={instructorId ? String(instructorId) : "all"}
                onValueChange={(value) => {
                  window.location.href = instructorFilterLink(value);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Instructors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Instructors</SelectItem>
                  {instructors.map((inst) => (
                    <SelectItem key={inst.id} value={String(inst.id)}>
                      {inst.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {courseBreakdown.length === 0 ? (
              <p className="px-6 py-8 text-center text-muted-foreground">
                No courses found for the selected filter.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Course
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Instructor
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        List Price
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Revenue
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Sales
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Enrollments
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Rating
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {courseBreakdown.map((row) => (
                      <tr
                        key={row.courseId}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-4 py-3 text-sm font-medium">
                          {row.title}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {row.instructorName}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          {formatPrice(row.listPrice)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium">
                          {formatPrice(row.revenue)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                          {row.sales}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                          {row.enrollments}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          {row.averageRating !== null ? (
                            <span className="inline-flex items-center gap-1">
                              <Star className="size-3.5 fill-amber-400 text-amber-400" />
                              {row.averageRating.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        </>
      )}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading analytics.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 401) {
      title = "Sign in required";
      message =
        typeof error.data === "string"
          ? error.data
          : "Please select a user from the DevUI panel.";
    } else if (error.status === 403) {
      title = "Access denied";
      message =
        typeof error.data === "string"
          ? error.data
          : "You don't have permission to view this page.";
    } else {
      title = `Error ${error.status}`;
      message = typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/admin/users">
            <Button variant="outline">Manage Users</Button>
          </Link>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
