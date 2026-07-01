import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Edit2,
  FileSignature,
  MoreHorizontal,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  WalletCards,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getEventDisplayName, getEventStatusColor, getEventStatusLabel } from "@/lib/eventDisplay";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

type EventRef = {
  id: string;
  name: string;
  type?: string | null;
  status?: string | null;
  eventDate?: string | null;
  customerUser?: { id: string; displayName: string } | null;
  consultationRequest?: {
    customerName?: string | null;
    eventType?: string | null;
    note?: string | null;
  } | null;
};

type ProjectFinance = EventRef & {
  budgetEstimated: number;
  budgetPlanned: number;
  budgetActual: number;
  totalCollected: number;
  pendingCollection: number;
  totalContractValue: number;
  receivable: number;
  profit: number;
  margin: number;
  collectionRate: number;
  contractCount: number;
};

type MonthlyPL = { month: string; revenue: number; expenses: number; profit: number };

type Expense = {
  id: string;
  category: string;
  actualAmount: string | number;
  estimatedAmount: string | number;
  status: string;
  updatedAt: string;
  vendor?: { id: string; name: string } | null;
  projectBudget?: { id: string; name: string; event?: EventRef | null } | null;
};

type FinanceContract = {
  id: string;
  contractCode: string;
  status: string;
  totalValue: string | number;
  collectedAmount: number;
  pendingAmount: number;
  outstandingAmount: number;
  currentVersion: string;
  paymentTerms?: string | null;
  sentAt?: string | null;
  signedAt?: string | null;
  event?: EventRef | null;
  customerUser?: { id: string; displayName: string; phone?: string | null; email?: string | null } | null;
};

type Transaction = {
  id: string;
  eventId?: string | null;
  contractId?: string | null;
  description: string;
  amount: string | number;
  transactionDate: string;
  paymentMethod?: string | null;
  status: string;
  event?: EventRef | null;
  contract?: { id: string; contractCode: string; totalValue: string | number; status: string; eventId: string } | null;
};

type Project = EventRef;

type PaymentPlan = {
  key: string;
  name: string;
  ratios: number[];
};

type PaymentTemplate = {
  value: string;
  description: string;
  amount: number;
  planName: string;
};

const moneyShort = (value: number) => {
  const amount = Math.abs(Number(value || 0));
  const sign = Number(value || 0) < 0 ? "-" : "";
  if (amount >= 1_000_000_000) return `${sign}${(amount / 1_000_000_000).toFixed(1)} tỷ`;
  if (amount >= 1_000_000) return `${sign}${Math.round(amount / 1_000_000)}tr`;
  return `${sign}${Math.round(amount).toLocaleString("vi-VN")}đ`;
};

