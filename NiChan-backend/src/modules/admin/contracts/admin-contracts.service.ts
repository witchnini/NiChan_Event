import { prisma } from "../../../lib/prisma";
import { createError } from "../../../middleware/errorHandler";
import type { CreateContractInput, UpdateContractInput } from "./admin-contracts.schema";

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
        versions: { take: 1, orderBy: { createdAt: "desc" } },
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
      versions: { orderBy: { createdAt: "desc" } },
      documents: true,
    },
  });
  if (!contract) throw createError("NOT_FOUND", "Contract not found", 404);
  return contract;
};

export const createContract = async (input: CreateContractInput, createdById: string) => {
  const year = new Date().getFullYear();
  const count = await prisma.contract.count({
    where: { contractCode: { startsWith: `HD-${year}-` } },
  });
  const contractCode = `HD-${year}-${String(count + 1).padStart(3, "0")}`;

  const contract = await prisma.contract.create({
    data: {
      contractCode,
      eventId: input.eventId,
      customerUserId: input.customerUserId,
      totalValue: input.totalValue,
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
        },
      },
    },
    include: { versions: true },
  });

  return contract;
};

export const updateContract = async (
  id: string,
  input: UpdateContractInput,
  updatedById: string,
) => {
  const existing = await prisma.contract.findUnique({ where: { id } });
  if (!existing) throw createError("NOT_FOUND", "Contract not found", 404);

  const hasContentChange =
    input.scopeText || input.paymentTerms || input.generalTerms || input.versionLabel;

  return prisma.$transaction(async (tx) => {
    if (hasContentChange) {
      const versionLabel = input.versionLabel ?? existing.currentVersion;
      await tx.contractVersion.create({
        data: {
          contractId: id,
          versionLabel,
          scopeText: input.scopeText ?? "",
          paymentTerms: input.paymentTerms ?? "",
          generalTerms: input.generalTerms ?? "",
          createdById: updatedById,
        },
      });
    }

    return tx.contract.update({
      where: { id },
      data: {
        ...(input.totalValue !== undefined ? { totalValue: input.totalValue } : {}),
        ...(input.versionLabel !== undefined ? { currentVersion: input.versionLabel } : {}),
      },
    });
  });
};

export const sendContract = async (id: string, sentById: string) => {
  const existing = await prisma.contract.findUnique({
    where: { id },
    include: {
      event: { select: { id: true, name: true } },
      versions: { take: 1, orderBy: { createdAt: "desc" }, select: { documentUrl: true } },
    },
  });
  if (!existing) throw createError("NOT_FOUND", "Contract not found", 404);
  if (existing.status !== "draft")
    throw createError("CONFLICT", "Only draft contracts can be sent", 409);

  const documentUrl = existing.versions[0]?.documentUrl ?? "";

  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.update({
      where: { id },
      data: { status: "sent", sentAt: new Date() },
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
          message: `Đã gửi hợp đồng ${existing.contractCode} cho khách hàng.`,
        },
      });
    }

    return contract;
  });
};

export const deleteContract = async (id: string) => {
  const existing = await prisma.contract.findUnique({ where: { id } });
  if (!existing) throw createError("NOT_FOUND", "Contract not found", 404);
  await prisma.contractVersion.deleteMany({ where: { contractId: id } });
  await prisma.contract.delete({ where: { id } });
};
