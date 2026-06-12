import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { signToken } from "../../lib/jwt";
import { emitNotification } from "../../lib/socket";
import { createError } from "../../middleware/errorHandler";
import type { RegisterInput, LoginInput, ConsultationInput } from "./auth.schema";

const SALT_ROUNDS = 12;
const PORTAL_ROLES = new Set(["admin", "organizer", "customer"]);
const REQUEST_CODE_UNIQUE_VIOLATION = "P2002";
const MAX_REQUEST_CODE_ATTEMPTS = 5;

const buildAuthUser = (user: {
  id: string;
  email: string;
  role: string;
  displayName: string;
  avatarUrl?: string | null;
}) => ({
  userId: user.id,
  email: user.email,
  role: user.role,
  displayName: user.displayName,
  avatarUrl: user.avatarUrl ?? null,
});

// ─── Register ─────────────────────────────────────────────────────────────────

export const register = async (input: RegisterInput) => {
  const existing = await prisma.user.findFirst({
    where: { email: input.email, deletedAt: null },
  });
  if (existing) {
    throw createError("CONFLICT", "Email already registered", 409);
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      displayName: input.name,
      phone: input.phone,
      role: "customer",
      status: "active",
      customerProfile: {
        create: { fullName: input.name },
      },
    },
    select: { id: true, email: true, role: true, displayName: true, avatarUrl: true },
  });

  const token = signToken({ userId: user.id, role: user.role });

  return {
    accessToken: token,
    user: buildAuthUser(user),
  };
};

// ─── Login ────────────────────────────────────────────────────────────────────

export const login = async (input: LoginInput) => {
  const user = await prisma.user.findFirst({
    where: { email: input.email, deletedAt: null },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      role: true,
      status: true,
      displayName: true,
      avatarUrl: true,
    },
  });

  if (!user) {
    throw createError("UNAUTHENTICATED", "Invalid email or password", 401);
  }

  if (user.status !== "active") {
    throw createError("FORBIDDEN", "Account is suspended or inactive", 403);
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw createError("UNAUTHENTICATED", "Invalid email or password", 401);
  }

  if (!PORTAL_ROLES.has(user.role)) {
    throw createError("FORBIDDEN", "This account is not allowed to sign in", 403);
  }

  // Update last login (fire-and-forget)
  prisma.user
    .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    .catch(() => {});

  const token = signToken({ userId: user.id, role: user.role });

  return {
    accessToken: token,
    user: buildAuthUser(user),
  };
};

export const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      displayName: true,
      avatarUrl: true,
    },
  });

  if (!user) {
    throw createError("NOT_FOUND", "User not found", 404);
  }

  if (user.status !== "active") {
    throw createError("FORBIDDEN", "Account is suspended or inactive", 403);
  }

  if (!PORTAL_ROLES.has(user.role)) {
    throw createError("FORBIDDEN", "This account is not allowed to sign in", 403);
  }

  return buildAuthUser(user);
};

export const logout = async () => {
  return { loggedOut: true };
};

// ─── Consultation Request ─────────────────────────────────────────────────────

const notifyAdminsOfConsultationRequest = async (request: {
  id: string;
  requestCode: string;
  customerName: string;
  eventType: string;
}) => {
  const admins = await prisma.user.findMany({
    where: { role: "admin", status: "active", deletedAt: null },
    select: { id: true },
  });

  await Promise.all(
    admins.map(async (admin) => {
      const notification = await prisma.notification.create({
        data: {
          userId: admin.id,
          scope: "admin",
          type: "request",
          title: "Yêu cầu báo giá mới",
          message: `${request.customerName} vừa gửi yêu cầu ${request.requestCode} cho ${request.eventType}`,
          entityType: "consultation_request",
          entityId: request.id,
        },
      });

      emitNotification(admin.id, {
        id: notification.id,
        type: notification.type,
        title: notification.title ?? null,
        message: notification.message,
        entityType: notification.entityType ?? null,
        entityId: notification.entityId ?? null,
        createdAt: notification.createdAt,
      });
    }),
  );
};

const buildRequestCode = (year: number, sequence: number) =>
  `YC-${year}-${String(sequence).padStart(3, "0")}`;

const parseRequestCodeSequence = (requestCode: string, year: number): number => {
  const match = requestCode.match(new RegExp(`^YC-${year}-(\\d+)$`));
  return match ? Number.parseInt(match[1], 10) : 0;
};

const getNextRequestCodeSequence = async (year: number): Promise<number> => {
  const prefix = `YC-${year}-`;
  const requests = await prisma.consultationRequest.findMany({
    where: { requestCode: { startsWith: prefix } },
    select: { requestCode: true },
  });

  const maxSequence = requests.reduce(
    (max, request) => Math.max(max, parseRequestCodeSequence(request.requestCode, year)),
    0,
  );

  return maxSequence + 1;
};

const isRequestCodeUniqueViolation = (error: unknown): boolean => {
  const prismaError = error as {
    code?: string;
    meta?: { target?: string[] | string };
  };
  const target = prismaError.meta?.target;

  return (
    prismaError.code === REQUEST_CODE_UNIQUE_VIOLATION &&
    (target === "requestCode" || (Array.isArray(target) && target.includes("requestCode")))
  );
};

export const createConsultationRequest = async (
  input: ConsultationInput,
  customerUserId?: string,
) => {
  // Generate request code: YC-YYYY-NNN
  const year = new Date().getFullYear();
  let sequence = await getNextRequestCodeSequence(year);

  for (let attempt = 1; attempt <= MAX_REQUEST_CODE_ATTEMPTS; attempt += 1) {
    const requestCode = buildRequestCode(year, sequence);

    try {
      const request = await prisma.consultationRequest.create({
        data: {
          requestCode,
          customerName: input.customerName,
          phone: input.phone,
          email: input.email,
          eventType: input.eventType,
          eventDate: input.eventDate ? new Date(input.eventDate) : null,
          guestCount: input.guestCount ?? null,
          budgetRange: input.budgetRange ?? null,
          locationText: input.location ?? null,
          note: input.note ?? null,
          status: "new",
          customerUserId: customerUserId ?? null,
        },
        select: { id: true, requestCode: true, status: true, customerName: true, eventType: true },
      });

      await notifyAdminsOfConsultationRequest(request).catch((error) => {
        console.warn("[CONSULTATION_NOTIFICATION_FAILED]", error);
      });

      return {
        id: request.id,
        requestCode: request.requestCode,
        status: request.status,
      };
    } catch (error) {
      if (!isRequestCodeUniqueViolation(error) || attempt === MAX_REQUEST_CODE_ATTEMPTS) {
        throw error;
      }

      sequence = await getNextRequestCodeSequence(year);
    }
  }

  throw createError("CONFLICT", "Could not generate a unique request code", 409);
};
