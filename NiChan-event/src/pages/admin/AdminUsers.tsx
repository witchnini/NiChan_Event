import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Shield, MoreHorizontal, Mail, Phone, Clock, UserCheck, UserX, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

type ApiUser = {
  id: string;
  displayName: string;
  email: string;
  phone?: string | null;
  role: "admin" | "organizer" | "customer";
  status: "active" | "inactive" | "suspended";
  lastLoginAt?: string | null;
};

const roleList = [
  { label: "Quản trị viên", value: "admin" },
  { label: "Người tổ chức", value: "organizer" },
  { label: "Khách hàng", value: "customer" },
];

const roleLabel: Record<string, string> = {
  admin: "Quản trị viên",
  organizer: "Người tổ chức",
  customer: "Khách hàng",
};

const statusLabel: Record<ApiUser["status"], string> = {
  active: "Đang hoạt động",
  inactive: "Không hoạt động",
  suspended: "Tạm khóa",
};

const roleColors: Record<string, string> = {
  admin: "bg-primary/10 text-primary",
  organizer: "bg-secondary/10 text-secondary",
  customer: "bg-surface-high text-foreground",
};

const emptyUser = { name: "", email: "", phone: "", role: "customer", password: "" };

const AdminUsers = () => {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<ApiUser | null>(null);
  const [form, setForm] = useState(emptyUser);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<ApiUser[]>("/admin/users", {
        search,
        role: filterRole === "all" ? undefined : filterRole,
        pageSize: 100,
      });
      setUsers(data);
    } catch (error) {
      toast.error("Không tải được danh sách người dùng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, [search, filterRole]);

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) {
      toast.error("Vui lòng nhập tên, email và mật khẩu");
      return;
    }
    try {
      await apiClient.post("/admin/users", form);
      toast.success(`Đã tạo tài khoản cho ${form.name}`);
      setCreateOpen(false);
      setForm(emptyUser);
      await loadUsers();
    } catch (error) {
      toast.error("Tạo người dùng thất bại");
    }
  };

  const handleEdit = async () => {
    if (!editItem) return;
    try {
      await apiClient.put(`/admin/users/${editItem.id}`, {
        name: form.name,
        phone: form.phone || undefined,
      });
      toast.success("Đã cập nhật người dùng");
      setEditItem(null);
      await loadUsers();
    } catch (error) {
      toast.error("Cập nhật người dùng thất bại");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.del(`/admin/users/${id}`);
      toast.success("Đã xóa người dùng");
      await loadUsers();
    } catch (error) {
      toast.error("Xóa người dùng thất bại");
    }
  };

  const toggleStatus = async (user: ApiUser) => {
    const next = user.status === "active" ? "inactive" : "active";
    try {
      await apiClient.patch(`/admin/users/${user.id}/status`, { status: next });
      toast.success("Đã cập nhật trạng thái");
      await loadUsers();
    } catch (error) {
      toast.error("Cập nhật trạng thái thất bại");
    }
  };

  const renderUserForm = (mode: "create" | "edit") => (
    <div className="space-y-4">
      <div><label className="font-body text-sm text-foreground mb-1 block">Họ và tên *</label>
        <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="rounded-xl bg-surface-lowest font-body border-none" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="font-body text-sm text-foreground mb-1 block">Email *</label>
          <Input value={form.email} disabled={mode === "edit"} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="rounded-xl bg-surface-lowest font-body border-none" />
        </div>
        <div><label className="font-body text-sm text-foreground mb-1 block">Điện thoại</label>
          <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="rounded-xl bg-surface-lowest font-body border-none" />
        </div>
      </div>
      {mode === "create" && (
        <div className="grid grid-cols-2 gap-3">
          <div><label className="font-body text-sm text-foreground mb-1 block">Vai trò</label>
            <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{roleList.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><label className="font-body text-sm text-foreground mb-1 block">Mật khẩu *</label>
            <Input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className="rounded-xl bg-surface-lowest font-body border-none" />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-headline-lg text-foreground">Quản lý người dùng</h1>
          <p className="font-body text-sm text-muted-foreground">{loading ? "Đang tải..." : `${users.length} người dùng`}</p>
        </div>
        <Button variant="hero" size="sm" onClick={() => { setForm(emptyUser); setCreateOpen(true); }}><Plus size={16} /> Tạo tài khoản</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm người dùng..." className="pl-10 rounded-xl bg-surface-lowest font-body border-none" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[{ label: "Tất cả", value: "all" }, ...roleList].map(role => (
            <button key={role.value} onClick={() => setFilterRole(role.value)}
              className={`px-3 py-2 rounded-xl font-body text-sm transition-all ${filterRole === role.value ? "gradient-primary text-primary-foreground" : "bg-surface-lowest text-muted-foreground hover:text-foreground"}`}
            >{role.label}</button>
          ))}
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-surface-lowest rounded-xl shadow-ambient overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-low">
              <TableHead>Người dùng</TableHead>
              <TableHead>Liên hệ</TableHead>
              <TableHead>Vai trò</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Đăng nhập cuối</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(user => (
              <TableRow key={user.id} className="hover:bg-surface-low/50">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-body font-bold text-xs">{user.displayName?.[0] ?? "U"}</div>
                    <p className="font-body text-sm font-semibold text-foreground">{user.displayName}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="font-body text-xs text-muted-foreground flex items-center gap-1"><Mail size={10} /> {user.email}</p>
                  <p className="font-body text-xs text-muted-foreground flex items-center gap-1"><Phone size={10} /> {user.phone || "-"}</p>
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-body font-semibold ${roleColors[user.role] ?? roleColors.customer}`}>
                    <Shield size={10} className="inline mr-1" />{roleLabel[user.role] ?? user.role}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`flex items-center gap-1 text-xs font-body font-semibold ${user.status === "active" ? "text-secondary" : "text-destructive"}`}>
                    {user.status === "active" ? <UserCheck size={12} /> : <UserX size={12} />}
                    {statusLabel[user.status] ?? user.status}
                  </span>
                </TableCell>
                <TableCell className="font-body text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock size={10} /> {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("vi-VN") : "-"}</span>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal size={14} /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setForm({ name: user.displayName, email: user.email, phone: user.phone ?? "", role: user.role, password: "" }); setEditItem(user); }}>
                        <Edit2 size={12} className="mr-2" /> Chỉnh sửa
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleStatus(user)}>
                        {user.status === "active" ? "Vô hiệu hóa" : "Kích hoạt lại"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleDelete(user.id)} className="text-destructive">
                        <Trash2 size={12} className="mr-2" /> Xóa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </motion.div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-serif">Tạo tài khoản mới</DialogTitle></DialogHeader>
          {renderUserForm("create")}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button variant="hero" onClick={handleCreate}>Tạo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-serif">Chỉnh sửa người dùng</DialogTitle></DialogHeader>
          {renderUserForm("edit")}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Hủy</Button>
            <Button variant="hero" onClick={handleEdit}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;
