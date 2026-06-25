import { useEffect, useRef, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";
import ContractDocument, { type FullContract } from "@/components/features/contracts/ContractDocument";
import { exportContractPdf } from "@/lib/contractPdf";
import { useAuth } from "@/contexts/AuthContext";

const ContractView = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const docRef = useRef<HTMLDivElement>(null);
  const [contract, setContract] = useState<FullContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

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
        setContract(await apiClient.get<FullContract>(path));
      } catch (error) {
        toast.error("Không tải được hợp đồng");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id, user?.role]);

  const handleSavePdf = async () => {
    if (!docRef.current || !contract) return;
    setExporting(true);
    try {
      await exportContractPdf(docRef.current, contract.contractCode);
    } catch (error) {
      toast.error("Không tạo được file PDF");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={isPortalView ? "min-h-full pb-8" : "min-h-screen pt-24 pb-16 bg-surface-low"}>
      <div className={isPortalView ? "mx-auto max-w-[980px]" : "container mx-auto px-6"}>
        <div className="flex items-center justify-between mb-6 max-w-[820px] mx-auto">
          <Link to={backPath} className="flex items-center gap-2 text-muted-foreground font-body text-sm hover:text-primary transition-colors">
            <ArrowLeft size={16} /> Quay lại hợp đồng
          </Link>
          <Button variant="hero" size="sm" onClick={handleSavePdf} disabled={!contract || exporting}>
            <Download size={16} className="mr-1" /> {exporting ? "Đang tạo PDF..." : "Lưu PDF"}
          </Button>
        </div>

        {loading && <p className="text-center font-body text-muted-foreground">Đang tải hợp đồng...</p>}
        {!loading && !contract && <p className="text-center font-body text-muted-foreground">Không tìm thấy hợp đồng.</p>}

        {contract && (
          <div className="shadow-ambient rounded-sm overflow-hidden">
            <ContractDocument ref={docRef} contract={contract} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ContractView;
