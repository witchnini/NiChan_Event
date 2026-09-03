import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { createError } from "../../../middleware/errorHandler";
import {
  emitCustomerNotification,
  notifyCustomerForEvent,
} from "../../shared/event-lifecycle.service";
import type {
  CreateContractInput,
  CreateSettlementInput,
  ReviseSettlementInput,
  UpdateContractInput,
} from "./admin-contracts.schema";

type ContractLineItemInput = NonNullable<CreateContractInput["lineItems"]>[number];
type StoredContractLineItem = {
  category: string;
  description: string | null;
  unit: string | null;
  quantity: unknown;
  unitPrice: unknown;
  note: string | null;
};

const lineItemsInclude = {
  orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
};

const normalizeAmount = (value: number) => Number(value.toFixed(2));

const normalizeLineItems = (lineItems?: ContractLineItemInput[]) =>
  (lineItems ?? []).map((item, index) => ({
    category: item.category.trim(),
    description: item.description?.trim() || null,
    unit: item.unit?.trim() || null,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    amount: normalizeAmount(item.quantity * item.unitPrice),
    note: item.note?.trim() || null,
    sortOrder: index,
  }));

const cloneStoredLineItems = (lineItems?: StoredContractLineItem[]) =>
  (lineItems ?? []).map((item, index) => {
    const quantity = Number(item.quantity ?? 0);
    const unitPrice = Number(item.unitPrice ?? 0);
    return {
      category: item.category,
      description: item.description ?? null,
      unit: item.unit ?? null,
      quantity,
      unitPrice,
      amount: normalizeAmount(quantity * unitPrice),
      note: item.note ?? null,
      sortOrder: index,
    };
  });

const sumLineItems = (lineItems: { amount: number }[]) =>
  normalizeAmount(lineItems.reduce((sum, item) => sum + item.amount, 0));

const ensurePositiveContractTotal = (totalValue: number) => {
  if (totalValue <= 0) {
    throw createError("VALIDATION_ERROR", "Contract total value must be positive", 400);
  }
};

const parseRatio = (value: string) => Number(value.replace(",", "."));

const isValidPaymentRatios = (ratios: number[]) => {
  if (ratios.length < 2 || ratios.length > 4) return false;
  const total = ratios.reduce((sum, ratio) => sum + ratio, 0);
  return ratios.every((ratio) => ratio > 0 && ratio < 100) && Math.abs(total - 100) <= 1;
};

const parsePaymentRatios = (paymentTerms?: string | null) => {
  if (!paymentTerms) return [50, 30, 20];

  const percentRatios = [...paymentTerms.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)].map((match) =>
    parseRatio(match[1]),
  );
  if (isValidPaymentRatios(percentRatios)) return percentRatios;

  const sequenceMatch = paymentTerms.match(
    /(?:^|[^\d])(\d+(?:[.,]\d+)?(?:\s*[-/+]\s*\d+(?:[.,]\d+)?){1,3})(?:%|[^\d]|$)/,
  );
  if (!sequenceMatch) return [50, 30, 20];

  const sequenceRatios = sequenceMatch[1].split(/\s*[-/+]\s*/).map(parseRatio);
  return isValidPaymentRatios(sequenceRatios) ? sequenceRatios : [50, 30, 20];
};

const formatPercent = (value: number) =>
  Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

