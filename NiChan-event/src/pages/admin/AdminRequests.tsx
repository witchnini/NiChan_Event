import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, Eye, UserPlus, MoreHorizontal, Mail, Phone, Calendar, Users, DollarSign, MapPin, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";
import { requestStatusLabels, requestStatusColors, requestStatusFilters, getRequestStatusLabel } from "@/lib/eventDisplay";

type RequestItem = {
  id: string;
  requestCode: string;
  customerName: string;
  phone: string;
  email: string;
  eventType: string;
  eventDate?: string | null;
  guestCount?: number | null;
  budgetRange?: string | null;
  locationText?: string | null;
  status: string;
  createdAt: string;
  note?: string | null;
  assignedManagerId?: string | null;
  assignedManager?: { id: string; displayName: string } | null;
};

type Manager = { id: string; displayName: string; email: string };

const statuses = requestStatusFilters;
const statusLabel = requestStatusLabels;
const statusColors = requestStatusColors;

/** Trích tên sự kiện từ trường note (định dạng "Ten su kien: ...") */
const parseEventNameFromNote = (note?: string | null): string | null => {
  if (!note) return null;
  const match = note.match(/Ten su kien:\s*(.+)/i);
  return match ? match[1].trim() : null;
};

/** Render ghi chú: chia dòng, làm nổi bật prefix label */
const NoteContent = ({ note }: { note: string }) => {
  const lines = note.split("\n").filter(Boolean);
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const colonIdx = line.indexOf(":");
        if (colonIdx > 0) {
          const label = line.slice(0, colonIdx).trim();
          const value = line.slice(colonIdx + 1).trim();
          // Nếu là "Ten su kien" thì bỏ qua vì đã hiển thị ở cột Sự kiện
          if (label.toLowerCase() === "ten su kien") return null;
          return (
            <div key={i} className="grid grid-cols-[auto_1fr] gap-x-2">
              <span className="font-semibold text-amber-700 whitespace-nowrap">{label}:</span>
              <span className="text-foreground">{value}</span>
            </div>
          );
        }
        return <p key={i} className="text-foreground">{line}</p>;
      })}
    </div>
  );
};

