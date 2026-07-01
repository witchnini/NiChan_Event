import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";
import { createError } from "../../../middleware/errorHandler";

export const transactionSchema = z.object({
  eventId: z.string().uuid().optional().nullable(),
  contractId: z.string().uuid().optional().nullable(),
  description: z.string().min(1).max(500),
  amount: z.number().positive(),
  transactionDate: z.string().datetime({ offset: true }),
  paymentMethod: z.string().max(100).optional().nullable(),
  status: z.enum(["pending", "completed", "cancelled"]).default("pending"),
});

export type TransactionInput = z.infer<typeof transactionSchema>;

const expenseStatuses = ["committed", "paid"];
const billableContractStatuses = ["sent", "active", "liquidated"];

const toNumber = (value: unknown) => Number(value ?? 0);

const transactionInclude = {
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
};

const ensureEvent = async (eventId: string) => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) throw createError("NOT_FOUND", "Event not found", 404);
};

const normalizeTransactionRelations = async (
  input: Partial<TransactionInput>,
  existing?: { eventId: string | null; contractId: string | null },
) => {
  let eventId =
    input.eventId === undefined ? existing?.eventId ?? null : input.eventId ?? null;
  const contractId =
    input.contractId === undefined
      ? existing?.contractId ?? null
      : input.contractId ?? null;

  if (contractId) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true, eventId: true },
    });
    if (!contract) throw createError("NOT_FOUND", "Contract not found", 404);
    if (eventId && eventId !== contract.eventId) {
      throw createError(
        "RELATION_MISMATCH",
        "Transaction event must match the selected contract event",
        409,
      );
    }
    eventId = contract.eventId;
  }

  if (eventId) await ensureEvent(eventId);
  return { eventId, contractId };
};

export const getProjectSummary = async () => {
  const events = await prisma.event.findMany({
    where: { status: { not: "cancelled" } },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      budgetEstimated: true,
      transactions: { select: { amount: true, status: true, paymentMethod: true } },
      contracts: {
        where: { status: { not: "cancelled" } },
        select: { id: true, status: true, totalValue: true },
      },
      budgets: {
        select: {
          items: {
            select: { estimatedAmount: true, actualAmount: true, status: true },
          },
        },
      },
    },
  });

  return events.map((event) => {
    const totalCollected = event.transactions
      .filter((transaction) => transaction.status === "completed")
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
    const pendingCollection = event.transactions
      .filter((transaction) => transaction.status === "pending" && transaction.paymentMethod)
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
    const allBudgetItems = event.budgets.flatMap((budget) => budget.items);
    const budgetActual = allBudgetItems
      .filter((item) => expenseStatuses.includes(item.status))
      .reduce((sum, item) => sum + toNumber(item.actualAmount), 0);
    const budgetPlanned = allBudgetItems.reduce(
      (sum, item) => sum + toNumber(item.estimatedAmount),
      0,
    );
    const totalContractValue = event.contracts
      .filter((contract) => billableContractStatuses.includes(contract.status))
      .reduce((sum, contract) => sum + toNumber(contract.totalValue), 0);
    const budgetEstimated = toNumber(event.budgetEstimated) || budgetPlanned;
    const receivable = totalContractValue
      ? Math.max(totalContractValue - totalCollected, 0)
      : 0;
    const profit = totalCollected - budgetActual;

    return {
      id: event.id,
      name: event.name,
      type: event.type,
      status: event.status,
      budgetEstimated,
      budgetPlanned,
      budgetActual,
      totalCollected,
      pendingCollection,
      totalContractValue,
      receivable,
      profit,
      margin: totalCollected ? Math.round((profit / totalCollected) * 100) : 0,
      collectionRate: totalContractValue
        ? Math.min(100, Math.round((totalCollected / totalContractValue) * 100))
        : 0,
      contractCount: event.contracts.length,
    };
  });
};

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const getMonthlyPL = async () => {
  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const [transactions, budgetItems] = await Promise.all([
    prisma.transaction.findMany({
      where: { transactionDate: { gte: twelveMonthsAgo } },
      select: { amount: true, status: true, transactionDate: true },
    }),
    prisma.budgetItem.findMany({
      where: { status: "paid", updatedAt: { gte: twelveMonthsAgo } },
      select: { actualAmount: true, updatedAt: true },
    }),
  ]);

  const map: Record<string, { revenue: number; expenses: number }> = {};
  for (let i = 0; i < 12; i++) {
    const date = new Date(twelveMonthsAgo);
    date.setMonth(date.getMonth() + i);
    map[monthKey(date)] = { revenue: 0, expenses: 0 };
  }

  for (const transaction of transactions) {
    const key = monthKey(transaction.transactionDate);
    if (!map[key]) map[key] = { revenue: 0, expenses: 0 };
    if (transaction.status === "completed") {
      map[key].revenue += toNumber(transaction.amount);
    }
  }

  for (const item of budgetItems) {
    const key = monthKey(item.updatedAt);
    if (!map[key]) map[key] = { revenue: 0, expenses: 0 };
    map[key].expenses += toNumber(item.actualAmount);
  }

  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data, profit: data.revenue - data.expenses }));
};