const installmentAmount = (totalValue: number, ratios: number[], index: number) => {
  if (index === ratios.length - 1) {
    const previous = ratios
      .slice(0, index)
      .reduce((sum, ratio) => sum + Math.round((totalValue * ratio) / 100), 0);
    return Math.max(totalValue - previous, 0);
  }
  return Math.round((totalValue * ratios[index]) / 100);
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const buildInstallmentDate = (eventDate: Date | null, index: number, total: number, sentAt: Date) => {
  if (index === 0) return sentAt;
  if (!eventDate || Number.isNaN(eventDate.getTime())) return addDays(sentAt, index * 7);

  if (index === total - 1) return addDays(eventDate, 1);
  const daysBeforeEvent = Math.max((total - index) * 7, 3);
  const dueDate = addDays(eventDate, -daysBeforeEvent);
  return dueDate > sentAt ? dueDate : addDays(sentAt, index * 7);
};

const installmentLabel = (index: number, total: number) => {
  if (index === 0) return "Đặt cọc sau khi ký hợp đồng";
  if (index === total - 1) return "Thanh toán sau nghiệm thu";
  return "Thanh toán trước ngày tổ chức";
};

const ensureContractPaymentSchedule = async (
  tx: Prisma.TransactionClient,
  input: {
    contractId: string;
    contractCode: string;
    eventId: string;
    eventDate: Date | null;
    totalValue: unknown;
    paymentTerms?: string | null;
    sentAt: Date;
  },
) => {
  const existingTransactions = await tx.transaction.count({
    where: { contractId: input.contractId },
  });
  if (existingTransactions > 0) return;

  const totalValue = Number(input.totalValue || 0);
  if (totalValue <= 0) return;

  const ratios = parsePaymentRatios(input.paymentTerms);
  await tx.transaction.createMany({
    data: ratios.map((ratio, index) => ({
      eventId: input.eventId,
      contractId: input.contractId,
      description: `Thanh toán ${input.contractCode} - Đợt ${index + 1}: ${installmentLabel(index, ratios.length)} (${formatPercent(ratio)}%)`,
      amount: installmentAmount(totalValue, ratios, index),
      transactionDate: buildInstallmentDate(input.eventDate, index, ratios.length, input.sentAt),
      paymentMethod: null,
      status: "pending",
    })),
  });
};

export const listContracts = async (filters: {
  status?: string;
  search?: string;
  skip: number;
  take: number;
  sortOrder: "asc" | "desc";
}) => {
  const where = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? {
          OR: [
            { contractCode: { contains: filters.search } },
            { event: { name: { contains: filters.search } } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.contract.findMany({
      where,
      skip: filters.skip,
      take: filters.take,
      orderBy: { createdAt: filters.sortOrder },
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
          include: { lineItems: lineItemsInclude },
        },
        settlementFeedbacks: {
          where: { status: { in: ["agreed", "feedback"] } },
          select: { id: true, status: true, contractLineItemId: true },
        },
      },
    }),
    prisma.contract.count({ where }),
  ]);

  return { items, total };
};

export const getContractById = async (id: string) => {
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
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
        orderBy: { createdAt: "desc" },
        include: { lineItems: lineItemsInclude },
      },
      documents: true,
    },
  });
  if (!contract) throw createError("NOT_FOUND", "Contract not found", 404);
  return contract;
};

export const createContract = async (input: CreateContractInput, createdById: string) => {
  const year = new Date().getFullYear();
  const existingCodes = await prisma.contract.findMany({
    where: { contractCode: { startsWith: `HD-${year}-` } },
    select: { contractCode: true },
  });
  const nextSequence =
    existingCodes.reduce((maxSequence, contract) => {
      const sequence = Number(contract.contractCode.split("-").at(-1));
      return Number.isInteger(sequence) ? Math.max(maxSequence, sequence) : maxSequence;
    }, 0) + 1;
  const contractCode = `HD-${year}-${String(nextSequence).padStart(3, "0")}`;
  const lineItems = normalizeLineItems(input.lineItems);
  const totalValue = lineItems.length > 0 ? sumLineItems(lineItems) : input.totalValue ?? 0;
  ensurePositiveContractTotal(totalValue);

  const contract = await prisma.contract.create({
    data: {
      contractCode,
      eventId: input.eventId,
      customerUserId: input.customerUserId,
      totalValue,
      currentVersion: input.versionLabel,
      createdById,
      status: "draft",
      versions: {
        create: {
          versionLabel: input.versionLabel,
          scopeText: input.scopeText,
          paymentTerms: input.paymentTerms,
          generalTerms: input.generalTerms,
          createdById,
          ...(lineItems.length > 0 ? { lineItems: { create: lineItems } } : {}),
        },
      },
    },
    include: { versions: { include: { lineItems: lineItemsInclude } } },
  });

  return contract;
};

