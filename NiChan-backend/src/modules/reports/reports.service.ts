import { prisma } from "../../lib/prisma";

// ─── Organizer Reports ────────────────────────────────────────────────────────

export const getOrganizerProjectProgress = async (organizerUserId: string) => {
  const events = await prisma.event.findMany({
    where: { organizerUserId, status: { not: "cancelled" } },
    include: {
      _count: { select: { tasks: true } },
      tasks: { select: { status: true } },
    },
  });

  return events.map((e) => {
    const total = e.tasks.length;
    const done = e.tasks.filter((t: { status: string }) => t.status === "done").length;
    return {
      id: e.id,
      name: e.name,
      status: e.status,
      eventDate: e.eventDate,
      progressPercent: e.progressPercent,
      taskTotal: total,
      taskDone: done,
      taskPercent: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  });
};

export const getOrganizerTaskCompletion = async (organizerUserId: string) => {
  return prisma.projectTask.groupBy({
    by: ["status"],
    where: { event: { organizerUserId } },
    _count: { status: true },
    orderBy: { _count: { status: "desc" } },
  });
};

export const getOrganizerBudgetOverview = async (organizerUserId: string) => {
  const events = await prisma.event.findMany({
    where: { organizerUserId },
    include: { budgets: { include: { items: true } } },
  });

  return events.map((e) => {
    const items = e.budgets.flatMap((b: { items: { estimatedAmount: unknown; actualAmount: unknown }[] }) => b.items);
    const estimated = items.reduce((s: number, i: { estimatedAmount: unknown }) => s + Number(i.estimatedAmount), 0);
    const actual = items.reduce((s: number, i: { actualAmount: unknown }) => s + Number(i.actualAmount), 0);
    return { id: e.id, name: e.name, estimated, actual, variance: estimated - actual };
  });
};

// High-level KPIs for the organizer reports/summary header.
export const getOrganizerSummary = async (organizerUserId: string) => {
  const [events, totalTasks, doneTasks, budgetAgg, reviewAgg, vendorCount, staffRows] =
    await prisma.$transaction([
      prisma.event.findMany({
        where: { organizerUserId },
        select: { status: true },
      }),
      prisma.projectTask.count({ where: { event: { organizerUserId } } }),
      prisma.projectTask.count({ where: { event: { organizerUserId }, status: "done" } }),
      prisma.budgetItem.aggregate({
        where: { projectBudget: { event: { organizerUserId } } },
        _sum: { estimatedAmount: true, actualAmount: true },
      }),
      prisma.review.aggregate({
        where: { event: { organizerUserId }, status: "approved" },
        _avg: { ratingOverall: true },
        _count: { _all: true },
      }),
      prisma.eventVendor.count({ where: { event: { organizerUserId } } }),
      prisma.eventStaffAssignment.findMany({
        where: { event: { organizerUserId } },
        select: { staffUserId: true },
        distinct: ["staffUserId"],
      }),
    ]);

  const totalEvents = events.length;
  const countOf = (status: string) => events.filter((e) => e.status === status).length;
  const completedEvents = countOf("completed");
  const cancelledEvents = countOf("cancelled");
  const activeEvents = totalEvents - completedEvents - cancelledEvents;

  const estimated = Number(budgetAgg._sum.estimatedAmount ?? 0);
  const actual = Number(budgetAgg._sum.actualAmount ?? 0);

  return {
    totalEvents,
    activeEvents,
    completedEvents,
    cancelledEvents,
    totalTasks,
    doneTasks,
    completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
    budgetEstimated: estimated,
    budgetActual: actual,
    budgetVariance: estimated - actual,
    vendorCount,
    staffCount: staffRows.length,
    reviewCount: reviewAgg._count._all,
    avgRating: reviewAgg._avg.ratingOverall ? Number(reviewAgg._avg.ratingOverall.toFixed(1)) : 0,
  };
};

// Staff performance scoped to the organizer's own events.
export const getOrganizerStaffPerformance = async (organizerUserId: string) => {
  const assignments = await prisma.eventStaffAssignment.findMany({
    where: { event: { organizerUserId } },
    include: {
      staffUser: { select: { id: true, displayName: true, avatarUrl: true } },
      event: { select: { status: true } },
    },
  });

  const staffMap: Record<
    string,
    { id: string; name: string; avatarUrl: string | null; assignments: number; confirmed: number; completed: number }
  > = {};

  for (const a of assignments) {
    const key = a.staffUserId;
    if (!staffMap[key]) {
      staffMap[key] = {
        id: a.staffUserId,
        name: a.staffUser.displayName,
        avatarUrl: a.staffUser.avatarUrl,
        assignments: 0,
        confirmed: 0,
        completed: 0,
      };
    }
    staffMap[key].assignments += 1;
    if (a.status === "confirmed") staffMap[key].confirmed += 1;
    if (a.event.status === "completed") staffMap[key].completed += 1;
  }

  return Object.values(staffMap).sort((a, b) => b.completed - a.completed || b.assignments - a.assignments);
};

// ─── Admin Reports ────────────────────────────────────────────────────────────

export const getAdminConversionReport = async () => {
  const [total, confirmed, rejected] = await prisma.$transaction([
    prisma.consultationRequest.count(),
    prisma.consultationRequest.count({ where: { status: "confirmed" } }),
    prisma.consultationRequest.count({ where: { status: "rejected" } }),
  ]);
  const conversionRate = total > 0 ? Math.round((confirmed / total) * 100) : 0;
  return { total, confirmed, rejected, conversionRate };
};

export const getAdminRevenueByType = async () => {
  const transactions = await prisma.transaction.findMany({
    where: { status: "completed" },
    select: {
      amount: true,
      event: { select: { type: true } },
      contract: { select: { event: { select: { type: true } } } },
    },
  });

  const map: Record<string, number> = {};
  for (const tx of transactions) {
    const type = tx.event?.type ?? tx.contract?.event.type ?? "Khác";
    map[type] = (map[type] ?? 0) + Number(tx.amount ?? 0);
  }

  return Object.entries(map)
    .map(([type, revenue]) => ({ type, revenue }))
    .sort((a, b) => b.revenue - a.revenue);
};

export const getAdminTopEvents = async () => {
  const events = await prisma.event.findMany({
    where: { status: { not: "cancelled" } },
    include: {
      customerUser: { select: { id: true, displayName: true } },
      organizerUser: { select: { id: true, displayName: true } },
      consultationRequest: { select: { customerName: true, eventType: true, note: true } },
      transactions: { select: { amount: true, status: true } },
      contracts: { where: { status: { in: billableContractStatuses } }, select: { totalValue: true } },
      budgets: {
        select: {
          items: {
            where: { status: { in: expenseStatuses } },
            select: { actualAmount: true },
          },
        },
      },
      reviews: { where: { status: "approved" }, select: { ratingOverall: true } },
    },
  });

  return buildTopEvents(events);
};

export const getAdminStaffPerformance = async () => {
  const assignments = await prisma.eventStaffAssignment.findMany({
    include: {
      staffUser: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          staffProfile: { select: { jobTitle: true, employmentStatus: true } },
        },
      },
      event: { select: { status: true } },
    },
  });

  const staffMap: Record<
    string,
    {
      id: string;
      name: string;
      avatarUrl: string | null;
      jobTitle: string | null;
      employmentStatus: string | null;
      assignments: number;
      confirmed: number;
      declined: number;
      completed: number;
      active: number;
      completionRate: number;
    }
  > = {};

  for (const a of assignments) {
    const key = a.staffUserId;
    if (!staffMap[key]) {
      staffMap[key] = {
        id: a.staffUserId,
        name: a.staffUser.displayName,
        avatarUrl: a.staffUser.avatarUrl,
        jobTitle: a.staffUser.staffProfile?.jobTitle ?? null,
        employmentStatus: a.staffUser.staffProfile?.employmentStatus ?? null,
        assignments: 0,
        confirmed: 0,
        declined: 0,
        completed: 0,
        active: 0,
        completionRate: 0,
      };
    }
    staffMap[key].assignments += 1;
    if (a.status === "confirmed") staffMap[key].confirmed += 1;
    if (a.status === "declined") staffMap[key].declined += 1;
    if (a.event.status === "completed") staffMap[key].completed += 1;
    if (["planning", "contracted", "in_progress", "quoted"].includes(a.event.status)) staffMap[key].active += 1;
  }

  return Object.values(staffMap)
    .map((staff) => ({
      ...staff,
      completionRate: staff.assignments > 0 ? Math.round((staff.completed / staff.assignments) * 100) : 0,
    }))
    .sort((a, b) => b.completed - a.completed || b.confirmed - a.confirmed || b.assignments - a.assignments);
};

