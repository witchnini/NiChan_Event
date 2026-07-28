import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, FolderKanban, MessageSquare, Wallet, FileBarChart,
  Globe, LogOut, Menu, X, ChevronLeft, Bell,
} from "lucide-react";
import { toast } from "sonner";
import { getNotificationRoute } from "@/utils/notificationRoute";
import { apiClient } from "@/services/apiClient";
import { getSocket } from "@/services/socket";
import { useAuth } from "@/contexts/AuthContext";
import { useChatNotification } from "@/hooks/useChatNotification";

const sidebarItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/ban-to-chuc" },
  { label: "Quản lý dự án", icon: FolderKanban, path: "/ban-to-chuc/du-an" },
  { label: "Trao đổi", icon: MessageSquare, path: "/ban-to-chuc/trao-doi" },
  { label: "Ngân sách", icon: Wallet, path: "/ban-to-chuc/ngan-sach" },
  { label: "Báo cáo & Tổng kết", icon: FileBarChart, path: "/ban-to-chuc/bao-cao" },
  { label: "Thông báo", icon: Bell, path: "/ban-to-chuc/thong-bao" },
];

type OrganizerProfileResponse = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  phone?: string | null;
  avatarUrl?: string | null;
  organizerProfile?: {
    fullName: string;
    jobTitle: string;
    address?: string | null;
    bio?: string | null;
  } | null;
};

type AppNotification = {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  type?: string | null;
  entityType?: string | null;
  entityId?: string | null;
};

const formatNotificationTime = (value: string) =>
  new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });

const OrganizerLayout = () => {
  const { logout, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [profile, setProfile] = useState<OrganizerProfileResponse | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Lắng nghe tin nhắn chat mới — hiện toast + browser notification + âm thanh
  const { totalUnread: unreadChatCount, clearAll: clearChatUnread } = useChatNotification();

  // Tự động xóa badge khi user đang ở trang trao đổi
  const isOnChatPage = location.pathname.startsWith("/ban-to-chuc/trao-doi");
  useEffect(() => {
    if (isOnChatPage) clearChatUnread();
  }, [isOnChatPage, clearChatUnread]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [profileData, notificationsData] = await Promise.all([
          apiClient.get<OrganizerProfileResponse>("/organizer/profile"),
          apiClient.get<AppNotification[]>("/organizer/notifications"),
        ]);

        if (cancelled) return;
        setProfile(profileData);
        setNotifications(notificationsData);
      } catch {
        if (!cancelled) {
          setProfile(null);
          setNotifications([]);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Real-time: nhận thông báo mới qua Socket.IO và thêm vào đầu danh sách.
  useEffect(() => {
    const socket = getSocket();
    const handleNotification = (payload: AppNotification) => {
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
  }, []);

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.isRead),
    [notifications],
  );

  const displayName = profile?.organizerProfile?.fullName || profile?.displayName || user?.displayName || "Organizer";
  const displayRole = profile?.organizerProfile?.jobTitle || "Ban tổ chức";
  const avatarText = displayName.trim().charAt(0).toUpperCase();

  const markAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((notification) => (
      notification.id === id ? { ...notification, isRead: true } : notification
    )));
    try {
      await apiClient.patch(`/organizer/notifications/${id}/read`);
    } catch {
      toast.error("Không thể cập nhật trạng thái thông báo");
    }
  };

  const markAllRead = async () => {
    const unreadIds = unreadNotifications.map((notification) => notification.id);
    setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true })));

    try {
      await Promise.all(unreadIds.map((id) => apiClient.patch(`/organizer/notifications/${id}/read`)));
      toast.success("Đã đánh dấu tất cả là đã đọc");
    } catch {
      toast.error("Không thể cập nhật tất cả thông báo");
    }
  };

  const openNotification = async (notification: AppNotification) => {
    await markAsRead(notification.id);
    setNotifOpen(false);
    navigate(getNotificationRoute(notification, "organizer"));
  };

  const handleLogout = async () => {
    await logout();
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 flex items-center gap-2">
        <Link to="/ban-to-chuc" className="flex items-center gap-2">
          <span className="font-serif text-headline-md text-secondary font-bold">N</span>
          {!collapsed && <span className="font-serif text-headline-md text-foreground font-light">Organizer</span>}
        </Link>
        <button onClick={() => setCollapsed(!collapsed)} className="ml-auto hidden lg:block text-muted-foreground hover:text-foreground">
          <ChevronLeft size={18} className={`transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {sidebarItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== "/ban-to-chuc" && location.pathname.startsWith(item.path));
          const chatBadge = item.path === "/ban-to-chuc/trao-doi" && unreadChatCount > 0;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => { setMobileOpen(false); if (item.path === "/ban-to-chuc/trao-doi") clearChatUnread(); }}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl font-body text-sm transition-all ${isActive ? "bg-secondary text-secondary-foreground font-semibold shadow-ambient" : "text-muted-foreground hover:text-foreground hover:bg-surface-low"}`}
            >
              <item.icon size={18} />
              {!collapsed && <span>{item.label}</span>}
              {chatBadge && !isOnChatPage && (
                collapsed ? (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
                ) : (
                  <span className="ml-auto min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] flex items-center justify-center font-bold">
                    {unreadChatCount > 99 ? "99+" : unreadChatCount}
                  </span>
                )
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 space-y-1">
        {profile && !collapsed && (
          <div className="px-3 py-2.5 mb-1 rounded-xl bg-surface-low">
            <p className="font-body text-xs font-semibold text-foreground truncate">{displayName}</p>
            <p className="font-body text-xs text-muted-foreground truncate">{displayRole}</p>
            <p className="font-body text-xs text-muted-foreground truncate">{profile.email}</p>
          </div>
        )}
        <Link
          to="/"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-body text-sm text-muted-foreground hover:text-foreground hover:bg-surface-low transition-all"
        >
          <Globe size={18} />{!collapsed && <span>Xem website</span>}
        </Link>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-body text-sm text-destructive hover:bg-destructive/10 transition-all">
          <LogOut size={18} />{!collapsed && <span>Đăng xuất</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-surface-low">
      <aside className={`hidden lg:flex flex-col bg-surface-lowest shadow-ambient-lg transition-all duration-300 ${collapsed ? "w-16" : "w-64"}`}>
        <SidebarContent />
      </aside>
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-foreground/30 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} className="fixed left-0 top-0 bottom-0 w-64 bg-surface-lowest shadow-ambient-lg z-50 lg:hidden">
              <div className="flex items-center justify-end p-4"><button onClick={() => setMobileOpen(false)}><X size={20} /></button></div>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-surface-lowest shadow-ambient flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden text-foreground"><Menu size={22} /></button>
            <h2 className="font-serif text-foreground font-semibold text-lg hidden md:block">
              {sidebarItems.find((item) => location.pathname === item.path || (item.path !== "/ban-to-chuc" && location.pathname.startsWith(item.path)))?.label || "Ban tổ chức"}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button onClick={() => setNotifOpen(!notifOpen)} className="relative text-muted-foreground hover:text-foreground">
                <Bell size={20} />
                {unreadNotifications.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-secondary text-secondary-foreground text-[10px] flex items-center justify-center font-bold">{unreadNotifications.length}</span>}
              </button>
              <AnimatePresence>
                {notifOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 top-full mt-2 w-80 bg-surface-lowest rounded-xl shadow-ambient-lg z-50 overflow-hidden">
                      <div className="flex items-center justify-between p-4 bg-surface-low">
                        <h3 className="font-serif font-semibold text-foreground text-sm">Thông báo</h3>
                        {unreadNotifications.length > 0 && <button onClick={markAllRead} className="font-body text-xs text-secondary hover:underline">Đánh dấu tất cả</button>}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.map((notification) => (
                          <button
                            key={notification.id}
                            onClick={() => void openNotification(notification)}
                            className={`w-full text-left p-4 border-b border-border hover:bg-surface-low transition-colors ${!notification.isRead ? "bg-secondary/5" : ""}`}
                          >
                            <div className="flex items-start gap-3">
                              {!notification.isRead && <span className="w-2 h-2 rounded-full bg-secondary mt-1.5 shrink-0" />}
                              <div className={!notification.isRead ? "" : "ml-5"}>
                                <p className={`font-body text-sm ${!notification.isRead ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{notification.message}</p>
                                <p className="font-body text-xs text-muted-foreground mt-1">{formatNotificationTime(notification.createdAt)}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                        {notifications.length === 0 && (
                          <p className="p-4 font-body text-sm text-muted-foreground">Chưa có thông báo.</p>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <Link to="/ban-to-chuc/ho-so" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-body font-bold text-sm">
                {avatarText}
              </div>
              <div className="hidden md:block text-right">
                <p className="font-body text-xs font-semibold text-foreground leading-tight">{displayName}</p>
                <p className="font-body text-xs text-muted-foreground leading-tight">{displayRole}</p>
              </div>
            </Link>
          </div>
        </header>
        <main className="flex-1 p-6"><Outlet /></main>
      </div>
    </div>
  );
};

export default OrganizerLayout;
