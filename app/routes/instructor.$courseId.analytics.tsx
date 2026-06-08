import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/instructor.$courseId.analytics";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { UserRole } from "~/db/schema";
import {
  getRevenueStatsForCourse,
  getRevenueTimeSeries,
  getCompletionRateForCourse,
  getCourseByIdForAnalytics,
  type Period,
} from "~/services/analyticsService";
import { formatPrice } from "~/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ArrowLeft,
  AlertTriangle,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  GraduationCap,
} from "lucide-react";
import { data, isRouteErrorResponse } from "react-router";

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

function isValidPeriod(value: string | null): value is Period {
  return (
    value === "7d" || value === "30d" || value === "90d" || value === "all"
  );
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  const title = loaderData?.course?.title ?? "Course";
  return [
    { title: `Analytics: ${title} — Cadence` },
    { name: "description", content: `Analytics for ${title}` },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to view analytics.", {
      status: 401,
    });
  }

  const user = getUserById(currentUserId);
  if (!user || user.role !== UserRole.Instructor) {
    throw data("Only instructors can access analytics.", { status: 403 });
  }

  const courseId = parseInt(params.courseId, 10);
  if (isNaN(courseId)) {
    throw data("Invalid course ID.", { status: 400 });
  }

  const course = getCourseByIdForAnalytics(courseId);
  if (!course) {
    throw data("Course not found.", { status: 404 });
  }

  if (course.instructorId !== currentUserId) {
    throw data("You can only view analytics for your own courses.", {
      status: 403,
    });
  }

  const url = new URL(request.url);
  const periodParam = url.searchParams.get("period");
  const period: Period = isValidPeriod(periodParam) ? periodParam : "30d";

  const stats = getRevenueStatsForCourse(courseId, period);
  const timeSeries = getRevenueTimeSeries(courseId, period);
  const completionRate = getCompletionRateForCourse(courseId);

  return { course, stats, timeSeries, completionRate, period };
}

const revenueChartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(142.1 76.2% 36.3%)",
  },
} satisfies ChartConfig;

export default function CourseAnalytics({ loaderData }: Route.ComponentProps) {
  const { course, stats, timeSeries, completionRate, period } = loaderData;
  const [searchParams] = useSearchParams();

  function periodLink(p: Period) {
    const params = new URLSearchParams(searchParams);
    params.set("period", p);
    return `?${params.toString()}`;
  }

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/instructor" className="hover:text-foreground">
          My Courses
        </Link>
        <span className="mx-2">/</span>
        <Link to={`/instructor/${course.id}`} className="hover:text-foreground">
          {course.title}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Analytics</span>
      </nav>

      <Link
        to={`/instructor/${course.id}`}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 size-4" />
        Back to Course Editor
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">{course.title}</h1>
        <p className="mt-1 text-muted-foreground">Course Analytics</p>
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

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <ShoppingCart className="size-5 text-blue-700 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Purchases</p>
                <p className="text-2xl font-bold">{stats.purchaseCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30">
                <TrendingUp className="size-5 text-purple-700 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg. Price</p>
                <p className="text-2xl font-bold">
                  {stats.purchaseCount > 0
                    ? formatPrice(stats.averagePrice)
                    : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-100 p-2 dark:bg-orange-900/30">
                <GraduationCap className="size-5 text-orange-700 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
                <p className="text-2xl font-bold">{completionRate}%</p>
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
              <BarChart data={timeSeries} accessibilityLayer>
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
                <Bar
                  dataKey="revenue"
                  fill="var(--color-revenue)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="py-8 text-center text-muted-foreground">
              No revenue data for this period.
            </p>
          )}
        </CardContent>
      </Card>
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
    } else if (error.status === 404) {
      title = "Course not found";
      message = "The course you're looking for doesn't exist.";
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
          <Link to="/instructor">
            <Button variant="outline">My Courses</Button>
          </Link>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
