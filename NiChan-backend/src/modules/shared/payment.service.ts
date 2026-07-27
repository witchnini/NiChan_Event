// ============================================================
// Payment Service — SePay Integration
// Xử lý tạo lệnh thanh toán, QR code, và webhook từ SePay
// ============================================================

import { prisma } from "../../lib/prisma";
import { createError } from "../../middleware/errorHandler";
import { emitNotification } from "../../lib/socket";
import { env } from "../../config/env";
import crypto from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentType = "deposit" | "contract_payment" | "installment";
export type PaymentStatus = "pending" | "completed" | "expired" | "cancelled";

export interface CreatePaymentOrderInput {
  eventId?: string;
  contractId?: string;
  type: PaymentType;
  amount: number;
  description: string;
}

export interface SepayWebhookPayload {
  id: number;
  gateway: string;
  transactionDate: string;
  accountNumber: string;
  subAccount: string | null;
  code: string;
  content: string;
  transferType: "in" | "out";
  description: string;
  transferAmount: number;
  accumulated: number;
  referenceCode: string;
}

export interface PaymentQRInfo {
  qrUrl: string;
  bankAccount: string;
  bankCode: string;
  accountHolder: string;
  amount: number;
  content: string;
  orderCode: string;
}

// ─── SePay IP Whitelist (để verify webhook) ───────────────────────────────────

const SEPAY_WHITELIST_IPS = [
  "172.236.138.20",
  "172.233.83.68",
  "171.244.35.2",
  "151.158.108.68",
  "151.158.109.79",
  "103.255.238.139",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Tạo mã thanh toán unique: NC + 8 ký tự
 * Format ngắn gọn, không dấu, dễ nhận diện trong nội dung chuyển khoản
 */
const generateOrderCode = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `NC${code}`;
};

/**
 * Tạo VietQR URL để hiển thị mã QR chuyển khoản
 */
const buildQRUrl = (amount: number, content: string): string => {
  const params = new URLSearchParams({
    acc: env.sepayBankAccount,
    bank: env.sepayBankCode,
    amount: String(amount),
    des: content,
    template: "compact",
  });
  return `https://qr.sepay.vn/img?${params.toString()}`;
};

/**
 * Xóa dấu tiếng Việt để so sánh nội dung chuyển khoản
 */
const removeVietnameseTones = (str: string): string => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
};

/**
 * Tìm orderCode trong nội dung chuyển khoản
 * Pattern: NC + 8 ký tự
 */
const extractOrderCode = (content: string): string | null => {
  const normalized = removeVietnameseTones(content).toUpperCase();
  const match = normalized.match(/NC[A-Z0-9]{8}/);
  return match ? match[0] : null;
};

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Tạo lệnh thanh toán mới (đặt cọc / thanh toán hợp đồng)
 */
export const createPaymentOrder = async (
  userId: string,
  input: CreatePaymentOrderInput,
) => {
  const { eventId, contractId, type, amount, description } = input;

  if (amount <= 0) {
    throw createError("INVALID_AMOUNT", "Số tiền thanh toán phải lớn hơn 0", 400);
  }

  // Validate event/contract ownership
  if (contractId) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, customerUserId: userId },
    });
    if (!contract) {
      throw createError("NOT_FOUND", "Không tìm thấy hợp đồng", 404);
    }
    if (!["sent", "active", "liquidated"].includes(contract.status)) {
      throw createError(
        "INVALID_STATUS",
        "Hợp đồng không ở trạng thái có thể thanh toán",
        400,
      );
    }
  }

  if (eventId) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, customerUserId: userId },
    });
    if (!event) {
      throw createError("NOT_FOUND", "Không tìm thấy sự kiện", 404);
    }
  }

  // Check for existing pending payment with same contract
  if (contractId) {
    const existingPending = await prisma.paymentOrder.findFirst({
      where: {
        contractId,
        status: "pending",
        type,
      },
    });
    if (existingPending) {
      // Return existing pending order instead of creating a new one
      return {
        paymentOrder: existingPending,
        qr: buildQRInfo(existingPending),
      };
    }
  }

  const orderCode = generateOrderCode();
  const qrContent = orderCode;

  // Set expiry to 24 hours from now
  const expiredAt = new Date();
  expiredAt.setHours(expiredAt.getHours() + 24);

  const paymentOrder = await prisma.paymentOrder.create({
    data: {
      orderCode,
      eventId: eventId || undefined,
      contractId: contractId || undefined,
      type,
      amount,
      status: "pending",
      description,
      qrContent,
      expiredAt,
    },
  });

  return {
    paymentOrder,
    qr: buildQRInfo(paymentOrder),
  };
};

/**
 * Build QR info from a payment order
 */
