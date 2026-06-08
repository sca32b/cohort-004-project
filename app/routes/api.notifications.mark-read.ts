import type { Route } from "./+types/api.notifications.mark-read";
import { getCurrentUserId } from "~/lib/session";
import { markAsRead } from "~/services/notificationService";
import { data } from "react-router";

export async function action({ request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const formData = await request.formData();
  const notificationId = Number(formData.get("notificationId"));
  if (!notificationId || isNaN(notificationId)) {
    throw data("Invalid notification ID", { status: 400 });
  }

  markAsRead(notificationId);
  return { success: true };
}
