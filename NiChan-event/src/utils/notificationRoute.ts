export type NotificationAudience = "customer" | "admin" | "organizer";

export type RoutableNotification = {
  type?: string | null;
  entityType?: string | null;
  entityId?: string | null;
};

const withId = (path: string, id?: string | null) =>
  id ? `${path}/${encodeURIComponent(id)}` : path;

export const getNotificationRoute = (
  notification: RoutableNotification,
  audience: NotificationAudience,
) => {
  const { entityType, entityId, type } = notification;

  if (audience === "customer") {
    if (type === "planning" && entityType === "event" && entityId) {
      return `/dashboard/su-kien/${encodeURIComponent(entityId)}?tab=timeline#timeline-planning-detail`;
    }
    if (type === "settlement" || type === "settlement_feedback") {
      if (entityType === "event" && entityId) {
        return `/dashboard/su-kien/${encodeURIComponent(entityId)}?tab=settlement#settlement-service-items`;
      }
      if (entityType === "contract" && entityId) {
        return `/dashboard/hop-dong/${encodeURIComponent(entityId)}?view=settlement`;
      }
      return "/dashboard/su-kien";
    }
    if (entityType === "contract") return withId("/dashboard/hop-dong", entityId);
    if (entityType === "event") return withId("/dashboard/su-kien", entityId);
    if (entityType === "request") return withId("/dashboard/yeu-cau", entityId);
    if (type === "contract") return "/dashboard/hop-dong";
    if (type === "planning" || type === "event" || type === "document") {
      return "/dashboard/su-kien";
    }
    if (type === "review") return "/dashboard/danh-gia";
    return "/dashboard";
  }

  if (audience === "admin") {
    if (type === "settlement_feedback" && entityId) {
      return `/admin/hop-dong?settlementFeedback=${encodeURIComponent(entityId)}`;
    }
    if (entityType === "contract") return withId("/admin/hop-dong", entityId);
    if (entityType === "request") return "/admin/yeu-cau";
    if (entityType === "event" || type === "project" || type === "task") return "/admin/du-an";
    if (entityType === "transaction" || type === "payment") return "/admin/tai-chinh";
    if (type === "contract") return "/admin/hop-dong";
    if (type === "staff") return "/admin/nhan-su";
    if (type === "vendor") return "/admin/nha-cung-cap";
    return "/admin";
  }

  if (entityType === "contract") return withId("/ban-to-chuc/hop-dong", entityId);
  if (entityType === "event" || type === "project" || type === "task") {
    return "/ban-to-chuc/du-an";
  }
  if (type === "budget" || type === "payment") return "/ban-to-chuc/ngan-sach";
  if (type === "vendor") return "/ban-to-chuc/nha-cung-cap";
  if (type === "message" || type === "document") return "/ban-to-chuc/trao-doi";
  return "/ban-to-chuc";
};
