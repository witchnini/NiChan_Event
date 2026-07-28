import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bell, Check, CheckCheck, Search, MailOpen, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/services/apiClient";
import { getSocket } from "@/services/socket";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { getNotificationRoute } from "@/utils/notificationRoute";

type NotificationItem = {
  id: string;
  title?: string | null;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  entityType?: string | null;
  entityId?: string | null;
};

const categoryColors: Record<string, string> = {
  task: "bg-primary/10 text-primary",
  vendor: "bg-secondary/10 text-secondary",
  budget: "bg-destructive/10 text-destructive",
  staff: "bg-accent/20 text-accent-foreground",
  project: "bg-muted text-muted-foreground",
};

// Nhãn tiếng Việt cho từng loại thông báo. Loại lạ sẽ hiển thị nguyên giá trị.
const typeLabels: Record<string, string> = {
  request: "Yêu cầu",
  project: "Dự án",
  task: "Công việc",
  vendor: "Nhà cung cấp",
  budget: "Ngân sách",
  staff: "Nhân sự",
  payment: "Thanh toán",
  contract: "Hợp đồng",
  system: "Hệ thống",
};

const typeLabel = (type: string) => typeLabels[type] ?? type;

const OrganizerNotifications = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterRead, setFilterRead] = useState("all");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<NotificationItem[]>("/organizer/notifications", {
        type: filterType === "all" ? undefined : filterType,
        read: filterRead === "all" ? undefined : filterRead === "read",
        pageSize: 100,
      });
      setNotifications(data);
    } catch (error) {
      toast.error("Không tải được thông báo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, [filterType, filterRead]);

  // Real-time: thêm thông báo mới qua Socket.IO nếu khớp bộ lọc đang chọn.
  useEffect(() => {
    const socket = getSocket();
    const handleNotification = (payload: NotificationItem & { createdAt: string }) => {
      // Thông báo mới luôn ở trạng thái chưa đọc.
      if (filterRead === "read") return;
      if (filterType !== "all" && payload.type !== filterType) return;
      setNotifications((prev) => (
        prev.some((n) => n.id === payload.id)
          ? prev
          : [{ ...payload, isRead: false }, ...prev]
      ));
    };
    socket.on("notification", handleNotification);
    return () => {
      socket.off("notification", handleNotification);
    };
  }, [filterType, filterRead]);

  const filtered = useMemo(() => notifications.filter(n => `${n.title ?? ""} ${n.message}`.toLowerCase().includes(search.toLowerCase())), [notifications, search]);
  const types = useMemo(() => Array.from(new Set(notifications.map(n => n.type))).filter(Boolean), [notifications]);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = async (id: string) => {
    try {
      await apiClient.patch(`/organizer/notifications/${id}/read`);
      await loadNotifications();
    } catch (error) {
      toast.error("Cập nhật thông báo thất bại");
    }
  };

  const markAllRead = async () => {
    await Promise.all(notifications.filter(n => !n.isRead).map(n => apiClient.patch(`/organizer/notifications/${n.id}/read`)));
    toast.success("Đã đánh dấu tất cả là đã đọc");
    await loadNotifications();
  };

  const openNotification = async (notification: NotificationItem) => {
    try {
      if (!notification.isRead) {
        await apiClient.patch(`/organizer/notifications/${notification.id}/read`);
      }
    } catch {
      toast.error("Không thể cập nhật trạng thái thông báo");
    } finally {
      navigate(getNotificationRoute(notification, "organizer"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-headline-lg text-foreground">Thông báo</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">{loading ? "Đang tải..." : `${unreadCount} thông báo chưa đọc`}</p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
          <CheckCheck size={14} /> Đọc tất cả
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Tìm kiếm thông báo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="rounded-xl border border-border bg-surface-lowest px-3 py-2 font-body text-sm text-foreground">
          <option value="all">Tất cả loại</option>
          {types.map(type => <option key={type} value={type}>{typeLabel(type)}</option>)}
        </select>
        <select value={filterRead} onChange={e => setFilterRead(e.target.value)} className="rounded-xl border border-border bg-surface-lowest px-3 py-2 font-body text-sm text-foreground">
          <option value="all">Tất cả</option>
          <option value="unread">Chưa đọc</option>
          <option value="read">Đã đọc</option>
        </select>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-surface-lowest rounded-xl shadow-ambient">
            <Bell size={40} className="mx-auto text-muted-foreground mb-4" />
            <p className="font-body text-muted-foreground">Không có thông báo nào</p>
          </div>
        ) : (
          filtered.map((n, i) => (
            <motion.div key={n.id} role="button" tabIndex={0} onClick={() => void openNotification(n)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") void openNotification(n); }} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className={`flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all ${!n.isRead ? "bg-secondary/5 shadow-ambient" : "bg-surface-lowest hover:bg-surface-low"}`}>
              <div className="mt-1 shrink-0">{!n.isRead ? <Mail size={18} className="text-secondary" /> : <MailOpen size={18} className="text-muted-foreground" />}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className={`font-body text-sm ${!n.isRead ? "font-semibold text-foreground" : "text-foreground"}`}>{n.title || typeLabel(n.type)}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${categoryColors[n.type] ?? "bg-muted text-muted-foreground"}`}>{typeLabel(n.type)}</span>
                </div>
                <p className={`font-body text-sm ${!n.isRead ? "text-foreground" : "text-muted-foreground"}`}>{n.message}</p>
                <p className="font-body text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString("vi-VN")}</p>
              </div>
              {!n.isRead && (
                <button onClick={(event) => { event.stopPropagation(); void markAsRead(n.id); }} className="p-1.5 rounded-lg hover:bg-surface-low text-muted-foreground hover:text-foreground transition-colors">
                  <Check size={14} />
                </button>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default OrganizerNotifications;
