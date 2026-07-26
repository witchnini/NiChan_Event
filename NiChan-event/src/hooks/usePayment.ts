// ============================================================
// usePayment Hook — SePay Integration
// Custom hooks cho thanh toán với polling trạng thái
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createPayment,
  getPaymentQR,
  getPaymentStatus,
  getPaymentsByEvent,
  getPaymentsByContract,
} from "@/services/payment";
import type {
  PaymentOrder,
  PaymentQRInfo,
  PaymentType,
  CreatePaymentResult,
} from "@/services/payment";

// ─── useCreatePayment ─────────────────────────────────────────────────────────

interface CreatePaymentInput {
  eventId?: string;
  contractId?: string;
  type: PaymentType;
  amount: number;
  description?: string;
}

export const useCreatePayment = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreatePaymentResult | null>(null);

  const create = useCallback(async (input: CreatePaymentInput) => {
    setLoading(true);
    setError(null);
    try {
      const data = await createPayment(input);
      setResult(data);
      return data;
    } catch (err: any) {
      const message = err?.message || "Không thể tạo lệnh thanh toán";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { create, loading, error, result };
};

// ─── usePaymentStatus (with polling) ──────────────────────────────────────────

interface UsePaymentStatusOptions {
  paymentId: string | null;
  /** Polling interval in ms (default: 5000) */
  pollInterval?: number;
  /** Stop polling when payment is completed */
  stopOnComplete?: boolean;
  /** Callback khi thanh toán thành công */
  onCompleted?: (order: PaymentOrder) => void;
}

export const usePaymentStatus = ({
  paymentId,
  pollInterval = 5000,
  stopOnComplete = true,
  onCompleted,
}: UsePaymentStatusOptions) => {
  const [status, setStatus] = useState<PaymentOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;

  const checkStatus = useCallback(async () => {
    if (!paymentId) return;
    try {
      const data = await getPaymentStatus(paymentId);
      setStatus(data);

      if (data.status === "completed" && onCompletedRef.current) {
        onCompletedRef.current(data);
      }

      // Stop polling if completed/expired/cancelled
      if (
        stopOnComplete &&
        ["completed", "expired", "cancelled"].includes(data.status)
      ) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }

      return data;
    } catch (err) {
      console.error("[usePaymentStatus] Error:", err);
    }
  }, [paymentId, stopOnComplete]);

  // Start polling
  useEffect(() => {
    if (!paymentId) return;

    setLoading(true);

    // Initial check
    checkStatus().then(() => setLoading(false));

    // Start interval
    intervalRef.current = setInterval(checkStatus, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [paymentId, pollInterval, checkStatus]);

  const refetch = useCallback(() => {
    checkStatus();
  }, [checkStatus]);

  return { status, loading, refetch };
};

// ─── usePaymentHistory ────────────────────────────────────────────────────────

export const usePaymentHistory = (
  eventId?: string | null,
  contractId?: string | null,
) => {
  const [payments, setPayments] = useState<PaymentOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!eventId && !contractId) return;
    setLoading(true);
    try {
      let data: PaymentOrder[];
      if (contractId) {
        data = await getPaymentsByContract(contractId);
      } else if (eventId) {
        data = await getPaymentsByEvent(eventId);
      } else {
        data = [];
      }
      setPayments(data);
    } catch (err) {
      console.error("[usePaymentHistory] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [eventId, contractId]);

  useEffect(() => {
    load();
  }, [load]);

  return { payments, loading, refetch: load };
};
