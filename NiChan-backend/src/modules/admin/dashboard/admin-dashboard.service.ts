import { prisma } from "../../../lib/prisma";
import { createError } from "../../../middleware/errorHandler";

// Percent change between two periods. Returns a signed integer percentage.
// When the previous period is empty we report +100% for any growth, 0% for none.
const pctChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

export const getAdminDashboard = async () => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    totalRequests,
    newRequests,
    requestsThisMonth,
    requestsLastMonth,
    totalEvents,
    activeEvents,
    eventsThisMonth,
    eventsLastMonth,
    totalCustomers,
    customersThisMonth,
    customersLastMonth,
    revenueThisMonth,
    revenueLastMonth,
    recentRequests,
    upcomingEvents,
    eventsByType,
  ] = await prisma.$transaction([
    prisma.consultationRequest.count(),
    prisma.consultationRequest.count({ where: { status: "new" } }),
    prisma.consultationRequest.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.consultationRequest.count({ where: { createdAt: { gte: lastMonthStart, lt: monthStart } } }),
    prisma.event.count(),
    prisma.event.count({ where: { status: { in: ["planning", "contracted", "in_progress"] } } }),
    prisma.event.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.event.count({ where: { createdAt: { gte: lastMonthStart, lt: monthStart } } }),
    prisma.user.count({ where: { role: "customer", deletedAt: null } }),
    prisma.user.count({ where: { role: "customer", deletedAt: null, createdAt: { gte: monthStart } } }),
    prisma.user.count({ where: { role: "customer", deletedAt: null, createdAt: { gte: lastMonthStart, lt: monthStart } } }),
    // monthly revenue from transactions this month
    prisma.transaction.aggregate({
      where: { transactionDate: { gte: monthStart }, status: "completed" },
      _sum: { amount: true },
    }),
    // revenue last month (for trend comparison)
    prisma.transaction.aggregate({
      where: { transactionDate: { gte: lastMonthStart, lt: monthStart }, status: "completed" },
      _sum: { amount: true },
    }),
    // recent requests
    prisma.consultationRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { assignedManager: { select: { id: true, displayName: true } } },
    }),
    // upcoming events
    prisma.event.findMany({
      where: { eventDate: { gte: now }, status: { not: "cancelled" } },
      orderBy: { eventDate: "asc" },
      take: 5,
      include: {
        customerUser: { select: { id: true, displayName: true } },
        organizerUser: { select: { id: true, displayName: true } },
      },
    }),
    // events by type
    prisma.event.groupBy({ by: ["type"], _count: { type: true }, orderBy: { _count: { type: "desc" } } }),
  ]);

  // monthly revenue per month (last 12 months) for chart
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);

  const monthlyTransactions = await prisma.transaction.findMany({
    where: { transactionDate: { gte: twelveMonthsAgo }, status: "completed" },
    select: { amount: true, transactionDate: true },
  });

  // Group by month in JS
  const revenueMap: Record<string, number> = {};
  for (const tx of monthlyTransactions) {
    const key = `${tx.transactionDate.getFullYear()}-${String(tx.transactionDate.getMonth() + 1).padStart(2, "0")}`;
    revenueMap[key] = (revenueMap[key] ?? 0) + Number(tx.amount);
  }

  const monthlyRevenueValue = Number(revenueThisMonth._sum.amount ?? 0);
  const lastMonthRevenueValue = Number(revenueLastMonth._sum.amount ?? 0);

  return {
    summary: {
      totalRequests,
      newRequests,
      requestsThisMonth,
      requestsTrend: pctChange(requestsThisMonth, requestsLastMonth),
      totalEvents,
      activeEvents,
      newEventsThisMonth: eventsThisMonth,
      eventsTrend: pctChange(eventsThisMonth, eventsLastMonth),
      totalCustomers,
      newCustomersThisMonth: customersThisMonth,
      customersTrend: pctChange(customersThisMonth, customersLastMonth),
      monthlyRevenue: monthlyRevenueValue,
      revenueTrend: pctChange(monthlyRevenueValue, lastMonthRevenueValue),
    },
    monthlyRevenue: revenueMap,
    eventTypes: eventsByType,
    recentRequests,
    upcomingEvents,
  };
};

export const getAdminNotifications = async (
  adminUserId: string,
  filters: { read?: string; type?: string; skip: number; take: number },
) => {
  const where = {
    userId: adminUserId,
    scope: "admin",
    ...(filters.read !== undefined ? { isRead: filters.read === "true" } : {}),
    ...(filters.type ? { type: filters.type } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: filters.skip,
      take: filters.take,
    }),
    prisma.notification.count({ where }),
  ]);
  return { items, total };
};

export const markAdminNotificationRead = async (id: string, adminUserId: string) => {
  const result = await prisma.notification.updateMany({
    where: { id, userId: adminUserId, scope: "admin" },
    data: { isRead: true, readAt: new Date() },
  });
  if (result.count === 0) throw createError("NOT_FOUND", "Notification not found", 404);
  return { updated: true };
};