const buildQRInfo = (paymentOrder: {
  orderCode: string;
  amount: any;
  qrContent: string;
}): PaymentQRInfo => {
  const amount = Number(paymentOrder.amount);
  return {
    qrUrl: buildQRUrl(amount, paymentOrder.qrContent),
    bankAccount: env.sepayBankAccount,
    bankCode: env.sepayBankCode,
    accountHolder: env.sepayAccountHolder,
    amount,
    content: paymentOrder.qrContent,
    orderCode: paymentOrder.orderCode,
  };
};

/**
 * Lấy thông tin QR code cho một payment order
 */
export const getPaymentQR = async (paymentOrderId: string, userId: string) => {
  const paymentOrder = await prisma.paymentOrder.findUnique({
    where: { id: paymentOrderId },
    include: {
      contract: { select: { customerUserId: true } },
      event: { select: { customerUserId: true } },
    },
  });

  if (!paymentOrder) {
    throw createError("NOT_FOUND", "Không tìm thấy lệnh thanh toán", 404);
  }

  // Verify ownership (skip if no linked entity — standalone order)
  const ownerUserId =
    paymentOrder.contract?.customerUserId ||
    paymentOrder.event?.customerUserId;
  if (ownerUserId && ownerUserId !== userId) {
    throw createError("FORBIDDEN", "Bạn không có quyền xem lệnh thanh toán này", 403);
  }

  return buildQRInfo(paymentOrder);
};

/**
 * Kiểm tra trạng thái thanh toán
 */
export const getPaymentStatus = async (
  paymentOrderId: string,
  userId: string,
) => {
  const paymentOrder = await prisma.paymentOrder.findUnique({
    where: { id: paymentOrderId },
    include: {
      contract: { select: { customerUserId: true } },
      event: { select: { customerUserId: true } },
    },
  });

  if (!paymentOrder) {
    throw createError("NOT_FOUND", "Không tìm thấy lệnh thanh toán", 404);
  }

  // Verify ownership (skip if no linked entity — standalone order)
  const ownerUserId =
    paymentOrder.contract?.customerUserId ||
    paymentOrder.event?.customerUserId;
  if (ownerUserId && ownerUserId !== userId) {
    throw createError("FORBIDDEN", "Bạn không có quyền xem lệnh thanh toán này", 403);
  }

  // Auto-expire if past expiry time
  if (
    paymentOrder.status === "pending" &&
    paymentOrder.expiredAt &&
    new Date() > paymentOrder.expiredAt
  ) {
    await prisma.paymentOrder.update({
      where: { id: paymentOrderId },
      data: { status: "expired" },
    });
    return { ...paymentOrder, status: "expired" };
  }

  return paymentOrder;
};

/**
 * Lấy danh sách thanh toán theo sự kiện (cho customer)
 */
export const getPaymentsByEvent = async (
  eventId: string,
  userId: string,
) => {
  // Verify event ownership
  const event = await prisma.event.findFirst({
    where: { id: eventId, customerUserId: userId },
  });
  if (!event) {
    throw createError("NOT_FOUND", "Không tìm thấy sự kiện", 404);
  }

  return prisma.paymentOrder.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Lấy danh sách thanh toán theo hợp đồng (cho customer)
 */
export const getPaymentsByContract = async (
  contractId: string,
  userId: string,
) => {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, customerUserId: userId },
  });
  if (!contract) {
    throw createError("NOT_FOUND", "Không tìm thấy hợp đồng", 404);
  }

  return prisma.paymentOrder.findMany({
    where: { contractId },
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Organizer xem thanh toán theo sự kiện
 */
export const getPaymentsByEventOrganizer = async (
  eventId: string,
  userId: string,
) => {
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      organizerUserId: userId,
      organizerAssignmentStatus: "accepted",
    },
  });
  if (!event) {
    throw createError("NOT_FOUND", "Không tìm thấy sự kiện", 404);
  }

  return prisma.paymentOrder.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
  });
};

// ─── Webhook Handler ──────────────────────────────────────────────────────────

/**
 * Xử lý webhook từ SePay khi có giao dịch ngân hàng
 *
 * Flow:
 * 1. Kiểm tra trùng lặp (sepayTransId)
 * 2. Tìm orderCode trong nội dung chuyển khoản
 * 3. Tìm PaymentOrder tương ứng
 * 4. Cập nhật PaymentOrder status = completed
 * 5. Tạo Transaction record
 * 6. Gửi notification cho customer + organizer
 */