const expenseStatuses = ["committed", "paid"];
const billableContractStatuses = ["sent", "active", "liquidated"];
const activeEventStatuses = ["planning", "quoted", "contracted", "in_progress"];

const toNumber = (value: unknown) => Number(value ?? 0);

const rate = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const getTwelveMonthWindow = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  start.setHours(0, 0, 0, 0);
  return { now, start };
};

const buildMonthlyMap = (start: Date) => {
  const map: Record<
    string,
    { month: string; revenue: number; expenses: number; profit: number; requests: number; events: number }
  > = {};

  for (let i = 0; i < 12; i += 1) {
    const date = new Date(start);
    date.setMonth(date.getMonth() + i);
    const key = monthKey(date);
    map[key] = { month: key, revenue: 0, expenses: 0, profit: 0, requests: 0, events: 0 };
  }

  return map;
};

const getGroupCount = (count: unknown, field: string) => {
  if (!count || typeof count !== "object") return 0;
  const value = (count as Record<string, unknown>)[field];
  return Number(value ?? 0);
};

const buildStatusCountMap = (items: { status: string; _count?: unknown }[]) =>
  items.map((item) => ({
    key: item.status,
    count: getGroupCount(item._count, "status"),
  }));

const buildTypeCountMap = (items: { type: string; _count?: unknown }[]) =>
  items.map((item) => ({
    key: item.type,
    count: getGroupCount(item._count, "type"),
  }));

