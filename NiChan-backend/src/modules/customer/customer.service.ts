import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { createError } from "../../middleware/errorHandler";
import { emitNewMessage, emitMessageDeleted, emitNotification } from "../../lib/socket";
import { z } from "zod";

type Tx = Prisma.TransactionClient;

const billableContractStatuses = ["sent", "active", "liquidated"];
const eventTrackingContractStatuses = [...billableContractStatuses, "cancelled"];
const payableTransactionStatuses = ["pending", "completed"];
const toNumber = (value: unknown) => Number(value ?? 0);

const money = (value: number) => `${value.toLocaleString("vi-VN")} đ`;
const contractLineItemsInclude = {
  orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
};

const customerTransactionInclude = {
  event: {
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      eventDate: true,
      customerUser: { select: { id: true, displayName: true } },
      consultationRequest: { select: { customerName: true, eventType: true, note: true } },
    },
  },
  contract: {
    select: {
      id: true,
      contractCode: true,
      totalValue: true,
      status: true,
      eventId: true,
    },
  },
} satisfies Prisma.TransactionInclude;

const payableAmounts = (
  totalValue: unknown,
  transactions: { amount: unknown; status: string; paymentMethod?: string | null }[],
) => {
  const completed = transactions
    .filter((transaction) => transaction.status === "completed")
    .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
  const pending = transactions
    .filter((transaction) => transaction.status === "pending" && transaction.paymentMethod)
    .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
  return {
    completed,
    pending,
    outstanding: Math.max(toNumber(totalValue) - completed - pending, 0),
  };
};

const isSettlementFinalInstallment = (description: string) =>
  /thanh toán sau nghiệm thu|phần còn lại sau quyết toán/i.test(description);

const getInstallmentNumber = (description: string, fallback: number) => {
  const match = description.match(/Đợt\s+(\d+)/i);
  return match ? Number(match[1]) : fallback;
};

