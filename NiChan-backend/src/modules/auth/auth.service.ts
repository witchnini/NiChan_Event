import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { signToken } from "../../lib/jwt";
import { emitNotification } from "../../lib/socket";
import { sendEmail } from "../../lib/email";
import {
  verifyEmailTemplate,
  resetPasswordTemplate,
  consultationReceivedTemplate,
  adminConsultationNotifyTemplate,
} from "../../lib/email-templates";
import { createError } from "../../middleware/errorHandler";
import type {
  RegisterInput,
  LoginInput,
  ConsultationInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  VerifyEmailInput,
  ResendVerificationInput,
} from "./auth.schema";

const SALT_ROUNDS = 12;
const PORTAL_ROLES = new Set(["admin", "organizer", "customer"]);
const REQUEST_CODE_UNIQUE_VIOLATION = "P2002";
const MAX_REQUEST_CODE_ATTEMPTS = 5;

// Token expiry durations
const VERIFY_EMAIL_HOURS = 24;
const RESET_PASSWORD_HOURS = 1;

// Cooldown period between email requests (in seconds)
const EMAIL_COOLDOWN_SECONDS = 60;

const addHours = (hours: number) =>
  new Date(Date.now() + hours * 60 * 60 * 1000);

const isWithinCooldown = (createdAt: Date): boolean =>
  Date.now() - createdAt.getTime() < EMAIL_COOLDOWN_SECONDS * 1000;

const buildAuthUser = (user: {
  id: string;
  email: string;
  role: string;
  displayName: string;
  avatarUrl?: string | null;
  emailVerified?: boolean;
}) => ({
  userId: user.id,
  email: user.email,
  role: user.role,
  displayName: user.displayName,
  avatarUrl: user.avatarUrl ?? null,
  emailVerified: user.emailVerified ?? false,
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
      emailVerified: false,
      customerProfile: {
        create: { fullName: input.name },
      },
    },
    select: { id: true, email: true, role: true, displayName: true, avatarUrl: true, emailVerified: true },
  });

  // Create verification token and send email (fire-and-forget)
  const verificationToken = crypto.randomUUID();
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      token: verificationToken,
      expiresAt: addHours(VERIFY_EMAIL_HOURS),
    },
  });

  sendEmail({
    to: user.email,
    subject: "Xác thực email — NiChan Events",
    html: verifyEmailTemplate(user.displayName, verificationToken),
  }).catch((err) => {
    console.warn("[VERIFICATION_EMAIL_FAILED]", err);
  });

  // Option B: allow login immediately, with emailVerified = false
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
      emailVerified: true,
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
      emailVerified: true,
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

// ─── Email Verification ───────────────────────────────────────────────────────

export const verifyEmail = async (input: VerifyEmailInput) => {
  const record = await prisma.emailVerificationToken.findUnique({
    where: { token: input.token },
    include: { user: { select: { id: true, emailVerified: true } } },
  });

  if (!record) {
    throw createError("NOT_FOUND", "Mã xác thực không hợp lệ", 400);
  }

  if (record.usedAt) {
    return { alreadyVerified: true, message: "Email đã được xác thực trước đó" };
  }

  if (record.expiresAt < new Date()) {
    throw createError("BAD_REQUEST", "Mã xác thực đã hết hạn. Vui lòng yêu cầu gửi lại.", 400);
  }

  // Mark token as used and update user
  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: true },
    }),
  ]);

  return { alreadyVerified: false, message: "Xác thực email thành công!" };
};

