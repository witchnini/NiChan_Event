import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { FileText, Eye, CheckCircle, Download, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import SectionHeading from "@/components/ui/section-heading";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";
import { getContractStatusLabel, getEventDisplayName } from "@/lib/eventDisplay";

type Contract = {
  id: string;
  contractCode: string;
  status: string;
  totalValue: string | number;
  currentVersion: string;
  sentAt?: string | null;
  signedAt?: string | null;
  event?: {
    id: string;
    name: string;
    type?: string | null;
    customerUser?: { displayName: string } | null;
    consultationRequest?: { customerName?: string | null; eventType?: string | null; note?: string | null } | null;
  } | null;
  versions?: { scopeText?: string; paymentTerms?: string; generalTerms?: string }[];
  transactions?: { id: string; amount: string | number; status: string; paymentMethod?: string | null }[];
};

const money = (value: string | number) => Number(value || 0).toLocaleString("vi-VN") + "đ";
const billableStatuses = new Set(["sent", "active", "liquidated"]);

const contractPaid = (contract: Contract) =>
  (contract.transactions ?? [])
    .filter((transaction) => transaction.status === "completed")
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

const contractPending = (contract: Contract) =>
  (contract.transactions ?? [])
    .filter((transaction) => transaction.status === "pending" && transaction.paymentMethod)
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

const contractSelectablePending = (contract: Contract) =>
  (contract.transactions ?? [])
    .filter((transaction) => transaction.status === "pending" && !transaction.paymentMethod)
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

const contractOutstanding = (contract: Contract) =>
  Math.max(Number(contract.totalValue || 0) - contractPaid(contract) - contractPending(contract), 0);

const MyContracts = () => {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setContracts(await apiClient.get<Contract[]>("/customer/contracts"));
      } catch (error) {
        toast.error("Không tải được hợp đồng");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const openContract = (contract: Contract) => navigate(`/dashboard/hop-dong/${contract.id}`);
  const openPayment = (contract: Contract) => {
    if (!contract.event?.id) return;
    navigate(`/dashboard/su-kien/${contract.event.id}?tab=payment&contractId=${contract.id}`);
  };
  const canPay = (contract: Contract) =>
    Boolean(contract.event?.id) &&
    billableStatuses.has(contract.status) &&
    (contractOutstanding(contract) > 0 || contractSelectablePending(contract) > 0);

  return (
    <div className="min-h-screen pt-24 pb-16">
      <section className="py-12 bg-surface-low">
        <div className="container mx-auto px-6">
          <SectionHeading label="Hợp đồng" title="Hợp đồng của tôi" subtitle="Xem và tải các hợp đồng dịch vụ đã được lưu trong hệ thống." />
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-6 max-w-4xl space-y-6">
          {loading && <p className="font-body text-muted-foreground">Đang tải hợp đồng...</p>}
          {!loading && contracts.length === 0 && <p className="font-body text-muted-foreground">Chưa có hợp đồng nào.</p>}
          {contracts.map((contract, i) => (
            <motion.div
              key={contract.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-surface-lowest rounded-xl border border-border/60 p-5 shadow-ambient transition-shadow hover:shadow-ambient-lg md:p-6"
            >
              <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_220px] md:items-start">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-low">
                    <FileText size={22} className="text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-serif font-semibold text-foreground">
                      {contract.event ? getEventDisplayName(contract.event) : "Hợp đồng"}
                    </h3>
                    <p className="mt-1 font-body text-sm text-muted-foreground">
                      Số HĐ: {contract.contractCode} - Phiên bản: {contract.currentVersion}
                    </p>
                    <p className="font-body text-sm text-muted-foreground">
                      Ngày gửi: {contract.sentAt ? new Date(contract.sentAt).toLocaleDateString("vi-VN") : "-"}
                    </p>
                  </div>
                </div>

                <div className="md:border-l md:border-border md:pl-5 md:text-right">
                  <p className="font-serif text-headline-md font-bold text-foreground">{money(contract.totalValue)}</p>
                  <p className="mt-1 font-body text-xs text-muted-foreground">Còn lại: {money(contractOutstanding(contract))}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-3 py-1 font-body text-xs font-semibold text-secondary">
                    <CheckCircle size={12} /> {getContractStatusLabel(contract.status)}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                {canPay(contract) && (
                  <Button
                    variant="hero"
                    size="sm"
                    className="w-full rounded-xl sm:w-auto sm:min-w-[132px]"
                    onClick={() => openPayment(contract)}
                  >
                    <CreditCard size={16} /> Thanh toán
                  </Button>
                )}
                <div className="grid w-full grid-cols-2 gap-1 rounded-xl bg-surface-low p-1 sm:w-[232px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 rounded-lg px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => openContract(contract)}
                  >
                    <Eye size={16} /> Xem
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 rounded-lg px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => openContract(contract)}
                  >
                    <Download size={16} /> PDF
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default MyContracts;
