// ============================================================
// PaymentQRModal — Hiển thị QR Code thanh toán SePay
// Modal cho khách hàng quét mã chuyển khoản
// ============================================================

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  CheckCircle2,
  Copy,
  Clock,
  Loader2,
  QrCode,
  Banknote,
  Building2,
  User,
  FileText,
  XCircle,
} from "lucide-react";
import { usePaymentStatus } from "@/hooks/usePayment";
import type { PaymentQRInfo, PaymentOrder } from "@/services/payment";

// ─── Props ────────────────────────────────────────────────────────────────────

interface PaymentQRModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentOrderId: string | null;
  qrInfo: PaymentQRInfo | null;
  onCompleted?: (order: PaymentOrder) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const PaymentQRModal = ({
  open,
  onOpenChange,
  paymentOrderId,
  qrInfo,
  onCompleted,
}: PaymentQRModalProps) => {
  const [showSuccess, setShowSuccess] = useState(false);

  const { status } = usePaymentStatus({
    paymentId: open ? paymentOrderId : null,
    pollInterval: 5000,
    stopOnComplete: true,
    onCompleted: (order) => {
      setShowSuccess(true);
      onCompleted?.(order);
    },
  });

  // Reset success state when modal closes
  useEffect(() => {
    if (!open) {
      setShowSuccess(false);
    }
  }, [open]);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Đã copy ${label}`);
    } catch {
      toast.error("Không thể copy");
    }
  };

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat("vi-VN").format(amount) + "đ";

  if (!qrInfo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
        {/* Success State */}
        {showSuccess || status?.status === "completed" ? (
          <div className="flex flex-col items-center justify-center py-16 px-8">
            <div className="relative mb-6">
              <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30 w-20 h-20" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/25">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2 font-heading">
              Thanh toán thành công!
            </h3>
            <p className="text-muted-foreground text-center font-body text-sm leading-relaxed max-w-[300px]">
              Giao dịch {formatMoney(qrInfo.amount)} đã được xác nhận tự động.
              Hệ thống đã cập nhật trạng thái thanh toán.
            </p>
            <Button
              onClick={() => onOpenChange(false)}
              className="mt-8 px-8 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-body font-medium transition-colors cursor-pointer"
            >
              Đóng
            </Button>
          </div>
        ) : status?.status === "expired" ? (
          /* Expired State */
          <div className="flex flex-col items-center justify-center py-16 px-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/25 mb-6">
              <XCircle className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2 font-heading">
              Lệnh thanh toán hết hạn
            </h3>
            <p className="text-muted-foreground text-center font-body text-sm">
              Vui lòng tạo lệnh thanh toán mới.
            </p>
            <Button
              onClick={() => onOpenChange(false)}
              className="mt-8 px-8 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-body font-medium transition-colors cursor-pointer"
            >
              Đóng
            </Button>
          </div>
        ) : (
          /* Payment State */
          <>
            <DialogHeader className="px-6 pt-6 pb-0">
              <DialogTitle className="flex items-center gap-2 font-heading text-lg">
                <QrCode className="h-5 w-5 text-primary" />
                Thanh toán chuyển khoản
              </DialogTitle>
              <DialogDescription className="font-body text-sm">
                Quét mã QR bằng app ngân hàng hoặc chuyển khoản thủ công
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-6 pt-4 space-y-5">
              {/* QR Code */}
              <div className="relative mx-auto w-fit">
                <div className="rounded-2xl border-2 border-primary/10 bg-white p-3 shadow-lg shadow-primary/5">
                  <img
                    src={qrInfo.qrUrl}
                    alt="QR Code thanh toán"
                    className="w-[260px] h-auto rounded-lg"
                    loading="eager"
                  />
                </div>
                {/* Polling indicator */}
                <div className="absolute -top-2 -right-2 flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-2.5 py-1">
                  <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                  <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 font-body">
                    Đang chờ
                  </span>
                </div>
              </div>

              {/* Bank Info */}
              <div className="space-y-2.5 rounded-xl bg-muted/50 p-4">
                <InfoRow
                  icon={<Building2 className="h-4 w-4" />}
                  label="Ngân hàng"
                  value={qrInfo.bankCode}
                />
                <InfoRow
                  icon={<FileText className="h-4 w-4" />}
                  label="Số tài khoản"
                  value={qrInfo.bankAccount}
                  copyable
                  onCopy={() => handleCopy(qrInfo.bankAccount, "số tài khoản")}
                />
                <InfoRow
                  icon={<User className="h-4 w-4" />}
                  label="Chủ tài khoản"
                  value={qrInfo.accountHolder}
                />
                <InfoRow
                  icon={<Banknote className="h-4 w-4" />}
                  label="Số tiền"
                  value={formatMoney(qrInfo.amount)}
                  highlight
                />

                <div className="pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span className="text-xs font-body">Nội dung CK</span>
                    </div>
                    <button
                      onClick={() => handleCopy(qrInfo.content, "nội dung CK")}
                      className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium font-body">Copy</span>
                    </button>
                  </div>
                  <div className="mt-1.5 rounded-lg bg-primary/5 border border-primary/10 px-3 py-2">
                    <code className="text-sm font-mono font-semibold text-primary tracking-wide">
                      {qrInfo.content}
                    </code>
                  </div>
                </div>
              </div>

              {/* Notice */}
              <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/30 px-3 py-2.5">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300 font-body leading-relaxed">
                  Hệ thống sẽ <strong>tự động xác nhận</strong> sau khi nhận được
                  chuyển khoản. Vui lòng giữ nguyên nội dung chuyển khoản.
                </p>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ─── InfoRow ──────────────────────────────────────────────────────────────────

const InfoRow = ({
  icon,
  label,
  value,
  copyable,
  onCopy,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  copyable?: boolean;
  onCopy?: () => void;
  highlight?: boolean;
}) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2 text-muted-foreground">
      {icon}
      <span className="text-xs font-body">{label}</span>
    </div>
    <div className="flex items-center gap-1.5">
      <span
        className={`text-sm font-body ${
          highlight
            ? "font-bold text-emerald-600 dark:text-emerald-400"
            : "font-medium text-foreground"
        }`}
      >
        {value}
      </span>
      {copyable && onCopy && (
        <button
          onClick={onCopy}
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  </div>
);

export default PaymentQRModal;