type TopEventSource = {
  id: string;
  name: string;
  type: string;
  status: string;
  eventDate?: Date | null;
  guestCount?: number | null;
  progressPercent: number;
  budgetActual?: unknown;
  customerUser?: { id: string; displayName: string } | null;
  organizerUser?: { id: string; displayName: string } | null;
  consultationRequest?: { customerName?: string | null; eventType?: string | null; note?: string | null } | null;
  transactions?: { amount: unknown; status: string }[];
  contracts?: { totalValue: unknown }[];
  budgets?: { items: { actualAmount: unknown }[] }[];
  reviews?: { ratingOverall: number }[];
};

const buildTopEvents = (events: TopEventSource[]) =>
  events
    .map((event) => {
      const revenue = (event.transactions ?? [])
        .filter((tx) => tx.status === "completed")
        .reduce((sum, tx) => sum + toNumber(tx.amount), 0);
      const pendingRevenue = (event.transactions ?? [])
        .filter((tx) => tx.status === "pending")
        .reduce((sum, tx) => sum + toNumber(tx.amount), 0);
      const expenses = (event.budgets ?? [])
        .flatMap((budget) => budget.items)
        .reduce((sum, item) => sum + toNumber(item.actualAmount), 0);
      const contractValue = (event.contracts ?? []).reduce(
        (sum, contract) => sum + toNumber(contract.totalValue),
        0,
      );
      const ratings = event.reviews ?? [];
      const avgRating =
        ratings.length > 0
          ? Number((ratings.reduce((sum, review) => sum + review.ratingOverall, 0) / ratings.length).toFixed(1))
          : 0;

      return {
        id: event.id,
        name: event.name,
        type: event.type,
        status: event.status,
        eventDate: event.eventDate,
        guestCount: event.guestCount,
        progressPercent: event.progressPercent,
        budgetActual: toNumber(event.budgetActual),
        customerUser: event.customerUser,
        organizerUser: event.organizerUser,
        consultationRequest: event.consultationRequest,
        revenue,
        pendingRevenue,
        expenses,
        profit: revenue - expenses,
        contractValue,
        collectionRate: rate(revenue, contractValue),
        avgRating,
        reviewCount: ratings.length,
      };
    })
    .filter((event) => event.revenue > 0 || event.contractValue > 0 || event.expenses > 0)
    .sort((a, b) => b.revenue - a.revenue || b.contractValue - a.contractValue)
    .slice(0, 10);

