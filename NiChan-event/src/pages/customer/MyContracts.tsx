import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { FileText, Eye, CheckCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import SectionHeading from "@/components/SectionHeading";
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
};

const money = (value: string | number) => Number(value || 0).toLocaleString("vi-VN") + "đ";

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
            <motion.div key={contract.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-surface-low flex items-center justify-center shrink-0"><FileText size={22} className="text-primary" /></div>
                  <div>
                    <h3 className="font-serif text-foreground font-semibold">{contract.event ? getEventDisplayName(contract.event) : "Hợp đồng"}</h3>
                    <p className="font-body text-sm text-muted-foreground mt-1">Số HĐ: {contract.contractCode} - Phiên bản: {contract.currentVersion}</p>
                    <p className="font-body text-sm text-muted-foreground">Ngày gửi: {contract.sentAt ? new Date(contract.sentAt).toLocaleDateString("vi-VN") : "-"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-serif font-bold text-foreground">{money(contract.totalValue)}</p>
                    <span className="inline-flex items-center gap-1 text-xs font-body font-semibold text-secondary"><CheckCircle size={12} /> {getContractStatusLabel(contract.status)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openContract(contract)}><Eye size={16} className="mr-1" /> Xem</Button>
                    <Button variant="hero" size="sm" onClick={() => openContract(contract)}><Download size={16} className="mr-1" /> Tải PDF</Button>
                  </div>
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