export const updateContract = async (
  id: string,
  input: UpdateContractInput,
  updatedById: string,
) => {
  const existing = await prisma.contract.findUnique({
    where: { id },
    include: {
      versions: {
        where: { purpose: "original" },
        take: 1,
        orderBy: { createdAt: "desc" },
        include: { lineItems: lineItemsInclude },
      },
    },
  });
  if (!existing) throw createError("NOT_FOUND", "Contract not found", 404);

  const settlementExists = await prisma.contractVersion.findFirst({
    where: { contractId: id, purpose: "settlement" },
    select: { id: true },
  });
  if (settlementExists) {
    throw createError(
      "CONFLICT",
      "The signed original contract is immutable after settlement is created",
      409,
    );
  }

  const hasContentChange =
    input.scopeText !== undefined ||
    input.paymentTerms !== undefined ||
    input.generalTerms !== undefined ||
    input.versionLabel !== undefined ||
    input.lineItems !== undefined;
  const latestVersion = existing.versions[0];
  const nextLineItems =
    input.lineItems !== undefined
      ? normalizeLineItems(input.lineItems)
      : cloneStoredLineItems(latestVersion?.lineItems);
  const nextTotalValue =
    input.lineItems !== undefined
      ? sumLineItems(nextLineItems)
      : input.totalValue !== undefined
        ? input.totalValue
        : Number(existing.totalValue);
  ensurePositiveContractTotal(nextTotalValue);

  return prisma.$transaction(async (tx) => {
    if (hasContentChange) {
      const versionLabel = input.versionLabel ?? existing.currentVersion;
      await tx.contractVersion.create({
        data: {
          contractId: id,
          versionLabel,
          purpose: "original",
          scopeText: input.scopeText ?? latestVersion?.scopeText ?? "",
          paymentTerms: input.paymentTerms ?? latestVersion?.paymentTerms ?? "",
          generalTerms: input.generalTerms ?? latestVersion?.generalTerms ?? "",
          createdById: updatedById,
          ...(nextLineItems.length > 0 ? { lineItems: { create: nextLineItems } } : {}),
        },
      });
    }

    return tx.contract.update({
      where: { id },
      data: {
        ...(input.totalValue !== undefined || input.lineItems !== undefined
          ? { totalValue: nextTotalValue }
          : {}),
        ...(input.versionLabel !== undefined ? { currentVersion: input.versionLabel } : {}),
      },
    });
  });
};

