// ============================================================
// PaymentHistory — Hiển thị lịch sử thanh toán
// Danh sách các payment orders với status badges
// ============================================================

import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  RefreshCw,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPaymentsByContract, getPaymentsByEvent } from "@/services/payment";
import type { PaymentOrder } from "@/services/payment";

// ─── Props ────────────────────────────────────────────────────────────────────

interface PaymentHistoryProps {
  contractId?: string;
  eventId?: string;
}

// ─── Status Config ────────────────────────────────────────────────────────────

const statusConfig: Record<
  string,
  { label: string; icon: React.ElementType; className: string }
> = {
  pending: {
    label: "Chờ thanh toán",
    icon: Clock,
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  completed: {
    label: "Đã thanh toán",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  expired: {
    label: "Hết hạn",
    icon: AlertCircle,
    className: "bg-gray-50 text-gray-500 border-gray-200",
  },
  cancelled: {
    label: "Đã hủy",
    icon: XCircle,
    className: "bg-red-50 text-red-600 border-red-200",
  },
};

const typeLabels: Record<string, string> = {
  deposit: "Đặt cọc",
  contract_payment: "Thanh toán hợp đồng",
  installment: "Trả góp",
};

// ─── Component ────────────────────────────────────────────────────────────────

const PaymentHistory = ({ contractId, eventId }: PaymentHistoryProps) => {
  const [payments, setPayments] = useState<PaymentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      let data: PaymentOrder[] = [];
      if (contractId) {
        data = await getPaymentsByContract(contractId);
      } else if (eventId) {
        data = await getPaymentsByEvent(eventId);
      }
      setPayments(data);
    } catch {
      // Silent fail — component will show empty state
    } finally {
      setLoading(false);
    }
  }, [contractId, eventId]);

  useEffect(() => {
    void fetchPayments();
  }, [fetchPayments]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-semibold text-foreground flex items-center gap-2">
            <Banknote size={20} className="text-primary" />
            Lịch sử thanh toán
          </h3>
        </div>
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl bg-surface-low"
          />
        ))}
      </div>
    );
  }

  if (payments.length === 0) {
    return null; // Don't show section if no payments
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg font-semibold text-foreground flex items-center gap-2">
          <Banknote size={20} className="text-primary" />
          Lịch sử thanh toán
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchPayments}
          className="text-muted-foreground hover:text-foreground"
        >
          <RefreshCw size={14} className="mr-1" />
          Làm mới
        </Button>
      </div>

      <div className="space-y-2">
        {payments.map((payment) => {
          const config = statusConfig[payment.status] || statusConfig.pending;
          const StatusIcon = config.icon;

          return (
            <div
              key={payment.id}
              className="flex items-center justify-between rounded-xl border border-border/50 bg-surface-lowest p-4 transition-colors hover:bg-surface-low/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${config.className}`}
                >
                  <StatusIcon size={16} />
                </div>
                <div className="min-w-0">
                  <p className="font-body text-sm font-medium text-foreground truncate">
                    {typeLabels[payment.type] || payment.type}
                  </p>
                  <p className="font-body text-xs text-muted-foreground">
                    {payment.orderCode} •{" "}
                    {new Date(payment.createdAt).toLocaleDateString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0 ml-4">
                <p className="font-body text-sm font-semibold text-foreground">
                  {Number(payment.amount).toLocaleString("vi-VN")}đ
                </p>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-body text-xs font-medium ${config.className}`}
                >
                  <StatusIcon size={10} />
                  {config.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PaymentHistory;
