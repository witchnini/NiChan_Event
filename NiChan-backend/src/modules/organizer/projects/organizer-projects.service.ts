import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { emitNotification } from "../../../lib/socket";
import { createError } from "../../../middleware/errorHandler";
import {
  emitCustomerNotification,
  ensureEventCanBeManuallyCompleted,
  ensureCustomerTrackingInTransaction,
  getEventProgressPercent,
  notifyCustomerForEvent,
} from "../../shared/event-lifecycle.service";
import { TASK_STATUS_TRANSITIONS, TaskStatus } from "../../../types/enums";
import type {
  CreateTaskInput,
  RespondProjectAssignmentInput,
  RespondRequestAssignmentInput,
  UpdateProjectStatusInput,
  UpdateTaskStatusInput,
} from "./organizer-projects.schema";

const contractLineItemsInclude = {
  orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
};

const parseEventNameFromNote = (note?: string | null) => {
  if (!note) return null;

  const eventNameLine = note
    .split(/\r?\n/)
    .find((line) => line.trim().toLowerCase().startsWith("ten su kien:"));

  if (!eventNameLine) return null;

  const eventName = eventNameLine.split(":").slice(1).join(":").trim();
  return eventName || null;
};

const buildEventNameFromRequest = (request: {
  eventType: string;
  note?: string | null;
}) => parseEventNameFromNote(request.note) ?? request.eventType;

const buildEventDataFromRequest = (request: {
  id: string;
  eventType: string;
  eventDate?: Date | null;
  locationText?: string | null;
  guestCount?: number | null;
  note?: string | null;
  customerUserId: string;
  assignedManagerId: string;
}) => ({
  name: buildEventNameFromRequest(request),
  type: request.eventType,
  customerUserId: request.customerUserId,
  organizerUserId: request.assignedManagerId,
  organizerAssignmentStatus: "accepted",
  organizerRejectionReason: null,
  organizerRespondedAt: new Date(),
  consultationRequestId: request.id,
  eventDate: request.eventDate,
  locationText: request.locationText,
  guestCount: request.guestCount,
  summary: request.note,
});

// ─── Projects List ────────────────────────────────────────────────────────────

