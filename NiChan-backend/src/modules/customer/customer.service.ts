import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { createError } from "../../middleware/errorHandler";
import { emitNewMessage, emitMessageDeleted, emitNotification } from "../../lib/socket";
import { z } from "zod";

type Tx = Prisma.TransactionClient;

const billableContractStatuses = ["sent", "active", "liquidated"];
const payableTransactionStatuses = ["pending", "completed"];
const toNumber = (value: unknown) => Number(value ?? 0);

const money = (value: number) => `${value.toLocaleString("vi-VN")} đ`;

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

const payableAmounts = (totalValue: unknown, transactions: { amount: unknown; status: string }[]) => {
  const completed = transactions
    .filter((transaction) => transaction.status === "completed")
    .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
  const pending = transactions
    .filter((transaction) => transaction.status === "pending")
    .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
  return {
    completed,
    pending,
    outstanding: Math.max(toNumber(totalValue) - completed - pending, 0),
  };
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const getCustomerDashboard = async (customerUserId: string) => {
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

  return { events, recentActivities, contracts, transactions };
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
        where: { status: { in: billableContractStatuses } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          contractCode: true,
          status: true,
          totalValue: true,
          currentVersion: true,
          sentAt: true,
          signedAt: true,
          transactions: {
            where: { status: { in: payableTransactionStatuses } },
            select: { id: true, amount: true, status: true },
          },
          versions: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: { paymentTerms: true },
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

// ─── Chat ─────────────────────────────────────────────────────────────────────

const ensureEventAccess = async (eventId: string, userId: string) => {
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      OR: [{ customerUserId: userId }, { organizerUserId: userId }],
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

// ─── Contracts & Transactions ─────────────────────────────────────────────────

export const getCustomerContracts = async (customerUserId: string) => {
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
        select: { id: true, amount: true, status: true },
      },
      versions: { take: 1, orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const getCustomerContractById = async (contractId: string, customerUserId: string) => {
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
      versions: { take: 1, orderBy: { createdAt: "desc" } },
    },
  });
  if (!contract) throw createError("NOT_FOUND", "Contract not found", 404);
  if (contract.customerUserId !== customerUserId)
    throw createError("FORBIDDEN", "You do not have access to this contract", 403);
  return contract;
};

export const getCustomerTransactions = async (customerUserId: string) => {
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
            select: { amount: true, status: true },
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
            select: { amount: true, status: true },
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