const AdminRequests = () => {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewItem, setViewItem] = useState<RequestItem | null>(null);
  const [assignItem, setAssignItem] = useState<RequestItem | null>(null);
  const [selectedManager, setSelectedManager] = useState("");
  const [loading, setLoading] = useState(true);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<RequestItem[]>("/admin/requests", {
        search,
        status: filterStatus === "all" ? undefined : filterStatus,
        pageSize: 100,
      });
      setRequests(data);
    } catch (error) {
      toast.error("Không thể tải danh sách yêu cầu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, [search, filterStatus]);

  useEffect(() => {
    apiClient.get<Manager[]>("/admin/users", { role: "organizer", pageSize: 100 })
      .then(data => setManagers(data))
      .catch(() => toast.error("Không thể tải danh sách quản lý"));
  }, []);

  const handleAssign = async () => {
    if (!assignItem || !selectedManager) return;
    try {
      await apiClient.patch(`/admin/requests/${assignItem.id}/assign-manager`, { managerUserId: selectedManager });
      toast.success("Đã phân công quản lý thành công");
      setAssignItem(null);
      setSelectedManager("");
      await loadRequests();
    } catch (error) {
      toast.error("Phân công thất bại, vui lòng thử lại");
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await apiClient.patch(`/admin/requests/${id}/status`, { status: newStatus });
      toast.success("Đã cập nhật trạng thái");
      await loadRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cập nhật trạng thái thất bại");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.del(`/admin/requests/${id}`);
      toast.success("Đã xoá yêu cầu");
      await loadRequests();
    } catch (error) {
      toast.error("Xoá yêu cầu thất bại");
    }
  };

  return (
    <div className="space-y-6">
      {/* Tiêu đề */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-headline-lg text-foreground">Quản lý yêu cầu</h1>
          <p className="font-body text-sm text-muted-foreground">
            {loading ? "Đang tải..." : `${requests.length} yêu cầu từ khách hàng`}
          </p>
        </div>
      </div>

      {/* Bộ lọc tìm kiếm */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên, email, mã yêu cầu..."
            className="pl-10 rounded-xl bg-surface-lowest font-body border-none"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[{ value: "all", label: "Tất cả" }, ...statuses].map((status) => (
            <button
              key={status.value}
              onClick={() => setFilterStatus(status.value)}
              className={`px-3 py-2 rounded-xl font-body text-sm transition-all ${
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

      {/* Bảng danh sách */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-surface-lowest rounded-xl shadow-ambient overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-low">
              <TableHead className="font-body text-xs font-semibold text-foreground/60 uppercase tracking-wider">Mã</TableHead>
              <TableHead className="font-body text-xs font-semibold text-foreground/60 uppercase tracking-wider">Khách hàng</TableHead>
              <TableHead className="font-body text-xs font-semibold text-foreground/60 uppercase tracking-wider">Sự kiện</TableHead>
              <TableHead className="font-body text-xs font-semibold text-foreground/60 uppercase tracking-wider">Ngày tổ chức</TableHead>
              <TableHead className="font-body text-xs font-semibold text-foreground/60 uppercase tracking-wider">Ngân sách</TableHead>
              <TableHead className="font-body text-xs font-semibold text-foreground/60 uppercase tracking-wider">Phụ trách</TableHead>
              <TableHead className="font-body text-xs font-semibold text-foreground/60 uppercase tracking-wider">Trạng thái</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground font-body text-sm">
                  Không tìm thấy yêu cầu nào phù hợp.
                </TableCell>
              </TableRow>
            )}
            {requests.map((req) => (
              <TableRow key={req.id} className="hover:bg-surface-low/50 transition-colors">
                <TableCell>
                  <span className="font-body text-sm font-bold text-primary">{req.requestCode}</span>
                  <p className="font-body text-xs text-muted-foreground mt-0.5">
                    {new Date(req.createdAt).toLocaleDateString("vi-VN")}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="font-body text-sm font-semibold text-foreground">{req.customerName}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                    <Mail size={10} /> {req.email}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone size={10} /> {req.phone}
                  </div>
                </TableCell>
                <TableCell>
                  <p className="font-body text-sm text-foreground font-medium">
                    {(() => {
                      const eventName = parseEventNameFromNote(req.note);
                      return eventName ? eventName : req.eventType;
                    })()}
                  </p>
                  {parseEventNameFromNote(req.note) && (
                    <p className="font-body text-xs text-muted-foreground">{req.eventType}</p>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                    <Users size={10} /> {req.guestCount ?? 0} khách
                  </div>
                </TableCell>
                <TableCell className="font-body text-sm text-foreground">
                  {req.eventDate ? (
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-muted-foreground" />
                      {new Date(req.eventDate).toLocaleDateString("vi-VN")}
                    </div>
                  ) : "—"}
                </TableCell>
                <TableCell className="font-body text-sm font-semibold text-foreground">
                  {req.budgetRange || "—"}
                </TableCell>
                <TableCell className="font-body text-sm">
                  {req.assignedManager
                    ? <span className="text-foreground">{req.assignedManager.displayName}</span>
                    : <span className="text-muted-foreground italic text-xs">Chưa phân công</span>
                  }
                </TableCell>
                <TableCell>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-body font-semibold ${statusColors[req.status] ?? "bg-muted text-muted-foreground"}`}>
                    {statusLabel[req.status] ?? req.status}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Xem chi tiết" onClick={() => setViewItem(req)}>
                      <Eye size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Phân công" onClick={() => { setAssignItem(req); setSelectedManager(req.assignedManagerId ?? ""); }}>
                      <UserPlus size={14} />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal size={14} /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <div className="px-2 py-1.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                          Chuyển trạng thái
                        </div>
                        {statuses.map(s => (
                          <DropdownMenuItem
                            key={s.value}
                            onClick={() => handleStatusChange(req.id, s.value)}
                            className={req.status === s.value ? "font-semibold bg-primary/5" : ""}
                          >
                            {s.label}
                            {req.status === s.value && <span className="ml-auto text-primary text-xs">✓</span>}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(req.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          Xoá yêu cầu
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

      {/* Dialog xem chi tiết */}
      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">
              Chi tiết yêu cầu{" "}
              <span className="text-primary">{viewItem?.requestCode}</span>
            </DialogTitle>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-5 font-body text-sm">
              {/* Thông tin khách hàng */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Thông tin khách hàng</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Họ tên</p>
                    <p className="font-semibold text-foreground">{viewItem.customerName}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Sự kiện</p>
                    <p className="font-semibold text-foreground">
                      {parseEventNameFromNote(viewItem.note) ?? viewItem.eventType}
                    </p>
                    {parseEventNameFromNote(viewItem.note) && (
                      <p className="text-xs text-muted-foreground">{viewItem.eventType}</p>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail size={11} /> Email</p>
                    <p className="text-foreground break-all">{viewItem.email}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone size={11} /> Điện thoại</p>
                    <p className="text-foreground">{viewItem.phone}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-border/50" />

              {/* Thông tin sự kiện */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Thông tin sự kiện</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar size={11} /> Ngày tổ chức</p>
                    <p className="text-foreground">
                      {viewItem.eventDate ? new Date(viewItem.eventDate).toLocaleDateString("vi-VN") : "—"}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Users size={11} /> Số khách</p>
                    <p className="text-foreground">{viewItem.guestCount ?? 0} khách</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign size={11} /> Ngân sách</p>
                    <p className="font-semibold text-foreground">{viewItem.budgetRange || "—"}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={11} /> Địa điểm</p>
                    <p className="text-foreground">{viewItem.locationText || "—"}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-border/50" />

              {/* Trạng thái & phụ trách */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Trạng thái</p>
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[viewItem.status] ?? "bg-muted text-muted-foreground"}`}>
                    {statusLabel[viewItem.status] ?? viewItem.status}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><UserPlus size={11} /> Phụ trách</p>
                  <p className="text-foreground">{viewItem.assignedManager?.displayName || "Chưa phân công"}</p>
                </div>
              </div>

              {viewItem.note && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5 mb-3">
                    <FileText size={12} /> Ghi chú
                  </p>
                  <div className="font-body text-sm leading-relaxed">
                    <NoteContent note={viewItem.note} />
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setViewItem(null)}>Đóng</Button>
            <Button variant="hero" onClick={() => { setAssignItem(viewItem); setViewItem(null); }}>
              <UserPlus size={14} className="mr-1.5" /> Phân công
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog phân công quản lý */}
      <Dialog open={!!assignItem} onOpenChange={() => setAssignItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">
              Phân công quản lý —{" "}
              <span className="text-primary">{assignItem?.requestCode}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-surface-low rounded-xl p-4 space-y-2 text-sm font-body">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sự kiện</span>
                <span className="font-semibold text-foreground">{assignItem?.eventType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Khách hàng</span>
                <span className="text-foreground">{assignItem?.customerName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Trạng thái</span>
                {assignItem && (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[assignItem.status] ?? "bg-muted text-muted-foreground"}`}>
                    {statusLabel[assignItem.status] ?? assignItem.status}
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="font-body text-sm font-medium text-foreground">Chọn người phụ trách</label>
              <Select value={selectedManager} onValueChange={setSelectedManager}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="-- Chọn quản lý --" />
                </SelectTrigger>
                <SelectContent>
                  {managers.length === 0
                    ? <SelectItem value="__empty__" disabled>Không có quản lý nào</SelectItem>
                    : managers.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          <div className="flex flex-col">
                            <span>{m.displayName}</span>
                            <span className="text-xs text-muted-foreground">{m.email}</span>
                          </div>
                        </SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setAssignItem(null)}>Huỷ</Button>
            <Button variant="hero" onClick={handleAssign} disabled={!selectedManager}>
              Xác nhận phân công
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRequests;