export const listOrganizerProjects = async (organizerUserId: string) => {
  const projects = await prisma.event.findMany({
    where: { organizerUserId },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      eventDate: true,
      guestCount: true,
      progressPercent: true,
      organizerAssignmentStatus: true,
      organizerRejectionReason: true,
      organizerRespondedAt: true,
      locationText: true,
      customerUser: { select: { id: true, displayName: true, avatarUrl: true, email: true, phone: true } },
      consultationRequest: {
        select: {
          id: true,
          requestCode: true,
          status: true,
          customerName: true,
          eventType: true,
          note: true,
          budgetRange: true,
        },
      },
      _count: { select: { tasks: true, milestones: true, vendors: true, staffAssignments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return projects.map((project) => ({
    ...project,
    progressPercent: getEventProgressPercent(project.status, project.progressPercent),
  }));
};

export const listOrganizerRequestAssignments = async (organizerUserId: string) => {
  return prisma.consultationRequest.findMany({
    where: {
      OR: [
        { assignedManagerId: organizerUserId },
        { assignmentHistory: { some: { organizerUserId } } },
      ],
      status: { in: ["reviewing", "quoted"] },
    },
    select: {
      id: true,
      requestCode: true,
      customerName: true,
      phone: true,
      email: true,
      eventType: true,
      eventDate: true,
      guestCount: true,
      budgetRange: true,
      locationText: true,
      note: true,
      status: true,
      assignedManagerId: true,
      organizerRequestStatus: true,
      organizerRequestRejectionReason: true,
      organizerRequestRespondedAt: true,
      createdAt: true,
      assignmentHistory: {
        where: { organizerUserId },
        select: {
          id: true,
          status: true,
          rejectionReason: true,
          assignedAt: true,
          respondedAt: true,
        },
        orderBy: { assignedAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const respondRequestAssignment = async (
  requestId: string,
  organizerUserId: string,
  input: RespondRequestAssignmentInput,
) => {
  const request = await prisma.consultationRequest.findFirst({
    where: { id: requestId, assignedManagerId: organizerUserId },
    select: {
      id: true,
      requestCode: true,
      customerName: true,
      eventType: true,
      organizerRequestStatus: true,
    },
  });
  if (!request) throw createError("NOT_FOUND", "Request assignment not found", 404);
  if (request.organizerRequestStatus !== "pending") {
    throw createError("CONFLICT", "Request assignment has already been responded to", 409);
  }

  const accepted = input.action === "accept";
  const reason = input.reason?.trim() ?? "";
  const result = await prisma.$transaction(async (tx) => {
    const updateResult = await tx.consultationRequest.updateMany({
      where: {
        id: requestId,
        assignedManagerId: organizerUserId,
        organizerRequestStatus: "pending",
      },
      data: {
        organizerRequestStatus: accepted ? "accepted" : "rejected",
        organizerRequestRejectionReason: accepted ? null : reason,
        organizerRequestRespondedAt: new Date(),
      },
    });
    if (updateResult.count === 0) {
      throw createError("CONFLICT", "Request assignment has already been responded to", 409);
    }

    const updatedRequest = await tx.consultationRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { events: { select: { id: true } } },
    });

    const assignmentHistory = await tx.organizerRequestAssignmentHistory.findFirst({
      where: {
        requestId,
        organizerUserId,
        status: "pending",
      },
      orderBy: { assignedAt: "desc" },
      select: { id: true },
    });
    if (assignmentHistory) {
      await tx.organizerRequestAssignmentHistory.update({
        where: { id: assignmentHistory.id },
        data: {
          status: accepted ? "accepted" : "rejected",
          rejectionReason: accepted ? null : reason,
          respondedAt: new Date(),
        },
      });
    } else {
      await tx.organizerRequestAssignmentHistory.create({
        data: {
          requestId,
          organizerUserId,
          status: accepted ? "accepted" : "rejected",
          rejectionReason: accepted ? null : reason,
          assignedAt: updatedRequest.createdAt,
          respondedAt: new Date(),
        },
      });
    }

    let event: { id: string; name: string } | null = null;
    if (accepted) {
      if (!updatedRequest.customerUserId || !updatedRequest.assignedManagerId) {
        throw createError("CONFLICT", "Request must be linked to a customer and organizer before accepting", 409);
      }

      const eventData = buildEventDataFromRequest({
        id: updatedRequest.id,
        eventType: updatedRequest.eventType,
        eventDate: updatedRequest.eventDate,
        locationText: updatedRequest.locationText,
        guestCount: updatedRequest.guestCount,
        note: updatedRequest.note,
        customerUserId: updatedRequest.customerUserId,
        assignedManagerId: updatedRequest.assignedManagerId,
      });

      event = updatedRequest.events[0]?.id
        ? await tx.event.update({
            where: { id: updatedRequest.events[0].id },
            data: eventData,
            select: { id: true, name: true },
          })
        : await tx.event.create({
            data: { ...eventData, status: "draft" },
            select: { id: true, name: true },
          });

      await tx.eventActivity.create({
        data: {
          eventId: event.id,
          actorUserId: organizerUserId,
          iconName: "check",
          message: `Organizer đã chấp nhận dự án ${event.name}.`,
        },
      });
    }

    const admins = await tx.user.findMany({
      where: { role: "admin", status: "active", deletedAt: null },
      select: { id: true },
    });
    const notifications = await Promise.all(
      admins.map((admin) =>
        tx.notification.create({
          data: {
            userId: admin.id,
            scope: "admin",
            type: accepted ? "request_assignment_accepted" : "request_assignment_rejected",
            title: accepted ? "Organizer đã nhận yêu cầu" : "Organizer từ chối yêu cầu",
            message: accepted
              ? `Organizer đã chấp nhận yêu cầu ${request.requestCode}.`
              : `Organizer đã từ chối yêu cầu ${request.requestCode}. Lý do: ${reason}`,
            entityType: "consultation_request",
            entityId: requestId,
          },
        }),
      ),
    );

    return { updatedRequest, event, notifications };
  });

  result.notifications.forEach((notification) => {
    emitNotification(notification.userId, {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      entityType: notification.entityType,
      entityId: notification.entityId,
      createdAt: notification.createdAt,
    });
  });

  return { request: result.updatedRequest, event: result.event };
};

export const respondProjectAssignment = async (
  projectId: string,
  organizerUserId: string,
  input: RespondProjectAssignmentInput,
) => {
  const project = await prisma.event.findFirst({
    where: { id: projectId, organizerUserId },
    select: { id: true, name: true, organizerAssignmentStatus: true },
  });
  if (!project) throw createError("NOT_FOUND", "Project assignment not found", 404);
  if (project.organizerAssignmentStatus !== "pending") {
    throw createError("CONFLICT", "Project assignment has already been responded to", 409);
  }

  const accepted = input.action === "accept";
  const result = await prisma.$transaction(async (tx) => {
    const updateResult = await tx.event.updateMany({
      where: {
        id: projectId,
        organizerUserId,
        organizerAssignmentStatus: "pending",
      },
      data: {
        organizerAssignmentStatus: accepted ? "accepted" : "rejected",
        organizerRejectionReason: accepted ? null : input.reason!.trim(),
        organizerRespondedAt: new Date(),
      },
    });
    if (updateResult.count === 0) {
      throw createError("CONFLICT", "Project assignment has already been responded to", 409);
    }

    const updatedProject = await tx.event.findUniqueOrThrow({
      where: { id: projectId },
    });

    await tx.eventActivity.create({
      data: {
        eventId: projectId,
        actorUserId: organizerUserId,
        iconName: accepted ? "check" : "x",
        message: accepted
          ? `Organizer đã chấp nhận dự án ${project.name}.`
          : `Organizer đã từ chối dự án ${project.name}. Lý do: ${input.reason!.trim()}`,
      },
    });

    const admins = await tx.user.findMany({
      where: { role: "admin", status: "active", deletedAt: null },
      select: { id: true },
    });
    const notifications = await Promise.all(
      admins.map((admin) =>
        tx.notification.create({
          data: {
            userId: admin.id,
            scope: "admin",
            type: accepted ? "project_assignment_accepted" : "project_assignment_rejected",
            title: accepted ? "Organizer đã nhận dự án" : "Organizer từ chối dự án",
            message: accepted
              ? `Organizer đã chấp nhận dự án ${project.name}.`
              : `Organizer đã từ chối dự án ${project.name}. Lý do: ${input.reason!.trim()}`,
            entityType: "event",
            entityId: projectId,
          },
        }),
      ),
    );
    return { updatedProject, notifications };
  });

  result.notifications.forEach((notification) => {
    emitNotification(notification.userId, {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      entityType: notification.entityType,
      entityId: notification.entityId,
      createdAt: notification.createdAt,
    });
  });
  return result.updatedProject;
};

export const getOrganizerProjectById = async (projectId: string, organizerUserId: string) => {
  const project = await prisma.event.findFirst({
    where: {
      id: projectId,
      organizerUserId,
      organizerAssignmentStatus: "accepted",
    },
    include: {
      customerUser: { select: { id: true, displayName: true, avatarUrl: true, email: true, phone: true } },
      organizerUser: { select: { id: true, displayName: true, avatarUrl: true, email: true, phone: true } },
      consultationRequest: {
        select: {
          id: true,
          requestCode: true,
          status: true,
          customerName: true,
          eventType: true,
          note: true,
          budgetRange: true,
        },
      },
      milestones: { orderBy: { sortOrder: "asc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 12 },
      _count: { select: { tasks: true, vendors: true, staffAssignments: true, contracts: true, documents: true } },
    },
  });
  if (!project) throw createError("NOT_FOUND", "Project not found", 404);
  return project;
};

// ─── Contracts (organizer view) ─────────────────────────────────────────────────

export const getOrganizerProjectContracts = async (
  projectId: string,
  organizerUserId: string,
) => {
  const event = await prisma.event.findFirst({
    where: { id: projectId, organizerUserId, organizerAssignmentStatus: "accepted" },
    select: { id: true },
  });
  if (!event) throw createError("NOT_FOUND", "Project not found", 404);

  return prisma.contract.findMany({
    where: { eventId: projectId },
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
      transactions: {
        where: { status: { in: ["pending", "completed"] } },
        select: { id: true, amount: true, status: true, paymentMethod: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const getOrganizerContractById = async (
  contractId: string,
  organizerUserId: string,
  role?: string,
) => {
  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      ...(role === "admin"
        ? {}
        : { event: { organizerUserId, organizerAssignmentStatus: "accepted" } }),
    },
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
      transactions: {
        where: { status: { in: ["pending", "completed"] } },
        select: { id: true, amount: true, status: true, paymentMethod: true },
      },
      documents: true,
    },
  });

  if (!contract) throw createError("NOT_FOUND", "Contract not found", 404);
  return contract;
};

// ─── Kanban ───────────────────────────────────────────────────────────────────

const KANBAN_COLUMNS = [
  { id: "todo", title: "Chờ xử lý" },
  { id: "in_progress", title: "Đang thực hiện" },
  { id: "review", title: "Đang kiểm tra" },
  { id: "done", title: "Hoàn thành" },
] as const;

export const recalculateProjectProgress = async (
  tx: Prisma.TransactionClient,
  eventId: string,
) => {
  const [event, total] = await Promise.all([
    tx.event.findUnique({
      where: { id: eventId },
      select: { status: true },
    }),
    tx.projectTask.count({ where: { eventId } }),
  ]);
  if (!event) throw createError("NOT_FOUND", "Event not found", 404);

  const done = total > 0 ? await tx.projectTask.count({ where: { eventId, status: "done" } }) : 0;
  const taskProgress = total > 0 ? Math.round((done / total) * 100) : 0;
  const progressPercent = getEventProgressPercent(event.status, taskProgress);

  return tx.event.update({
    where: { id: eventId },
    data: { progressPercent },
    select: { id: true, progressPercent: true },
  });
};

export const getKanban = async (projectId: string, organizerUserId: string) => {
  const event = await prisma.event.findFirst({
    where: {
      id: projectId,
      organizerUserId,
      organizerAssignmentStatus: "accepted",
    },
    select: {
      id: true,
      name: true,
      status: true,
      eventDate: true,
      guestCount: true,
      progressPercent: true,
      customerUser: { select: { id: true, displayName: true, avatarUrl: true } },
      consultationRequest: {
        select: {
          id: true,
          requestCode: true,
          status: true,
          customerName: true,
          eventType: true,
          note: true,
        },
      },
    },
  });
  if (!event) throw createError("NOT_FOUND", "Project not found", 404);

  const tasks = await prisma.projectTask.findMany({
    where: { eventId: projectId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      assignee: { select: { id: true, displayName: true, avatarUrl: true } },
      createdBy: { select: { id: true, displayName: true } },
    },
  });

  const columns = KANBAN_COLUMNS.map((col) => ({
    ...col,
    tasks: tasks.filter((t) => t.status === col.id),
  }));

  return {
    project: {
      ...event,
      progressPercent: getEventProgressPercent(event.status, event.progressPercent),
    },
    columns,
  };
};

export const getGantt = async (projectId: string, organizerUserId: string) => {
  const kanban = await getKanban(projectId, organizerUserId);
  const taskTime = (value?: Date | string | null) => {
    const time = value ? new Date(value).getTime() : Number.NaN;
    return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
  };

  const items = kanban.columns
    .flatMap((column) => column.tasks)
    .sort((left, right) => {
      const leftTime = Math.min(taskTime(left.dueAt), taskTime(left.createdAt));
      const rightTime = Math.min(taskTime(right.dueAt), taskTime(right.createdAt));
      return leftTime - rightTime || (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
    });

  return { project: kanban.project, items };
};

const customerTrackingStatuses = ["contracted", "quoted", "planning", "in_progress", "completed"] as const;
type CustomerTrackingStatus = (typeof customerTrackingStatuses)[number];

const isCustomerTrackingStatus = (
  status: UpdateProjectStatusInput["status"],
): status is CustomerTrackingStatus =>
  customerTrackingStatuses.includes(status as CustomerTrackingStatus);

const buildOrganizerStatusNotification = (
  eventName: string,
  status: CustomerTrackingStatus,
) => {
  if (status === "contracted") {
    return {
      activityMessage: `Ban tổ chức đã xác nhận sự kiện ${eventName}.`,
      notificationTitle: "Sự kiện đã được xác nhận",
      notificationMessage: `Sự kiện ${eventName} đã được xác nhận. Bạn có thể theo dõi tiến độ trên dashboard.`,
    };
  }

  if (status === "quoted") {
    return {
      activityMessage: `Ban tổ chức đã báo giá sự kiện ${eventName}.`,
      notificationTitle: "Sự kiện đã được báo giá",
      notificationMessage: `Sự kiện ${eventName} đã được báo giá. Bạn có thể xem chi tiết trên dashboard.`,
    };
  }

  if (status === "planning") {
    return {
      activityMessage: `Ban tổ chức đã đưa sự kiện ${eventName} vào giai đoạn lập kế hoạch.`,
      notificationTitle: "Sự kiện đang lập kế hoạch",
      notificationMessage: `Sự kiện ${eventName} đã bắt đầu lập kế hoạch. Bạn có thể theo dõi tiến độ trên dashboard.`,
    };
  }

  if (status === "in_progress") {
    return {
      activityMessage: `Ban tổ chức đã bắt đầu triển khai sự kiện ${eventName}.`,
      notificationTitle: "Sự kiện đã bắt đầu triển khai",
      notificationMessage: `Ban tổ chức đã bắt đầu triển khai sự kiện ${eventName}. Hãy theo dõi timeline và trao đổi trên dashboard.`,
    };
  }

  return {
    activityMessage: `Sự kiện ${eventName} đã được đánh dấu hoàn thành.`,
    notificationTitle: "Sự kiện đã hoàn thành",
    notificationMessage: `Sự kiện ${eventName} đã hoàn thành. Bạn có thể xem lại tài liệu, thanh toán và gửi đánh giá.`,
  };
};

const projectStatusLabel: Record<UpdateProjectStatusInput["status"], string> = {
  planning: "Lập kế hoạch",
  quoted: "Đã báo giá",
  contracted: "Đã xác nhận",
  in_progress: "Đang triển khai",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

export const updateProjectStatus = async (
  projectId: string,
  organizerUserId: string,
  input: UpdateProjectStatusInput,
) => {
  const event = await prisma.event.findFirst({
    where: { id: projectId, organizerUserId, organizerAssignmentStatus: "accepted" },
    select: {
      id: true,
      name: true,
      status: true,
      customerUserId: true,
      consultationRequestId: true,
    },
  });
  if (!event) throw createError("NOT_FOUND", "Project not found", 404);
  if (event.status === input.status) return event;
  if (event.status === "cancelled") {
    throw createError("CONFLICT", "A cancelled project cannot be resumed", 409);
  }
  if (input.status === "completed") {
    await ensureEventCanBeManuallyCompleted(projectId);
  }

  if (isCustomerTrackingStatus(input.status)) {
    const nextStatus = input.status;
    const copy = buildOrganizerStatusNotification(event.name, nextStatus);
    const result = await prisma.$transaction((tx) =>
      ensureCustomerTrackingInTransaction(tx, projectId, {
        actorUserId: organizerUserId,
        status: nextStatus,
        ...copy,
      }),
    );
    emitCustomerNotification(result.notification);
    return result.event;
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedEvent = await tx.event.update({
      where: { id: projectId },
      data: { status: input.status, completedAt: null },
      select: { id: true, name: true, status: true, progressPercent: true },
    });

    if (input.status === "cancelled" && event.consultationRequestId) {
      await tx.consultationRequest.update({
        where: { id: event.consultationRequestId },
        data: { status: "cancelled" },
      });
    }
    if (input.status === "cancelled") {
      await tx.contract.updateMany({
        where: { eventId: projectId, status: { not: "liquidated" } },
        data: { status: "cancelled" },
      });
      await tx.transaction.updateMany({
        where: {
          status: "pending",
          OR: [{ eventId: projectId }, { contract: { eventId: projectId } }],
        },
        data: { status: "cancelled" },
      });
    }

    await tx.eventActivity.create({
      data: {
        eventId: projectId,
        actorUserId: organizerUserId,
        iconName: input.status === "cancelled" ? "x" : "edit",
        message:
          input.status === "cancelled"
            ? `Ban tổ chức đã hủy sự kiện ${event.name}.`
            : `Ban tổ chức đã cập nhật trạng thái sự kiện ${event.name} thành ${projectStatusLabel[input.status]}.`,
      },
    });

    const notification =
      input.status === "cancelled"
        ? await tx.notification.create({
            data: {
              userId: event.customerUserId,
              scope: "customer",
              type: "project",
              title: "Sự kiện đã bị hủy",
              message: `Sự kiện ${event.name} đã bị hủy. Vui lòng liên hệ NiChan nếu cần hỗ trợ.`,
              entityType: "event",
              entityId: projectId,
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
          })
        : null;

    return { updatedEvent, notification };
  });

  if (result.notification) emitCustomerNotification(result.notification);
  return result.updatedEvent;
};

// ─── Tasks CRUD ───────────────────────────────────────────────────────────────

export const createTask = async (
  input: CreateTaskInput,
  createdById: string,
  organizerUserId?: string,
) => {
  const event = await prisma.event.findFirst({
    where: {
      id: input.eventId,
      ...(organizerUserId
        ? { organizerUserId, organizerAssignmentStatus: "accepted" }
        : {}),
    },
    select: { id: true, name: true, status: true, customerUserId: true },
  });
  if (!event) throw createError("NOT_FOUND", "Event not found", 404);
  if (event.status === "cancelled")
    throw createError("CONFLICT", "Cannot add tasks to a cancelled project", 409);

  const result = await prisma.$transaction(async (tx) => {
    const task = await tx.projectTask.create({
      data: {
        eventId: input.eventId,
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
        assigneeUserId: input.assigneeUserId ?? null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        sortOrder: input.sortOrder,
        createdById,
        ...(input.status === "done" ? { completedAt: new Date() } : {}),
      },
      include: {
        assignee: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    await recalculateProjectProgress(tx, input.eventId);
    const notification = await tx.notification.create({
      data: {
        userId: event.customerUserId,
        scope: "customer",
        type: "planning",
        title: "Kế hoạch sự kiện đã được cập nhật",
        message: `Ban tổ chức đã thêm kế hoạch "${task.title}" cho sự kiện ${event.name}.`,
        entityType: "event",
        entityId: event.id,
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

    return { task, notification };
  });

  emitCustomerNotification(result.notification);
  return result.task;
};

const getTaskForOrganizer = async (taskId: string, organizerUserId?: string) => {
  return prisma.projectTask.findFirst({
    where: {
      id: taskId,
      ...(organizerUserId
        ? { event: { organizerUserId, organizerAssignmentStatus: "accepted" } }
        : {}),
    },
    select: { id: true, eventId: true, status: true, event: { select: { status: true } } },
  });
};

export const getTask = async (taskId: string, organizerUserId?: string) => {
  const existing = await getTaskForOrganizer(taskId, organizerUserId);
  if (!existing) throw createError("NOT_FOUND", "Task not found", 404);
  if (existing.event.status === "cancelled")
    throw createError("CONFLICT", "Tasks in a cancelled project cannot be modified", 409);

  const task = await prisma.projectTask.findUnique({
    where: { id: taskId },
    include: {
      assignee: { select: { id: true, displayName: true, avatarUrl: true } },
      createdBy: { select: { id: true, displayName: true } },
      statusHistories: { orderBy: { changedAt: "desc" }, take: 10 },
    },
  });
  if (!task) throw createError("NOT_FOUND", "Task not found", 404);
  return task;
};

export const updateTask = async (
  taskId: string,
  data: Partial<CreateTaskInput>,
  organizerUserId?: string,
) => {
  const existing = await getTaskForOrganizer(taskId, organizerUserId);
  if (!existing) throw createError("NOT_FOUND", "Task not found", 404);

  const updated = await prisma.projectTask.update({
    where: { id: taskId },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.assigneeUserId !== undefined ? { assigneeUserId: data.assigneeUserId } : {}),
      ...(data.dueAt !== undefined ? { dueAt: data.dueAt ? new Date(data.dueAt) : null } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
    },
    include: { assignee: { select: { id: true, displayName: true, avatarUrl: true } } },
  });

  await notifyCustomerForEvent(existing.eventId, {
    type: "planning",
    title: "Kế hoạch sự kiện đã được cập nhật",
    message: `Ban tổ chức đã cập nhật kế hoạch "${updated.title}".`,
  });
  return updated;
};

export const updateTaskStatus = async (
  taskId: string,
  input: UpdateTaskStatusInput,
  changedById: string,
  organizerUserId?: string,
) => {
  const task = await getTaskForOrganizer(taskId, organizerUserId);
  if (!task) throw createError("NOT_FOUND", "Task not found", 404);
  if (task.event.status === "cancelled")
    throw createError("CONFLICT", "Tasks in a cancelled project cannot be progressed", 409);

  const currentStatus = task.status as TaskStatus;
  const allowed = TASK_STATUS_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(input.status as TaskStatus)) {
    throw createError(
      "INVALID_STATUS_TRANSITION",
      `Cannot transition from '${currentStatus}' to '${input.status}'`,
      422,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.projectTask.update({
      where: { id: taskId },
      data: {
        status: input.status,
        completedAt: input.status === "done" ? new Date() : null,
      },
    });

    await tx.taskStatusHistory.create({
      data: {
        taskId,
        fromStatus: currentStatus,
        toStatus: input.status,
        changedById,
      },
    });

    await recalculateProjectProgress(tx, task.eventId);
    return updated;
  });

  await notifyCustomerForEvent(task.eventId, {
    type: "planning",
    title: "Tiến độ kế hoạch đã thay đổi",
    message: `Một công việc trong kế hoạch sự kiện đã chuyển sang trạng thái ${input.status}.`,
  });
  return updated;
};

export const deleteTask = async (taskId: string, organizerUserId?: string) => {
  const existing = await getTaskForOrganizer(taskId, organizerUserId);
  if (!existing) throw createError("NOT_FOUND", "Task not found", 404);
  if (existing.event.status === "cancelled")
    throw createError("CONFLICT", "Tasks in a cancelled project cannot be deleted", 409);
  await prisma.$transaction(async (tx) => {
    await tx.taskStatusHistory.deleteMany({ where: { taskId } });
    await tx.projectTask.delete({ where: { id: taskId } });
    await recalculateProjectProgress(tx, existing.eventId);
  });

  await notifyCustomerForEvent(existing.eventId, {
    type: "planning",
    title: "Kế hoạch sự kiện đã được cập nhật",
    message: "Ban tổ chức đã loại bỏ một công việc khỏi kế hoạch sự kiện.",
  });
};