export const getAdminReportsOverview = async () => {
  const { start } = getTwelveMonthWindow();

  const [coreData, revenueByType, topEvents, staffPerformance] = await Promise.all([
    prisma.$transaction([
      prisma.consultationRequest.groupBy({
        by: ["status"],
        _count: { status: true },
        orderBy: { _count: { status: "desc" } },
      }),
      prisma.event.groupBy({
        by: ["status"],
        _count: { status: true },
        orderBy: { _count: { status: "desc" } },
      }),
      prisma.event.groupBy({
        by: ["type"],
        _count: { type: true },
        orderBy: { _count: { type: "desc" } },
      }),
      prisma.contract.groupBy({
        by: ["status"],
        _count: { status: true },
        orderBy: { _count: { status: "desc" } },
      }),
      prisma.transaction.groupBy({
        by: ["status"],
        _count: { status: true },
        orderBy: { _count: { status: "desc" } },
      }),
      prisma.consultationRequest.count(),
      prisma.consultationRequest.count({ where: { status: "confirmed" } }),
      prisma.consultationRequest.count({ where: { status: "rejected" } }),
      prisma.event.count(),
      prisma.event.count({ where: { status: { in: activeEventStatuses } } }),
      prisma.event.count({ where: { status: "completed" } }),
      prisma.event.count({ where: { status: "cancelled" } }),
      prisma.user.count({ where: { role: "customer", deletedAt: null } }),
      prisma.user.count({ where: { role: "organizer", deletedAt: null } }),
      prisma.user.count({ where: { role: "staff", deletedAt: null } }),
      prisma.vendor.count({ where: { status: { not: "inactive" } } }),
      prisma.event.aggregate({ _avg: { progressPercent: true } }),
      prisma.transaction.aggregate({ where: { status: "completed" }, _sum: { amount: true } }),
      prisma.budgetItem.aggregate({
        where: { status: { in: expenseStatuses } },
        _sum: { actualAmount: true },
      }),
      prisma.review.aggregate({
        where: { status: "approved" },
        _avg: { ratingOverall: true },
        _count: { _all: true },
      }),
      prisma.contract.findMany({
        where: { status: { in: billableContractStatuses } },
        select: {
          totalValue: true,
          transactions: { where: { status: "completed" }, select: { amount: true } },
        },
      }),
      prisma.transaction.findMany({
        where: { status: "completed", transactionDate: { gte: start } },
        select: { amount: true, transactionDate: true },
      }),
      prisma.budgetItem.findMany({
        where: { status: "paid", updatedAt: { gte: start } },
        select: { actualAmount: true, updatedAt: true },
      }),
      prisma.consultationRequest.findMany({
        where: { createdAt: { gte: start } },
        select: { createdAt: true },
      }),
      prisma.event.findMany({
        where: { createdAt: { gte: start } },
        select: { createdAt: true },
      }),
    ]),
    getAdminRevenueByType(),
    getAdminTopEvents(),
    getAdminStaffPerformance(),
  ]);

  const [
    requestStatusRows,
    eventStatusRows,
    eventTypeRows,
    contractStatusRows,
    transactionStatusRows,
    requestTotal,
    confirmedRequests,
    rejectedRequests,
    totalEvents,
    activeEvents,
    completedEvents,
    cancelledEvents,
    customerCount,
    organizerCount,
    staffCount,
    vendorCount,
    progressAggregate,
    revenueAggregate,
    expenseAggregate,
    reviewAggregate,
    contracts,
    monthlyTransactions,
    monthlyExpenses,
    monthlyRequests,
    monthlyEvents,
  ] = coreData;

  const monthly = buildMonthlyMap(start);
  for (const tx of monthlyTransactions) {
    const key = monthKey(tx.transactionDate);
    if (monthly[key]) monthly[key].revenue += toNumber(tx.amount);
  }
  for (const expense of monthlyExpenses) {
    const key = monthKey(expense.updatedAt);
    if (monthly[key]) monthly[key].expenses += toNumber(expense.actualAmount);
  }
  for (const request of monthlyRequests) {
    const key = monthKey(request.createdAt);
    if (monthly[key]) monthly[key].requests += 1;
  }
  for (const event of monthlyEvents) {
    const key = monthKey(event.createdAt);
    if (monthly[key]) monthly[key].events += 1;
  }

  const monthlyTrend = Object.values(monthly).map((item) => ({
    ...item,
    profit: item.revenue - item.expenses,
  }));

  const totalRevenue = toNumber(revenueAggregate._sum.amount);
  const totalExpenses = toNumber(expenseAggregate._sum.actualAmount);
  const contractValue = contracts.reduce((sum, contract) => sum + toNumber(contract.totalValue), 0);
  const collectedOnContracts = contracts.reduce(
    (sum, contract) =>
      sum + contract.transactions.reduce((txSum, tx) => txSum + toNumber(tx.amount), 0),
    0,
  );
  const receivable = contracts.reduce((sum, contract) => {
    const collected = contract.transactions.reduce((txSum, tx) => txSum + toNumber(tx.amount), 0);
    return sum + Math.max(toNumber(contract.totalValue) - collected, 0);
  }, 0);
  const profit = totalRevenue - totalExpenses;

  return {
    summary: {
      totalRequests: requestTotal,
      confirmedRequests,
      rejectedRequests,
      conversionRate: rate(confirmedRequests, requestTotal),
      totalEvents,
      activeEvents,
      completedEvents,
      cancelledEvents,
      averageProgress: Math.round(progressAggregate._avg.progressPercent ?? 0),
      totalCustomers: customerCount,
      totalOrganizers: organizerCount,
      totalStaff: staffCount,
      totalVendors: vendorCount,
      totalRevenue,
      totalExpenses,
      profit,
      profitMargin: rate(profit, totalRevenue),
      contractValue,
      collectedOnContracts,
      receivable,
      collectionRate: rate(collectedOnContracts, contractValue),
      reviewCount: reviewAggregate._count._all,
      avgRating: reviewAggregate._avg.ratingOverall
        ? Number(reviewAggregate._avg.ratingOverall.toFixed(1))
        : 0,
    },
    monthlyTrend,
    requestStatus: buildStatusCountMap(requestStatusRows),
    eventStatus: buildStatusCountMap(eventStatusRows),
    eventTypes: buildTypeCountMap(eventTypeRows),
    contractStatus: buildStatusCountMap(contractStatusRows),
    transactionStatus: buildStatusCountMap(transactionStatusRows),
    revenueByType,
    topEvents,
    staffPerformance,
  };
};
