import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { FileText, Eye, Send, MoreHorizontal, Trash2, Plus, Search, Edit2, Clock, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";
import ContractPdfButton from "@/components/ContractPdfButton";

type ContractVersion = {
  id: string;
  versionLabel: string;
  scopeText?: string;
  paymentTerms?: string;
  generalTerms?: string;
  documentUrl?: string | null;
  createdAt: string;
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
  event?: { id: string; name: string; type: string } | null;
  customerUser?: { id: string; displayName: string; phone?: string | null } | null;
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

const money = (value: string | number) => Number(value || 0).toLocaleString("vi-VN") + " ₫";

const emptyForm = {
  eventId: "",
  customerUserId: "",
  totalValue: "",
  versionLabel: "1.0",
  scopeText: "",
  paymentTerms: "",
  generalTerms: "",
};

const AdminContracts = () => {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<Contract | null>(null);
  const [viewItem, setViewItem] = useState<Contract | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const openCreate = () => {
    setForm(emptyForm);
    setCreateOpen(true);
    void loadProjects();
  };

  const selectProject = (eventId: string) => {
    const project = projects.find(p => p.id === eventId);
    setForm(prev => ({ ...prev, eventId, customerUserId: project?.customerUser?.id ?? "" }));
  };

  const handleCreate = async () => {
    if (!form.eventId || !form.customerUserId) {
      toast.error("Vui lòng chọn dự án/sự kiện");
      return;
    }
    const totalValue = Number(form.totalValue);
    if (!totalValue || totalValue <= 0) {
      toast.error("Giá trị hợp đồng phải lớn hơn 0");
      return;
    }
    if (!form.scopeText || !form.paymentTerms || !form.generalTerms) {
      toast.error("Vui lòng nhập đầy đủ phạm vi, điều khoản thanh toán và điều khoản chung");
      return;
    }
    setSaving(true);
    try {
      await apiClient.post("/admin/contracts", {
        eventId: form.eventId,
        customerUserId: form.customerUserId,
        totalValue,
        versionLabel: form.versionLabel || "1.0",
        scopeText: form.scopeText,
        paymentTerms: form.paymentTerms,
        generalTerms: form.generalTerms,
      });
      toast.success("Đã tạo hợp đồng");
      setCreateOpen(false);
      setForm(emptyForm);
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
      setForm({
        eventId: detail.event?.id ?? "",
        customerUserId: detail.customerUser?.id ?? "",
        totalValue: String(detail.totalValue ?? ""),
        versionLabel: detail.currentVersion ?? "1.0",
        scopeText: latest?.scopeText ?? "",
        paymentTerms: latest?.paymentTerms ?? "",
        generalTerms: latest?.generalTerms ?? "",
      });
      setEditItem(detail);
    } catch (error) {
      toast.error("Không tải được chi tiết hợp đồng");
    }
  };

  const handleEdit = async () => {
    if (!editItem) return;
    const totalValue = Number(form.totalValue);
    if (!totalValue || totalValue <= 0) {
      toast.error("Giá trị hợp đồng phải lớn hơn 0");
      return;
    }
    setSaving(true);
    try {
      await apiClient.put(`/admin/contracts/${editItem.id}`, {
        totalValue,
        versionLabel: form.versionLabel,
        scopeText: form.scopeText,
        paymentTerms: form.paymentTerms,
        generalTerms: form.generalTerms,
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
      // keep the row data already shown
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

  const renderContractForm = (mode: "create" | "edit") => (
    <div className="space-y-4">
      {mode === "create" ? (
        <div>
          <label className="font-body text-sm text-foreground mb-1 block">Dự án / Sự kiện *</label>
          <Select value={form.eventId} onValueChange={selectProject}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Chọn dự án" /></SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} — {p.customerUser?.displayName ?? "Chưa có khách hàng"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="rounded-xl bg-surface-low px-3 py-2">
          <p className="font-body text-xs text-muted-foreground">Sự kiện</p>
          <p className="font-body text-sm font-semibold text-foreground">{editItem?.event?.name ?? "-"}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-body text-sm text-foreground mb-1 block">Giá trị (VND) *</label>
          <Input type="number" min={0} value={form.totalValue} onChange={e => setForm(p => ({ ...p, totalValue: e.target.value }))} className="rounded-xl bg-surface-lowest font-body border-none" />
        </div>
        <div>
          <label className="font-body text-sm text-foreground mb-1 block">Phiên bản *</label>
          <Input value={form.versionLabel} onChange={e => setForm(p => ({ ...p, versionLabel: e.target.value }))} placeholder="1.0" className="rounded-xl bg-surface-lowest font-body border-none" />
        </div>
      </div>

      <div>
        <label className="font-body text-sm text-foreground mb-1 block">Phạm vi công việc *</label>
        <Textarea value={form.scopeText} onChange={e => setForm(p => ({ ...p, scopeText: e.target.value }))} rows={3} className="rounded-xl bg-surface-lowest font-body border-none" />
      </div>
      <div>
        <label className="font-body text-sm text-foreground mb-1 block">Điều khoản thanh toán *</label>
        <Textarea value={form.paymentTerms} onChange={e => setForm(p => ({ ...p, paymentTerms: e.target.value }))} rows={3} className="rounded-xl bg-surface-lowest font-body border-none" />
      </div>
      <div>
        <label className="font-body text-sm text-foreground mb-1 block">Điều khoản chung *</label>
        <Textarea value={form.generalTerms} onChange={e => setForm(p => ({ ...p, generalTerms: e.target.value }))} rows={3} className="rounded-xl bg-surface-lowest font-body border-none" />
      </div>
      {mode === "edit" && (
        <p className="font-body text-xs text-muted-foreground">Lưu thay đổi nội dung sẽ tạo một phiên bản mới của hợp đồng.</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-headline-lg text-foreground">Quản lý hợp đồng</h1>
          <p className="font-body text-sm text-muted-foreground">{loading ? "Đang tải..." : `${contracts.length} hợp đồng`}</p>
        </div>
        <Button variant="hero" size="sm" onClick={openCreate}><Plus size={16} /> Tạo hợp đồng</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo số HĐ, sự kiện..." className="pl-10 rounded-xl bg-surface-lowest font-body border-none" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[{ label: "Tất cả", value: "all" }, ...statusList].map(status => (
            <button key={status.value} onClick={() => setFilterStatus(status.value)}
              className={`px-3 py-2 rounded-xl font-body text-sm transition-all ${filterStatus === status.value ? "gradient-primary text-primary-foreground" : "bg-surface-lowest text-muted-foreground hover:text-foreground"}`}
            >{status.label}</button>
          ))}
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-surface-lowest rounded-xl shadow-ambient overflow-hidden">
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
                <TableCell colSpan={8} className="text-center font-body text-sm text-muted-foreground py-10">Chưa có hợp đồng nào</TableCell>
              </TableRow>
            )}
            {contracts.map(contract => (
              <TableRow key={contract.id} className="hover:bg-surface-low/50">
                <TableCell className="font-body text-sm font-semibold text-primary">{contract.contractCode}</TableCell>
                <TableCell className="font-body text-sm text-foreground">{contract.event?.name ?? "-"}</TableCell>
                <TableCell className="font-body text-sm text-foreground">{contract.customerUser?.displayName ?? "-"}</TableCell>
                <TableCell className="font-body text-sm font-semibold text-foreground">{money(contract.totalValue)}</TableCell>
                <TableCell className="font-body text-sm text-foreground">{contract.sentAt ? new Date(contract.sentAt).toLocaleDateString("vi-VN") : "-"}</TableCell>
                <TableCell className="font-body text-sm text-muted-foreground">v{contract.currentVersion}</TableCell>
                <TableCell><span className={`px-3 py-1 rounded-full text-xs font-body font-semibold ${statusColors[contract.status] ?? "bg-muted text-muted-foreground"}`}>{statusLabel[contract.status] ?? contract.status}</span></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/admin/hop-dong/${contract.id}`)} title="Xem bản đầy đủ"><Eye size={14} /></Button>
                    <ContractPdfButton contract={contract} detailPath={`/admin/contracts/${contract.id}`} variant="ghost" size="icon" label="" className="h-8 w-8" />
                    {contract.status === "draft" && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSend(contract)} title="Gửi khách"><Send size={14} /></Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal size={14} /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/admin/hop-dong/${contract.id}`)}><Eye size={12} className="mr-2" /> Xem bản đầy đủ</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openView(contract)}><FileText size={12} className="mr-2" /> Xem nhanh</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(contract)}><Edit2 size={12} className="mr-2" /> Chỉnh sửa</DropdownMenuItem>
                        {contract.status === "draft" && (
                          <DropdownMenuItem onClick={() => handleSend(contract)}><Send size={12} className="mr-2" /> Gửi khách hàng</DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDelete(contract.id)} className="text-destructive"><Trash2 size={12} className="mr-2" /> Xóa</DropdownMenuItem>
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
          <DialogHeader><DialogTitle className="font-serif">Tạo hợp đồng mới</DialogTitle></DialogHeader>
          {renderContractForm("create")}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button variant="hero" onClick={handleCreate} disabled={saving}>{saving ? "Đang lưu..." : "Tạo"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif">Chỉnh sửa hợp đồng {editItem?.contractCode}</DialogTitle></DialogHeader>
          {renderContractForm("edit")}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Hủy</Button>
            <Button variant="hero" onClick={handleEdit} disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View */}
      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif">Hợp đồng {viewItem?.contractCode}</DialogTitle></DialogHeader>
          {viewItem && (
            <div className="space-y-4 font-body text-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-surface-low flex items-center justify-center"><FileText size={22} className="text-primary" /></div>
                <div>
                  <p className="font-semibold text-foreground">{viewItem.event?.name ?? "-"}</p>
                  <p className="text-muted-foreground">{viewItem.customerUser?.displayName ?? "-"}{viewItem.customerUser?.phone ? ` · ${viewItem.customerUser.phone}` : ""}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div><p className="text-muted-foreground">Giá trị</p><p className="font-semibold text-foreground">{money(viewItem.totalValue)}</p></div>
                <div><p className="text-muted-foreground">Phiên bản</p><p className="text-foreground">v{viewItem.currentVersion}</p></div>
                <div><p className="text-muted-foreground">Trạng thái</p><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[viewItem.status] ?? "bg-muted text-muted-foreground"}`}>{statusLabel[viewItem.status] ?? viewItem.status}</span></div>
                <div><p className="text-muted-foreground">Ngày gửi</p><p className="text-foreground">{viewItem.sentAt ? new Date(viewItem.sentAt).toLocaleDateString("vi-VN") : "-"}</p></div>
                <div><p className="text-muted-foreground">Ngày ký</p><p className="text-foreground">{viewItem.signedAt ? new Date(viewItem.signedAt).toLocaleDateString("vi-VN") : "-"}</p></div>
                <div><p className="text-muted-foreground">Người tạo</p><p className="text-foreground">{viewItem.createdBy?.displayName ?? "-"}</p></div>
              </div>

              {viewItem.versions?.[0] && (
                <div className="space-y-3 border-t border-border pt-3">
                  <div><p className="text-muted-foreground mb-1">Phạm vi công việc</p><p className="text-foreground whitespace-pre-wrap">{viewItem.versions[0].scopeText || "-"}</p></div>
                  <div><p className="text-muted-foreground mb-1">Điều khoản thanh toán</p><p className="text-foreground whitespace-pre-wrap">{viewItem.versions[0].paymentTerms || "-"}</p></div>
                  <div><p className="text-muted-foreground mb-1">Điều khoản chung</p><p className="text-foreground whitespace-pre-wrap">{viewItem.versions[0].generalTerms || "-"}</p></div>
                </div>
              )}

              {viewItem.versions && viewItem.versions.length > 1 && (
                <div className="border-t border-border pt-3">
                  <p className="text-muted-foreground mb-2 flex items-center gap-1"><History size={12} /> Lịch sử phiên bản</p>
                  <div className="space-y-1">
                    {viewItem.versions.map(v => (
                      <div key={v.id} className="flex items-center justify-between text-xs">
                        <span className="text-foreground font-semibold">v{v.versionLabel}</span>
                        <span className="text-muted-foreground flex items-center gap-1"><Clock size={10} /> {new Date(v.createdAt).toLocaleString("vi-VN")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewItem.documents && viewItem.documents.length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="text-muted-foreground mb-2">Tài liệu đính kèm</p>
                  <div className="space-y-1">
                    {viewItem.documents.map(doc => (
                      <a key={doc.id} href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline">
                        <FileText size={12} /> {doc.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewItem(null)}>Đóng</Button>
            {viewItem && <ContractPdfButton contract={viewItem} detailPath={`/admin/contracts/${viewItem.id}`} variant="outline" label="Tải PDF" />}
            {viewItem?.status === "draft" && (
              <Button variant="hero" onClick={() => { if (viewItem) handleSend(viewItem); setViewItem(null); }}><Send size={14} className="mr-1" /> Gửi khách</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminContracts;