export const getExpenses = async () => {
  return prisma.budgetItem.findMany({
    where: { status: { in: ["committed", "paid"] } },
    include: {
      vendor: { select: { id: true, name: true } },
      projectBudget: {
        select: {
          id: true,
          name: true,
          event: {
            select: {
              id: true,
              name: true,
              type: true,
              status: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
};

export const listFinanceContracts = async () => {
  const contracts = await prisma.contract.findMany({
    where: { status: { not: "cancelled" } },
    orderBy: { createdAt: "desc" },
    include: {
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
      customerUser: { select: { id: true, displayName: true, phone: true, email: true } },
      versions: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { paymentTerms: true },
      },
      transactions: {
        where: { status: { in: ["pending", "completed"] } },
        select: { amount: true, status: true, paymentMethod: true },
      },
    },
  });

  return contracts.map((contract) => {
    const totalValue = toNumber(contract.totalValue);
    const collectedAmount = contract.transactions
      .filter((transaction) => transaction.status === "completed")
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
    const pendingAmount = contract.transactions
      .filter((transaction) => transaction.status === "pending" && transaction.paymentMethod)
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
    const scheduledAmount = contract.transactions
      .filter((transaction) => transaction.status === "pending" && !transaction.paymentMethod)
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);

    return {
      id: contract.id,
      contractCode: contract.contractCode,
      status: contract.status,
      totalValue,
      collectedAmount,
      pendingAmount,
      scheduledAmount,
      outstandingAmount: Math.max(totalValue - collectedAmount, 0),
      currentVersion: contract.currentVersion,
      paymentTerms: contract.versions[0]?.paymentTerms ?? "",
      sentAt: contract.sentAt,
      signedAt: contract.signedAt,
      event: contract.event,
      customerUser: contract.customerUser,
    };
  });
};

export const listTransactions = async (filters: {
  eventId?: string;
  contractId?: string;
  status?: string;
  search?: string;
  skip: number;
  take: number;
}) => {
  const where: Prisma.TransactionWhereInput = {
    ...(filters.eventId ? { eventId: filters.eventId } : {}),
    ...(filters.contractId ? { contractId: filters.contractId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? {
          OR: [
            { description: { contains: filters.search } },
            { event: { name: { contains: filters.search } } },
            { contract: { contractCode: { contains: filters.search } } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.transaction.findMany({
      where,
      skip: filters.skip,
      take: filters.take,
      orderBy: { transactionDate: "desc" },
      include: transactionInclude,
    }),
    prisma.transaction.count({ where }),
  ]);
  return { items, total };
};

export const createTransaction = async (input: TransactionInput) => {
  const relation = await normalizeTransactionRelations(input);
  return prisma.transaction.create({
    data: {
      eventId: relation.eventId,
      contractId: relation.contractId,
      description: input.description,
      amount: input.amount,
      transactionDate: new Date(input.transactionDate),
      paymentMethod: input.paymentMethod || null,
      status: input.status,
    },
    include: transactionInclude,
  });
};

export const updateTransaction = async (id: string, input: Partial<TransactionInput>) => {
  const existing = await prisma.transaction.findUnique({
    where: { id },
    select: { id: true, eventId: true, contractId: true },
  });
  if (!existing) throw createError("NOT_FOUND", "Transaction not found", 404);

  const relation = await normalizeTransactionRelations(input, existing);
  const data: Prisma.TransactionUncheckedUpdateInput = {
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.amount !== undefined ? { amount: input.amount } : {}),
    ...(input.transactionDate !== undefined
      ? { transactionDate: new Date(input.transactionDate) }
      : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.paymentMethod !== undefined ? { paymentMethod: input.paymentMethod || null } : {}),
  };

  if (input.eventId !== undefined) data.eventId = relation.eventId;
  if (input.contractId !== undefined) {
    data.contractId = relation.contractId;
    data.eventId = relation.eventId;
  }

  return prisma.transaction.update({
    where: { id },
    data,
    include: transactionInclude,
  });
};

export const deleteTransaction = async (id: string) => {
  return prisma.transaction.delete({ where: { id } });
};
