import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import ContractDocument, { type FullContract } from "./ContractDocument";
import { exportContractPdf, getContractPdfErrorMessage } from "@/lib/contractPdf";
import { apiClient } from "@/services/apiClient";

type Props = {
  contract?: FullContract;
  label?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  detailPath?: string;
  title?: string;
};

/**
 * Nút mở bản hợp đồng đầy đủ trong modal (xem trước) kèm nút tải PDF.
 * Dùng chung cho mọi vai trò (khách, organizer, admin).
 * Để label = "" để hiển thị dạng icon-only (dùng trong bảng/danh sách).
 *
 * Lưu ý: html2canvas cần phần tử hiển thị trong viewport mới chụp đúng,
 * nên bản hợp đồng được render hiển thị trong modal (không render ẩn ngoài màn hình).
 */
const ContractPdfButton = ({
  contract,
  label = "Xem / Tải PDF",
  variant = "hero",
  size = "sm",
  className,
  detailPath,
  title,
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [previewContract, setPreviewContract] = useState<FullContract | null>(contract ?? null);
  const [open, setOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (contract) setPreviewContract(contract);
  }, [contract]);

  const handleOpen = async () => {
    if (!detailPath) {
      if (!contract) {
        toast.error("Không có dữ liệu hợp đồng để tải PDF");
        return;
      }
      setPreviewContract(contract);
      setOpen(true);
      return;
    }

    setLoadingDetail(true);
    try {
      const detail = await apiClient.get<FullContract>(detailPath);
      setPreviewContract(detail);
      setOpen(true);
    } catch (error) {
      toast.error("Không tải được bản hợp đồng đầy đủ");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleExport = async () => {
    if (!ref.current || !previewContract) return;
    setExporting(true);
    try {
      await exportContractPdf(ref.current, previewContract.contractCode);
      toast.success("Đã lưu hợp đồng PDF");
    } catch (error) {
      console.error("Không tạo được file hợp đồng PDF:", error);
      toast.error(getContractPdfErrorMessage(error), { duration: 10_000 });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleOpen}
        disabled={loadingDetail || (!contract && !detailPath)}
        title={title || label || "Xem / Tải hợp đồng"}
      >
        <Download size={16} className={label ? "mr-1" : ""} /> {label && (loadingDetail ? "Đang tải..." : label)}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Hợp đồng {previewContract?.contractCode ?? ""}</DialogTitle>
          </DialogHeader>

          {previewContract && (
            <div className="border border-border rounded-sm overflow-hidden bg-white">
              <ContractDocument ref={ref} contract={previewContract} />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Đóng</Button>
            <Button variant="hero" onClick={handleExport} disabled={exporting}>
              <Download size={16} className="mr-1" /> {exporting ? "Đang tạo PDF..." : "Tải PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ContractPdfButton;
