import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Wallet, TrendingUp, TrendingDown, AlertCircle, Plus, Edit2, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

type Project = { id: string; name: string };
type Vendor = { id: string; name: string };
type BudgetItem = {
  id: string;
  category: string;
  estimatedAmount: string | number;
  actualAmount: string | number;
  note?: string | null;
  status: string;
  vendorId?: string | null;
  vendor?: { id: string; name: string } | null;
};
type ProjectBudget = { project: Project; budget: { id: string; name: string }; items: BudgetItem[]; estimatedTotal: number; actualTotal: number };

const NO_VENDOR = "none";

const statusLabel: Record<string, string> = {
  planned: "Dự kiến",
  approved: "Đã duyệt",
  committed: "Đã cam kết",
  paid: "Đã thanh toán",
};

const statusBadge: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  approved: "bg-primary/10 text-primary",
  committed: "bg-amber-500/10 text-amber-600",
  paid: "bg-secondary/10 text-secondary",
};

const statusOptions = Object.keys(statusLabel);

const emptyForm = { category: "", estimated: "", actual: "0", note: "", status: "planned", vendorId: NO_VENDOR };
const toMillion = (value: string | number) => Number(value || 0) / 1_000_000;
const fromMillion = (value: string) => Number(value || 0) * 1_000_000;

