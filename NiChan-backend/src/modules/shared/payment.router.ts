// ============================================================
// Payment Router — SePay Integration
// API routes cho thanh toán + webhook endpoint
// ============================================================

import { Request, Response, Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth";
import { p, q } from "../../utils/request";
import { sendSuccess, sendFail } from "../../utils/response";
import {
  createPaymentOrder,
  getPaymentQR,
  getPaymentStatus,
  getPaymentsByEvent,
  getPaymentsByContract,
  getPaymentsByEventOrganizer,
  handleSepayWebhook,
  verifySepayWebhook,
} from "./payment.service";
import type { SepayWebhookPayload, PaymentType } from "./payment.service";

// ─── Webhook Router (không cần auth JWT) ──────────────────────────────────────

export const webhookRouter = Router();

/**
 * POST /api/webhooks/sepay
 * Endpoint nhận webhook từ SePay khi có giao dịch ngân hàng mới
 * 
 * SePay yêu cầu response: HTTP 200 + { success: true }
 * Nếu không respond đúng trong 30s, SePay sẽ retry (tối đa 7 lần)
 */
webhookRouter.post("/sepay", async (req: Request, res: Response) => {
  try {
    // Verify webhook authenticity
    const apiKey =
      req.headers["authorization"]?.replace("Apikey ", "") ||
      req.headers["x-api-key"] as string | undefined;

    const sourceIp =
      (req.headers["x-forwarded-for"] as string) ||
      req.socket.remoteAddress;

    if (!verifySepayWebhook(apiKey, sourceIp)) {
      console.warn("[SePay Webhook] ❌ Auth failed. IP:", sourceIp);
      // Vẫn respond 200 để SePay không retry
      return res.status(200).json({ success: false });
    }

    const payload = req.body as SepayWebhookPayload;

    // Validate payload
    if (!payload || !payload.id || payload.transferAmount === undefined) {
      return res.status(200).json({ success: false });
    }

    const result = await handleSepayWebhook(payload, sourceIp);

    // SePay yêu cầu response { success: true } để không retry
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[SePay Webhook] Error:", error);
    // Vẫn respond 200 để tránh SePay retry liên tục khi lỗi logic
    return res.status(200).json({ success: true });
  }
});

// ─── Customer Payment Router ──────────────────────────────────────────────────

export const customerPaymentRouter = Router();
customerPaymentRouter.use(authenticate, requireRole("customer", "admin"));

/**
 * POST /api/customer/payments
 * Tạo lệnh thanh toán mới (đặt cọc / thanh toán hợp đồng)
 */
customerPaymentRouter.post("/", async (req: Request, res: Response) => {
  const { eventId, contractId, type, amount, description } = req.body;

  if (!type || !amount) {
    return sendFail(res, {
      code: "VALIDATION_ERROR",
      message: "Thiếu thông tin thanh toán (type, amount)",
    });
  }

  const validTypes: PaymentType[] = ["deposit", "contract_payment", "installment"];
  if (!validTypes.includes(type)) {
    return sendFail(res, {
      code: "VALIDATION_ERROR",
      message: "Loại thanh toán không hợp lệ",
    });
  }

  const result = await createPaymentOrder(req.user!.userId, {
    eventId,
    contractId,
    type,
    amount: Number(amount),
    description: description || `Thanh toán ${type === "deposit" ? "đặt cọc" : "hợp đồng"}`,
  });

  sendSuccess(res, { data: result, status: 201 });
});

/**
 * GET /api/customer/payments/:id/qr
 * Lấy thông tin QR code để thanh toán
 */
customerPaymentRouter.get("/:id/qr", async (req: Request, res: Response) => {
  const data = await getPaymentQR(p(req, "id"), req.user!.userId);
  sendSuccess(res, { data });
});

/**
 * GET /api/customer/payments/:id/status
 * Kiểm tra trạng thái thanh toán (dùng cho polling)
 */
customerPaymentRouter.get("/:id/status", async (req: Request, res: Response) => {
  const data = await getPaymentStatus(p(req, "id"), req.user!.userId);
  sendSuccess(res, { data });
});

/**
 * GET /api/customer/events/:eventId/payments
 * Lấy danh sách thanh toán theo sự kiện
 */
customerPaymentRouter.get(
  "/events/:eventId",
  async (req: Request, res: Response) => {
    const data = await getPaymentsByEvent(p(req, "eventId"), req.user!.userId);
    sendSuccess(res, { data });
  },
);

/**
 * GET /api/customer/payments/contract/:contractId
 * Lấy danh sách thanh toán theo hợp đồng
 */
customerPaymentRouter.get(
  "/contract/:contractId",
  async (req: Request, res: Response) => {
    const data = await getPaymentsByContract(p(req, "contractId"), req.user!.userId);
    sendSuccess(res, { data });
  },
);

// ─── Organizer Payment Router ─────────────────────────────────────────────────

export const organizerPaymentRouter = Router();
organizerPaymentRouter.use(authenticate, requireRole("organizer", "admin"));

/**
 * GET /api/organizer/payments/events/:eventId
 * Organizer xem danh sách thanh toán theo sự kiện
 */
organizerPaymentRouter.get(
  "/events/:eventId",
  async (req: Request, res: Response) => {
    const data = await getPaymentsByEventOrganizer(p(req, "eventId"), req.user!.userId);
    sendSuccess(res, { data });
  },
);
