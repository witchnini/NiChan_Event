import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Calculator,
  Edit2,
  Eye,
  FileText,
  History,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";
import ContractPdfButton from "@/components/features/contracts/ContractPdfButton";

type ContractLineItem = {
  id?: string;
  category: string;
  description?: string | null;
  unit?: string | null;
  quantity: string | number;
  unitPrice: string | number;
  amount?: string | number | null;
  note?: string | null;
};

type ContractVersion = {
  id: string;
  versionLabel: string;
  scopeText?: string;
  paymentTerms?: string;
  generalTerms?: string;
  documentUrl?: string | null;
  createdAt: string;
  lineItems?: ContractLineItem[];
};

type ContractDocument = {
  id: string;
  name: string;
  fileType: string;
  fileUrl: string;
  status: string;
};

type Contract = {
  id: string;
  contractCode: string;
  status: string;
  totalValue: string | number;
  currentVersion: string;
  sentAt?: string | null;
  signedAt?: string | null;
  createdAt?: string | null;
  event?: {
    id: string;
    name: string;
    type?: string | null;
    eventDate?: string | null;
    locationText?: string | null;
    customerUser?: { id?: string; displayName?: string | null } | null;
    consultationRequest?: { customerName?: string | null; eventType?: string | null; note?: string | null } | null;
  } | null;
  customerUser?: { id: string; displayName: string; phone?: string | null; email?: string | null } | null;
  createdBy?: { id: string; displayName: string } | null;
  versions?: ContractVersion[];
  documents?: ContractDocument[];
};

type Project = {
  id: string;
  name: string;
  type: string;
  customerUser?: { id: string; displayName: string } | null;
};

type BudgetItem = {
  id: string;
  category: string;
  estimatedAmount: string | number;
  actualAmount?: string | number;
  status: string;
};

type BudgetResponse = {
  items: BudgetItem[];
};

type LineItemForm = {
  category: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  note: string;
};

type ContractForm = {
  eventId: string;
  customerUserId: string;
  versionLabel: string;
  scopeText: string;
  paymentTerms: string;
  generalTerms: string;
  lineItems: LineItemForm[];
};

const statusList = [
  { label: "Bản nháp", value: "draft" },
  { label: "Đã gửi", value: "sent" },
  { label: "Hiệu lực", value: "active" },
  { label: "Đã thanh lý", value: "liquidated" },
  { label: "Đã hủy", value: "cancelled" },
];

const statusLabel: Record<string, string> = {
  draft: "Bản nháp",
  sent: "Đã gửi",
  active: "Hiệu lực",
  liquidated: "Đã thanh lý",
  cancelled: "Đã hủy",
  completed: "Hoàn thành",
};

