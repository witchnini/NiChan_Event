import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  Phone,
  Mail,
  MoreHorizontal,
  Building2,
  Edit2,
  Trash2,
  MapPin,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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

const emptyVendor = {
  name: "",
  categoryId: "",
  phone: "",
  email: "",
  bankAccountNumber: "",
  contactName: "",
  address: "",
  status: "active" as Vendor["status"],
};

const statusLabel: Record<Vendor["status"], string> = {
  active: "Đang hợp tác",
  paused: "Tạm dừng",
  inactive: "Ngừng hợp tác",
};

const AdminVendors = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<VendorCategory[]>([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<Vendor | null>(null);
  const [viewItem, setViewItem] = useState<Vendor | null>(null);
  const [form, setForm] = useState(emptyVendor);
  const [loading, setLoading] = useState(true);

  const loadVendors = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<Vendor[]>("/admin/vendors", {
        search,
        categoryId: filterCat === "all" ? undefined : filterCat,
        pageSize: 100,
      });
      setVendors(data);
    } catch (error) {
      toast.error("Không tải được danh sách nhà cung cấp");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiClient
      .get<VendorCategory[]>("/admin/vendors/categories")
      .then((data) => {
        setCategories(data);
        setForm((prev) => ({
          ...prev,
          categoryId: prev.categoryId || data[0]?.id || "",
        }));
      })
      .catch(() => toast.error("Không tải được danh mục nhà cung cấp"));
  }, []);

  useEffect(() => {
    void loadVendors();
  }, [search, filterCat]);

  const payload = () => ({
    name: form.name.trim(),
    categoryId: form.categoryId || categories[0]?.id,
    phone: form.phone.trim() || undefined,
    email: form.email.trim() || "",
    bankAccountNumber: form.bankAccountNumber.trim() || undefined,
    contactName: form.contactName.trim() || undefined,
    address: form.address.trim(),
    status: form.status,
  });

  const handleCreate = async () => {
    if (!form.name.trim() || !form.categoryId || !form.address.trim()) {
      toast.error("Vui lòng nhập tên, danh mục và địa chỉ");
      return;
    }
    try {
      await apiClient.post("/admin/vendors", payload());
      toast.success(`Đã thêm nhà cung cấp ${form.name.trim()}`);
      setCreateOpen(false);
      setForm({ ...emptyVendor, categoryId: categories[0]?.id || "" });
      await loadVendors();
    } catch (error) {
      toast.error("Thêm nhà cung cấp thất bại");
    }
  };

  const handleEdit = async () => {
    if (!editItem) return;
    if (!form.name.trim() || !form.categoryId || !form.address.trim()) {
      toast.error("Vui lòng nhập tên, danh mục và địa chỉ");
      return;
    }
    try {
      await apiClient.patch(`/admin/vendors/${editItem.id}`, payload());
      toast.success("Đã cập nhật nhà cung cấp");
      setEditItem(null);
      await loadVendors();
    } catch (error) {
      toast.error("Cập nhật nhà cung cấp thất bại");
    }
  };

  const handleDelete = async (vendor: Vendor) => {
    const inUse = (vendor._count?.eventVendors ?? 0) > 0;
    const message = inUse
      ? `Nhà cung cấp "${vendor.name}" đã tham gia dự án. Hệ thống sẽ chuyển sang trạng thái ngừng hợp tác.`
      : `Xóa nhà cung cấp "${vendor.name}"?`;

    if (!window.confirm(message)) return;

    try {
      await apiClient.del(`/admin/vendors/${vendor.id}`);
      toast.success(inUse ? "Đã ngừng hợp tác với nhà cung cấp" : "Đã xóa nhà cung cấp");
      await loadVendors();
    } catch (error) {
      toast.error("Xóa nhà cung cấp thất bại");
    }
  };

  const openEdit = (vendor: Vendor) => {
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
    setEditItem(vendor);
  };

  const VendorForm = () => (
    <div className="space-y-4">
      <div>
        <label className="font-body text-sm text-foreground mb-1 block">
          Tên nhà cung cấp *
        </label>
        <Input
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          className="rounded-xl bg-surface-lowest font-body border-none"
        />
      </div>
      <div>
        <label className="font-body text-sm text-foreground mb-1 block">
          Danh mục *
        </label>
        <Select
          value={form.categoryId}
          onValueChange={(v) => setForm((p) => ({ ...p, categoryId: v }))}
        >
          <SelectTrigger className="rounded-xl">
            <SelectValue placeholder="Chọn danh mục" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-body text-sm text-foreground mb-1 block">
            Điện thoại
          </label>
          <Input
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            className="rounded-xl bg-surface-lowest font-body border-none"
          />
        </div>
        <div>
          <label className="font-body text-sm text-foreground mb-1 block">
            Email
          </label>
          <Input
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            className="rounded-xl bg-surface-lowest font-body border-none"
          />
        </div>
      </div>
      <div>
        <label className="font-body text-sm text-foreground mb-1 block">
          Số tài khoản ngân hàng
        </label>
        <Input
          value={form.bankAccountNumber}
          onChange={(e) =>
            setForm((p) => ({ ...p, bankAccountNumber: e.target.value }))
          }
          className="rounded-xl bg-surface-lowest font-body border-none"
        />
      </div>
      <div>
        <label className="font-body text-sm text-foreground mb-1 block">
          Người liên hệ
        </label>
        <Input
          value={form.contactName}
          onChange={(e) =>
            setForm((p) => ({ ...p, contactName: e.target.value }))
          }
          className="rounded-xl bg-surface-lowest font-body border-none"
        />
      </div>
      <div>
        <label className="font-body text-sm text-foreground mb-1 block">
          Địa chỉ *
        </label>
        <Input
          value={form.address}
          onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
          className="rounded-xl bg-surface-lowest font-body border-none"
        />
      </div>
      <div>
        <label className="font-body text-sm text-foreground mb-1 block">
          Trạng thái
        </label>
        <Select
          value={form.status}
          onValueChange={(v) =>
            setForm((p) => ({ ...p, status: v as Vendor["status"] }))
          }
        >
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Đang hợp tác</SelectItem>
            <SelectItem value="paused">Tạm dừng</SelectItem>
            <SelectItem value="inactive">Ngừng hợp tác</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-headline-lg text-foreground">
            Quản lý nhà cung cấp
          </h1>
          <p className="font-body text-sm text-muted-foreground">
            {loading ? "Đang tải..." : `${vendors.length} đối tác`}
          </p>
        </div>
        <Button
          variant="hero"
          size="sm"
          onClick={() => {
            setForm({ ...emptyVendor, categoryId: categories[0]?.id || "" });
            setCreateOpen(true);
          }}
        >
          <Plus size={16} /> Thêm nhà cung cấp
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm nhà cung cấp..."
            className="pl-10 rounded-xl bg-surface-lowest font-body border-none"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[{ id: "all", name: "Tất cả" }, ...categories].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCat(cat.id)}
              className={`px-3 py-2 rounded-xl font-body text-sm transition-all ${filterCat === cat.id ? "gradient-primary text-primary-foreground" : "bg-surface-lowest text-muted-foreground hover:text-foreground"}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vendors.map((vendor, i) => (
          <motion.div
            key={vendor.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-surface-lowest rounded-xl p-5 shadow-ambient hover:shadow-ambient-lg transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-low flex items-center justify-center">
                  <Building2 size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-body text-sm font-semibold text-foreground">
                    {vendor.name}
                  </h3>
                  <p className="font-body text-xs text-primary">
                    {vendor.category?.name ?? "-"}
                  </p>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-body font-semibold ${vendor.status === "active" ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"}`}
              >
                {statusLabel[vendor.status]}
              </span>
            </div>
            <div className="space-y-1.5 text-xs font-body text-muted-foreground">
              <p className="flex items-center gap-2">
                <Phone size={11} /> {vendor.phone || "-"}
              </p>
              <p className="flex items-center gap-2">
                <Mail size={11} /> {vendor.email || "-"}
              </p>
              <p className="flex items-center gap-2">
                <MapPin size={11} /> {vendor.address}
              </p>
              <p className="flex items-center gap-2">
                <Briefcase size={11} /> Đã tham gia {vendor._count?.eventVendors ?? 0} dự án
              </p>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-full"
                onClick={() => setViewItem(vendor)}
              >
                Chi tiết
              </Button>
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
                  <DropdownMenuItem
                    onClick={() => handleDelete(vendor)}
                    className="text-destructive focus:text-destructive"
                  >
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
          <DialogHeader>
            <DialogTitle className="font-serif">Chi tiết nhà cung cấp</DialogTitle>
          </DialogHeader>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Thêm nhà cung cấp</DialogTitle>
          </DialogHeader>
          <VendorForm />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Hủy
            </Button>
            <Button variant="hero" onClick={handleCreate}>
              Thêm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">
              Chỉnh sửa nhà cung cấp
            </DialogTitle>
          </DialogHeader>
          <VendorForm />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>
              Hủy
            </Button>
            <Button variant="hero" onClick={handleEdit}>
              Lưu
            </Button>
          </DialogFooter>
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

export default AdminVendors;