export const resendVerification = async (input: ResendVerificationInput) => {
  const user = await prisma.user.findFirst({
    where: { email: input.email, deletedAt: null },
    select: { id: true, email: true, displayName: true, emailVerified: true },
  });

  const successMessage = "Nếu email tồn tại, chúng tôi đã gửi lại email xác thực.";

  if (!user) {
    // Don't reveal whether email exists
    return { message: successMessage };
  }

  if (user.emailVerified) {
    return { message: "Email đã được xác thực." };
  }

  // Cooldown check — prevent spamming
  const recentToken = await prisma.emailVerificationToken.findFirst({
    where: { userId: user.id, usedAt: null },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (recentToken && isWithinCooldown(recentToken.createdAt)) {
    return { message: successMessage };
  }

  // Invalidate old tokens
  await prisma.emailVerificationToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  // Create new token
  const token = crypto.randomUUID();
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt: addHours(VERIFY_EMAIL_HOURS),
    },
  });

  sendEmail({
    to: user.email,
    subject: "Xác thực email — NiChan Events",
    html: verifyEmailTemplate(user.displayName, token),
  }).catch((err) => {
    console.warn("[RESEND_VERIFICATION_EMAIL_FAILED]", err);
  });

  return { message: successMessage };
};

// ─── Password Reset ──────────────────────────────────────────────────────────

export const forgotPassword = async (input: ForgotPasswordInput) => {
  const user = await prisma.user.findFirst({
    where: { email: input.email, deletedAt: null },
    select: { id: true, email: true, displayName: true },
  });

  // Always return success to prevent email enumeration
  const successMessage = "Nếu email tồn tại, chúng tôi đã gửi liên kết đặt lại mật khẩu.";

  if (!user) {
    return { message: successMessage };
  }

  // Cooldown check — prevent spamming
  const recentToken = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, usedAt: null },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (recentToken && isWithinCooldown(recentToken.createdAt)) {
    return { message: successMessage };
  }

  // Invalidate old reset tokens
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  // Create new reset token
  const token = crypto.randomUUID();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt: addHours(RESET_PASSWORD_HOURS),
    },
  });

  sendEmail({
    to: user.email,
    subject: "Đặt lại mật khẩu — NiChan Events",
    html: resetPasswordTemplate(user.displayName, token),
  }).catch((err) => {
    console.warn("[RESET_PASSWORD_EMAIL_FAILED]", err);
  });

  return { message: successMessage };
};

export const resetPassword = async (input: ResetPasswordInput) => {
  const record = await prisma.passwordResetToken.findUnique({
    where: { token: input.token },
    include: { user: { select: { id: true } } },
  });

  if (!record) {
    throw createError("NOT_FOUND", "Mã đặt lại mật khẩu không hợp lệ", 400);
  }

  if (record.usedAt) {
    throw createError("BAD_REQUEST", "Mã đặt lại mật khẩu đã được sử dụng", 400);
  }

  if (record.expiresAt < new Date()) {
    throw createError("BAD_REQUEST", "Mã đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu gửi lại.", 400);
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
  ]);

  return { message: "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới." };
};

// ─── Consultation Request ─────────────────────────────────────────────────────

const notifyAdminsOfConsultationRequest = async (request: {
  id: string;
  requestCode: string;
  customerName: string;
  eventType: string;
  phone: string;
  email: string;
}) => {
  const admins = await prisma.user.findMany({
    where: { role: "admin", status: "active", deletedAt: null },
    select: { id: true, email: true },
  });

  await Promise.all(
    admins.map(async (admin) => {
      // In-app notification (existing)
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

      // Email notification (new)
      if (admin.email) {
        sendEmail({
          to: admin.email,
          subject: `Yêu cầu tư vấn mới: ${request.requestCode}`,
          html: adminConsultationNotifyTemplate(
            request.requestCode,
            request.customerName,
            request.eventType,
            request.phone,
            request.email,
          ),
        }).catch((err) => {
          console.warn("[ADMIN_CONSULTATION_EMAIL_FAILED]", err);
        });
      }
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

      // Notify admins (in-app + email)
      await notifyAdminsOfConsultationRequest({
        ...request,
        phone: input.phone,
        email: input.email,
      }).catch((error) => {
        console.warn("[CONSULTATION_NOTIFICATION_FAILED]", error);
      });

      // Send confirmation email to customer
      sendEmail({
        to: input.email,
        subject: `Xác nhận yêu cầu tư vấn ${request.requestCode} — NiChan Events`,
        html: consultationReceivedTemplate(
          input.customerName,
          request.requestCode,
          input.eventType,
        ),
      }).catch((err) => {
        console.warn("[CONSULTATION_CONFIRM_EMAIL_FAILED]", err);
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