const statusColors: Record<string, string> = {
  active: "bg-secondary/10 text-secondary",
  sent: "bg-primary/10 text-primary",
  completed: "bg-muted text-muted-foreground",
  liquidated: "bg-muted text-muted-foreground",
  draft: "bg-surface-high text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

const unitOptions = [
  "gói",
  "buổi",
  "ngày",
  "giờ",
  "khách",
  "người",
  "suất",
  "bàn",
  "bộ",
  "cái",
  "chiếc",
  "m2",
  "m",
  "xe",
  "chuyến",
  "lượt",
  "phòng",
  "đêm",
  "tháng",
];

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const suggestUnitForCategory = (category: string) => {
  const text = normalizeText(category);
  if (!text.trim()) return "gói";

  if (/(catering|thuc don|do an|do uong|tea break|suat|ban tiec)/.test(text)) return "suất";
  if (/(khach|ve moi|dai bieu|tham du|check-in|check in)/.test(text)) return "khách";
  if (/(nhan su|le tan|pg|pb|bao ve|an ninh|ky thuat|mc|host|nhiep anh|quay phim)/.test(text)) return "người";
  if (/(dia diem|sanh|venue|phong hop|studio|mat bang)/.test(text)) return "buổi";
  if (/(xe|van chuyen|di chuyen|logistics|roadshow)/.test(text)) return "chuyến";
  if (/(luu tru|khach san|hotel)/.test(text)) return "đêm";
  if (/(in an|qua tang|posm|thiep|badge|tai lieu|vat pham|backdrop|booth)/.test(text)) return "bộ";
  if (/(tham|vai|decal|san khau|san|dien tich|mat dung)/.test(text)) return "m2";
  if (/(thue thiet bi|loa|mic|micro|den|led|man hinh|camera|ban ghe)/.test(text)) return "cái";
  if (/(livestream|tong duyet|setup|thao do|van hanh|bieu dien|tiet muc)/.test(text)) return "buổi";

  return "gói";
};

const emptyLineItem = (): LineItemForm => ({
  category: "",
  description: "",
  unit: "gói",
  quantity: "1",
  unitPrice: "",
  note: "",
});

const emptyForm = (): ContractForm => ({
  eventId: "",
  customerUserId: "",
  versionLabel: "1.0",
  scopeText: "",
  paymentTerms: "",
  generalTerms: "",
  lineItems: [emptyLineItem()],
});

const money = (value: string | number) => Number(value || 0).toLocaleString("vi-VN") + " đ";

const toNumber = (value: string | number | null | undefined) => Number(value || 0);

const lineAmount = (item: LineItemForm | ContractLineItem) =>
  toNumber(item.quantity) * toNumber(item.unitPrice);

const roundSellingPrice = (value: number) => Math.round(value / 1000) * 1000;

const AdminContracts = () => {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<Contract | null>(null);
  const [viewItem, setViewItem] = useState<Contract | null>(null);
  const [form, setForm] = useState<ContractForm>(emptyForm);
  const [markupPercent, setMarkupPercent] = useState("30");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [budgetLoading, setBudgetLoading] = useState(false);

  const quoteTotal = useMemo(
    () => form.lineItems.reduce((sum, item) => sum + lineAmount(item), 0),
    [form.lineItems],
  );

  const loadContracts = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<Contract[]>("/admin/contracts", {
        search,
        status: filterStatus === "all" ? undefined : filterStatus,
        pageSize: 100,
      });
      setContracts(data);
    } catch (error) {
      toast.error("Không tải được danh sách hợp đồng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadContracts();
  }, [search, filterStatus]);

  const loadProjects = async () => {
    try {
      const data = await apiClient.get<Project[]>("/admin/projects", { pageSize: 100 });
      setProjects(data);
    } catch (error) {
      toast.error("Không tải được danh sách dự án");
    }
  };

  const loadBudgetItems = async (eventId: string) => {
    if (!eventId) {
      setBudgetItems([]);
      return;
    }

    setBudgetLoading(true);
    try {
      const data = await apiClient.get<BudgetResponse>(`/organizer/budgets/${eventId}`);
      setBudgetItems(data.items ?? []);
    } catch (error) {
      setBudgetItems([]);
      toast.error("Không tải được ngân sách nội bộ của dự án");
    } finally {
      setBudgetLoading(false);
    }
  };

  const openCreate = () => {
    setForm(emptyForm());
    setBudgetItems([]);
    setCreateOpen(true);
    void loadProjects();
  };

  const selectProject = (eventId: string) => {
    const project = projects.find((item) => item.id === eventId);
    setForm((current) => ({
      ...current,
      eventId,
      customerUserId: project?.customerUser?.id ?? "",
    }));
    void loadBudgetItems(eventId);
  };

  const updateLineItem = (index: number, patch: Partial<LineItemForm>) => {
    setForm((current) => ({
      ...current,
      lineItems: current.lineItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  };

  const updateLineItemCategory = (index: number, category: string) => {
    setForm((current) => ({
      ...current,
      lineItems: current.lineItems.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const suggestedUnit = suggestUnitForCategory(category);
        const shouldAutoUpdateUnit = !item.unit || item.unit === "gói" || item.unit === suggestUnitForCategory(item.category);
        return {
          ...item,
          category,
          unit: shouldAutoUpdateUnit ? suggestedUnit : item.unit,
        };
      }),
    }));
  };

  const addLineItem = () => {
    setForm((current) => ({ ...current, lineItems: [...current.lineItems, emptyLineItem()] }));
  };

  const removeLineItem = (index: number) => {
    setForm((current) => ({
      ...current,
      lineItems:
        current.lineItems.length === 1
          ? [emptyLineItem()]
          : current.lineItems.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const importBudgetAsQuote = () => {
    if (budgetItems.length === 0) {
      toast.error("Dự án chưa có hạng mục ngân sách để nhập");
      return;
    }

    const markup = Number(markupPercent || 0);
    const multiplier = 1 + markup / 100;
    const nextItems = budgetItems.map((item) => ({
      category: item.category,
      description: "",
      unit: suggestUnitForCategory(item.category),
      quantity: "1",
      unitPrice: String(roundSellingPrice(toNumber(item.estimatedAmount) * multiplier)),
      note: "",
    }));

    setForm((current) => ({ ...current, lineItems: nextItems }));
    toast.success("Đã nhập hạng mục báo giá từ ngân sách nội bộ");
  };

  const normalizedLineItems = () =>
    form.lineItems.map((item) => ({
      category: item.category.trim(),
      description: item.description.trim() || null,
      unit: item.unit.trim() || null,
      quantity: toNumber(item.quantity),
      unitPrice: toNumber(item.unitPrice),
      note: item.note.trim() || null,
    }));

  const validateForm = () => {
    if (!form.eventId || !form.customerUserId) {
      toast.error("Vui lòng chọn dự án/sự kiện");
      return false;
    }

    if (quoteTotal <= 0) {
      toast.error("Tổng báo giá phải lớn hơn 0");
      return false;
    }

    const invalidItem = form.lineItems.find(
      (item) => !item.category.trim() || toNumber(item.quantity) <= 0 || toNumber(item.unitPrice) < 0,
    );
    if (invalidItem) {
      toast.error("Vui lòng kiểm tra hạng mục, số lượng và đơn giá");
      return false;
    }

    if (!form.scopeText.trim() || !form.paymentTerms.trim() || !form.generalTerms.trim()) {
      toast.error("Vui lòng nhập đầy đủ phạm vi, thanh toán và điều khoản chung");
      return false;
    }

    return true;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      await apiClient.post("/admin/contracts", {
        eventId: form.eventId,
        customerUserId: form.customerUserId,
        totalValue: quoteTotal,
        versionLabel: form.versionLabel || "1.0",
        scopeText: form.scopeText,
        paymentTerms: form.paymentTerms,
        generalTerms: form.generalTerms,
        lineItems: normalizedLineItems(),
      });
      toast.success("Đã tạo hợp đồng");
      setCreateOpen(false);
      setForm(emptyForm());
      await loadContracts();
    } catch (error) {
      toast.error("Tạo hợp đồng thất bại");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = async (contract: Contract) => {
    try {
      const detail = await apiClient.get<Contract>(`/admin/contracts/${contract.id}`);
      const latest = detail.versions?.[0];
      const lineItems = latest?.lineItems?.length
        ? latest.lineItems.map((item) => ({
            category: item.category ?? "",
            description: item.description ?? "",
            unit: item.unit ?? "gói",
            quantity: String(item.quantity ?? 1),
            unitPrice: String(item.unitPrice ?? 0),
            note: item.note ?? "",
          }))
        : [{
            ...emptyLineItem(),
            category: "Dịch vụ tổ chức sự kiện",
            unitPrice: String(detail.totalValue ?? ""),
          }];

      setForm({
        eventId: detail.event?.id ?? "",
        customerUserId: detail.customerUser?.id ?? "",
        versionLabel: detail.currentVersion ?? "1.0",
        scopeText: latest?.scopeText ?? "",
        paymentTerms: latest?.paymentTerms ?? "",
        generalTerms: latest?.generalTerms ?? "",
        lineItems,
      });
      setEditItem(detail);
      void loadBudgetItems(detail.event?.id ?? "");
    } catch (error) {
      toast.error("Không tải được chi tiết hợp đồng");
    }
  };

  const handleEdit = async () => {
    if (!editItem || !validateForm()) return;

    setSaving(true);
    try {
      await apiClient.put(`/admin/contracts/${editItem.id}`, {
        totalValue: quoteTotal,
        versionLabel: form.versionLabel,
        scopeText: form.scopeText,
        paymentTerms: form.paymentTerms,
        generalTerms: form.generalTerms,
        lineItems: normalizedLineItems(),
      });
      toast.success("Đã cập nhật hợp đồng");
      setEditItem(null);
      await loadContracts();
    } catch (error) {
      toast.error("Cập nhật hợp đồng thất bại");
    } finally {
      setSaving(false);
    }
  };

  const openView = async (contract: Contract) => {
    setViewItem(contract);
    try {
      const detail = await apiClient.get<Contract>(`/admin/contracts/${contract.id}`);
      setViewItem(detail);
    } catch (error) {
      // Giữ dữ liệu đang có trên dòng bảng.
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.del(`/admin/contracts/${id}`);
      toast.success("Đã xóa hợp đồng");
      await loadContracts();
    } catch (error) {
      toast.error("Xóa hợp đồng thất bại");
    }
  };

  const handleSend = async (contract: Contract) => {
    try {
      await apiClient.patch(`/admin/contracts/${contract.id}/send`);
      toast.success(`Đã gửi hợp đồng ${contract.contractCode}`);
      await loadContracts();
    } catch (error) {
      toast.error("Chỉ có thể gửi hợp đồng ở trạng thái bản nháp");
    }
  };

  const renderLineItemEditor = () => (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-low p-3 md:flex-row md:items-end">
        <div className="w-full md:w-36">
          <label className="mb-1 block font-body text-sm text-foreground">Markup (%)</label>
          <Input
            type="number"
            min={0}
            value={markupPercent}
            onChange={(event) => setMarkupPercent(event.target.value)}
            className="rounded-lg border-none bg-surface-lowest font-body"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={importBudgetAsQuote}
          disabled={budgetLoading || !form.eventId}
          className="rounded-lg"
        >
          <Calculator size={16} /> {budgetLoading ? "Đang tải..." : "Nhập từ ngân sách"}
        </Button>
        <p className="font-body text-xs text-muted-foreground">
          {budgetItems.length > 0 ? `${budgetItems.length} hạng mục nội bộ sẵn sàng` : "Chưa có dữ liệu ngân sách"}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-[820px] w-full border-collapse text-sm">
          <thead className="bg-surface-low">
            <tr>
              <th className="px-3 py-2 text-left font-body font-semibold">Hạng mục</th>
              <th className="px-3 py-2 text-left font-body font-semibold">Mô tả</th>
              <th className="w-24 px-3 py-2 text-left font-body font-semibold">SL</th>
              <th className="w-24 px-3 py-2 text-left font-body font-semibold">Đơn vị</th>
              <th className="w-36 px-3 py-2 text-left font-body font-semibold">Đơn giá bán</th>
              <th className="w-36 px-3 py-2 text-right font-body font-semibold">Thành tiền</th>
              <th className="w-12 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {form.lineItems.map((item, index) => (
              <tr key={index} className="border-t border-border">
                <td className="px-3 py-2 align-top">
                  <Input
                    value={item.category}
                    onChange={(event) => updateLineItemCategory(index, event.target.value)}
                    placeholder="Hạng mục dịch vụ"
                    className="h-9 rounded-lg border-none bg-surface-lowest font-body"
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <Input
                    value={item.description}
                    onChange={(event) => updateLineItem(index, { description: event.target.value })}
                    placeholder="Mô tả gửi khách"
                    className="h-9 rounded-lg border-none bg-surface-lowest font-body"
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.quantity}
                    onChange={(event) => updateLineItem(index, { quantity: event.target.value })}
                    className="h-9 rounded-lg border-none bg-surface-lowest font-body"
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <Select value={item.unit || "gói"} onValueChange={(value) => updateLineItem(index, { unit: value })}>
                    <SelectTrigger className="h-9 rounded-lg border-none bg-surface-lowest font-body">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {unitOptions.map((unit) => (
                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2 align-top">
                  <Input
                    type="number"
                    min={0}
                    value={item.unitPrice}
                    onChange={(event) => updateLineItem(index, { unitPrice: event.target.value })}
                    className="h-9 rounded-lg border-none bg-surface-lowest font-body"
                  />
                </td>
                <td className="px-3 py-2 text-right align-middle font-body font-semibold">
                  {money(lineAmount(item))}
                </td>
                <td className="px-2 py-2 align-top">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-destructive"
                    onClick={() => removeLineItem(index)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" size="sm" onClick={addLineItem} className="rounded-lg">
          <Plus size={14} /> Thêm hạng mục
        </Button>
        <div className="text-right font-body">
          <p className="text-xs text-muted-foreground">Tổng giá trị báo khách</p>
          <p className="text-lg font-bold text-foreground">{money(quoteTotal)}</p>
        </div>
      </div>
    </div>
  );

  const renderContractForm = (mode: "create" | "edit") => (
    <div className="space-y-5">
      {mode === "create" ? (
        <div>
          <label className="mb-1 block font-body text-sm text-foreground">Dự án / Sự kiện *</label>
          <Select value={form.eventId} onValueChange={selectProject}>
            <SelectTrigger className="rounded-lg">
              <SelectValue placeholder="Chọn dự án" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name} - {project.customerUser?.displayName ?? "Chưa có khách hàng"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="rounded-lg bg-surface-low px-3 py-2">
          <p className="font-body text-xs text-muted-foreground">Sự kiện</p>
          <p className="font-body text-sm font-semibold text-foreground">{editItem?.event?.name ?? "-"}</p>
        </div>
      )}

      <div>
        <label className="mb-1 block font-body text-sm text-foreground">Phiên bản *</label>
        <Input
          value={form.versionLabel}
          onChange={(event) => setForm((current) => ({ ...current, versionLabel: event.target.value }))}
          placeholder="1.0"
          className="rounded-lg border-none bg-surface-lowest font-body"
        />
      </div>

      <div>
        <label className="mb-1 block font-body text-sm text-foreground">Bảng báo giá gửi khách *</label>
        {renderLineItemEditor()}
      </div>

      <div>
        <label className="mb-1 block font-body text-sm text-foreground">Phạm vi công việc *</label>
        <Textarea
          value={form.scopeText}
          onChange={(event) => setForm((current) => ({ ...current, scopeText: event.target.value }))}
          rows={3}
          className="rounded-lg border-none bg-surface-lowest font-body"
        />
      </div>
      <div>
        <label className="mb-1 block font-body text-sm text-foreground">Điều khoản thanh toán *</label>
        <Textarea
          value={form.paymentTerms}
          onChange={(event) => setForm((current) => ({ ...current, paymentTerms: event.target.value }))}
          rows={3}
          className="rounded-lg border-none bg-surface-lowest font-body"
        />
      </div>
      <div>
        <label className="mb-1 block font-body text-sm text-foreground">Điều khoản chung *</label>
        <Textarea
          value={form.generalTerms}
          onChange={(event) => setForm((current) => ({ ...current, generalTerms: event.target.value }))}
          rows={3}
          className="rounded-lg border-none bg-surface-lowest font-body"
        />
      </div>
      {mode === "edit" && (
        <p className="font-body text-xs text-muted-foreground">
          Lưu thay đổi nội dung hoặc bảng báo giá sẽ tạo một phiên bản hợp đồng mới.
        </p>
      )}
    </div>
  );

  const latestLineItems = viewItem?.versions?.[0]?.lineItems ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-serif text-headline-lg text-foreground">Quản lý hợp đồng</h1>
          <p className="font-body text-sm text-muted-foreground">
            {loading ? "Đang tải..." : `${contracts.length} hợp đồng`}
          </p>
        </div>
        <Button variant="hero" size="sm" onClick={openCreate}>
          <Plus size={16} /> Tạo hợp đồng
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo số HĐ, sự kiện..."
            className="rounded-lg border-none bg-surface-lowest pl-10 font-body"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[{ label: "Tất cả", value: "all" }, ...statusList].map((status) => (
            <button
              key={status.value}
              onClick={() => setFilterStatus(status.value)}
              className={`rounded-lg px-3 py-2 font-body text-sm transition-all ${
                filterStatus === status.value
                  ? "gradient-primary text-primary-foreground"
                  : "bg-surface-lowest text-muted-foreground hover:text-foreground"
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="overflow-hidden rounded-lg bg-surface-lowest shadow-ambient"
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-low">
              <TableHead>Số HĐ</TableHead>
              <TableHead>Sự kiện</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead>Giá trị</TableHead>
              <TableHead>Ngày gửi</TableHead>
              <TableHead>Phiên bản</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && contracts.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center font-body text-sm text-muted-foreground">
                  Chưa có hợp đồng nào
                </TableCell>
              </TableRow>
            )}
            {contracts.map((contract) => (
              <TableRow key={contract.id} className="hover:bg-surface-low/50">
                <TableCell className="font-body text-sm font-semibold text-primary">{contract.contractCode}</TableCell>
                <TableCell className="font-body text-sm text-foreground">{contract.event?.name ?? "-"}</TableCell>
                <TableCell className="font-body text-sm text-foreground">{contract.customerUser?.displayName ?? "-"}</TableCell>
                <TableCell className="font-body text-sm font-semibold text-foreground">{money(contract.totalValue)}</TableCell>
                <TableCell className="font-body text-sm text-foreground">
                  {contract.sentAt ? new Date(contract.sentAt).toLocaleDateString("vi-VN") : "-"}
                </TableCell>
                <TableCell className="font-body text-sm text-muted-foreground">v{contract.currentVersion}</TableCell>
                <TableCell>
                  <span className={`rounded-full px-3 py-1 font-body text-xs font-semibold ${statusColors[contract.status] ?? "bg-muted text-muted-foreground"}`}>
                    {statusLabel[contract.status] ?? contract.status}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => navigate(`/admin/hop-dong/${contract.id}`)}
                      title="Xem bản đầy đủ"
                    >
                      <Eye size={14} />
                    </Button>
                    <ContractPdfButton
                      contract={contract}
                      detailPath={`/admin/contracts/${contract.id}`}
                      variant="ghost"
                      size="icon"
                      label=""
                      className="h-8 w-8 rounded-lg"
                    />
                    {contract.status === "draft" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => handleSend(contract)}
                        title="Gửi khách"
                      >
                        <Send size={14} />
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                          <MoreHorizontal size={14} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/admin/hop-dong/${contract.id}`)}>
                          <Eye size={12} className="mr-2" /> Xem bản đầy đủ
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openView(contract)}>
                          <FileText size={12} className="mr-2" /> Xem nhanh
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(contract)}>
                          <Edit2 size={12} className="mr-2" /> Chỉnh sửa
                        </DropdownMenuItem>
                        {contract.status === "draft" && (
                          <DropdownMenuItem onClick={() => handleSend(contract)}>
                            <Send size={12} className="mr-2" /> Gửi khách hàng
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDelete(contract.id)} className="text-destructive">
                          <Trash2 size={12} className="mr-2" /> Xóa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </motion.div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="font-serif">Tạo hợp đồng mới</DialogTitle>
          </DialogHeader>
          {renderContractForm("create")}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button variant="hero" onClick={handleCreate} disabled={saving}>
              {saving ? "Đang lưu..." : "Tạo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="font-serif">Chỉnh sửa hợp đồng {editItem?.contractCode}</DialogTitle>
          </DialogHeader>
          {renderContractForm("edit")}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Hủy</Button>
            <Button variant="hero" onClick={handleEdit} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-serif">Hợp đồng {viewItem?.contractCode}</DialogTitle>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-4 font-body text-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-low">
                  <FileText size={22} className="text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{viewItem.event?.name ?? "-"}</p>
                  <p className="text-muted-foreground">
                    {viewItem.customerUser?.displayName ?? "-"}
                    {viewItem.customerUser?.phone ? ` - ${viewItem.customerUser.phone}` : ""}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-muted-foreground">Giá trị</p>
                  <p className="font-semibold text-foreground">{money(viewItem.totalValue)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phiên bản</p>
                  <p className="text-foreground">v{viewItem.currentVersion}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Trạng thái</p>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[viewItem.status] ?? "bg-muted text-muted-foreground"}`}>
                    {statusLabel[viewItem.status] ?? viewItem.status}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground">Ngày gửi</p>
                  <p className="text-foreground">{viewItem.sentAt ? new Date(viewItem.sentAt).toLocaleDateString("vi-VN") : "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ngày ký</p>
                  <p className="text-foreground">{viewItem.signedAt ? new Date(viewItem.signedAt).toLocaleDateString("vi-VN") : "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Người tạo</p>
                  <p className="text-foreground">{viewItem.createdBy?.displayName ?? "-"}</p>
                </div>
              </div>

              {latestLineItems.length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="mb-2 text-muted-foreground">Bảng báo giá khách</p>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="min-w-[620px] w-full border-collapse text-xs">
                      <thead className="bg-surface-low">
                        <tr>
                          <th className="px-3 py-2 text-left">Hạng mục</th>
                          <th className="px-3 py-2 text-center">SL</th>
                          <th className="px-3 py-2 text-center">Đơn vị</th>
                          <th className="px-3 py-2 text-right">Đơn giá</th>
                          <th className="px-3 py-2 text-right">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latestLineItems.map((item, index) => (
                          <tr key={item.id ?? index} className="border-t border-border">
                            <td className="px-3 py-2">
                              <p className="font-semibold">{item.category}</p>
                              {item.description && <p className="text-muted-foreground">{item.description}</p>}
                            </td>
                            <td className="px-3 py-2 text-center">{toNumber(item.quantity).toLocaleString("vi-VN")}</td>
                            <td className="px-3 py-2 text-center">{item.unit || "-"}</td>
                            <td className="px-3 py-2 text-right">{money(item.unitPrice)}</td>
                            <td className="px-3 py-2 text-right font-semibold">{money(item.amount ?? lineAmount(item))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {viewItem.versions?.[0] && (
                <div className="space-y-3 border-t border-border pt-3">
                  <div>
                    <p className="mb-1 text-muted-foreground">Phạm vi công việc</p>
                    <p className="whitespace-pre-wrap text-foreground">{viewItem.versions[0].scopeText || "-"}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-muted-foreground">Điều khoản thanh toán</p>
                    <p className="whitespace-pre-wrap text-foreground">{viewItem.versions[0].paymentTerms || "-"}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-muted-foreground">Điều khoản chung</p>
                    <p className="whitespace-pre-wrap text-foreground">{viewItem.versions[0].generalTerms || "-"}</p>
                  </div>
                </div>
              )}

              {viewItem.versions && viewItem.versions.length > 1 && (
                <div className="border-t border-border pt-3">
                  <p className="mb-2 flex items-center gap-1 text-muted-foreground">
                    <History size={12} /> Lịch sử phiên bản
                  </p>
                  <div className="space-y-1">
                    {viewItem.versions.map((version) => (
                      <div key={version.id} className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground">v{version.versionLabel}</span>
                        <span className="text-muted-foreground">{new Date(version.createdAt).toLocaleString("vi-VN")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewItem(null)}>Đóng</Button>
            {viewItem && (
              <ContractPdfButton
                contract={viewItem}
                detailPath={`/admin/contracts/${viewItem.id}`}
                variant="outline"
                label="Tải PDF"
              />
            )}
            {viewItem?.status === "draft" && (
              <Button
                variant="hero"
                onClick={() => {
                  if (viewItem) void handleSend(viewItem);
                  setViewItem(null);
                }}
              >
                <Send size={14} className="mr-1" /> Gửi khách
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminContracts;
