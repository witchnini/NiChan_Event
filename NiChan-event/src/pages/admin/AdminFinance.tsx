import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, Plus, Edit2, CheckCircle2, XCircle, MoreHorizontal } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

type ProjectFinance = {
  id: string;
  name: string;
  type: string;
  status: string;
  budgetEstimated: number;
  budgetActual: number;
  totalCollected: number;
};

type MonthlyPL = { month: string; revenue: number; expenses: number; profit: number };
type Expense = { id: string; category: string; actualAmount: string | number; estimatedAmount: string | number };

type Transaction = {
  id: string;
  eventId?: string | null;
  description: string;
  amount: string | number;
  transactionDate: string;
  paymentMethod?: string | null;
  status: string;
  event?: { id: string; name: string } | null;
};

type Project = { id: string; name: string };

const moneyShort = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} ty`;
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}tr`;
  return `${Math.round(value).toLocaleString("vi-VN")}d`;
};

const money = (value: string | number) => Number(value || 0).toLocaleString("vi-VN") + " d";

const txStatusList = [
  { label: "Cho xu ly", value: "pending" },
  { label: "Hoan thanh", value: "completed" },
  { label: "Da huy", value: "cancelled" },
];

const txStatusLabel: Record<string, string> = {
  pending: "Cho xu ly",
  completed: "Hoan thanh",
  cancelled: "Da huy",
};

const txStatusColors: Record<string, string> = {
  completed: "bg-secondary/10 text-secondary",
  pending: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
};

const emptyTxForm = {
  eventId: "",
  description: "",
  amount: "",
  transactionDate: "",
  paymentMethod: "",
  status: "pending",
};