export const handleSepayWebhook = async (
  payload: SepayWebhookPayload,
  sourceIp: string | undefined,
) => {
  console.log(
    "[SePay Webhook] Received:",
    JSON.stringify(payload),
  );

  // 1. Chống trùng lặp — kiểm tra sepayTransId đã xử lý chưa
  const existingTx = await prisma.paymentOrder.findFirst({
    where: { sepayTransId: payload.id },
  });
  if (existingTx) {
    console.log(`[SePay Webhook] Duplicate: sepayTransId=${payload.id}`);
    return { status: "duplicate" };
  }

  // 2. Chỉ xử lý tiền VÀO
  if (payload.transferType !== "in") {
    console.log(`[SePay Webhook] Skipped: transferType=${payload.transferType}`);
    return { status: "skipped" };
  }

  // 3. Tìm orderCode trong nội dung chuyển khoản
  const orderCode = extractOrderCode(payload.content);

  // 4. Tìm PaymentOrder
  const paymentOrder = orderCode
    ? await prisma.paymentOrder.findUnique({
        where: { orderCode },
        include: {
          contract: {
            select: {
              id: true,
              customerUserId: true,
              eventId: true,
              status: true,
              totalValue: true,
              event: {
                select: {
                  organizerUserId: true,
                },
              },
            },
          },
          event: {
            select: {
              id: true,
              customerUserId: true,
              organizerUserId: true,
              name: true,
            },
          },
        },
      })
    : null;

  if (!paymentOrder) {
    console.log(
      `[SePay Webhook] PaymentOrder not found for orderCode: ${orderCode || "N/A"}`,
    );
    // Lưu giao dịch unmatched để admin review sau
    await prisma.transaction.create({
      data: {
        description: `[Unmatched] ${payload.description || payload.content}`,
        amount: payload.transferAmount,
        transactionDate: new Date(payload.transactionDate),
        paymentMethod: "bank_transfer",
        status: "pending",
        sepayTransId: payload.id,
        referenceCode: payload.referenceCode,
        gateway: payload.gateway,
      },
    });
    return { status: "unmatched", orderCode };
  }

  // 5. Kiểm tra PaymentOrder đã completed/cancelled chưa
  if (paymentOrder.status !== "pending") {
    console.log(
      `[SePay Webhook] PaymentOrder ${orderCode} already ${paymentOrder.status}`,
    );
    return { status: "already_processed" };
  }

  // 6. Transaction trong prisma — atomic update
  const result = await prisma.$transaction(async (tx) => {
    // Cập nhật PaymentOrder
    const updated = await tx.paymentOrder.update({
      where: { id: paymentOrder.id },
      data: {
        status: "completed",
        sepayTransId: payload.id,
        paidAt: new Date(),
      },
    });

    // Tạo Transaction record
    const transaction = await tx.transaction.create({
      data: {
        eventId: paymentOrder.eventId,
        contractId: paymentOrder.contractId,
        description: `Thanh toán ${paymentOrder.type === "deposit" ? "đặt cọc" : "hợp đồng"} — ${orderCode}`,
        amount: payload.transferAmount,
        transactionDate: new Date(payload.transactionDate),
        paymentMethod: "bank_transfer",
        status: "completed",
        sepayTransId: payload.id,
        referenceCode: payload.referenceCode,
        gateway: payload.gateway,
        paymentOrderId: paymentOrder.id,
      },
    });

    return { paymentOrder: updated, transaction };
  });

  console.log(
    `[SePay Webhook] ✅ Matched & completed: orderCode=${orderCode}, amount=${payload.transferAmount}`,
  );

  // 7. Gửi notification cho customer
  const customerUserId =
    paymentOrder.contract?.customerUserId ||
    paymentOrder.event?.customerUserId;

  if (customerUserId) {
    emitNotification(customerUserId, {
      type: "payment_completed",
      title: "Thanh toán thành công",
      message: `Đã nhận ${payload.transferAmount.toLocaleString("vi-VN")}đ cho mã ${orderCode}`,
      data: {
        paymentOrderId: paymentOrder.id,
        orderCode,
        amount: payload.transferAmount,
      },
    });
  }

  // 8. Gửi notification cho organizer
  const organizerUserId =
    (paymentOrder.contract as any)?.event?.organizerUserId ||
    paymentOrder.event?.organizerUserId;

  if (organizerUserId) {
    emitNotification(organizerUserId, {
      type: "payment_received",
      title: "Nhận thanh toán mới",
      message: `Khách hàng đã thanh toán ${payload.transferAmount.toLocaleString("vi-VN")}đ — ${orderCode}`,
      data: {
        paymentOrderId: paymentOrder.id,
        orderCode,
        amount: payload.transferAmount,
      },
    });
  }

  return { status: "completed", orderCode };
};

// ─── Webhook Verification ─────────────────────────────────────────────────────

/**
 * Verify SePay webhook authenticity
 */
export const verifySepayWebhook = (
  apiKey: string | undefined,
  sourceIp: string | undefined,
): boolean => {
  // Method 1: API Key verification (highest priority)
  if (env.sepayWebhookApiKey && apiKey) {
    return apiKey === env.sepayWebhookApiKey;
  }

  // Dev mode: allow all requests (before IP check, since localhost = ::1)
  if (env.isDevelopment) {
    console.warn("[SePay Webhook] ⚠️ Dev mode: skipping auth verification");
    return true;
  }

  // Method 2: IP whitelist (production fallback)
  if (sourceIp) {
    // Handle x-forwarded-for format
    const ip = sourceIp.split(",")[0].trim();
    return SEPAY_WHITELIST_IPS.includes(ip);
  }

  return false;
};
