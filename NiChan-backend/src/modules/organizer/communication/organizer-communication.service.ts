import { prisma } from "../../../lib/prisma";
import { createError } from "../../../middleware/errorHandler";
import { notifyCustomerForEvent } from "../../shared/event-lifecycle.service";

// Chat dùng lại logic của customer (ensureEventAccess đã hỗ trợ cả organizer)
export { getChatMessages, sendChatMessage, deleteChatMessage } from "../../customer/customer.service";

// ─── Documents (organizer view) ─────────────────────────────────────────────────

const assertOrganizerEvent = async (eventId: string, organizerUserId: string) => {
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizerUserId, organizerAssignmentStatus: "accepted" },
    select: { id: true, name: true },
  });
  if (!event) throw createError("NOT_FOUND", "Event not found or access denied", 404);
  return event;
};

export const getOrganizerEventDocuments = async (eventId: string, organizerUserId: string) => {
  await assertOrganizerEvent(eventId, organizerUserId);

  return prisma.document.findMany({
    where: { eventId },
    include: { event: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
};

export const createOrganizerDocument = async (
  eventId: string,
  organizerUserId: string,
  input: { name: string; fileType: string; fileUrl: string },
) => {
  const event = await assertOrganizerEvent(eventId, organizerUserId);

  const document = await prisma.document.create({
    data: {
      eventId,
      name: input.name,
      fileType: input.fileType,
      fileUrl: input.fileUrl,
      uploadedById: organizerUserId,
      status: "approved",
    },
    include: { event: { select: { id: true, name: true } } },
  });

  await prisma.eventActivity.create({
    data: {
      eventId,
      actorUserId: organizerUserId,
      iconName: "file-text",
      message: `Đã thêm tài liệu "${input.name}" vào dự án ${event.name}.`,
    },
  });

  await notifyCustomerForEvent(eventId, {
    type: "document",
    title: "Có tài liệu mới",
    message: `Ban tổ chức đã thêm tài liệu "${input.name}" vào sự kiện ${event.name}.`,
    entityType: "event",
  });
  return document;
};

export const deleteOrganizerDocument = async (
  eventId: string,
  documentId: string,
  organizerUserId: string,
) => {
  const event = await assertOrganizerEvent(eventId, organizerUserId);
  const document = await prisma.document.findFirst({
    where: { id: documentId, eventId },
    select: { id: true, name: true, uploadedById: true },
  });

  if (!document) throw createError("NOT_FOUND", "Document not found", 404);
  if (document.uploadedById !== organizerUserId) {
    throw createError("FORBIDDEN", "You can only delete documents you uploaded", 403);
  }

  await prisma.$transaction(async (tx) => {
    await tx.document.delete({ where: { id: documentId } });
    await tx.eventActivity.create({
      data: {
        eventId,
        actorUserId: organizerUserId,
        iconName: "trash-2",
        message: `Đã xóa tài liệu "${document.name}" khỏi dự án ${event.name}.`,
      },
    });
  });

  await notifyCustomerForEvent(eventId, {
    type: "document",
    title: "Tài liệu sự kiện đã thay đổi",
    message: `Ban tổ chức đã xóa tài liệu "${document.name}" khỏi sự kiện ${event.name}.`,
    entityType: "event",
  });
  return { deleted: true };
};