const toDatetimeLocal = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const AdminFinance = () => {
  const [projectFinance, setProjectFinance] = useState<ProjectFinance[]>([]);
  const [monthlyPL, setMonthlyPL] = useState<MonthlyPL[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txFilter, setTxFilter] = useState("all");
  const [txLoading, setTxLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<Transaction | null>(null);
  const [form, setForm] = useState(emptyTxForm);
  const [saving, setSaving] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [projectsData, pl, expenseItems] = await Promise.all([
        apiClient.get<ProjectFinance[]>("/admin/finance/project-summary"),
        apiClient.get<MonthlyPL[]>("/admin/finance/monthly-pl"),
        apiClient.get<Expense[]>("/admin/finance/expenses"),
      ]);
      setProjectFinance(projectsData);
      setMonthlyPL(pl.map(item => ({ ...item, expenses: item.expenses ?? 0 })));
      setExpenses(expenseItems);
    } catch (error) {
      toast.error("Khong tai duoc du lieu tai chinh");
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    setTxLoading(true);
    try {
      const data = await apiClient.get<Transaction[]>("/admin/transactions", {
        status: txFilter === "all" ? undefined : txFilter,
        pageSize: 100,
      });
      setTransactions(data);
    } catch (error) {
      toast.error("Khong tai duoc danh sach giao dich");
    } finally {
      setTxLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    void loadTransactions();
  }, [txFilter]);

  const loadProjects = async () => {
    if (projects.length) return;
    try {
      const data = await apiClient.get<Project[]>("/admin/projects", { pageSize: 100 });
      setProjects(data);
    } catch (error) {
      toast.error("Khong tai duoc danh sach du an");
    }
  };

  const totals = useMemo(() => {
    const revenue = projectFinance.reduce((sum, p) => sum + Number(p.totalCollected || 0), 0);
    const expense = projectFinance.reduce((sum, p) => sum + Number(p.budgetActual || 0), 0);
    const receivable = projectFinance.reduce((sum, p) => sum + Math.max(Number(p.budgetEstimated || 0) - Number(p.totalCollected || 0), 0), 0);
    return { revenue, expense, profit: revenue - expense, receivable };
  }, [projectFinance]);

  const expenseBreakdown = useMemo(() => {
    // Consolidate budget items into one row per category.
    const byCategory = new Map<string, number>();
    for (const exp of expenses) {
      const amount = Number(exp.actualAmount || 0);
      byCategory.set(exp.category, (byCategory.get(exp.category) ?? 0) + amount);
    }
    const total = [...byCategory.values()].reduce((sum, v) => sum + v, 0);
    return [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount, percent: total ? Math.round((amount / total) * 100) : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const openCreate = () => {
    setForm({ ...emptyTxForm, transactionDate: toDatetimeLocal(new Date().toISOString()) });
    setCreateOpen(true);
    void loadProjects();
  };

  const openEdit = (tx: Transaction) => {
    setForm({
      eventId: tx.eventId ?? "",
      description: tx.description,
      amount: String(tx.amount ?? ""),
      transactionDate: toDatetimeLocal(tx.transactionDate),
      paymentMethod: tx.paymentMethod ?? "",
      status: tx.status,
    });
    setEditItem(tx);
    void loadProjects();
  };

  const validateForm = () => {
    if (!form.description.trim()) {
      toast.error("Vui long nhap mo ta giao dich");
      return false;
    }
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      toast.error("So tien phai lon hon 0");
      return false;
    }
    if (!form.transactionDate) {
      toast.error("Vui long chon ngay giao dich");
      return false;
    }
    return true;
  };

  const buildPayload = () => ({
    eventId: form.eventId || undefined,
    description: form.description.trim(),
    amount: Number(form.amount),
    transactionDate: new Date(form.transactionDate).toISOString(),
    paymentMethod: form.paymentMethod.trim() || undefined,
    status: form.status,
  });

  const handleCreate = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      await apiClient.post("/admin/transactions", buildPayload());
      toast.success("Da tao giao dich");
      setCreateOpen(false);
      setForm(emptyTxForm);
      await Promise.all([loadTransactions(), loadDashboard()]);
    } catch (error) {
      toast.error("Tao giao dich that bai");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editItem || !validateForm()) return;
    setSaving(true);
    try {
      await apiClient.put(`/admin/transactions/${editItem.id}`, buildPayload());
      toast.success("Da cap nhat giao dich");
      setEditItem(null);
      await Promise.all([loadTransactions(), loadDashboard()]);
    } catch (error) {
      toast.error("Cap nhat giao dich that bai");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (tx: Transaction, status: string) => {
    try {
      await apiClient.put(`/admin/transactions/${tx.id}`, { status });
      toast.success(`Da chuyen sang "${txStatusLabel[status] ?? status}"`);
      await Promise.all([loadTransactions(), loadDashboard()]);
    } catch (error) {
      toast.error("Cap nhat trang thai that bai");
    }
  };

  const renderTxForm = () => (
    <div className="space-y-4">
      <div>
        <label className="font-body text-sm text-foreground mb-1 block">Du an / Su kien</label>
        <Select value={form.eventId || "none"} onValueChange={v => setForm(p => ({ ...p, eventId: v === "none" ? "" : v }))}>
          <SelectTrigger className="rounded-xl"><SelectValue placeholder="Khong gan du an" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Khong gan du an</SelectItem>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="font-body text-sm text-foreground mb-1 block">Mo ta *</label>
        <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="VD: Tam ung dot 1" className="rounded-xl bg-surface-lowest font-body border-none" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-body text-sm text-foreground mb-1 block">So tien (VND) *</label>
          <Input type="number" min={0} value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} className="rounded-xl bg-surface-lowest font-body border-none" />
        </div>
        <div>
          <label className="font-body text-sm text-foreground mb-1 block">Ngay giao dich *</label>
          <Input type="datetime-local" value={form.transactionDate} onChange={e => setForm(p => ({ ...p, transactionDate: e.target.value }))} className="rounded-xl bg-surface-lowest font-body border-none" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-body text-sm text-foreground mb-1 block">Hinh thuc thanh toan</label>
          <Input value={form.paymentMethod} onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value }))} placeholder="Chuyen khoan / Tien mat" className="rounded-xl bg-surface-lowest font-body border-none" />
        </div>
        <div>
          <label className="font-body text-sm text-foreground mb-1 block">Trang thai</label>
          <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {txStatusList.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-headline-lg text-foreground">Quan ly tai chinh</h1>
        <p className="font-body text-sm text-muted-foreground">{loading ? "Dang tai du lieu tu backend..." : "Du lieu lay tu PostgreSQL qua API"}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Tong doanh thu", value: moneyShort(totals.revenue), icon: DollarSign, up: true },
          { label: "Tong chi phi", value: moneyShort(totals.expense), icon: TrendingDown, up: false },
          { label: "Loi nhuan rong", value: moneyShort(totals.profit), icon: TrendingUp, up: totals.profit >= 0 },
          { label: "Cong no phai thu", value: moneyShort(totals.receivable), icon: AlertCircle, up: false },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-surface-lowest rounded-xl p-5 shadow-ambient">
            <stat.icon size={20} className={stat.up ? "text-secondary" : "text-primary"} />
            <p className="font-serif text-headline-lg text-foreground mt-3">{stat.value}</p>
            <p className="font-body text-sm text-muted-foreground mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
          <h3 className="font-serif text-headline-md text-foreground mb-6">Doanh thu vs Chi phi</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlyPL}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(38 20% 86%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(50 8% 42%)" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(50 8% 42%)" }} tickFormatter={moneyShort} />
              <Tooltip formatter={(value: number) => money(value)} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(113 33% 31%)" strokeWidth={2} name="Doanh thu" />
              <Line type="monotone" dataKey="expenses" stroke="hsl(355 63% 42%)" strokeWidth={2} name="Chi phi" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
          <h3 className="font-serif text-headline-md text-foreground mb-6">Co cau chi phi</h3>
          <div className="space-y-4">
            {expenseBreakdown.length === 0 && <p className="font-body text-sm text-muted-foreground">Chua co chi phi committed/paid.</p>}
            {expenseBreakdown.map((exp) => (
              <div key={exp.category}>
                <div className="flex items-center justify-between mb-1.5 font-body text-sm">
                  <span className="text-foreground">{exp.category}</span>
                  <span className="text-muted-foreground">{moneyShort(exp.amount)} ({exp.percent}%)</span>
                </div>
                <div className="w-full h-2 bg-surface-high rounded-full">
                  <div className="h-2 rounded-full gradient-primary transition-all" style={{ width: `${exp.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
        <h3 className="font-serif text-headline-md text-foreground mb-6">Tai chinh theo du an</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 text-muted-foreground font-semibold">Du an</th>
                <th className="text-right py-3 text-muted-foreground font-semibold">Du toan</th>
                <th className="text-right py-3 text-muted-foreground font-semibold">Da chi</th>
                <th className="text-right py-3 text-muted-foreground font-semibold">Thu duoc</th>
                <th className="text-right py-3 text-muted-foreground font-semibold">Loi nhuan</th>
                <th className="text-right py-3 text-muted-foreground font-semibold">Trang thai</th>
              </tr>
            </thead>
            <tbody>
              {projectFinance.map((p) => {
                const profit = Number(p.totalCollected || 0) - Number(p.budgetActual || 0);
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface-low/50">
                    <td className="py-3 font-semibold text-foreground">{p.name}</td>
                    <td className="py-3 text-right text-foreground">{moneyShort(Number(p.budgetEstimated || 0))}</td>
                    <td className="py-3 text-right text-foreground">{moneyShort(Number(p.budgetActual || 0))}</td>
                    <td className="py-3 text-right text-secondary font-semibold">{moneyShort(Number(p.totalCollected || 0))}</td>
                    <td className={`py-3 text-right font-semibold ${profit >= 0 ? "text-secondary" : "text-destructive"}`}>{moneyShort(profit)}</td>
                    <td className="py-3 text-right"><span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">{p.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Transactions management */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="font-serif text-headline-md text-foreground">Giao dich</h3>
            <p className="font-body text-sm text-muted-foreground">{txLoading ? "Dang tai..." : `${transactions.length} giao dich`}</p>
          </div>
          <Button variant="hero" size="sm" onClick={openCreate}><Plus size={16} /> Tao giao dich</Button>
        </div>

        <div className="flex gap-2 flex-wrap mb-4">
          {[{ label: "Tat ca", value: "all" }, ...txStatusList].map(status => (
            <button key={status.value} onClick={() => setTxFilter(status.value)}
              className={`px-3 py-2 rounded-xl font-body text-sm transition-all ${txFilter === status.value ? "gradient-primary text-primary-foreground" : "bg-surface-low text-muted-foreground hover:text-foreground"}`}
            >{status.label}</button>
          ))}
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-surface-low">
              <TableHead>Mo ta</TableHead>
              <TableHead>Du an</TableHead>
              <TableHead>Ngay</TableHead>
              <TableHead>Hinh thuc</TableHead>
              <TableHead className="text-right">So tien</TableHead>
              <TableHead>Trang thai</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!txLoading && transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center font-body text-sm text-muted-foreground py-10">Chua co giao dich nao</TableCell>
              </TableRow>
            )}
            {transactions.map(tx => (
              <TableRow key={tx.id} className="hover:bg-surface-low/50">
                <TableCell className="font-body text-sm font-semibold text-foreground">{tx.description}</TableCell>
                <TableCell className="font-body text-sm text-foreground">{tx.event?.name ?? "-"}</TableCell>
                <TableCell className="font-body text-sm text-foreground">{new Date(tx.transactionDate).toLocaleDateString("vi-VN")}</TableCell>
                <TableCell className="font-body text-sm text-muted-foreground">{tx.paymentMethod ?? "-"}</TableCell>
                <TableCell className="font-body text-sm font-semibold text-foreground text-right">{money(tx.amount)}</TableCell>
                <TableCell><span className={`px-3 py-1 rounded-full text-xs font-body font-semibold ${txStatusColors[tx.status] ?? "bg-muted text-muted-foreground"}`}>{txStatusLabel[tx.status] ?? tx.status}</span></TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tx)} title="Chinh sua"><Edit2 size={14} /></Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal size={14} /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {tx.status !== "completed" && (
                          <DropdownMenuItem onClick={() => handleStatusChange(tx, "completed")}><CheckCircle2 size={12} className="mr-2" /> Danh dau hoan thanh</DropdownMenuItem>
                        )}
                        {tx.status !== "cancelled" && (
                          <DropdownMenuItem onClick={() => handleStatusChange(tx, "cancelled")} className="text-destructive"><XCircle size={12} className="mr-2" /> Huy giao dich</DropdownMenuItem>
                        )}
                        {tx.status !== "pending" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleStatusChange(tx, "pending")}>Dat lai cho xu ly</DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </motion.div>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif">Tao giao dich moi</DialogTitle></DialogHeader>
          {renderTxForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Huy</Button>
            <Button variant="hero" onClick={handleCreate} disabled={saving}>{saving ? "Dang luu..." : "Tao"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif">Chinh sua giao dich</DialogTitle></DialogHeader>
          {renderTxForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Huy</Button>
            <Button variant="hero" onClick={handleEdit} disabled={saving}>{saving ? "Dang luu..." : "Luu"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFinance;
