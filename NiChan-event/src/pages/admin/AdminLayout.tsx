import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, FileText, Users, DollarSign,
  FileSignature, BarChart3, Globe, LogOut, Menu, X, ChevronLeft, Bell,
  FolderKanban, UserCog, Building2,
} from "lucide-react";
import { apiClient } from "@/services/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const sidebarItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  { label: "Yêu cầu", icon: FileText, path: "/admin/yeu-cau" },
  { label: "Dự án", icon: FolderKanban, path: "/admin/du-an" },
  { label: "Người dùng", icon: Users, path: "/admin/nguoi-dung" },
  { label: "Nhân sự", icon: UserCog, path: "/admin/nhan-su" },
  { label: "Nhà cung cấp", icon: Building2, path: "/admin/nha-cung-cap" },
  { label: "Nội dung", icon: Globe, path: "/admin/noi-dung" },
  { label: "Hợp đồng", icon: FileSignature, path: "/admin/hop-dong" },
  { label: "Tài chính", icon: DollarSign, path: "/admin/tai-chinh" },
  { label: "Thống kê", icon: BarChart3, path: "/admin/bao-cao" },
  { label: "Thông báo", icon: Bell, path: "/admin/thong-bao" },
];

type AdminProfileResponse = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  phone?: string | null;
  avatarUrl?: string | null;
  adminProfile?: {
    fullName: string;
    address?: string | null;
    bio?: string | null;
  } | null;
};

type AppNotification = {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

const formatNotificationTime = (value: string) =>
  new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });

const AdminLayout = () => {
  const { logout, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [profile, setProfile] = useState<AdminProfileResponse | null>(null);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [profileData, notificationsData] = await Promise.all([
          apiClient.get<AdminProfileResponse>("/admin/profile"),
          apiClient.get<AppNotification[]>("/admin/notifications"),
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

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.isRead),
    [notifications],
  );

  const displayName = profile?.adminProfile?.fullName || profile?.displayName || user?.displayName || "Admin";
  const avatarText = displayName.trim().charAt(0).toUpperCase();

  const markAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((notification) => (
      notification.id === id ? { ...notification, isRead: true } : notification
    )));

    try {
      await apiClient.patch(`/admin/notifications/${id}/read`);
    } catch {
      toast.error("Không thể cập nhật trạng thái thông báo");
    }
  };

  const markAllRead = async () => {
    const unreadIds = unreadNotifications.map((notification) => notification.id);
    setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true })));

    try {
      await Promise.all(unreadIds.map((id) => apiClient.patch(`/admin/notifications/${id}/read`)));
      toast.success("Đã đánh dấu tất cả là đã đọc");
    } catch {
      toast.error("Không thể cập nhật tất cả thông báo");
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 flex items-center gap-2">
        <Link to="/admin" className="flex items-center gap-2">
          <span className="font-serif text-headline-md text-primary font-bold">N</span>
          {!collapsed && <span className="font-serif text-headline-md text-foreground font-light">Admin</span>}
        </Link>
        <button onClick={() => setCollapsed(!collapsed)} className="ml-auto hidden lg:block text-muted-foreground hover:text-foreground">
          <ChevronLeft size={18} className={`transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {sidebarItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== "/admin" && location.pathname.startsWith(item.path));
          return (
            <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-body text-sm transition-all ${isActive ? "gradient-primary text-primary-foreground font-semibold shadow-ambient" : "text-muted-foreground hover:text-foreground hover:bg-surface-low"}`}
            >
              <item.icon size={18} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 space-y-1">
        {!collapsed && profile && (
          <div className="px-3 py-2.5 mb-1 rounded-xl bg-surface-low">
            <p className="font-body text-xs font-semibold text-foreground truncate">{displayName}</p>
            <p className="font-body text-xs text-muted-foreground truncate">Quản trị viên</p>
            <p className="font-body text-xs text-muted-foreground truncate">{profile.email}</p>
          </div>
        )}
        <Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-body text-sm text-muted-foreground hover:text-foreground hover:bg-surface-low transition-all">
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
              <div className="flex items-center justify-end p-4">
                <button onClick={() => setMobileOpen(false)}><X size={20} /></button>
              </div>
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
              {sidebarItems.find((item) => location.pathname === item.path || (item.path !== "/admin" && location.pathname.startsWith(item.path)))?.label || "Admin"}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button onClick={() => setNotifOpen(!notifOpen)} className="relative text-muted-foreground hover:text-foreground">
                <Bell size={20} />
                {unreadNotifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full gradient-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">{unreadNotifications.length}</span>
                )}
              </button>

              <AnimatePresence>
                {notifOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 top-full mt-2 w-80 bg-surface-lowest rounded-xl shadow-ambient-lg z-50 overflow-hidden"
                    >
                      <div className="flex items-center justify-between p-4 bg-surface-low">
                        <h3 className="font-serif font-semibold text-foreground text-sm">Thông báo</h3>
                        {unreadNotifications.length > 0 && (
                          <button onClick={markAllRead} className="font-body text-xs text-primary hover:underline">Đánh dấu tất cả</button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.map((notification) => (
                          <button key={notification.id} onClick={() => markAsRead(notification.id)}
                            className={`w-full text-left p-4 border-b border-border hover:bg-surface-low transition-colors ${!notification.isRead ? "bg-primary/5" : ""}`}
                          >
                            <div className="flex items-start gap-3">
                              {!notification.isRead && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
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

            <Link to="/admin/ho-so" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-body font-bold text-sm">{avatarText}</div>
              <div className="hidden md:block text-right">
                <p className="font-body text-xs font-semibold text-foreground leading-tight">{displayName}</p>
                <p className="font-body text-xs text-muted-foreground leading-tight">Quản trị viên</p>
              </div>
            </Link>
          </div>
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