const syncLiquidatedContractPayments = async (filters: {
  customerUserId: string;
  eventId?: string;
  contractId?: string;
}) => {
  await prisma.$transaction(async (tx) => {
    const contracts = await tx.contract.findMany({
      where: {
        customerUserId: filters.customerUserId,
        status: "liquidated",
        ...(filters.eventId ? { eventId: filters.eventId } : {}),
        ...(filters.contractId ? { id: filters.contractId } : {}),
      },
      select: {
        id: true,
        contractCode: true,
        totalValue: true,
        transactions: {
          where: { status: { in: payableTransactionStatuses } },
          select: {
            id: true,
            amount: true,
            status: true,
            paymentMethod: true,
            description: true,
            transactionDate: true,
          },
          orderBy: { transactionDate: "asc" },
        },
      },
    });

    for (const contract of contracts) {
      const finalInstallment = contract.transactions
        .filter(
          (transaction) =>
            transaction.status === "pending" &&
            !transaction.paymentMethod &&
            isSettlementFinalInstallment(transaction.description),
        )
        .sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime())[0];

      if (!finalInstallment) continue;

      const settledAmount = contract.transactions
        .filter((transaction) => transaction.id !== finalInstallment.id)
        .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
      const remainingAmount = Math.max(toNumber(contract.totalValue) - settledAmount, 0);

      if (remainingAmount <= 0) {
        await tx.transaction.update({
          where: { id: finalInstallment.id },
          data: {
            status: "cancelled",
            description: `${finalInstallment.description} - Không phát sinh thêm sau quyết toán`,
          },
        });
        continue;
      }

      if (toNumber(finalInstallment.amount) === remainingAmount) continue;

      const installmentNumber = getInstallmentNumber(finalInstallment.description, contract.transactions.length);
      await tx.transaction.update({
        where: { id: finalInstallment.id },
        data: {
          amount: remainingAmount,
          description: `Thanh toán ${contract.contractCode} - Đợt ${installmentNumber}: Thanh toán sau nghiệm thu (phần còn lại sau quyết toán)`,
        },
      });
    }
  });
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const getCustomerDashboard = async (customerUserId: string) => {
  await syncLiquidatedContractPayments({ customerUserId });
  const [events, contracts, transactions] = await prisma.$transaction([
    prisma.event.findMany({
      where: { customerUserId },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        eventDate: true,
        progressPercent: true,
        organizerUser: { select: { id: true, displayName: true, avatarUrl: true } },
        customerUser: { select: { id: true, displayName: true } },
        consultationRequest: {
          select: {
            id: true,
            customerName: true,
            eventType: true,
            note: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.contract.findMany({
      where: { customerUserId },
      select: { id: true, contractCode: true, status: true, totalValue: true, sentAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.transaction.findMany({
      where: { event: { customerUserId } },
      select: { id: true, description: true, amount: true, transactionDate: true, status: true },
      orderBy: { transactionDate: "desc" },
      take: 5,
    }),
  ]);

  const recentActivities = await prisma.eventActivity.findMany({
    where: { event: { customerUserId } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, message: true, iconName: true, createdAt: true },
  });

  const requests = await getCustomerRequests(customerUserId);
  return { events, requests: requests.slice(0, 5), recentActivities, contracts, transactions };
};

export const getCustomerRequests = async (customerUserId: string) => {
  return prisma.consultationRequest.findMany({
    where: { customerUserId },
    select: {
      id: true,
      requestCode: true,
      customerName: true,
      eventType: true,
      eventDate: true,
      guestCount: true,
      budgetRange: true,
      locationText: true,
      note: true,
      status: true,
      quotedAt: true,
      confirmedAt: true,
      rejectedAt: true,
      createdAt: true,
      updatedAt: true,
      assignedManager: {
        select: { id: true, displayName: true, avatarUrl: true },
      },
      events: {
        take: 1,
        select: { id: true, name: true, status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const getCustomerRequestById = async (requestId: string, customerUserId: string) => {
  const request = await prisma.consultationRequest.findFirst({
    where: { id: requestId, customerUserId },
    include: {
      assignedManager: {
        select: { id: true, displayName: true, avatarUrl: true },
      },
      events: {
        take: 1,
        select: { id: true, name: true, status: true },
      },
    },
  });
  if (!request) throw createError("NOT_FOUND", "Request not found", 404);
  return request;
};

export const getCustomerNotifications = async (
  customerUserId: string,
  filters: { read?: string; type?: string; skip: number; take: number },
) => {
  const where = {
    userId: customerUserId,
    scope: "customer",
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

export const markCustomerNotificationRead = async (
  id: string,
  customerUserId: string,
) => {
  const result = await prisma.notification.updateMany({
    where: { id, userId: customerUserId, scope: "customer" },
    data: { isRead: true, readAt: new Date() },
  });
  if (result.count === 0) throw createError("NOT_FOUND", "Notification not found", 404);
  return { updated: true };
};

// ─── Events ───────────────────────────────────────────────────────────────────

export const getCustomerEvents = async (
  customerUserId: string,
  filters: { status?: string; upcomingOnly?: string },
) => {
  const now = new Date();
  return prisma.event.findMany({
    where: {
      customerUserId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.upcomingOnly === "true"
        ? { eventDate: { gte: now }, status: { not: "cancelled" } }
        : {}),
    },
    include: {
      organizerUser: { select: { id: true, displayName: true, avatarUrl: true } },
      customerUser: { select: { id: true, displayName: true } },
      consultationRequest: {
        select: {
          id: true,
          customerName: true,
          eventType: true,
          note: true,
        },
      },
      _count: { select: { tasks: true, milestones: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const getCustomerEventById = async (eventId: string, customerUserId: string) => {
  await syncLiquidatedContractPayments({ customerUserId, eventId });
  const event = await prisma.event.findFirst({
    where: { id: eventId },
    include: {
      organizerUser: { select: { id: true, displayName: true, avatarUrl: true, phone: true } },
      customerUser: { select: { id: true, displayName: true } },
      consultationRequest: {
        select: {
          id: true,
          customerName: true,
          eventType: true,
          note: true,
        },
      },
      milestones: { orderBy: { sortOrder: "asc" } },
      contracts: {
        where: { status: { in: eventTrackingContractStatuses } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          contractCode: true,
          status: true,
          totalValue: true,
          currentVersion: true,
          sentAt: true,
          signedAt: true,
          respondedAt: true,
          rejectionNote: true,
          updatedAt: true,
          transactions: {
            where: { status: { in: payableTransactionStatuses } },
            select: { id: true, amount: true, status: true, paymentMethod: true },
          },
          versions: {
            take: 1,
            orderBy: { createdAt: "desc" },
            include: { lineItems: contractLineItemsInclude },
          },
        },
      },
      _count: { select: { tasks: true } },
    },
  });
  if (!event) throw createError("NOT_FOUND", "Event not found", 404);
  if (event.customerUserId !== customerUserId)
    throw createError("FORBIDDEN", "You do not have access to this event", 403);
  return event;
};

export const getEventMilestones = async (eventId: string, customerUserId: string) => {
  const event = await prisma.event.findFirst({
    where: { id: eventId, customerUserId },
    select: { id: true },
  });
  if (!event) throw createError("NOT_FOUND", "Event not found or access denied", 404);

  return prisma.eventMilestone.findMany({
    where: { eventId },
    orderBy: { sortOrder: "asc" },
  });
};

// ─── Tasks (read-only for customer) ───────────────────────────────────────────

export const getCustomerEventTasks = async (eventId: string, customerUserId: string) => {
  const event = await prisma.event.findFirst({
    where: { id: eventId, customerUserId },
    select: { id: true },
  });
  if (!event) throw createError("NOT_FOUND", "Event not found or access denied", 404);

  return prisma.projectTask.findMany({
    where: { eventId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueAt: true,
      completedAt: true,
      sortOrder: true,
      createdAt: true,
    },
  });
};

// ─── Chat ─────────────────────────────────────────────────────────────────────

const ensureEventAccess = async (eventId: string, userId: string) => {
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      OR: [
        { customerUserId: userId },
        { organizerUserId: userId, organizerAssignmentStatus: "accepted" },
      ],
    },
    select: { id: true },
  });
  if (!event) throw createError("FORBIDDEN", "Access denied to this event", 403);
  return event;
};

const ensureThread = async (eventId: string) => {
  let thread = await prisma.chatThread.findFirst({ where: { eventId } });
  if (!thread) {
    thread = await prisma.chatThread.create({ data: { eventId } });
  }
  return thread;
};

export const getChatMessages = async (
  eventId: string,
  userId: string,
  cursor?: string,
  limit = 30,
) => {
  await ensureEventAccess(eventId, userId);
  const thread = await ensureThread(eventId);

  const messages = await prisma.chatMessage.findMany({
    where: {
      threadId: thread.id,
      deletedAt: null,
      ...(cursor ? { sentAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { sentAt: "desc" },
    take: limit,
    include: { sender: { select: { id: true, displayName: true, avatarUrl: true } } },
  });

  return messages.reverse();
};

const sendMessageBodySchema = z
  .object({
    message: z.string().max(2000).optional().default(""),
    attachmentUrl: z.string().url().max(1000).optional(),
    attachmentType: z.string().max(200).optional(),
    attachmentName: z.string().max(500).optional(),
  })
  .refine((data) => data.message.trim().length > 0 || Boolean(data.attachmentUrl), {
    message: "Message text or an attachment is required",
  });

export const sendChatMessage = async (eventId: string, userId: string, body: unknown) => {
  await ensureEventAccess(eventId, userId);

  const { message, attachmentUrl, attachmentType, attachmentName } =
    sendMessageBodySchema.parse(body);
  const thread = await ensureThread(eventId);

  await prisma.chatThreadMember.upsert({
    where: { threadId_userId: { threadId: thread.id, userId } },
    create: { threadId: thread.id, userId },
    update: {},
  });

  const sender = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, avatarUrl: true },
  });

  const chatMessage = await prisma.chatMessage.create({
    data: {
      threadId: thread.id,
      senderUserId: userId,
      messageText: message,
      attachmentUrl: attachmentUrl ?? null,
      attachmentType: attachmentType ?? null,
      attachmentName: attachmentName ?? null,
    },
    include: { sender: { select: { id: true, displayName: true, avatarUrl: true } } },
  });

  emitNewMessage(eventId, {
    id: chatMessage.id,
    eventId,
    senderUserId: userId,
    sender: { displayName: sender?.displayName ?? "" },
    messageText: message,
    attachmentUrl: attachmentUrl ?? null,
    attachmentType: attachmentType ?? null,
    attachmentName: attachmentName ?? null,
    sentAt: chatMessage.sentAt,
  });

  return chatMessage;
};

export const deleteChatMessage = async (eventId: string, messageId: string, userId: string) => {
  await ensureEventAccess(eventId, userId);

  const message = await prisma.chatMessage.findFirst({
    where: { id: messageId, deletedAt: null },
    include: { thread: { select: { eventId: true } } },
  });

  if (!message) throw createError("NOT_FOUND", "Message not found", 404);
  if (message.senderUserId !== userId) throw createError("FORBIDDEN", "You can only delete your own messages", 403);
  if (message.thread.eventId !== eventId) throw createError("FORBIDDEN", "Message does not belong to this event", 403);

  await prisma.chatMessage.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
  });

  emitMessageDeleted(eventId, messageId);

  return { success: true };
};

// ─── Reviews ─────────────────────────────────────────────────────────────────

const reviewBodySchema = z.object({
  eventId: z.string().uuid(),
  ratingOverall: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(2000),
  criteriaScores: z
    .array(z.object({ key: z.string(), score: z.number().int().min(1).max(5) }))
    .optional(),
});

export const submitReview = async (customerUserId: string, body: unknown) => {
  const input = reviewBodySchema.parse(body);

  const event = await prisma.event.findFirst({
    where: { id: input.eventId, customerUserId, status: "completed" },
  });
  if (!event) throw createError("NOT_FOUND", "Completed event not found", 404);

  const existing = await prisma.review.findUnique({
    where: { eventId_customerUserId: { eventId: input.eventId, customerUserId } },
  });
  if (existing) throw createError("CONFLICT", "Review already submitted for this event", 409);

  const criteriaKeys = input.criteriaScores?.map((s) => s.key) ?? [];
  const criteriaRecords =
    criteriaKeys.length > 0
      ? await prisma.reviewCriteria.findMany({ where: { key: { in: criteriaKeys } } })
      : [];

  return prisma.review.create({
    data: {
      eventId: input.eventId,
      customerUserId,
      ratingOverall: input.ratingOverall,
      comment: input.comment,
      status: "pending",
      submittedAt: new Date(),
      scores: {
        create: criteriaRecords.map((c) => ({
          reviewCriteriaId: c.id,
          score: input.criteriaScores?.find((s) => s.key === c.key)?.score ?? 0,
        })),
      },
    },
    include: { scores: { include: { criteria: true } } },
  });
};

export const updateReview = async (
  customerUserId: string,
  reviewId: string,
  body: unknown,
) => {
  const input = reviewBodySchema.parse(body);

  const existing = await prisma.review.findFirst({
    where: {
      id: reviewId,
      eventId: input.eventId,
      customerUserId,
      event: { status: "completed" },
    },
    select: { id: true },
  });
  if (!existing) throw createError("NOT_FOUND", "Completed review not found", 404);

  const criteriaKeys = input.criteriaScores?.map((s) => s.key) ?? [];
  const criteriaRecords =
    criteriaKeys.length > 0
      ? await prisma.reviewCriteria.findMany({ where: { key: { in: criteriaKeys } } })
      : [];

  return prisma.$transaction(async (tx) => {
    await tx.reviewScore.deleteMany({ where: { reviewId } });

    return tx.review.update({
      where: { id: reviewId },
      data: {
        ratingOverall: input.ratingOverall,
        comment: input.comment,
        status: "pending",
        submittedAt: new Date(),
        approvedAt: null,
        approvedById: null,
        scores: {
          create: criteriaRecords.map((c) => ({
            reviewCriteriaId: c.id,
            score: input.criteriaScores?.find((s) => s.key === c.key)?.score ?? 0,
          })),
        },
      },
      include: { scores: { include: { criteria: true } } },
    });
  });
};

// ─── Contracts & Transactions ─────────────────────────────────────────────────

export const getCustomerContracts = async (customerUserId: string) => {
  await syncLiquidatedContractPayments({ customerUserId });
  return prisma.contract.findMany({
    where: { customerUserId },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          type: true,
          customerUser: { select: { id: true, displayName: true } },
          consultationRequest: {
            select: {
              id: true,
              customerName: true,
              eventType: true,
              note: true,
            },
          },
        },
      },
      transactions: {
        where: { status: { in: payableTransactionStatuses } },
        select: { id: true, amount: true, status: true, paymentMethod: true },
      },
      versions: {
        take: 1,
        orderBy: { createdAt: "desc" },
        include: { lineItems: contractLineItemsInclude },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const getCustomerContractById = async (contractId: string, customerUserId: string) => {
  await syncLiquidatedContractPayments({ customerUserId, contractId });
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          type: true,
          eventDate: true,
          locationText: true,
          customerUser: { select: { id: true, displayName: true } },
          consultationRequest: {
            select: { id: true, customerName: true, eventType: true, note: true },
          },
        },
      },
      customerUser: { select: { id: true, displayName: true, phone: true, email: true } },
      createdBy: { select: { id: true, displayName: true } },
      versions: {
        take: 1,
        orderBy: { createdAt: "desc" },
        include: { lineItems: contractLineItemsInclude },
      },
    },
  });
  if (!contract) throw createError("NOT_FOUND", "Contract not found", 404);
  if (contract.customerUserId !== customerUserId)
    throw createError("FORBIDDEN", "You do not have access to this contract", 403);
  return contract;
};

export const respondToContract = async (
  contractId: string,
  customerUserId: string,
  action: "accept" | "reject",
  rejectionNote?: string,
) => {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          organizerUserId: true,
          consultationRequestId: true,
        },
      },
      customerUser: { select: { id: true, displayName: true } },
      createdBy: { select: { id: true } },
    },
  });
  if (!contract) throw createError("NOT_FOUND", "Contract not found", 404);
  if (contract.customerUserId !== customerUserId)
    throw createError("FORBIDDEN", "You do not have access to this contract", 403);
  if (contract.status !== "sent")
    throw createError("CONFLICT", "Only sent contracts can be responded to", 409);

  const now = new Date();
  const customerName = contract.customerUser?.displayName ?? "Khách hàng";
  const eventName = contract.event?.name ?? "";

  if (action === "accept") {
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.contract.update({
        where: { id: contractId },
        data: {
          status: "active",
          signedAt: now,
          respondedAt: now,
          rejectionNote: null,
        },
      });

      await tx.event.update({
        where: { id: contract.eventId },
        data: { status: "planning" },
      });

      if (contract.event.consultationRequestId) {
        await tx.consultationRequest.update({
          where: { id: contract.event.consultationRequestId },
          data: {
            status: "confirmed",
            confirmedAt: now,
          },
        });
      }

      await tx.eventActivity.create({
        data: {
          eventId: contract.eventId,
          actorUserId: customerUserId,
          iconName: "check-circle",
          message: `${customerName} đã đồng ý hợp đồng ${contract.contractCode} cho sự kiện "${eventName}".`,
        },
      });

      let notification = null;
      if (contract.createdBy?.id) {
        notification = await tx.notification.create({
          data: {
            userId: contract.createdBy.id,
            scope: "admin",
            type: "contract_accepted",
            title: "Khách hàng đã đồng ý hợp đồng",
            message: `${customerName} đã đồng ý hợp đồng ${contract.contractCode} (${eventName}).`,
            entityType: "contract",
            entityId: contractId,
          },
        });
      }

      const organizerNotification = contract.event.organizerUserId
        ? await tx.notification.create({
            data: {
              userId: contract.event.organizerUserId,
              scope: "organizer",
              type: "contract_accepted",
              title: "Khách hàng đã đồng ý hợp đồng",
              message: `${customerName} đã đồng ý hợp đồng ${contract.contractCode}. Dự án ${eventName} đã chuyển sang lập kế hoạch.`,
              entityType: "event",
              entityId: contract.eventId,
            },
          })
        : null;

      return { updated, notification, organizerNotification };
    });

    if (result.notification && contract.createdBy?.id) {
      emitNotification(contract.createdBy.id, {
        id: result.notification.id,
        type: result.notification.type,
        title: result.notification.title,
        message: result.notification.message,
        entityType: result.notification.entityType,
        entityId: result.notification.entityId,
        createdAt: result.notification.createdAt,
      });
    }

    if (result.organizerNotification && contract.event.organizerUserId) {
      emitNotification(contract.event.organizerUserId, {
        id: result.organizerNotification.id,
        type: result.organizerNotification.type,
        title: result.organizerNotification.title,
        message: result.organizerNotification.message,
        entityType: result.organizerNotification.entityType,
        entityId: result.organizerNotification.entityId,
        createdAt: result.organizerNotification.createdAt,
      });
    }

    return result.updated;
  }

  // action === "reject"
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.contract.update({
      where: { id: contractId },
      data: {
        respondedAt: now,
        rejectionNote: rejectionNote?.trim() || "Khách hàng từ chối, chưa nêu lý do.",
      },
    });

    await tx.eventActivity.create({
      data: {
        eventId: contract.eventId,
        actorUserId: customerUserId,
        iconName: "x-circle",
        message: `${customerName} đã từ chối hợp đồng ${contract.contractCode}: "${rejectionNote?.trim() || "Không nêu lý do"}".`,
      },
    });

    let notification = null;
    if (contract.createdBy?.id) {
      notification = await tx.notification.create({
        data: {
          userId: contract.createdBy.id,
          scope: "admin",
          type: "contract_rejected",
          title: "Khách hàng từ chối hợp đồng",
          message: `${customerName} đã từ chối hợp đồng ${contract.contractCode} (${eventName}). Lý do: ${rejectionNote?.trim() || "Không nêu lý do"}.`,
          entityType: "contract",
          entityId: contractId,
        },
      });
    }

    return { updated, notification };
  });

  if (result.notification && contract.createdBy?.id) {
    emitNotification(contract.createdBy.id, {
      id: result.notification.id,
      type: result.notification.type,
      title: result.notification.title,
      message: result.notification.message,
      entityType: result.notification.entityType,
      entityId: result.notification.entityId,
      createdAt: result.notification.createdAt,
    });
  }

  return result.updated;
};

export const getCustomerTransactions = async (customerUserId: string) => {
  await syncLiquidatedContractPayments({ customerUserId });
  return prisma.transaction.findMany({
    where: { event: { customerUserId } },
    include: customerTransactionInclude,
    orderBy: { transactionDate: "desc" },
  });
};

// ─── Payments (customer view) ──────────────────────────────────────────────────────

const customerPaymentSchema = z
  .object({
    eventId: z.string().uuid().optional().nullable(),
    contractId: z.string().uuid().optional().nullable(),
    amount: z.number().positive(),
    paymentMethod: z.string().min(1).max(100),
    note: z.string().max(500).optional().nullable(),
  })
  .refine((data) => Boolean(data.eventId || data.contractId), {
    message: "Event or contract is required",
  });

const customerInstallmentPaymentSchema = z.object({
  paymentMethod: z.string().min(1).max(100),
  note: z.string().max(500).optional().nullable(),
});

const notifyAdminsAboutPayment = async (
  tx: Tx,
  input: {
    transactionId: string;
    eventName: string;
    amount: number;
    customerName: string;
  },
) => {
  const admins = await tx.user.findMany({
    where: { role: "admin", status: "active", deletedAt: null },
    select: { id: true },
  });

  return Promise.all(
    admins.map((admin) =>
      tx.notification.create({
        data: {
          userId: admin.id,
          scope: "admin",
          type: "payment",
          title: "Thanh toán mới",
          message: `${input.customerName} đã gửi thanh toán ${money(input.amount)} cho ${input.eventName}.`,
          entityType: "transaction",
          entityId: input.transactionId,
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
      }),
    ),
  );
};

export const submitCustomerPayment = async (customerUserId: string, body: unknown) => {
  const input = customerPaymentSchema.parse(body);
  const note = input.note?.trim();

  const result = await prisma.$transaction(async (tx) => {
    const customer = await tx.user.findUnique({
      where: { id: customerUserId },
      select: { displayName: true },
    });

    let eventId = input.eventId ?? null;
    let contractId = input.contractId ?? null;
    let eventName = "";
    let description = note ? `Thanh toán: ${note}` : "Thanh toán";
    let outstanding = 0;

    if (contractId) {
      const contract = await tx.contract.findFirst({
        where: {
          id: contractId,
          customerUserId,
          status: { in: billableContractStatuses },
        },
        include: {
          event: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          transactions: {
            where: { status: { in: payableTransactionStatuses } },
            select: { amount: true, status: true, paymentMethod: true },
          },
        },
      });

      if (!contract) throw createError("NOT_FOUND", "Payable contract not found", 404);
      if (eventId && eventId !== contract.eventId) {
        throw createError(
          "RELATION_MISMATCH",
          "Payment event must match the selected contract",
          409,
        );
      }

      eventId = contract.eventId;
      contractId = contract.id;
      eventName = contract.event.name || contract.event.type || "sự kiện";
      description = note
        ? `Thanh toán ${contract.contractCode}: ${note}`
        : `Thanh toán ${contract.contractCode}`;
      outstanding = payableAmounts(contract.totalValue, contract.transactions).outstanding;
    } else if (eventId) {
      const event = await tx.event.findFirst({
        where: { id: eventId, customerUserId, status: { not: "cancelled" } },
        include: {
          transactions: {
            where: { status: { in: payableTransactionStatuses } },
            select: { amount: true, status: true, paymentMethod: true },
          },
        },
      });

      if (!event) throw createError("NOT_FOUND", "Payable event not found", 404);
      eventName = event.name || event.type || "sự kiện";
      description = note ? `Thanh toán ${eventName}: ${note}` : `Thanh toán ${eventName}`;
      outstanding = payableAmounts(event.budgetEstimated, event.transactions).outstanding;
    }

    if (!eventId) throw createError("VALIDATION_ERROR", "Event or contract is required", 400);
    if (outstanding <= 0) {
      throw createError("PAYMENT_NOT_AVAILABLE", "No payable amount remains", 409);
    }
    if (input.amount > outstanding) {
      throw createError(
        "PAYMENT_AMOUNT_EXCEEDED",
        `Amount must not exceed the remaining payable amount (${money(outstanding)})`,
        409,
      );
    }

    const transaction = await tx.transaction.create({
      data: {
        eventId,
        contractId,
        description,
        amount: input.amount,
        transactionDate: new Date(),
        paymentMethod: input.paymentMethod,
        status: "pending",
      },
      include: customerTransactionInclude,
    });

    await tx.eventActivity.create({
      data: {
        eventId,
        actorUserId: customerUserId,
        iconName: "payment",
        message: `Khách hàng đã gửi thanh toán ${money(input.amount)}, chờ xác nhận.`,
      },
    });

    const notifications = await notifyAdminsAboutPayment(tx, {
      transactionId: transaction.id,
      eventName,
      amount: input.amount,
      customerName: customer?.displayName ?? "Khách hàng",
    });

    return { transaction, notifications };
  });

  for (const notification of result.notifications) {
    emitNotification(notification.userId, {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      entityType: notification.entityType,
      entityId: notification.entityId,
      createdAt: notification.createdAt,
    });
  }

  return result.transaction;
};

export const submitCustomerInstallmentPayment = async (
  customerUserId: string,
  transactionId: string,
  body: unknown,
) => {
  const input = customerInstallmentPaymentSchema.parse(body);
  const note = input.note?.trim();

  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findFirst({
      where: {
        id: transactionId,
        status: "pending",
        event: { customerUserId, status: { not: "cancelled" } },
      },
      include: customerTransactionInclude,
    });

    if (!transaction) {
      throw createError("NOT_FOUND", "Payable transaction not found", 404);
    }
    if (!transaction.eventId || !transaction.event) {
      throw createError("PAYMENT_NOT_AVAILABLE", "Transaction is not linked to an event", 409);
    }
    if (transaction.paymentMethod) {
      throw createError("PAYMENT_ALREADY_SUBMITTED", "Payment was already submitted", 409);
    }

    const updated = await tx.transaction.update({
      where: { id: transaction.id },
      data: {
        description: note ? `${transaction.description} - ${note}` : transaction.description,
        transactionDate: new Date(),
        paymentMethod: input.paymentMethod,
      },
      include: customerTransactionInclude,
    });

    await tx.eventActivity.create({
      data: {
        eventId: transaction.eventId,
        actorUserId: customerUserId,
        iconName: "payment",
        message: `Khách hàng đã chọn thanh toán ${money(toNumber(transaction.amount))}, chờ xác nhận.`,
      },
    });

    const customer = await tx.user.findUnique({
      where: { id: customerUserId },
      select: { displayName: true },
    });

    const eventName = transaction.event.name || transaction.event.type || "sự kiện";
    const notifications = await notifyAdminsAboutPayment(tx, {
      transactionId: updated.id,
      eventName,
      amount: toNumber(updated.amount),
      customerName: customer?.displayName ?? "Khách hàng",
    });

    return { transaction: updated, notifications };
  });

  for (const notification of result.notifications) {
    emitNotification(notification.userId, {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      entityType: notification.entityType,
      entityId: notification.entityId,
      createdAt: notification.createdAt,
    });
  }

  return result.transaction;
};

// ─── Reviews (customer view) ───────────────────────────────────────────────────────

export const getCustomerReviews = async (customerUserId: string) => {
  return prisma.review.findMany({
    where: { customerUserId },
    include: {
      event: { select: { id: true, name: true } },
      scores: { include: { criteria: { select: { key: true, label: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
};

// ─── Documents (customer view) ─────────────────────────────────────────────────────

export const getCustomerDocuments = async (customerUserId: string) => {
  return prisma.document.findMany({
    where: { event: { customerUserId } },
    include: { event: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
};

// ─── Settlement Feedback (customer view) ────────────────────────────────────────

export const getSettlementFeedback = async (contractId: string, customerUserId: string) => {
  // Verify contract belongs to this customer
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, customerUserId },
    select: { id: true },
  });
  if (!contract) throw createError("NOT_FOUND", "Hợp đồng không tồn tại hoặc không thuộc về bạn.", 404);

  return prisma.settlementFeedback.findMany({
    where: { contractId, customerId: customerUserId },
    select: {
      id: true,
      contractLineItemId: true,
      status: true,
      feedbackNote: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });
};

const settlementFeedbackItemSchema = z.object({
  lineItemId: z.string().uuid(),
  status: z.enum(["agreed", "feedback"]),
  note: z.string().optional(),
});

const settlementFeedbackBodySchema = z.object({
  items: z.array(settlementFeedbackItemSchema).min(1, "Cần ít nhất một hạng mục để nghiệm thu."),
});

export const submitSettlementFeedback = async (
  contractId: string,
  customerUserId: string,
  body: unknown,
) => {
  const parsed = settlementFeedbackBodySchema.parse(body);

  // Verify contract belongs to this customer and is in a reviewable state
  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      customerUserId,
      status: { in: ["active", "liquidated"] },
    },
    select: {
      id: true,
      contractCode: true,
      eventId: true,
      event: { select: { organizerUserId: true } },
    },
  });
  if (!contract) throw createError("NOT_FOUND", "Hợp đồng không hợp lệ hoặc chưa sẵn sàng nghiệm thu.", 404);

  // Verify all lineItemIds belong to this contract's versions
  const validLineItemIds = await prisma.contractLineItem.findMany({
    where: {
      contractVersion: { contractId },
      id: { in: parsed.items.map((i) => i.lineItemId) },
    },
    select: { id: true },
  });
  const validIds = new Set(validLineItemIds.map((i) => i.id));
  const invalidItems = parsed.items.filter((i) => !validIds.has(i.lineItemId));
  if (invalidItems.length > 0) {
    throw createError("VALIDATION_ERROR", "Một số hạng mục không thuộc hợp đồng này.", 400);
  }

  // Upsert all feedbacks in a transaction
  const result = await prisma.$transaction(async (tx: Tx) => {
    const feedbacks = await Promise.all(
      parsed.items.map((item) =>
        tx.settlementFeedback.upsert({
          where: {
            contractLineItemId_customerId: {
              contractLineItemId: item.lineItemId,
              customerId: customerUserId,
            },
          },
          create: {
            contractLineItemId: item.lineItemId,
            contractId,
            customerId: customerUserId,
            status: item.status,
            feedbackNote: item.status === "feedback" ? (item.note?.trim() || null) : null,
          },
          update: {
            status: item.status,
            feedbackNote: item.status === "feedback" ? (item.note?.trim() || null) : null,
          },
        }),
      ),
    );

    // Notify admin/organizer about the feedback
    const feedbackCount = parsed.items.filter((i) => i.status === "feedback").length;
    const agreedCount = parsed.items.filter((i) => i.status === "agreed").length;
    const message = feedbackCount > 0
      ? `Khách hàng đã nghiệm thu ${contract.contractCode}: ${agreedCount} đồng ý, ${feedbackCount} cần xem lại.`
      : `Khách hàng đã đồng ý tất cả ${agreedCount} hạng mục trong ${contract.contractCode}.`;

    const notifyUserIds = new Set<string>();
    if (contract.event?.organizerUserId) notifyUserIds.add(contract.event.organizerUserId);

    // Also notify admins
    const admins = await tx.user.findMany({
      where: { role: "admin", status: "active" },
      select: { id: true },
    });
    for (const admin of admins) notifyUserIds.add(admin.id);

    const notifications = await Promise.all(
      [...notifyUserIds].map((userId) =>
        tx.notification.create({
          data: {
            userId,
            scope: "admin",
            type: "settlement_feedback",
            title: "Nghiệm thu hạng mục",
            message,
            entityType: "contract",
            entityId: contractId,
          },
        }),
      ),
    );

    return { feedbacks, notifications };
  });

  // Emit real-time notifications
  for (const notification of result.notifications) {
    emitNotification(notification.userId, {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      entityType: notification.entityType,
      entityId: notification.entityId,
      createdAt: notification.createdAt,
    });
  }

  return result.feedbacks;
};