const money = (value: string | number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "-";

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const getDisplayName = (event?: EventRef | null) =>
  event ? getEventDisplayName(event) : "-";

const txStatusList = [
  { label: "Chờ xử lý", value: "pending" },
  { label: "Hoàn thành", value: "completed" },
  { label: "Đã hủy", value: "cancelled" },
];

const txStatusLabel: Record<string, string> = {
  pending: "Chờ xử lý",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

const txStatusColors: Record<string, string> = {
  completed: "bg-secondary/10 text-secondary",
  pending: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
};

const contractStatusLabel: Record<string, string> = {
  draft: "Nháp",
  sent: "Đã gửi",
  active: "Hiệu lực",
  liquidated: "Đã thanh lý",
  cancelled: "Đã hủy",
};

const emptyTxForm = {
  eventId: "",
  contractId: "",
  description: "",
  amount: "",
  transactionDate: "",
  paymentMethod: "",
  status: "pending",
};

const toDatetimeLocal = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const defaultPaymentPlans: PaymentPlan[] = [
  { key: "two-installments", name: "2 đợt 50/50", ratios: [50, 50] },
  { key: "three-installments", name: "3 đợt 50/30/20", ratios: [50, 30, 20] },
];

const parseRatio = (value: string) => Number(value.replace(",", "."));

const isValidPaymentRatios = (ratios: number[]) => {
  if (ratios.length < 2 || ratios.length > 3) return false;
  const total = ratios.reduce((sum, ratio) => sum + ratio, 0);
  return ratios.every((ratio) => ratio > 0 && ratio < 100) && Math.abs(total - 100) <= 1;
};

const ratioKey = (ratios: number[]) =>
  ratios.map((ratio) => Number(ratio.toFixed(2))).join("-");

const parsePaymentRatios = (paymentTerms?: string | null) => {
  if (!paymentTerms) return [];
  const percentRatios = [...paymentTerms.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)]
    .map((match) => parseRatio(match[1]));
  if (isValidPaymentRatios(percentRatios)) return percentRatios;

  const sequenceMatch = paymentTerms.match(
    /(?:^|[^\d])(\d+(?:[.,]\d+)?(?:\s*[-/+]\s*\d+(?:[.,]\d+)?){1,2})(?:%|[^\d]|$)/,
  );
  if (!sequenceMatch) return [];

  const sequenceRatios = sequenceMatch[1].split(/\s*[-/+]\s*/).map(parseRatio);
  return isValidPaymentRatios(sequenceRatios) ? sequenceRatios : [];
};

const formatPercent = (value: number) =>
  Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

const installmentAmount = (totalValue: number, ratios: number[], index: number) => {
  if (index === ratios.length - 1) {
    const previous = ratios
      .slice(0, index)
      .reduce((sum, ratio) => sum + Math.round((totalValue * ratio) / 100), 0);
    return Math.max(totalValue - previous, 0);
  }
  return Math.round((totalValue * ratios[index]) / 100);
};

const buildPaymentTemplates = (contract?: FinanceContract | null): PaymentTemplate[] => {
  if (!contract) return [];

  const plans: PaymentPlan[] = [];
  const contractRatios = parsePaymentRatios(contract.paymentTerms);
  if (contractRatios.length) {
    plans.push({ key: "contract-terms", name: "Theo điều khoản HĐ", ratios: contractRatios });
  }

  const seen = new Set(plans.map((plan) => ratioKey(plan.ratios)));
  for (const plan of defaultPaymentPlans) {
    const key = ratioKey(plan.ratios);
    if (!seen.has(key)) {
      plans.push(plan);
      seen.add(key);
    }
  }

  const totalValue = Number(contract.totalValue || 0);
  return plans.flatMap((plan) =>
    plan.ratios.map((ratio, index) => {
      const description = `Đợt ${index + 1} (${formatPercent(ratio)}%)`;
      return {
        value: `${plan.key}-${index}`,
        description,
        amount: installmentAmount(totalValue, plan.ratios, index),
        planName: plan.name,
      };
    }),
  );
};

const AdminFinance = () => {
  const [projectFinance, setProjectFinance] = useState<ProjectFinance[]>([]);
  const [monthlyPL, setMonthlyPL] = useState<MonthlyPL[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [contracts, setContracts] = useState<FinanceContract[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txFilter, setTxFilter] = useState("all");
  const [txSearch, setTxSearch] = useState("");
  const [txEventFilter, setTxEventFilter] = useState("all");
  const [txContractFilter, setTxContractFilter] = useState("all");
  const [txLoading, setTxLoading] = useState(true);

  const [projects, setProjects] = useState<Project[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<Transaction | null>(null);
  const [form, setForm] = useState(emptyTxForm);
  const [paymentTemplate, setPaymentTemplate] = useState("manual");
  const [saving, setSaving] = useState(false);

  const loadDashboard = async () => {
    setDashboardLoading(true);
    try {
      const [projectsData, pl, expenseItems, contractItems] = await Promise.all([
        apiClient.get<ProjectFinance[]>("/admin/finance/project-summary"),
        apiClient.get<MonthlyPL[]>("/admin/finance/monthly-pl"),
        apiClient.get<Expense[]>("/admin/finance/expenses"),
        apiClient.get<FinanceContract[]>("/admin/finance/contracts"),
      ]);
      setProjectFinance(projectsData);
      setMonthlyPL(pl.map((item) => ({ ...item, expenses: item.expenses ?? 0 })));
      setExpenses(expenseItems);
      setContracts(contractItems);
    } catch {
      toast.error("Không tải được dữ liệu tài chính");
    } finally {
      setDashboardLoading(false);
    }
  };

  const loadTransactions = async () => {
    setTxLoading(true);
    try {
      const data = await apiClient.get<Transaction[]>("/admin/transactions", {
        search: txSearch.trim() || undefined,
        eventId: txEventFilter === "all" ? undefined : txEventFilter,
        contractId: txContractFilter === "all" ? undefined : txContractFilter,
        status: txFilter === "all" ? undefined : txFilter,
        pageSize: 100,
      });
      setTransactions(data);
    } catch {
      toast.error("Không tải được danh sách giao dịch");
    } finally {
      setTxLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTransactions();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [txFilter, txSearch, txEventFilter, txContractFilter]);

  const loadProjects = async () => {
    if (projects.length) return;
    try {
      const data = await apiClient.get<Project[]>("/admin/projects", { pageSize: 100 });
      setProjects(data);
    } catch {
      toast.error("Không tải được danh sách dự án");
    }
  };

  const projectOptions = projects.length ? projects : projectFinance;

  const billableContracts = useMemo(
    () => contracts.filter((contract) => ["sent", "active", "liquidated"].includes(contract.status)),
    [contracts],
  );

  const contractsWithReceivable = useMemo(
    () => billableContracts.filter((contract) => Number(contract.outstandingAmount || 0) > 0),
    [billableContracts],
  );

  const totals = useMemo(() => {
    const revenue = projectFinance.reduce((sum, project) => sum + Number(project.totalCollected || 0), 0);
    const expense = projectFinance.reduce((sum, project) => sum + Number(project.budgetActual || 0), 0);
    const receivable = projectFinance.reduce((sum, project) => sum + Number(project.receivable || 0), 0);
    const pending = projectFinance.reduce((sum, project) => sum + Number(project.pendingCollection || 0), 0);
    const contractValue = billableContracts.reduce((sum, contract) => sum + Number(contract.totalValue || 0), 0);
    return { revenue, expense, receivable, pending, contractValue, profit: revenue - expense };
  }, [projectFinance, billableContracts]);

  const collectionRate = totals.contractValue
    ? Math.min(100, Math.round((totals.revenue / totals.contractValue) * 100))
    : 0;

  const expenseBreakdown = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const expense of expenses) {
      const amount = Number(expense.actualAmount || 0);
      byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + amount);
    }
    const total = [...byCategory.values()].reduce((sum, value) => sum + value, 0);
    return [...byCategory.entries()]
      .map(([category, amount]) => ({
        category,
        amount,
        percent: total ? Math.round((amount / total) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const projectChartData = useMemo(
    () =>
      projectFinance
        .map((project) => ({
          name: getDisplayName(project),
          revenue: Number(project.totalCollected || 0),
          expenses: Number(project.budgetActual || 0),
          receivable: Number(project.receivable || 0),
        }))
        .sort((a, b) => b.revenue + b.receivable - (a.revenue + a.receivable))
        .slice(0, 6),
    [projectFinance],
  );

  const filteredContractsForForm = useMemo(
    () =>
      contracts.filter(
        (contract) =>
          !form.eventId ||
          contract.event?.id === form.eventId ||
          contract.id === form.contractId,
      ),
    [contracts, form.eventId, form.contractId],
  );

  const filteredContractsForFilter = useMemo(
    () =>
      contracts.filter(
        (contract) => txEventFilter === "all" || contract.event?.id === txEventFilter,
      ),
    [contracts, txEventFilter],
  );

  const selectedFormContract = useMemo(
    () => contracts.find((contract) => contract.id === form.contractId) ?? null,
    [contracts, form.contractId],
  );

  const paymentTemplates = useMemo(
    () => buildPaymentTemplates(selectedFormContract),
    [selectedFormContract],
  );

  const selectFormEvent = (eventId: string) => {
    const normalizedEventId = eventId === "none" ? "" : eventId;
    const selectedContract = contracts.find((contract) => contract.id === form.contractId);
    const keepContract = Boolean(
      selectedContract && selectedContract.event?.id === normalizedEventId,
    );
    if (!keepContract) setPaymentTemplate("manual");
    setForm((prev) => ({
      ...prev,
      eventId: normalizedEventId,
      contractId: keepContract ? prev.contractId : "",
    }));
  };

  const selectFormContract = (contractId: string) => {
    if (contractId === "none") {
      setPaymentTemplate("manual");
      setForm((prev) => ({ ...prev, contractId: "" }));
      return;
    }

    const contract = contracts.find((item) => item.id === contractId);
    const templates = buildPaymentTemplates(contract);
    const template = templates[0];
    const shouldApplyTemplate = Boolean(
      template && (!form.description.trim() || !form.amount || paymentTemplate !== "manual"),
    );
    setPaymentTemplate(shouldApplyTemplate && template ? template.value : "manual");
    setForm((prev) => ({
      ...prev,
      contractId,
      eventId: contract?.event?.id ?? prev.eventId,
      amount: shouldApplyTemplate && template
        ? String(template.amount)
        : prev.amount || String(contract?.outstandingAmount || contract?.totalValue || ""),
      description: shouldApplyTemplate && template
        ? template.description
        : prev.description || `Thanh toán ${contract?.contractCode ?? ""}`.trim(),
    }));
  };

  const selectPaymentTemplate = (value: string) => {
    setPaymentTemplate(value);
    if (value === "manual") return;
    const template = paymentTemplates.find((item) => item.value === value);
    if (!template) return;
    setForm((prev) => ({
      ...prev,
      description: template.description,
      amount: String(template.amount),
    }));
  };

  const openCreate = () => {
    setForm({ ...emptyTxForm, transactionDate: toDatetimeLocal(new Date().toISOString()) });
    setPaymentTemplate("manual");
    setCreateOpen(true);
    void loadProjects();
  };

  const openEdit = (transaction: Transaction) => {
    setForm({
      eventId: transaction.eventId ?? "",
      contractId: transaction.contractId ?? "",
      description: transaction.description,
      amount: String(transaction.amount ?? ""),
      transactionDate: toDatetimeLocal(transaction.transactionDate),
      paymentMethod: transaction.paymentMethod ?? "",
      status: transaction.status,
    });
    setPaymentTemplate("manual");
    setEditItem(transaction);
    void loadProjects();
  };

  const validateForm = () => {
    if (!form.description.trim()) {
      toast.error("Vui lòng nhập mô tả giao dịch");
      return false;
    }
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      toast.error("Số tiền phải lớn hơn 0");
      return false;
    }
    if (!form.transactionDate) {
      toast.error("Vui lòng chọn ngày giao dịch");
      return false;
    }
    return true;
  };

  const buildPayload = () => ({
    eventId: form.eventId || null,
    contractId: form.contractId || null,
    description: form.description.trim(),
    amount: Number(form.amount),
    transactionDate: new Date(form.transactionDate).toISOString(),
    paymentMethod: form.paymentMethod.trim() || null,
    status: form.status,
  });

  const refreshAll = async () => {
    await Promise.all([loadDashboard(), loadTransactions()]);
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      await apiClient.post("/admin/transactions", buildPayload());
      toast.success("Đã tạo giao dịch");
      setCreateOpen(false);
      setForm(emptyTxForm);
      setPaymentTemplate("manual");
      await refreshAll();
    } catch {
      toast.error("Tạo giao dịch thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editItem || !validateForm()) return;
    setSaving(true);
    try {
      await apiClient.put(`/admin/transactions/${editItem.id}`, buildPayload());
      toast.success("Đã cập nhật giao dịch");
      setEditItem(null);
      await refreshAll();
    } catch {
      toast.error("Cập nhật giao dịch thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (transaction: Transaction, status: string) => {
    try {
      await apiClient.put(`/admin/transactions/${transaction.id}`, { status });
      toast.success(`Đã chuyển sang "${txStatusLabel[status] ?? status}"`);
      await refreshAll();
    } catch {
      toast.error("Cập nhật trạng thái thất bại");
    }
  };

  const handleDelete = async (transaction: Transaction) => {
    if (!window.confirm(`Xóa giao dịch "${transaction.description}"? Hành động này không thể hoàn tác.`)) return;
    try {
      await apiClient.del(`/admin/transactions/${transaction.id}`);
      toast.success("Đã xóa giao dịch");
      await refreshAll();
    } catch {
      toast.error("Xóa giao dịch thất bại");
    }
  };

  const changeEventFilter = (eventId: string) => {
    setTxEventFilter(eventId);
    const selectedContract = contracts.find((contract) => contract.id === txContractFilter);
    if (eventId !== "all" && selectedContract?.event?.id !== eventId) {
      setTxContractFilter("all");
    }
  };

  const renderTxForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="font-body text-sm text-foreground mb-1 block">Dự án / Sự kiện</label>
          <Select value={form.eventId || "none"} onValueChange={selectFormEvent}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Không gắn dự án" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Không gắn dự án</SelectItem>
              {projectOptions.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {getDisplayName(project)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="font-body text-sm text-foreground mb-1 block">Hợp đồng</label>
          <Select value={form.contractId || "none"} onValueChange={selectFormContract}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Không gắn hợp đồng" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Không gắn hợp đồng</SelectItem>
              {filteredContractsForForm.map((contract) => (
                <SelectItem key={contract.id} value={contract.id}>
                  {contract.contractCode} - còn {moneyShort(Number(contract.outstandingAmount || 0))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedFormContract && (
        <div>
          <label className="font-body text-sm text-foreground mb-1 block">Mẫu thanh toán</label>
          <Select value={paymentTemplate} onValueChange={selectPaymentTemplate}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Chọn đợt thanh toán" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Nhập thủ công</SelectItem>
              {paymentTemplates.map((template) => (
                <SelectItem key={template.value} value={template.value}>
                  {template.planName}: {template.description} - {moneyShort(template.amount)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <label className="font-body text-sm text-foreground mb-1 block">Mô tả *</label>
        <Input
          value={form.description}
          onChange={(event) => {
            setPaymentTemplate("manual");
            setForm((prev) => ({ ...prev, description: event.target.value }));
          }}
          placeholder="VD: Thanh toán đợt 1"
          className="rounded-xl bg-surface-lowest font-body border-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="font-body text-sm text-foreground mb-1 block">Số tiền (VNĐ) *</label>
          <Input
            type="number"
            min={0}
            value={form.amount}
            onChange={(event) => {
              setPaymentTemplate("manual");
              setForm((prev) => ({ ...prev, amount: event.target.value }));
            }}
            className="rounded-xl bg-surface-lowest font-body border-none"
          />
        </div>
        <div>
          <label className="font-body text-sm text-foreground mb-1 block">Ngày giao dịch *</label>
          <Input
            type="datetime-local"
            value={form.transactionDate}
            onChange={(event) => setForm((prev) => ({ ...prev, transactionDate: event.target.value }))}
            className="rounded-xl bg-surface-lowest font-body border-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="font-body text-sm text-foreground mb-1 block">Hình thức thanh toán</label>
          <Input
            value={form.paymentMethod}
            onChange={(event) => setForm((prev) => ({ ...prev, paymentMethod: event.target.value }))}
            placeholder="Chuyển khoản / Tiền mặt"
            className="rounded-xl bg-surface-lowest font-body border-none"
          />
        </div>
        <div>
          <label className="font-body text-sm text-foreground mb-1 block">Trạng thái</label>
          <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {txStatusList.map((status) => (
                <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-headline-lg text-foreground">Quản lý tài chính</h1>
          <p className="font-body text-sm text-muted-foreground">
            {dashboardLoading ? "Đang tải số liệu..." : `${contracts.length} hợp đồng · ${transactions.length} giao dịch đang hiển thị`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll}>
          <RefreshCw size={16} /> Làm mới
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {[
          { label: "Giá trị hợp đồng", value: moneyShort(totals.contractValue), hint: `${billableContracts.length} hợp đồng ghi nhận`, icon: FileSignature, color: "text-primary" },
          { label: "Đã thu", value: moneyShort(totals.revenue), hint: `${collectionRate}% giá trị hợp đồng`, icon: DollarSign, color: "text-secondary" },
          { label: "Công nợ phải thu", value: moneyShort(totals.receivable), hint: `${moneyShort(totals.pending)} đang chờ xử lý`, icon: AlertCircle, color: "text-primary" },
          { label: "Chi phí đã ghi nhận", value: moneyShort(totals.expense), hint: `${expenses.length} khoản committed/paid`, icon: TrendingDown, color: "text-destructive" },
          { label: "Lợi nhuận ròng", value: moneyShort(totals.profit), hint: totals.profit >= 0 ? "Đang dương" : "Đang âm", icon: TrendingUp, color: totals.profit >= 0 ? "text-secondary" : "text-destructive" },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className="bg-surface-lowest rounded-xl p-5 shadow-ambient min-w-0"
          >
            <stat.icon size={20} className={stat.color} />
            <p className="font-serif text-headline-md text-foreground mt-3 truncate">{stat.value}</p>
            <p className="font-body text-sm text-muted-foreground mt-1">{stat.label}</p>
            <p className="font-body text-xs text-muted-foreground mt-2 truncate">{stat.hint}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-lowest rounded-xl p-6 shadow-ambient xl:col-span-2">
          <h3 className="font-serif text-headline-md text-foreground mb-6">Doanh thu vs chi phí</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyPL}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(38 20% 86%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(50 8% 42%)" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(50 8% 42%)" }} tickFormatter={moneyShort} />
              <Tooltip formatter={(value: number) => money(value)} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(113 33% 31%)" strokeWidth={2} name="Doanh thu" />
              <Line type="monotone" dataKey="expenses" stroke="hsl(355 63% 42%)" strokeWidth={2} name="Chi phí" />
              <Line type="monotone" dataKey="profit" stroke="hsl(38 72% 45%)" strokeWidth={2} name="Lợi nhuận" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
          <h3 className="font-serif text-headline-md text-foreground mb-6">Cơ cấu chi phí</h3>
          <div className="space-y-4">
            {expenseBreakdown.length === 0 && (
              <p className="font-body text-sm text-muted-foreground">Chưa có chi phí committed/paid.</p>
            )}
            {expenseBreakdown.map((expense) => (
              <div key={expense.category}>
                <div className="flex items-center justify-between gap-3 mb-1.5 font-body text-sm">
                  <span className="text-foreground truncate">{expense.category}</span>
                  <span className="text-muted-foreground whitespace-nowrap">{moneyShort(expense.amount)} ({expense.percent}%)</span>
                </div>
                <div className="w-full h-2 bg-surface-high rounded-full">
                  <div className="h-2 rounded-full gradient-primary transition-all" style={{ width: `${expense.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
        <h3 className="font-serif text-headline-md text-foreground mb-6">Thu chi theo dự án</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={projectChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(38 20% 86%)" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(50 8% 42%)" }} />
            <YAxis tick={{ fontSize: 12, fill: "hsl(50 8% 42%)" }} tickFormatter={moneyShort} />
            <Tooltip formatter={(value: number) => money(value)} />
            <Bar dataKey="revenue" fill="hsl(113 33% 31%)" name="Đã thu" radius={[6, 6, 0, 0]} />
            <Bar dataKey="expenses" fill="hsl(355 63% 42%)" name="Đã chi" radius={[6, 6, 0, 0]} />
            <Bar dataKey="receivable" fill="hsl(38 72% 45%)" name="Phải thu" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h3 className="font-serif text-headline-md text-foreground">Tài chính theo dự án</h3>
          <span className="font-body text-sm text-muted-foreground">{projectFinance.length} dự án</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm font-body">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 text-muted-foreground font-semibold">Dự án</th>
                <th className="text-right py-3 text-muted-foreground font-semibold">Hợp đồng</th>
                <th className="text-right py-3 text-muted-foreground font-semibold">Đã thu</th>
                <th className="text-right py-3 text-muted-foreground font-semibold">Phải thu</th>
                <th className="text-right py-3 text-muted-foreground font-semibold">Đã chi</th>
                <th className="text-right py-3 text-muted-foreground font-semibold">Lợi nhuận</th>
                <th className="text-right py-3 text-muted-foreground font-semibold">% thu</th>
                <th className="text-right py-3 text-muted-foreground font-semibold">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {!dashboardLoading && projectFinance.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-muted-foreground py-10">Chưa có dữ liệu tài chính dự án</td>
                </tr>
              )}
              {projectFinance.map((project) => (
                <tr key={project.id} className="border-b border-border last:border-0 hover:bg-surface-low/50">
                  <td className="py-3 font-semibold text-foreground">
                    <div className="max-w-[260px]">
                      <p className="truncate">{getDisplayName(project)}</p>
                      <p className="text-xs font-normal text-muted-foreground">{project.type || "-"} · {project.contractCount} HĐ</p>
                    </div>
                  </td>
                  <td className="py-3 text-right text-foreground">{moneyShort(Number(project.totalContractValue || 0))}</td>
                  <td className="py-3 text-right text-secondary font-semibold">{moneyShort(Number(project.totalCollected || 0))}</td>
                  <td className="py-3 text-right text-primary font-semibold">{moneyShort(Number(project.receivable || 0))}</td>
                  <td className="py-3 text-right text-foreground">{moneyShort(Number(project.budgetActual || 0))}</td>
                  <td className={`py-3 text-right font-semibold ${project.profit >= 0 ? "text-secondary" : "text-destructive"}`}>{moneyShort(project.profit)}</td>
                  <td className="py-3 text-right text-foreground">{project.collectionRate}%</td>
                  <td className="py-3 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getEventStatusColor(project.status)}`}>
                      {getEventStatusLabel(project.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
          <div>
            <h3 className="font-serif text-headline-md text-foreground">Giao dịch</h3>
            <p className="font-body text-sm text-muted-foreground">{txLoading ? "Đang tải..." : `${transactions.length} giao dịch`}</p>
          </div>
          <Button variant="hero" size="sm" onClick={openCreate}><Plus size={16} /> Tạo giao dịch</Button>
        </div>

        <div className="flex flex-col xl:flex-row gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={txSearch}
              onChange={(event) => setTxSearch(event.target.value)}
              placeholder="Tìm mô tả, dự án, số HĐ..."
              className="pl-10 rounded-xl bg-surface-low font-body border-none"
            />
          </div>
          <Select value={txEventFilter} onValueChange={changeEventFilter}>
            <SelectTrigger className="rounded-xl bg-surface-low border-none xl:w-64"><SelectValue placeholder="Tất cả dự án" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả dự án</SelectItem>
              {projectFinance.map((project) => (
                <SelectItem key={project.id} value={project.id}>{getDisplayName(project)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={txContractFilter} onValueChange={setTxContractFilter}>
            <SelectTrigger className="rounded-xl bg-surface-low border-none xl:w-56"><SelectValue placeholder="Tất cả HĐ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả hợp đồng</SelectItem>
              {filteredContractsForFilter.map((contract) => (
                <SelectItem key={contract.id} value={contract.id}>{contract.contractCode}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 flex-wrap mb-4">
          {[{ label: "Tất cả", value: "all" }, ...txStatusList].map((status) => (
            <button
              key={status.value}
              onClick={() => setTxFilter(status.value)}
              className={`px-3 py-2 rounded-xl font-body text-sm transition-all ${txFilter === status.value ? "gradient-primary text-primary-foreground" : "bg-surface-low text-muted-foreground hover:text-foreground"}`}
            >
              {status.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow className="bg-surface-low">
                <TableHead>Mô tả</TableHead>
                <TableHead>Dự án</TableHead>
                <TableHead>Hợp đồng</TableHead>
                <TableHead>Ngày</TableHead>
                <TableHead>Hình thức</TableHead>
                <TableHead className="text-right">Số tiền</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {txLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center font-body text-sm text-muted-foreground py-10">Đang tải giao dịch...</TableCell>
                </TableRow>
              )}
              {!txLoading && transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center font-body text-sm text-muted-foreground py-10">Chưa có giao dịch nào</TableCell>
                </TableRow>
              )}
              {!txLoading && transactions.map((transaction) => (
                <TableRow key={transaction.id} className="hover:bg-surface-low/50">
                  <TableCell className="font-body text-sm font-semibold text-foreground">
                    <div className="flex items-center gap-2">
                      <ReceiptText size={14} className="text-primary shrink-0" />
                      <span className="line-clamp-1">{transaction.description}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-body text-sm text-foreground">{getDisplayName(transaction.event)}</TableCell>
                  <TableCell className="font-body text-sm text-primary font-semibold">{transaction.contract?.contractCode ?? "-"}</TableCell>
                  <TableCell className="font-body text-sm text-foreground">{formatDateTime(transaction.transactionDate)}</TableCell>
                  <TableCell className="font-body text-sm text-muted-foreground">{transaction.paymentMethod ?? "-"}</TableCell>
                  <TableCell className="font-body text-sm font-semibold text-foreground text-right">{money(transaction.amount)}</TableCell>
                  <TableCell>
                    <span className={`px-3 py-1 rounded-full text-xs font-body font-semibold ${txStatusColors[transaction.status] ?? "bg-muted text-muted-foreground"}`}>
                      {txStatusLabel[transaction.status] ?? transaction.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(transaction)} title="Chỉnh sửa"><Edit2 size={14} /></Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal size={14} /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {transaction.status !== "completed" && (
                            <DropdownMenuItem onClick={() => handleStatusChange(transaction, "completed")}><CheckCircle2 size={12} className="mr-2" /> Đánh dấu hoàn thành</DropdownMenuItem>
                          )}
                          {transaction.status !== "cancelled" && (
                            <DropdownMenuItem onClick={() => handleStatusChange(transaction, "cancelled")} className="text-destructive"><XCircle size={12} className="mr-2" /> Hủy giao dịch</DropdownMenuItem>
                          )}
                          {transaction.status !== "pending" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleStatusChange(transaction, "pending")}>Đặt lại chờ xử lý</DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(transaction)} className="text-destructive"><Trash2 size={12} className="mr-2" /> Xóa giao dịch</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h3 className="font-serif text-headline-md text-foreground">Hợp đồng còn phải thu</h3>
          <WalletCards size={20} className="text-primary" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {contractsWithReceivable
            .slice(0, 6)
            .map((contract) => (
              <div key={contract.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-body text-sm font-semibold text-primary truncate">{contract.contractCode}</p>
                    <p className="font-body text-sm text-foreground truncate mt-1">{getDisplayName(contract.event)}</p>
                    <p className="font-body text-xs text-muted-foreground mt-1">{contract.customerUser?.displayName ?? "-"}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-body font-semibold bg-surface-high text-muted-foreground whitespace-nowrap">
                    {contractStatusLabel[contract.status] ?? contract.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4 font-body text-sm">
                  <div>
                    <p className="text-muted-foreground">Giá trị</p>
                    <p className="font-semibold text-foreground">{money(contract.totalValue)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Còn thu</p>
                    <p className="font-semibold text-primary">{money(contract.outstandingAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Đã thu</p>
                    <p className="font-semibold text-secondary">{money(contract.collectedAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ngày gửi</p>
                    <p className="text-foreground">{formatDate(contract.sentAt)}</p>
                  </div>
                </div>
              </div>
            ))}
          {!dashboardLoading && contractsWithReceivable.length === 0 && (
            <p className="font-body text-sm text-muted-foreground">Không có hợp đồng đang còn phải thu.</p>
          )}
        </div>
      </motion.div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Tạo giao dịch mới</DialogTitle>
            <DialogDescription className="sr-only">Nhập thông tin giao dịch tài chính mới.</DialogDescription>
          </DialogHeader>
          {renderTxForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button variant="hero" onClick={handleCreate} disabled={saving}>{saving ? "Đang lưu..." : "Tạo"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={(open) => { if (!open) setEditItem(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Chỉnh sửa giao dịch</DialogTitle>
            <DialogDescription className="sr-only">Cập nhật thông tin giao dịch tài chính.</DialogDescription>
          </DialogHeader>
          {renderTxForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Hủy</Button>
            <Button variant="hero" onClick={handleEdit} disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFinance;
