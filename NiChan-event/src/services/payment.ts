// ============================================================
// Payment API — SePay Integration (Frontend)
// API calls + hooks cho thanh toán
// ============================================================

import { apiClient } from "./apiClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentType = "deposit" | "contract_payment" | "installment";
export type PaymentStatus = "pending" | "completed" | "expired" | "cancelled";

export interface PaymentOrder {
  id: string;
  orderCode: string;
  eventId?: string | null;
  contractId?: string | null;
  type: PaymentType;
  amount: string | number;
  status: PaymentStatus;
  description: string;
  qrContent?: string | null;
  paidAt?: string | null;
  expiredAt?: string | null;
  createdAt: string;
  updatedAt: string;
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

export interface CreatePaymentResult {
  paymentOrder: PaymentOrder;
  qr: PaymentQRInfo;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

/**
 * Tạo lệnh thanh toán mới
 */
export const createPayment = async (data: {
  eventId?: string;
  contractId?: string;
  type: PaymentType;
  amount: number;
  description?: string;
}): Promise<CreatePaymentResult> =>
  apiClient.post<CreatePaymentResult>("/customer/payments", data);

/**
 * Lấy thông tin QR code thanh toán
 */
export const getPaymentQR = async (paymentId: string): Promise<PaymentQRInfo> =>
  apiClient.get<PaymentQRInfo>(`/customer/payments/${paymentId}/qr`);

/**
 * Kiểm tra trạng thái thanh toán
 */
export const getPaymentStatus = async (paymentId: string): Promise<PaymentOrder> =>
  apiClient.get<PaymentOrder>(`/customer/payments/${paymentId}/status`);

/**
 * Lấy danh sách thanh toán theo sự kiện
 */
export const getPaymentsByEvent = async (eventId: string): Promise<PaymentOrder[]> =>
  apiClient.get<PaymentOrder[]>(`/customer/payments/events/${eventId}`);

/**
 * Lấy danh sách thanh toán theo hợp đồng
 */
export const getPaymentsByContract = async (contractId: string): Promise<PaymentOrder[]> =>
  apiClient.get<PaymentOrder[]>(`/customer/payments/contract/${contractId}`);
