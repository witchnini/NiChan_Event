import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bell, Check, CheckCheck, Search, MailOpen, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

type NotificationItem = {
  id: string;
  title?: string | null;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
};

const categoryColors: Record<string, string> = {
  task: "bg-primary/10 text-primary",
  vendor: "bg-secondary/10 text-secondary",
  budget: "bg-destructive/10 text-destructive",
  staff: "bg-accent/20 text-accent-foreground",
  project: "bg-muted text-muted-foreground",
};

const OrganizerNotifications = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<NotificationItem[]>("/organizer/notifications", {
        type: filterType === "all" ? undefined : filterType,
        pageSize: 100,
      });
      setNotifications(data);
    } catch (error) {
      toast.error("Khong tai duoc thong bao");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, [filterType]);

  const filtered = useMemo(() => notifications.filter(n => `${n.title ?? ""} ${n.message}`.toLowerCase().includes(search.toLowerCase())), [notifications, search]);
  const types = useMemo(() => Array.from(new Set(notifications.map(n => n.type))).filter(Boolean), [notifications]);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = async (id: string) => {
    try {
      await apiClient.patch(`/organizer/notifications/${id}/read`);
      await loadNotifications();
    } catch (error) {
      toast.error("Cap nhat thong bao that bai");
    }
  };

  const markAllRead = async () => {
    await Promise.all(notifications.filter(n => !n.isRead).map(n => apiClient.patch(`/organizer/notifications/${n.id}/read`)));
    toast.success("Da danh dau tat ca da doc");
    await loadNotifications();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-headline-lg text-foreground">Thong bao</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">{loading ? "Dang tai..." : `${unreadCount} thong bao chua doc`}</p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
          <CheckCheck size={14} /> Doc tat ca
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Tim kiem..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="rounded-xl border border-border bg-surface-lowest px-3 py-2 font-body text-sm text-foreground">
          <option value="all">Tat ca</option>
          {types.map(type => <option key={type} value={type}>{type}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-surface-lowest rounded-xl shadow-ambient">
            <Bell size={40} className="mx-auto text-muted-foreground mb-4" />
            <p className="font-body text-muted-foreground">Khong co thong bao nao</p>
          </div>
        ) : (
          filtered.map((n, i) => (
            <motion.div key={n.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className={`flex items-start gap-4 p-4 rounded-xl transition-all ${!n.isRead ? "bg-secondary/5 shadow-ambient" : "bg-surface-lowest hover:bg-surface-low"}`}>
              <div className="mt-1 shrink-0">{!n.isRead ? <Mail size={18} className="text-secondary" /> : <MailOpen size={18} className="text-muted-foreground" />}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className={`font-body text-sm ${!n.isRead ? "font-semibold text-foreground" : "text-foreground"}`}>{n.title || n.type}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${categoryColors[n.type] ?? "bg-muted text-muted-foreground"}`}>{n.type}</span>
                </div>
                <p className={`font-body text-sm ${!n.isRead ? "text-foreground" : "text-muted-foreground"}`}>{n.message}</p>
                <p className="font-body text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString("vi-VN")}</p>
              </div>
              {!n.isRead && (
                <button onClick={() => markAsRead(n.id)} className="p-1.5 rounded-lg hover:bg-surface-low text-muted-foreground hover:text-foreground transition-colors">
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
