import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { emitNotification } from "../../lib/socket";
import { createError } from "../../middleware/errorHandler";

type Tx = Prisma.TransactionClient;

type CustomerTrackingOptions = {
  actorUserId?: string | null;
  status: "contracted" | "quoted" | "planning" | "in_progress" | "completed";
  activityMessage: string;
  notificationTitle: string;
  notificationMessage: string;
};

type NotificationPayload = {
  id: string;
  type: string;
  title: string | null;
  message: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: Date;
  userId: string;
};

const eventStatusProgressFloor: Readonly<Record<string, number>> = {
  contracted: 10,
  quoted: 25,
  planning: 40,
  in_progress: 60,
  completed: 100,
};

export const getEventProgressPercent = (
  status: string,
  calculatedProgress?: number | null,
) => {
  if (status === "completed") return 100;

  const tentativeProgress = Math.max(
    calculatedProgress ?? 0,
    eventStatusProgressFloor[status] ?? 0,
  );

  // Hoan thanh tat ca cong viec van chua dong nghia voi hoan tat thanh du an.
  // Chi luong nghiem thu quyet toan va thanh toan du moi duoc dat 100%.
  return Math.min(tentativeProgress, 99);
};

const addDays = (value: Date, days: number) => {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
};

const defaultMilestones = (eventDate?: Date | null) => [
  {
    title: "Khởi động dự án",
    description: "Thông tin sự kiện đã sẵn sàng để khách hàng theo dõi.",
    milestoneDate: null,
    status: "done",
    sortOrder: 10,
  },
  {
    title: "Chốt kế hoạch",
    description: "Thống nhất timeline, hạng mục công việc và nguồn lực chính.",
    milestoneDate: eventDate ? addDays(eventDate, -14) : null,
    status: "todo",
    sortOrder: 20,
  },
  {
    title: "Triển khai sự kiện",
    description: "Ban tổ chức tiến hành setup và điều phối sự kiện.",
    milestoneDate: eventDate ?? null,
    status: "todo",
    sortOrder: 30,
  },
  {
    title: "Nghiệm thu và hoàn tất",
    description: "Tổng kết, bàn giao tài liệu và hoàn tất thanh toán.",
    milestoneDate: eventDate ? addDays(eventDate, 1) : null,
    status: "todo",
    sortOrder: 40,
  },
];

export const ensureCustomerTrackingInTransaction = async (
  tx: Tx,
  eventId: string,
  options: CustomerTrackingOptions,
) => {
  const event = await tx.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      status: true,
      customerUserId: true,
      organizerUserId: true,
      consultationRequestId: true,
      eventDate: true,
      progressPercent: true,
    },
  });
  if (!event) throw createError("NOT_FOUND", "Event not found", 404);

  const targetProgress = getEventProgressPercent(options.status);
  const progressPatch =
    options.status === "completed"
      ? { progressPercent: 100, completedAt: new Date() }
      : { progressPercent: targetProgress, completedAt: null };

  const updatedEvent = await tx.event.update({
    where: { id: eventId },
    data: { status: options.status, ...progressPatch },
    select: {
      id: true,
      name: true,
      status: true,
      progressPercent: true,
      customerUserId: true,
      organizerUserId: true,
    },
  });

  if (event.consultationRequestId) {
    const requestStatusByEventStatus = {
      quoted: "quoted",
      contracted: "confirmed",
      planning: "planning",
      in_progress: "in_progress",
      completed: "completed",
    } as const;
    const requestStatus = requestStatusByEventStatus[options.status];
    await tx.consultationRequest.update({
      where: { id: event.consultationRequestId },
      data: {
        status: requestStatus,
        ...(requestStatus === "quoted" ? { quotedAt: new Date() } : {}),
        ...(requestStatus === "confirmed" ? { confirmedAt: new Date() } : {}),
      },
    });
  }

  const milestoneCount = await tx.eventMilestone.count({ where: { eventId } });
  if (milestoneCount === 0) {
    await tx.eventMilestone.createMany({
      data: defaultMilestones(event.eventDate).map((milestone) => ({
        eventId,
        ...milestone,
      })),
    });
  }

  let thread = await tx.chatThread.findFirst({
    where: { eventId },
    select: { id: true },
  });
  thread ??= await tx.chatThread.create({
    data: { eventId },
    select: { id: true },
  });

  await tx.chatThreadMember.upsert({
    where: { threadId_userId: { threadId: thread.id, userId: event.customerUserId } },
    create: { threadId: thread.id, userId: event.customerUserId },
    update: {},
  });

  if (event.organizerUserId) {
    await tx.chatThreadMember.upsert({
      where: { threadId_userId: { threadId: thread.id, userId: event.organizerUserId } },
      create: { threadId: thread.id, userId: event.organizerUserId },
      update: {},
    });
  }

  await tx.eventActivity.create({
    data: {
      eventId,
      actorUserId: options.actorUserId ?? event.organizerUserId,
      iconName: "check",
      message: options.activityMessage,
    },
  });

  const notification = await tx.notification.create({
    data: {
      userId: event.customerUserId,
      scope: "customer",
      type: "project",
      title: options.notificationTitle,
      message: options.notificationMessage,
      entityType: "event",
      entityId: eventId,
    },
    select: {
      id: true,
      userId: true,
      type: true,
      title: true,
      message: true,
      entityType: true,
      entityId: true,
      createdAt: true,
    },
  });

  return { event: updatedEvent, notification };
};

