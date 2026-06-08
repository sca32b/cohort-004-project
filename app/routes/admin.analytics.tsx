import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/admin.analytics";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { UserRole } from "~/db/schema";
import {
  getPlatformRevenueStats,
  type AdminPeriod,
} from "~/services/adminAnalyticsService";
import { formatPrice } from "~/lib/utils";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { AlertTriangle, DollarSign, Users, Trophy } from "lucide-react";
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

  const stats = getPlatformRevenueStats(period);

  return { stats, period };
}

export default function AdminAnalytics({ loaderData }: Route.ComponentProps) {
  const { stats, period } = loaderData;
  const [searchParams] = useSearchParams();

  function periodLink(p: AdminPeriod) {
    const params = new URLSearchParams(searchParams);
    params.set("period", p);
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
