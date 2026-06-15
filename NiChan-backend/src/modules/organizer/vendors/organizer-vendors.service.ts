import { prisma } from "../../../lib/prisma";
import { createError } from "../../../middleware/errorHandler";
import { z } from "zod";

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const vendorSchema = z.object({
  name: z.string().min(1).max(255),
  categoryId: z.string().uuid(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  bankAccountNumber: z.string().max(100).optional(),
  contactName: z.string().optional(),
  address: z.string().min(1).max(500),
  note: z.string().max(1000).optional(),
});

export const vendorStatusSchema = z.object({
  status: z.enum(["active", "paused", "inactive"]),
});

export const eventVendorSchema = z.object({
  vendorId: z.string().uuid(),
  serviceNote: z.string().trim().max(500).optional(),
});

export type VendorInput = z.infer<typeof vendorSchema>;
export type EventVendorInput = z.infer<typeof eventVendorSchema>;

// ─── Vendor Categories ────────────────────────────────────────────────────────

export const listVendorCategories = async () =>
  prisma.vendorCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

// ─── Vendors ─────────────────────────────────────────────────────────────────

export const listVendors = async (filters: {
  categoryId?: string;
  status?: string;
  search?: string;
  skip: number;
  take: number;
}) => {
  const where = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search } },
            { email: { contains: filters.search } },
            { contactName: { contains: filters.search } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.vendor.findMany({
      where,
      skip: filters.skip,
      take: filters.take,
      orderBy: { name: "asc" },
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { eventVendors: true } },
      },
    }),
    prisma.vendor.count({ where }),
  ]);

  return { items, total };
};

export const getVendorById = async (id: string) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      _count: { select: { eventVendors: true } },
    },
  });
  if (!vendor) throw createError("NOT_FOUND", "Vendor not found", 404);
  return vendor;
};

export const createVendor = async (input: VendorInput) => {
  return prisma.vendor.create({
    data: {
      name: input.name,
      categoryId: input.categoryId,
      phone: input.phone,
      email: input.email,
      bankAccountNumber: input.bankAccountNumber,
      contactName: input.contactName,
      address: input.address,
      note: input.note,
      status: "active",
    },
    include: {
      category: { select: { id: true, name: true } },
      _count: { select: { eventVendors: true } },
    },
  });
};

export const updateVendor = async (id: string, input: Partial<VendorInput>) => {
  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) throw createError("NOT_FOUND", "Vendor not found", 404);
  return prisma.vendor.update({
    where: { id },
    data: input,
    include: {
      category: { select: { id: true, name: true } },
      _count: { select: { eventVendors: true } },
    },
  });
};

export const updateVendorStatus = async (id: string, status: string) => {
  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) throw createError("NOT_FOUND", "Vendor not found", 404);
  return prisma.vendor.update({
    where: { id },
    data: { status },
    include: {
      category: { select: { id: true, name: true } },
      _count: { select: { eventVendors: true } },
    },
  });
};

export const deleteVendor = async (id: string) => {
  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) throw createError("NOT_FOUND", "Vendor not found", 404);

  const linkedProjects = await prisma.eventVendor.count({ where: { vendorId: id } });
  if (linkedProjects > 0) {
    return prisma.vendor.update({
      where: { id },
      data: { status: "inactive" },
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { eventVendors: true } },
      },
    });
  }

  await prisma.vendor.delete({ where: { id } });
  return { deleted: true };
};

// ─── Event Vendors ────────────────────────────────────────────────────────────

const getManagedEvent = async (eventId: string, actorUserId: string, actorRole: string) => {
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      ...(actorRole === "organizer" ? { organizerUserId: actorUserId } : {}),
    },
    select: {
      id: true,
      name: true,
      organizerUser: { select: { displayName: true } },
    },
  });
  if (!event) throw createError("NOT_FOUND", "Event not found or access denied", 404);
  return event;
};

export const getEventVendors = async (eventId: string, actorUserId: string, actorRole: string) => {
  await getManagedEvent(eventId, actorUserId, actorRole);

  return prisma.eventVendor.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    include: { vendor: { include: { category: { select: { id: true, name: true } } } } },
  });
};

export const addEventVendor = async (
  eventId: string,
  input: EventVendorInput,
  actorUserId: string,
  actorRole: string,
) => {
  const event = await getManagedEvent(eventId, actorUserId, actorRole);

  const vendor = await prisma.vendor.findFirst({
    where: { id: input.vendorId, status: { not: "inactive" } },
    select: { id: true, name: true },
  });
  if (!vendor) throw createError("NOT_FOUND", "Vendor not found or inactive", 404);

  const existing = await prisma.eventVendor.findFirst({
    where: { eventId, vendorId: input.vendorId },
  });
  if (existing) throw createError("CONFLICT", "Vendor already assigned to this project", 409);

  return prisma.$transaction(async (tx) => {
    const eventVendor = await tx.eventVendor.create({
      data: {
        eventId,
        vendorId: input.vendorId,
        serviceNote: input.serviceNote || null,
        status: "active",
      },
      include: { vendor: { include: { category: { select: { id: true, name: true } } } } },
    });

    await tx.eventActivity.create({
      data: {
        eventId,
        actorUserId,
        iconName: "briefcase",
        message: `${event.organizerUser?.displayName ?? "Organizer"} đã thêm nhà cung cấp ${vendor.name} vào dự án ${event.name}.`,
      },
    });

    return eventVendor;
  });
};

export const removeEventVendor = async (
  eventVendorId: string,
  actorUserId: string,
  actorRole: string,
) => {
  const existing = await prisma.eventVendor.findUnique({
    where: { id: eventVendorId },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          organizerUserId: true,
          organizerUser: { select: { displayName: true } },
        },
      },
      vendor: { select: { id: true, name: true } },
    },
  });
  if (!existing) throw createError("NOT_FOUND", "Event vendor not found", 404);
  if (actorRole === "organizer" && existing.event.organizerUserId !== actorUserId) {
    throw createError("FORBIDDEN", "You do not manage this event", 403);
  }

  await prisma.$transaction(async (tx) => {
    await tx.eventVendor.delete({ where: { id: eventVendorId } });

    const budgets = await tx.projectBudget.findMany({
      where: { eventId: existing.event.id },
      select: { id: true },
    });
    if (budgets.length > 0) {
      await tx.budgetItem.updateMany({
        where: {
          projectBudgetId: { in: budgets.map((budget) => budget.id) },
          vendorId: existing.vendor.id,
        },
        data: { vendorId: null },
      });
    }

    await tx.eventActivity.create({
      data: {
        eventId: existing.event.id,
        actorUserId,
        iconName: "briefcase",
        message: `${existing.event.organizerUser?.displayName ?? "Organizer"} đã gỡ nhà cung cấp ${existing.vendor.name} khỏi dự án ${existing.event.name}.`,
      },
    });
  });
};