const OrganizerBudget = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [current, setCurrent] = useState<ProjectBudget | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<BudgetItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const data = await apiClient.get<Project[]>("/organizer/projects");
        setProjects(data);
        setActiveProjectId(data[0]?.id ?? "");
      } catch (error) {
        toast.error("Không tải được danh sách dự án");
      }
    };
    const loadVendors = async () => {
      try {
        const data = await apiClient.get<Vendor[]>("/organizer/vendors", { pageSize: 100 });
        setVendors(data);
      } catch (error) {
        toast.error("Không tải được danh sách nhà cung cấp");
      }
    };
    void loadProjects();
    void loadVendors();
  }, []);

  const loadBudget = async (projectId: string) => {
    if (!projectId) {
      setCurrent(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiClient.get<ProjectBudget>(`/organizer/budgets/${projectId}`);
      setCurrent(data);
    } catch (error) {
      toast.error("Không tải được ngân sách dự án");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBudget(activeProjectId);
  }, [activeProjectId]);

  const totalEstimated = current?.estimatedTotal ?? 0;
  const totalActual = current?.actualTotal ?? 0;
  const remaining = totalEstimated - totalActual;
  const percent = totalEstimated ? Math.round((totalActual / totalEstimated) * 100) : 0;

  const visibleItems = useMemo(
    () => (current?.items ?? []).filter(item => statusFilter === "all" || item.status === statusFilter),
    [current, statusFilter],
  );

  const comparisonData = useMemo(() => visibleItems.map(item => ({
    category: item.category,
    estimated: toMillion(item.estimatedAmount),
    actual: toMillion(item.actualAmount),
  })), [visibleItems]);

  const openAdd = () => { setEditItem(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (item: BudgetItem) => {
    setEditItem(item);
    setForm({
      category: item.category,
      estimated: String(toMillion(item.estimatedAmount)),
      actual: String(toMillion(item.actualAmount)),
      note: item.note ?? "",
      status: item.status ?? "planned",
      vendorId: item.vendorId ?? NO_VENDOR,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!current || !form.category.trim()) return;
    const payload = {
      projectBudgetId: current.budget.id,
      category: form.category,
      estimatedAmount: fromMillion(form.estimated),
      actualAmount: fromMillion(form.actual),
      status: form.status,
      note: form.note || undefined,
      vendorId: form.vendorId === NO_VENDOR ? null : form.vendorId,
    };
    try {
      if (editItem) {
        await apiClient.put(`/organizer/budget-items/${editItem.id}`, payload);
      } else {
        await apiClient.post("/organizer/budget-items", payload);
      }
      toast.success(editItem ? "Đã cập nhật mục chi phí" : "Đã thêm mục chi phí");
      setDialogOpen(false);
      await loadBudget(activeProjectId);
    } catch (error) {
      toast.error("Lưu mục chi phí thất bại");
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await apiClient.del(`/organizer/budget-items/${id}`);
      toast.success("Đã xóa mục chi phí");
      await loadBudget(activeProjectId);
    } catch (error) {
      toast.error("Xóa mục chi phí thất bại");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-headline-lg text-foreground">Quản lý ngân sách</h1>
          <p className="font-body text-sm text-muted-foreground">{loading ? "Đang tải dữ liệu..." : "Theo dõi dự toán và chi phí thực tế cho từng dự án"}</p>
        </div>
        <Button variant="hero" size="sm" onClick={openAdd} disabled={!current}><Plus size={16} /> Thêm hạng mục</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Tổng dự toán", value: `${Math.round(toMillion(totalEstimated))}tr`, icon: Wallet, color: "text-primary" },
          { label: "Đã chi thực tế", value: `${Math.round(toMillion(totalActual))}tr`, icon: TrendingDown, color: totalActual > totalEstimated * 0.8 ? "text-destructive" : "text-secondary" },
          { label: "Còn lại", value: `${Math.round(toMillion(remaining))}tr`, icon: TrendingUp, color: "text-secondary" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-surface-lowest rounded-xl p-5 shadow-ambient">
            <stat.icon size={20} className={stat.color} />
            <p className="font-serif text-headline-lg text-foreground mt-3">{stat.value}</p>
            <p className="font-body text-sm text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {projects.map((project) => (
          <button key={project.id} onClick={() => setActiveProjectId(project.id)}
            className={`px-4 py-2 rounded-xl font-body text-sm transition-all ${activeProjectId === project.id ? "bg-secondary text-secondary-foreground font-semibold" : "bg-surface-lowest text-muted-foreground hover:text-foreground"}`}>
            {project.name}
          </button>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
        {!current ? (
          <p className="font-body text-sm text-muted-foreground">Chưa có dự án để hiển thị ngân sách.</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-headline-md text-foreground">{current.project.name}</h3>
              <span className={`font-serif font-bold text-lg ${percent > 80 ? "text-destructive" : "text-secondary"}`}>{percent}% đã chi</span>
            </div>
            <Progress value={percent} className="h-3 mb-6" />

            <div className="flex gap-2 flex-wrap mb-4">
              {[{ id: "all", label: "Tất cả" }, ...statusOptions.map(s => ({ id: s, label: statusLabel[s] }))].map(opt => (
                <button key={opt.id} onClick={() => setStatusFilter(opt.id)}
                  className={`px-3 py-1.5 rounded-xl font-body text-xs transition-all ${statusFilter === opt.id ? "bg-secondary text-secondary-foreground font-semibold" : "bg-surface-low text-muted-foreground hover:text-foreground"}`}>
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 text-muted-foreground font-semibold">Hạng mục</th>
                    <th className="text-right py-3 text-muted-foreground font-semibold">Dự toán (tr)</th>
                    <th className="text-right py-3 text-muted-foreground font-semibold">Thực tế (tr)</th>
                    <th className="text-right py-3 text-muted-foreground font-semibold">Chênh lệch</th>
                    <th className="text-left py-3 text-muted-foreground font-semibold pl-4">Trạng thái</th>
                    <th className="text-left py-3 text-muted-foreground font-semibold pl-4">Nhà cung cấp</th>
                    <th className="text-left py-3 text-muted-foreground font-semibold pl-4">Ghi chú</th>
                    <th className="text-right py-3 text-muted-foreground font-semibold">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.length === 0 ? (
                    <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Chưa có hạng mục nào.</td></tr>
                  ) : visibleItems.map(item => {
                    const estimated = toMillion(item.estimatedAmount);
                    const actual = toMillion(item.actualAmount);
                    const diff = actual - estimated;
                    return (
                      <tr key={item.id} className="border-b border-border last:border-0 hover:bg-surface-low/50">
                        <td className="py-3 font-semibold text-foreground">{item.category}</td>
                        <td className="py-3 text-right text-foreground">{Math.round(estimated)}</td>
                        <td className="py-3 text-right text-foreground">{Math.round(actual)}{actual > estimated && <AlertCircle size={12} className="inline ml-1 text-destructive" />}</td>
                        <td className={`py-3 text-right font-semibold ${diff > 0 ? "text-destructive" : diff < 0 ? "text-secondary" : "text-muted-foreground"}`}>{diff > 0 ? `+${Math.round(diff)}` : diff === 0 ? "-" : Math.round(diff)}</td>
                        <td className="py-3 pl-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-body font-semibold ${statusBadge[item.status] ?? "bg-muted text-muted-foreground"}`}>
                            {statusLabel[item.status] ?? item.status}
                          </span>
                        </td>
                        <td className="py-3 pl-4 text-muted-foreground">{item.vendor?.name ?? "—"}</td>
                        <td className="py-3 pl-4 text-muted-foreground">{item.note || "—"}</td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => openEdit(item)} className="p-1 text-muted-foreground hover:text-foreground"><Edit2 size={14} /></button>
                            <button onClick={() => deleteItem(item.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
        <h3 className="font-serif text-headline-md text-foreground mb-6">Dự toán vs Thực tế (triệu VND)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={comparisonData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(38 20% 86%)" />
            <XAxis dataKey="category" tick={{ fontSize: 11, fill: "hsl(50 8% 42%)" }} />
            <YAxis tick={{ fontSize: 12, fill: "hsl(50 8% 42%)" }} />
            <Tooltip />
            <Bar dataKey="estimated" fill="hsl(38 20% 86%)" radius={[6, 6, 0, 0]} name="Dự toán" />
            <Bar dataKey="actual" fill="hsl(355 63% 42%)" radius={[6, 6, 0, 0]} name="Thực tế" />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-serif">{editItem ? "Sửa hạng mục" : "Thêm hạng mục"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="font-body text-sm mb-1 block">Tên hạng mục</label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="rounded-xl border-none bg-surface-low" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="font-body text-sm mb-1 block">Dự toán (triệu)</label><Input type="number" value={form.estimated} onChange={e => setForm({ ...form, estimated: e.target.value })} className="rounded-xl border-none bg-surface-low" /></div>
              <div><label className="font-body text-sm mb-1 block">Thực tế (triệu)</label><Input type="number" value={form.actual} onChange={e => setForm({ ...form, actual: e.target.value })} className="rounded-xl border-none bg-surface-low" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="font-body text-sm mb-1 block">Trạng thái</label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{statusOptions.map(s => <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><label className="font-body text-sm mb-1 block">Nhà cung cấp</label>
                <Select value={form.vendorId} onValueChange={v => setForm({ ...form, vendorId: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Không liên kết" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_VENDOR}>Không liên kết</SelectItem>
                    {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><label className="font-body text-sm mb-1 block">Ghi chú</label><Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className="rounded-xl border-none bg-surface-low" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button><Button variant="hero" onClick={save}>Lưu</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrganizerBudget;