export const emitCustomerNotification = (notification: NotificationPayload) => {
  emitNotification(notification.userId, {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    entityType: notification.entityType,
    entityId: notification.entityId,
    createdAt: notification.createdAt,
  });
};

export const tryFinalizeSettlementPaymentInTransaction = async (
  tx: Tx,
  contractId: string,
  actorUserId?: string | null,
) => {
  const contract = await tx.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      contractCode: true,
      status: true,
      totalValue: true,
      eventId: true,
      event: {
        select: {
          id: true,
          name: true,
          status: true,
          customerUserId: true,
          organizerUserId: true,
          consultationRequestId: true,
        },
      },
      versions: {
        where: { purpose: "settlement" },
        take: 1,
        orderBy: { createdAt: "desc" },
        select: {
          lineItems: {
            select: {
              settlementFeedbacks: {
                where: { status: "agreed" },
                select: { customerId: true },
              },
            },
          },
        },
      },
      transactions: {
        where: { status: "completed" },
        select: { amount: true },
      },
    },
  });

  if (!contract || contract.status === "cancelled") {
    return { finalized: false, notification: null };
  }

  const settlement = contract.versions[0];
  const allItemsAgreed =
    Boolean(settlement?.lineItems.length) &&
    settlement!.lineItems.every((item) =>
      item.settlementFeedbacks.some(
        (feedback) => feedback.customerId === contract.event.customerUserId,
      ),
    );
  const collectedAmount = contract.transactions.reduce(
    (sum, transaction) => sum + Number(transaction.amount),
    0,
  );
  const fullyPaid = collectedAmount + 0.01 >= Number(contract.totalValue);

  if (!allItemsAgreed) {
    return { finalized: false, notification: null };
  }

  const otherOpenContractCount = await tx.contract.count({
    where: {
      eventId: contract.eventId,
      id: { not: contractId },
      status: { in: ["sent", "active"] },
    },
  });

  // Chốt quyết toán là bước áp chót. Dự án chỉ hoàn thành 100% sau khi thanh toán đủ.
  if (!fullyPaid) {
    await tx.event.update({
      where: { id: contract.eventId },
      data: {
        status: "in_progress",
        progressPercent: 99,
        completedAt: null,
      },
    });

    if (contract.event.consultationRequestId) {
      await tx.consultationRequest.update({
        where: { id: contract.event.consultationRequestId },
        data: { status: "in_progress" },
      });
    }

    return { finalized: false, notification: null };
  }

  if (contract.status !== "liquidated") {
    await tx.contract.update({
      where: { id: contractId },
      data: { status: "liquidated" },
    });
  }

  if (otherOpenContractCount > 0 || contract.event.status === "completed") {
    return { finalized: true, notification: null };
  }

  const completedAt = new Date();
  await tx.event.update({
    where: { id: contract.eventId },
    data: {
      status: "completed",
      progressPercent: 100,
      completedAt,
    },
  });

  if (contract.event.consultationRequestId) {
    await tx.consultationRequest.update({
      where: { id: contract.event.consultationRequestId },
      data: { status: "completed" },
    });
  }

  await tx.eventMilestone.updateMany({
    where: { eventId: contract.eventId },
    data: { status: "done" },
  });

  await tx.eventActivity.create({
    data: {
      eventId: contract.eventId,
      actorUserId: actorUserId ?? contract.event.organizerUserId,
      iconName: "badge-check",
      message: `Hợp đồng ${contract.contractCode} đã được nghiệm thu, thanh toán đủ và thanh lý. Dự án hoàn thành 100%.`,
    },
  });

  const notification = await tx.notification.create({
    data: {
      userId: contract.event.customerUserId,
      scope: "customer",
      type: "project",
      title: "Dự án đã hoàn thành",
      message: `NiChan đã xác nhận thanh toán cuối cùng cho ${contract.event.name}. Hợp đồng ${contract.contractCode} đã thanh lý và dự án hoàn thành 100%.`,
      entityType: "event",
      entityId: contract.eventId,
    },
    select: {
      id: true,
      userId: true,
      type: true,
      title: true,
      message: true,
      entityType: true,
      entityId: true,
      createdAt: true,
    },
  });

  return { finalized: true, notification };
};

export const ensureEventCanBeManuallyCompleted = async (eventId: string) => {
  const openContractCount = await prisma.contract.count({
    where: {
      eventId,
      status: { in: ["sent", "active"] },
    },
  });
  if (openContractCount > 0) {
    throw createError(
      "SETTLEMENT_PAYMENT_REQUIRED",
      "Dự án chỉ hoàn thành sau khi khách hàng đồng ý nghiệm thu và thanh toán đủ hợp đồng.",
      409,
    );
  }
};

export const notifyCustomerForEvent = async (
  eventId: string,
  input: {
    type: string;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
  },
) => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { customerUserId: true },
  });
  if (!event) return null;

  const notification = await prisma.notification.create({
    data: {
      userId: event.customerUserId,
      scope: "customer",
      type: input.type,
      title: input.title,
      message: input.message,
      entityType: input.entityType ?? "event",
      entityId: input.entityId ?? eventId,
    },
    select: {
      id: true,
      userId: true,
      type: true,
      title: true,
      message: true,
      entityType: true,
      entityId: true,
      createdAt: true,
    },
  });

  emitCustomerNotification(notification);
  return notification;
};

export const activateCustomerTracking = async (
  eventId: string,
  options: CustomerTrackingOptions,
) => {
  const result = await prisma.$transaction((tx) =>
    ensureCustomerTrackingInTransaction(tx, eventId, options),
  );
  emitCustomerNotification(result.notification);
  return result.event;
};
