import { useEffect, useRef, useState } from "react";
import { useParams, Link, useLocation, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, FileText, ClipboardCheck, MessageSquare, CreditCard, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";
import ContractDocument, { type FullContract } from "@/components/features/contracts/ContractDocument";
import { exportContractPdf, getContractPdfErrorMessage } from "@/lib/contractPdf";
import { useAuth } from "@/contexts/AuthContext";
import PaymentQRModal from "@/components/features/payment/PaymentQRModal";
import PaymentHistory from "@/components/features/payment/PaymentHistory";
import { useCreatePayment } from "@/hooks/usePayment";
import type { PaymentQRInfo } from "@/services/payment";

type VersionPurpose = "original" | "settlement";
type ContractWithFeedback = FullContract & {
  respondedAt?: string | null;
  rejectionNote?: string | null;
  updatedAt?: string | null;
};

const ContractView = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const docRef = useRef<HTMLDivElement>(null);
  const [contract, setContract] = useState<ContractWithFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [viewPurpose, setViewPurpose] = useState<VersionPurpose>(
    (searchParams.get("view") as VersionPurpose) || "original",
  );

  // Payment states
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);
  const [currentQRInfo, setCurrentQRInfo] = useState<PaymentQRInfo | null>(null);
  const { create: createPayment, loading: paymentLoading } = useCreatePayment();

  const isPortalView = location.pathname.startsWith("/admin") || location.pathname.startsWith("/ban-to-chuc");
  const backPath =
    user?.role === "admin"
      ? "/admin/hop-dong"
      : user?.role === "organizer"
        ? "/ban-to-chuc/du-an"
        : "/dashboard/hop-dong";

  useEffect(() => {
    const load = async () => {
      if (!id || !user?.role) return;
      setLoading(true);
      try {
        const path =
          user.role === "admin"
            ? `/admin/contracts/${id}`
            : user.role === "organizer"
              ? `/organizer/contracts/${id}`
              : `/customer/contracts/${id}`;
        const data = await apiClient.get<ContractWithFeedback>(path);
        setContract(data);

        // Auto-select settlement view if URL param says so, or if only settlement exists
        const hasSettlement = data.versions?.some((v) => v.purpose === "settlement");
        const hasOriginal = data.versions?.some((v) => (v.purpose ?? "original") === "original");
        if (searchParams.get("view") === "settlement" && hasSettlement) {
          setViewPurpose("settlement");
        } else if (!hasOriginal && hasSettlement) {
          setViewPurpose("settlement");
        }
      } catch (error) {
        toast.error("Không tải được hợp đồng");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id, user?.role, searchParams]);

  const hasSettlement = contract?.versions?.some((v) => v.purpose === "settlement") ?? false;
  const hasOriginal = contract?.versions?.some((v) => (v.purpose ?? "original") === "original") ?? false;
  const showToggle = hasSettlement && hasOriginal;
  const adminFeedbackNote = user?.role === "admin" ? contract?.rejectionNote?.trim() : "";

  const handleSavePdf = async () => {
    if (!docRef.current || !contract) return;
    setExporting(true);
    try {
      const suffix = viewPurpose === "settlement" ? "_quyet-toan" : "";
      await exportContractPdf(docRef.current, contract.contractCode + suffix);
      toast.success("Đã lưu hợp đồng PDF");
    } catch (error) {
      console.error("Không tạo được file hợp đồng PDF:", error);
      toast.error(getContractPdfErrorMessage(error), { duration: 10_000 });
    } finally {
      setExporting(false);
    }
  };

  // Payment: kiểm tra hợp đồng có thể thanh toán
  const canPay =
    user?.role === "customer" &&
    contract &&
    ["sent", "active"].includes(contract.status);

  const handlePayment = async () => {
    if (!contract) return;
    try {
      const totalValue = Number(contract.totalValue || 0);
      const type = contract.status === "sent" ? "deposit" : "contract_payment";
      const amount = type === "deposit" ? Math.round(totalValue * 0.3) : totalValue;
      const desc =
        type === "deposit"
          ? `Đặt cọc hợp đồng ${contract.contractCode}`
          : `Thanh toán hợp đồng ${contract.contractCode}`;

      const result = await createPayment({
        contractId: contract.id,
        eventId: contract.event?.id,
        type,
        amount,
        description: desc,
      });

      setCurrentPaymentId(result.paymentOrder.id);
      setCurrentQRInfo(result.qr);
      setPaymentModalOpen(true);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Không thể tạo lệnh thanh toán");
    }
  };

  return (
    <div className={isPortalView ? "min-h-full pb-8" : "min-h-screen pt-24 pb-16 bg-surface-low"}>
      <div className={isPortalView ? "mx-auto max-w-[980px]" : "container mx-auto px-6"}>
        <div className="flex items-center justify-between mb-6 max-w-[820px] mx-auto">
          <Link to={backPath} className="flex items-center gap-2 text-muted-foreground font-body text-sm hover:text-primary transition-colors">
            <ArrowLeft size={16} /> Quay lại hợp đồng
          </Link>
          <div className="flex items-center gap-2">
            {canPay && (
              <Button
                variant="hero"
                size="sm"
                onClick={handlePayment}
                disabled={paymentLoading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <CreditCard size={16} className="mr-1" />
                {paymentLoading
                  ? "Đang tạo..."
                  : contract?.status === "sent"
                    ? "Đặt cọc"
                    : "Thanh toán"}
              </Button>
            )}
            <Button variant="hero" size="sm" onClick={handleSavePdf} disabled={!contract || exporting}>
              <Download size={16} className="mr-1" /> {exporting ? "Đang tạo PDF..." : "Lưu PDF"}
            </Button>
          </div>
        </div>

        {showToggle && (
          <div className="flex justify-center mb-6">
            <div className="inline-flex rounded-xl bg-surface-low p-1 gap-1">
              <button
                onClick={() => setViewPurpose("original")}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 font-body text-sm font-medium transition-all ${
                  viewPurpose === "original"
                    ? "bg-surface-lowest text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText size={16} /> Hợp đồng gốc
              </button>
              <button
                onClick={() => setViewPurpose("settlement")}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 font-body text-sm font-medium transition-all ${
                  viewPurpose === "settlement"
                    ? "bg-surface-lowest text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ClipboardCheck size={16} /> Biên bản quyết toán
              </button>
            </div>
          </div>
        )}

        {adminFeedbackNote && contract && (
          <div className="mb-6 max-w-[820px] mx-auto rounded-xl border border-destructive/20 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <MessageSquare size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-body text-sm font-semibold text-destructive">
                    {contract.status === "cancelled" ? "Phản hồi từ khách hàng trước khi hủy" : "Phản hồi từ khách hàng"}
                  </p>
                  {(contract.respondedAt || contract.updatedAt) && (
                    <span className="font-body text-xs text-muted-foreground">
                      {new Date(contract.respondedAt ?? contract.updatedAt ?? "").toLocaleDateString("vi-VN")}
                    </span>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words font-body text-sm leading-relaxed text-foreground">
                  {adminFeedbackNote}
                </p>
              </div>
            </div>
          </div>
        )}

        {loading && <p className="text-center font-body text-muted-foreground">Đang tải hợp đồng...</p>}
        {!loading && !contract && <p className="text-center font-body text-muted-foreground">Không tìm thấy hợp đồng.</p>}

        {contract && (
          <div className="shadow-ambient rounded-sm overflow-hidden">
            <ContractDocument ref={docRef} contract={contract} versionPurpose={viewPurpose} />
          </div>
        )}

        {/* Payment History */}
        {contract && user?.role === "customer" && (
          <div className="max-w-[820px] mx-auto mt-8">
            <PaymentHistory contractId={contract.id} />
          </div>
        )}
      </div>

      {/* Payment QR Modal */}
      <PaymentQRModal
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        paymentOrderId={currentPaymentId}
        qrInfo={currentQRInfo}
        onCompleted={() => {
          toast.success("Thanh toán thành công!");
        }}
      />
    </div>
  );
};

export default ContractView;