export const sendContract = async (id: string, sentById: string) => {
  const existing = await prisma.contract.findUnique({
    where: { id },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          eventDate: true,
          consultationRequestId: true,
          customerUserId: true,
        },
      },
      versions: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { documentUrl: true, paymentTerms: true },
      },
    },
  });
  if (!existing) throw createError("NOT_FOUND", "Contract not found", 404);
  if (existing.status !== "draft" && existing.status !== "sent")
    throw createError("CONFLICT", "Only draft or sent contracts can be sent", 409);

  const documentUrl = existing.versions[0]?.documentUrl ?? "";

  const result = await prisma.$transaction(async (tx) => {
    const sentAt = new Date();
    const contract = await tx.contract.update({
      where: { id },
      data: { status: "sent", sentAt, rejectionNote: null, respondedAt: null },
    });

    await tx.event.update({
      where: { id: existing.eventId },
      data: { status: "quoted" },
    });

    if (existing.event.consultationRequestId) {
      await tx.consultationRequest.update({
        where: { id: existing.event.consultationRequestId },
        data: {
          status: "quoted",
          quotedAt: sentAt,
          confirmedAt: null,
        },
      });
    }

    await ensureContractPaymentSchedule(tx, {
      contractId: id,
      contractCode: existing.contractCode,
      eventId: existing.eventId,
      eventDate: existing.event.eventDate,
      totalValue: existing.totalValue,
      paymentTerms: existing.versions[0]?.paymentTerms,
      sentAt,
    });

    // Tạo bản ghi tài liệu để hợp đồng hiển thị trong phần "Tài liệu" của khách hàng.
    // Tránh trùng lặp nếu hợp đồng được gửi lại.
    const existingDoc = await tx.document.findFirst({ where: { contractId: id } });
    if (!existingDoc) {
      await tx.document.create({
        data: {
          eventId: existing.eventId,
          contractId: id,
          name: `Hợp đồng ${existing.contractCode}`,
          fileType: "Hợp đồng",
          fileUrl: documentUrl,
          uploadedById: sentById,
          status: "sent",
        },
      });

      await tx.eventActivity.create({
        data: {
          eventId: existing.eventId,
          actorUserId: sentById,
          iconName: "file-text",
          message: `Đã gửi hợp đồng ${existing.contractCode} và tự động tạo lịch thanh toán cho khách hàng.`,
        },
      });
    }

    const notification = await tx.notification.create({
      data: {
        userId: existing.event.customerUserId,
        scope: "customer",
        type: "contract",
        title: "Hợp đồng mới đã được gửi",
        message: `Hợp đồng ${existing.contractCode} cho sự kiện ${existing.event.name} đã được gửi. Vui lòng kiểm tra nội dung hợp đồng.`,
        entityType: "contract",
        entityId: id,
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

    return { contract, notification };
  });

  emitCustomerNotification(result.notification);
  return result.contract;
};

// ─── Settlement (Quyết toán) ──────────────────────────────────────────────────

export const getSettlementPreview = async (contractId: string) => {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      event: {
        include: {
          budgets: {
            include: {
              items: {
                where: { actualAmount: { gt: 0 } },
                include: { vendor: { select: { id: true, name: true } } },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      },
      versions: {
        where: { purpose: "original" },
        take: 1,
        orderBy: { createdAt: "desc" },
        include: { lineItems: lineItemsInclude },
      },
    },
  });
  if (!contract) throw createError("NOT_FOUND", "Contract not found", 404);

  const budgetItems = contract.event.budgets.flatMap((b) => b.items);
  const lineItems = budgetItems.map((item, index) => ({
    budgetItemId: item.id,
    category: item.category,
    description: item.vendor?.name || null,
    unit: "Trọn gói" as string | null,
    quantity: 1,
    unitPrice: Number(item.actualAmount),
    amount: normalizeAmount(Number(item.actualAmount)),
    note: item.note || null,
    sortOrder: index,
  }));

  const totalValue = sumLineItems(lineItems);
  const originalVersion = contract.versions[0];
  const originalTotal = originalVersion
    ? originalVersion.lineItems.reduce((sum, li) => sum + Number(li.amount ?? 0), 0)
    : Number(contract.totalValue);

  return {
    contractId,
    contractCode: contract.contractCode,
    eventId: contract.eventId,
    eventName: contract.event.name,
    eventStatus: contract.event.status,
    currentContractStatus: contract.status,
    originalTotal,
    settlementTotal: totalValue,
    difference: totalValue - originalTotal,
    lineItems,
    budgetItemCount: budgetItems.length,
  };
};

export const createSettlementVersion = async (
  contractId: string,
  createdById: string,
  input?: CreateSettlementInput,
) => {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          status: true,
          customerUserId: true,
          budgets: {
            include: {
              items: {
                where: { actualAmount: { gt: 0 } },
                include: { vendor: { select: { name: true } } },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      },
      versions: {
        take: 1,
        orderBy: { createdAt: "desc" },
        include: { lineItems: lineItemsInclude },
      },
    },
  });

  if (!contract) throw createError("NOT_FOUND", "Contract not found", 404);
  if (contract.status === "cancelled")
    throw createError("CONFLICT", "Cannot create settlement for a cancelled contract", 409);

  // Check if a settlement version already exists
  const existingSettlement = await prisma.contractVersion.findFirst({
    where: { contractId, purpose: "settlement" },
  });
  if (existingSettlement)
    throw createError("CONFLICT", "A settlement version already exists for this contract", 409);

  // Build line items from budget or override
  const budgetItems = contract.event.budgets.flatMap((b) => b.items);
  const lineItems = input?.lineItems
    ? normalizeLineItems(input.lineItems)
    : budgetItems.map((item, index) => ({
        category: item.category,
        description: item.vendor?.name || null,
        unit: "Trọn gói" as string | null,
        quantity: 1,
        unitPrice: Number(item.actualAmount),
        amount: normalizeAmount(Number(item.actualAmount)),
        note: item.note || null,
        sortOrder: index,
      }));

  if (lineItems.length === 0)
    throw createError("VALIDATION_ERROR", "No budget items with actual costs found", 400);

  const totalValue = sumLineItems(lineItems);
  ensurePositiveContractTotal(totalValue);

  const latestVersion = contract.versions[0];
  const versionLabel = "QT-1.0";
  const scopeText =
    input?.scopeText ||
    `Biên bản nghiệm thu và quyết toán sự kiện "${contract.event.name}". ` +
      `Căn cứ hợp đồng số ${contract.contractCode}, hai bên xác nhận các hạng mục dịch vụ đã thực hiện và chi phí thực tế như sau.`;
  const generalTerms =
    input?.generalTerms ||
    "Hai bên xác nhận đã nghiệm thu đầy đủ các hạng mục dịch vụ. " +
      "Bên B thanh toán phần còn lại (nếu có) trong vòng 07 ngày kể từ ngày ký biên bản này. " +
      "Sau khi thanh toán đủ, hợp đồng được coi là hoàn tất và thanh lý.";

  const result = await prisma.$transaction(async (tx) => {
    // Create settlement version
    await tx.contractVersion.create({
      data: {
        contractId,
        versionLabel,
        purpose: "settlement",
        scopeText,
        paymentTerms: latestVersion?.paymentTerms ?? "",
        generalTerms,
        createdById,
        lineItems: { create: lineItems },
      },
    });

    // Giữ hợp đồng ở trạng thái active cho đến khi khách đồng ý nghiệm thu
    // và khoản thanh toán cuối cùng được xác nhận.
    const updatedContract = await tx.contract.update({
      where: { id: contractId },
      data: {
        totalValue,
        currentVersion: versionLabel,
        status: "active",
      },
    });

    // Log activity
    await tx.eventActivity.create({
      data: {
        eventId: contract.eventId,
        actorUserId: createdById,
        iconName: "clipboard-check",
        message: `Đã tạo biên bản quyết toán cho hợp đồng ${contract.contractCode}. Tổng chi phí thực tế: ${totalValue.toLocaleString("vi-VN")} đ.`,
      },
    });

    // Notify customer
    const notification = await tx.notification.create({
      data: {
        userId: contract.event.customerUserId,
        scope: "customer",
        type: "settlement",
        title: "Biên bản quyết toán đã được tạo",
        message: `Biên bản quyết toán cho hợp đồng ${contract.contractCode} (sự kiện ${contract.event.name}) đã được lập. Vui lòng nghiệm thu từng hạng mục; đợt thanh toán cuối sẽ mở sau khi hai bên chốt nội dung.`,
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

    return { updatedContract, notification };
  });

  emitCustomerNotification(result.notification);
  return result.updatedContract;
};

export const getSettlementFeedbackForAdmin = async (contractId: string) => {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      contractCode: true,
      status: true,
      totalValue: true,
      event: { select: { id: true, name: true } },
      customerUser: {
        select: { id: true, displayName: true, email: true, phone: true },
      },
      versions: {
        where: { purpose: "settlement" },
        take: 1,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          versionLabel: true,
          scopeText: true,
          paymentTerms: true,
          generalTerms: true,
          createdAt: true,
          lineItems: {
            ...lineItemsInclude,
            include: {
              settlementFeedbacks: {
                where: { contractId },
                select: {
                  id: true,
                  status: true,
                  feedbackNote: true,
                  createdAt: true,
                  updatedAt: true,
                  customer: { select: { id: true, displayName: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!contract) throw createError("NOT_FOUND", "Contract not found", 404);
  const settlementVersion = contract.versions[0];
  if (!settlementVersion) {
    throw createError("NOT_FOUND", "Settlement version not found", 404);
  }

  const lineItems = settlementVersion.lineItems.map((item) => {
    const feedback = item.settlementFeedbacks[0] ?? null;
    const { settlementFeedbacks: _feedbacks, ...lineItem } = item;
    return { ...lineItem, feedback };
  });
  const agreedCount = lineItems.filter((item) => item.feedback?.status === "agreed").length;
  const feedbackCount = lineItems.filter((item) => item.feedback?.status === "feedback").length;
  const pendingCount = lineItems.length - agreedCount - feedbackCount;
  const submittedAt = lineItems.reduce<Date | null>((latest, item) => {
    const updatedAt = item.feedback?.updatedAt ?? null;
    return updatedAt && (!latest || updatedAt > latest) ? updatedAt : latest;
  }, null);

  return {
    contract: {
      id: contract.id,
      contractCode: contract.contractCode,
      status: contract.status,
      totalValue: contract.totalValue,
      event: contract.event,
      customerUser: contract.customerUser,
    },
    settlementVersion: {
      ...settlementVersion,
      lineItems,
    },
    summary: {
      total: lineItems.length,
      agreed: agreedCount,
      feedback: feedbackCount,
      pending: pendingCount,
      submittedAt,
      needsRevision: feedbackCount > 0,
    },
  };
};

const nextSettlementVersionLabel = (label: string) => {
  const match = label.match(/^QT-(\d+)\.(\d+)$/i);
  if (!match) return "QT-1.1";
  return `QT-${Number(match[1])}.${Number(match[2]) + 1}`;
};

export const reviseSettlementVersion = async (
  contractId: string,
  revisedById: string,
  input: ReviseSettlementInput,
) => {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      contractCode: true,
      status: true,
      eventId: true,
      event: { select: { name: true, customerUserId: true } },
      versions: {
        where: { purpose: "settlement" },
        take: 1,
        orderBy: { createdAt: "desc" },
        include: {
          lineItems: {
            ...lineItemsInclude,
            include: {
              settlementFeedbacks: {
                where: { status: { in: ["agreed", "feedback"] } },
                select: { id: true, status: true, customerId: true },
              },
            },
          },
        },
      },
    },
  });

  if (!contract) throw createError("NOT_FOUND", "Contract not found", 404);
  if (!["active", "liquidated"].includes(contract.status)) {
    throw createError("CONFLICT", "Contract is not ready to revise settlement", 409);
  }

  const latestSettlement = contract.versions[0];
  if (!latestSettlement) {
    throw createError("NOT_FOUND", "Settlement version not found", 404);
  }
  const lineItems = normalizeLineItems(input.lineItems);
  const totalValue = sumLineItems(lineItems);
  ensurePositiveContractTotal(totalValue);
  const versionLabel = nextSettlementVersionLabel(latestSettlement.versionLabel);

  const result = await prisma.$transaction(async (tx) => {
    await tx.settlementFeedback.updateMany({
      where: { contractId, status: "feedback" },
      data: { status: "resolved" },
    });

    const version = await tx.contractVersion.create({
      data: {
        contractId,
        versionLabel,
        purpose: "settlement",
        scopeText: input.scopeText ?? latestSettlement.scopeText,
        paymentTerms: input.paymentTerms ?? latestSettlement.paymentTerms,
        generalTerms: input.generalTerms ?? latestSettlement.generalTerms,
        createdById: revisedById,
        lineItems: { create: lineItems },
      },
      include: { lineItems: lineItemsInclude },
    });

    const previousLineItems = new Map(
      latestSettlement.lineItems.map((item) => [item.id, item]),
    );
    const createdLineItems = new Map(
      version.lineItems.map((item) => [item.sortOrder, item]),
    );
    const carriedAgreements = input.lineItems.flatMap((item, index) => {
      if (!item.sourceLineItemId) return [];

      const previousItem = previousLineItems.get(item.sourceLineItemId);
      const createdItem = createdLineItems.get(index);
      const agreedFeedback = previousItem?.settlementFeedbacks.find(
        (feedback) => feedback.status === "agreed",
      );
      if (!createdItem || !agreedFeedback) return [];

      return [{
        contractLineItemId: createdItem.id,
        contractId,
        customerId: agreedFeedback.customerId,
        status: "agreed",
        feedbackNote: null,
      }];
    });

    if (carriedAgreements.length > 0) {
      await tx.settlementFeedback.createMany({ data: carriedAgreements });
    }

    await tx.contract.update({
      where: { id: contractId },
      data: { totalValue, currentVersion: versionLabel, status: "active" },
    });

    await tx.eventActivity.create({
      data: {
        eventId: contract.eventId,
        actorUserId: revisedById,
        iconName: "clipboard-edit",
        message: `Đã chỉnh sửa biên bản nghiệm thu ${contract.contractCode} theo phản hồi khách hàng và tạo phiên bản ${versionLabel}.`,
      },
    });

    const notification = await tx.notification.create({
      data: {
        userId: contract.event.customerUserId,
        scope: "customer",
        type: "settlement_feedback",
        title: "Biên bản nghiệm thu đã được chỉnh sửa",
        message: `Biên bản nghiệm thu của hợp đồng ${contract.contractCode} (${contract.event.name}) đã được chỉnh sửa theo phản hồi của bạn. Vui lòng kiểm tra lại phiên bản ${versionLabel}.`,
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

    return { version, notification };
  });

  emitCustomerNotification(result.notification);
  return result.version;
};

export const deleteContract = async (id: string) => {
  const existing = await prisma.contract.findUnique({
    where: { id },
    select: {
      id: true,
      eventId: true,
      contractCode: true,
      status: true,
      event: { select: { name: true } },
    },
  });
  if (!existing) throw createError("NOT_FOUND", "Contract not found", 404);

  await prisma.$transaction(async (tx) => {
    await tx.document.deleteMany({ where: { contractId: id } });
    await tx.transaction.deleteMany({ where: { contractId: id } });
    await tx.contractLineItem.deleteMany({ where: { contractVersion: { contractId: id } } });
    await tx.contractVersion.deleteMany({ where: { contractId: id } });
    await tx.notification.deleteMany({ where: { entityType: "contract", entityId: id } });
    await tx.contract.delete({ where: { id } });
  });

  if (existing.status !== "draft") {
    await notifyCustomerForEvent(existing.eventId, {
      type: "contract",
      title: "Hợp đồng đã được gỡ",
      message: `Hợp đồng ${existing.contractCode} của sự kiện ${existing.event.name} đã được gỡ khỏi hệ thống.`,
    });
  }
};

export const cancelContract = async (id: string, cancelledById: string) => {
  const existing = await prisma.contract.findUnique({
    where: { id },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          consultationRequestId: true,
        },
      },
    },
  });
  if (!existing) throw createError("NOT_FOUND", "Contract not found", 404);
  if (existing.status === "cancelled")
    throw createError("CONFLICT", "Contract is already cancelled", 409);
  if (existing.status === "liquidated")
    throw createError("CONFLICT", "Cannot cancel a liquidated contract", 409);

  const contract = await prisma.$transaction(async (tx) => {
    const contract = await tx.contract.update({
      where: { id },
      data: { status: "cancelled" },
    });

    await tx.event.update({
      where: { id: existing.eventId },
      data: { status: "cancelled", completedAt: null },
    });

    if (existing.event.consultationRequestId) {
      await tx.consultationRequest.update({
        where: { id: existing.event.consultationRequestId },
        data: { status: "cancelled" },
      });
    }
    await tx.contract.updateMany({
      where: { eventId: existing.eventId, status: { not: "liquidated" } },
      data: { status: "cancelled" },
    });

    await tx.eventActivity.create({
      data: {
        eventId: existing.eventId,
        actorUserId: cancelledById,
        iconName: "x-circle",
        message: `Đã hủy hợp đồng ${existing.contractCode}; dự án "${existing.event.name}" cũng được chuyển sang trạng thái đã hủy.`,
      },
    });

    // Cancel pending transactions
    await tx.transaction.updateMany({
      where: {
        status: "pending",
        OR: [{ eventId: existing.eventId }, { contract: { eventId: existing.eventId } }],
      },
      data: { status: "cancelled" },
    });

    return contract;
  });

  await notifyCustomerForEvent(existing.eventId, {
    type: "contract",
    title: "Hợp đồng đã bị hủy",
    message: `Hợp đồng ${existing.contractCode} của sự kiện ${existing.event.name} đã bị hủy.`,
    entityType: "contract",
    entityId: id,
  });
  return contract;
};
