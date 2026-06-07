import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Download, Eye, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [viewItem, setViewItem] = useState<Contract | null>(null);
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

  const handleDownload = (contract: Contract) => {
    toast.success(`Đang tải hợp đồng ${contract.contractCode}...`);
  };

  return (
    <div className="min-h-screen pt-24 pb-16">
      <section className="py-12 bg-surface-low">
        <div className="container mx-auto px-6">
          <SectionHeading label="Hợp đồng" title="Hợp đồng của tôi" subtitle="Xem các hợp đồng dịch vụ đã được lưu trong hệ thống." />
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
                    <Button variant="ghost" size="icon" onClick={() => setViewItem(contract)}><Eye size={18} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDownload(contract)}><Download size={18} /></Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-serif">Hợp đồng {viewItem?.contractCode}</DialogTitle></DialogHeader>
          {viewItem && (
            <div className="space-y-4 font-body text-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-surface-low flex items-center justify-center"><FileText size={22} className="text-primary" /></div>
                <div>
                  <p className="font-semibold text-foreground text-base">{viewItem.event ? getEventDisplayName(viewItem.event) : "Hợp đồng"}</p>
                  <p className="text-muted-foreground">Phiên bản {viewItem.currentVersion}</p>
                </div>
              </div>
              <div className="bg-surface-low rounded-xl p-4 space-y-3">
                <div><p className="text-muted-foreground font-semibold">Phạm vi</p><p className="text-foreground">{viewItem.versions?.[0]?.scopeText ?? "-"}</p></div>
                <div><p className="text-muted-foreground font-semibold">Thanh toán</p><p className="text-foreground">{viewItem.versions?.[0]?.paymentTerms ?? "-"}</p></div>
                <div><p className="text-muted-foreground font-semibold">Điều khoản</p><p className="text-foreground">{viewItem.versions?.[0]?.generalTerms ?? "-"}</p></div>
              </div>
              <div className="flex items-center justify-between">
                <p className="font-serif font-bold text-lg text-foreground">{money(viewItem.totalValue)}</p>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-secondary/10 text-secondary">{getContractStatusLabel(viewItem.status)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewItem(null)}>Đóng</Button>
            <Button variant="hero" onClick={() => { if (viewItem) handleDownload(viewItem); }}><Download size={14} className="mr-1" /> Tải PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyContracts;
