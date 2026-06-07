import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Edit2, Phone, MapPin, Tag, Briefcase, Mail, Trash2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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

type VendorCategory = { id: string; name: string };
type Vendor = {
  id: string;
  name: string;
  categoryId: string;
  category?: VendorCategory;
  phone?: string | null;
  email?: string | null;
  bankAccountNumber?: string | null;
  contactName?: string | null;
  address: string;
  status: "active" | "paused" | "inactive";
  _count?: { eventVendors?: number };
};

const emptyForm = {
  name: "",
  categoryId: "",
  phone: "",
  email: "",
  bankAccountNumber: "",
  contactName: "",
  address: "",
  status: "active",
};

const statusLabel: Record<string, string> = {
  active: "Đang hợp tác",
  paused: "Tạm dừng",
  inactive: "Ngừng hợp tác",
};

const OrganizerVendors = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<VendorCategory[]>([]);
  const [filter, setFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Vendor | null>(null);
  const [viewItem, setViewItem] = useState<Vendor | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  const loadVendors = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<Vendor[]>("/organizer/vendors", {
        category: filter === "all" ? undefined : filter,
        pageSize: 100,
      });
      setVendors(data);
    } catch (error) {
      toast.error("Không tải được nhà cung cấp");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiClient.get<VendorCategory[]>("/organizer/vendor-categories")
      .then(data => {
        setCategories(data);
        setForm(prev => ({ ...prev, categoryId: prev.categoryId || data[0]?.id || "" }));
      })
      .catch(() => toast.error("Không tải được danh mục nhà cung cấp"));
  }, []);

  useEffect(() => {
    void loadVendors();
  }, [filter]);

  const payload = () => ({
    name: form.name.trim(),
    categoryId: form.categoryId || categories[0]?.id,
    phone: form.phone.trim() || undefined,
    email: form.email.trim() || undefined,
    bankAccountNumber: form.bankAccountNumber.trim() || undefined,
    contactName: form.contactName.trim() || undefined,
    address: form.address.trim(),
    status: form.status,
  });

  const openAdd = () => {
    setEditItem(null);
    setForm({ ...emptyForm, categoryId: categories[0]?.id || "" });
    setDialogOpen(true);
  };

  const openEdit = (vendor: Vendor) => {
    setEditItem(vendor);
    setForm({
      name: vendor.name,
      categoryId: vendor.categoryId,
      phone: vendor.phone ?? "",
      email: vendor.email ?? "",
      bankAccountNumber: vendor.bankAccountNumber ?? "",
      contactName: vendor.contactName ?? "",
      address: vendor.address,
      status: vendor.status,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.categoryId || !form.address.trim()) return;
    try {
      if (editItem) {
        await apiClient.put(`/organizer/vendors/${editItem.id}`, payload());
      } else {
        await apiClient.post("/organizer/vendors", payload());
      }
      toast.success(editItem ? "Đã cập nhật nhà cung cấp" : "Đã thêm nhà cung cấp mới");
      setDialogOpen(false);
      await loadVendors();
    } catch (error) {
      toast.error("Lưu nhà cung cấp thất bại");
    }
  };

  const toggleStatus = async (vendor: Vendor) => {
    const next = vendor.status === "active" ? "paused" : "active";
    try {
      await apiClient.patch(`/organizer/vendors/${vendor.id}/status`, { status: next });
      toast.success("Đã cập nhật trạng thái");
      await loadVendors();
    } catch (error) {
      toast.error("Cập nhật trạng thái thất bại");
    }
  };

  const deleteVendor = async (vendor: Vendor) => {
    const inUse = (vendor._count?.eventVendors ?? 0) > 0;
    const message = inUse
      ? `Nhà cung cấp "${vendor.name}" đã tham gia dự án. Hệ thống sẽ chuyển sang trạng thái ngừng hợp tác.`
      : `Xóa nhà cung cấp "${vendor.name}"?`;

    if (!window.confirm(message)) return;

    try {
      await apiClient.del(`/organizer/vendors/${vendor.id}`);
      toast.success(inUse ? "Đã ngừng hợp tác với nhà cung cấp" : "Đã xóa nhà cung cấp");
      await loadVendors();
    } catch (error) {
      toast.error("Xóa nhà cung cấp thất bại");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-headline-lg text-foreground">Quản lý nhà cung cấp</h1>
          <p className="font-body text-sm text-muted-foreground">{loading ? "Đang tải..." : `${vendors.length} nhà cung cấp`}</p>
        </div>
        <Button variant="hero" size="sm" onClick={openAdd}><Plus size={16} /> Thêm nhà cung cấp</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[{ id: "all", name: "Tất cả" }, ...categories].map(cat => (
          <button key={cat.id} onClick={() => setFilter(cat.id)}
            className={`px-4 py-2 rounded-xl font-body text-sm transition-all ${filter === cat.id ? "bg-secondary text-secondary-foreground font-semibold" : "bg-surface-lowest text-muted-foreground hover:text-foreground"}`}>
            {cat.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {vendors.map((vendor, i) => (
          <motion.div key={vendor.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-surface-lowest rounded-xl p-5 shadow-ambient hover:shadow-ambient-lg transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-body text-sm font-semibold text-foreground">{vendor.name}</h3>
                <span className="inline-flex items-center gap-1 font-body text-xs text-muted-foreground mt-1"><Tag size={10} />{vendor.category?.name ?? "-"}</span>
              </div>
              <button onClick={() => toggleStatus(vendor)} className={`px-2 py-0.5 rounded-full text-xs font-body font-semibold cursor-pointer ${vendor.status === "active" ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"}`}>
                {statusLabel[vendor.status]}
              </button>
            </div>
            <div className="space-y-2 text-xs font-body text-muted-foreground mb-4">
              <div className="flex items-center gap-2"><Phone size={12} />{vendor.phone || "-"}</div>
              <div className="flex items-center gap-2"><Mail size={12} />{vendor.email || "-"}</div>
              <div className="flex items-center gap-2"><MapPin size={12} />{vendor.address}</div>
              <div className="flex items-center gap-2"><Briefcase size={12} />Đã tham gia {vendor._count?.eventVendors ?? 0} dự án</div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="flex-1 rounded-full" onClick={() => setViewItem(vendor)}>Chi tiết</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                    <MoreHorizontal size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => openEdit(vendor)}>
                    <Edit2 size={14} className="mr-2" /> Chỉnh sửa
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => deleteVendor(vendor)} className="text-destructive focus:text-destructive">
                    <Trash2 size={14} className="mr-2" /> Xóa
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </motion.div>
        ))}
      </div>

      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-serif">Chi tiết nhà cung cấp</DialogTitle></DialogHeader>
          {viewItem && (
            <div className="space-y-4 font-body text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Tên nhà cung cấp</p>
                <p className="font-semibold text-foreground">{viewItem.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Info label="Danh mục" value={viewItem.category?.name ?? "-"} />
                <Info label="Trạng thái" value={statusLabel[viewItem.status] ?? viewItem.status} />
                <Info label="Số điện thoại" value={viewItem.phone || "-"} />
                <Info label="Email" value={viewItem.email || "-"} />
                <Info label="Số tài khoản ngân hàng" value={viewItem.bankAccountNumber || "-"} />
                <Info label="Người liên hệ" value={viewItem.contactName || "-"} />
                <Info label="Dự án đã tham gia" value={`${viewItem._count?.eventVendors ?? 0} dự án`} />
              </div>
              <Info label="Địa chỉ" value={viewItem.address} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewItem(null)}>Đóng</Button>
            {viewItem && <Button variant="hero" onClick={() => { const vendor = viewItem; setViewItem(null); openEdit(vendor); }}>Chỉnh sửa</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-serif">{editItem ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp mới"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="font-body text-sm mb-1 block">Tên nhà cung cấp</label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-xl border-none bg-surface-low" /></div>
            <div><label className="font-body text-sm mb-1 block">Danh mục</label>
              <Select value={form.categoryId} onValueChange={v => setForm({ ...form, categoryId: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Chọn danh mục" /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="font-body text-sm mb-1 block">Liên hệ</label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="rounded-xl border-none bg-surface-low" /></div>
              <div><label className="font-body text-sm mb-1 block">Email</label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="rounded-xl border-none bg-surface-low" /></div>
            </div>
            <div><label className="font-body text-sm mb-1 block">Số tài khoản ngân hàng</label><Input value={form.bankAccountNumber} onChange={e => setForm({ ...form, bankAccountNumber: e.target.value })} className="rounded-xl border-none bg-surface-low" /></div>
            <div><label className="font-body text-sm mb-1 block">Địa chỉ</label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="rounded-xl border-none bg-surface-low" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button><Button variant="hero" onClick={save}>Lưu</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg bg-surface-low p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 break-words font-semibold text-foreground">{value}</p>
  </div>
);

export default OrganizerVendors;
