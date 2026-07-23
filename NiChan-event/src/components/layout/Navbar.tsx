import { useState, useRef, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut, User, ChevronDown, Mail, Settings, Shield, LayoutDashboard, Sparkles, Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { getServiceCategories, type PublicServiceCategory } from "@/services/api";
import { apiClient } from "@/services/apiClient";
import { getSocket } from "@/services/socket";
import { toast } from "sonner";
import { useChatNotification } from "@/hooks/useChatNotification";

const navLinks = [
  { label: "Trang chủ", path: "/" },
  { label: "Dịch vụ", path: "/dich-vu", hasDropdown: true },
  { label: "Portfolio", path: "/portfolio" },
  { label: "Blog", path: "/blog" },
  { label: "Giới thiệu", path: "/gioi-thieu" },
  { label: "Liên hệ", path: "/lien-he" },
];

const customerLinks = [
  { label: "Tổng quan", path: "/dashboard" },
  { label: "Sự kiện", path: "/dashboard/su-kien" },
  { label: "Hợp đồng", path: "/dashboard/hop-dong" },
  { label: "Đánh giá", path: "/dashboard/danh-gia" },
];

const roleLabels = {
  admin: "Quản trị viên",
  organizer: "Ban tổ chức",
  customer: "Khách hàng",
} as const;

type CustomerNotification = {
  id: string;
  title?: string | null;
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

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);
  const [mobileServiceOpen, setMobileServiceOpen] = useState(false);
  const [serviceCategories, setServiceCategories] = useState<PublicServiceCategory[]>([]);
  const profileRef = useRef<HTMLDivElement>(null);
  const desktopNotificationRef = useRef<HTMLDivElement>(null);
  const mobileNotificationRef = useRef<HTMLDivElement>(null);
  const serviceDropdownRef = useRef<HTMLDivElement>(null);
  const serviceDropdownTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();

  const isCustomerRoute = location.pathname.startsWith("/dashboard");
  const currentRole = user?.role ?? null;
  const roleLabel = currentRole ? roleLabels[currentRole] : "";
  const panelPath =
    currentRole === "customer" ? "/dashboard" : currentRole === "admin" ? "/admin" : currentRole === "organizer" ? "/ban-to-chuc" : "";
  const profilePath =
    currentRole === "customer" ? "/dashboard/ho-so" : currentRole === "admin" ? "/admin/ho-so" : currentRole === "organizer" ? "/ban-to-chuc/ho-so" : "/";

  const links = isCustomerRoute ? customerLinks : navLinks;
  const isCustomerUser = currentRole === "customer";
  // Lắng nghe tin nhắn chat mới — hiện toast + browser notification + âm thanh
  useChatNotification();
  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.isRead),
    [notifications],
  );

  // Fetch service categories once
  useEffect(() => {
    let cancelled = false;
    const loadCategories = async () => {
      try {
        const data = await getServiceCategories();
        if (!cancelled) setServiceCategories(data);
      } catch {
        // silently ignore – dropdown will just show "Tất cả dịch vụ"
      }
    };
    loadCategories();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      const isInsideNotification =
        desktopNotificationRef.current?.contains(e.target as Node) ||
        mobileNotificationRef.current?.contains(e.target as Node);
      if (!isInsideNotification) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !isCustomerUser) {
      setNotifications([]);
      setNotifOpen(false);
      return;
    }

    let cancelled = false;
    const loadNotifications = async () => {
      try {
        const data = await apiClient.get<CustomerNotification[]>("/customer/notifications", {
          pageSize: 20,
        });
        if (!cancelled) setNotifications(data);
      } catch {
        if (!cancelled) setNotifications([]);
      }
    };

    void loadNotifications();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isCustomerUser, user?.userId]);

  useEffect(() => {
    if (!isAuthenticated || !isCustomerUser) return;

    const socket = getSocket();
    const handleNotification = (payload: {
      id: string;
      title?: string | null;
      message: string;
      createdAt: string;
    }) => {
      setNotifications((prev) => (
        prev.some((notification) => notification.id === payload.id)
          ? prev
          : [{ ...payload, isRead: false }, ...prev]
      ));
    };

    socket.on("notification", handleNotification);
    return () => {
      socket.off("notification", handleNotification);
    };
  }, [isAuthenticated, isCustomerUser, user?.userId]);

  // Close dropdown when navigating
  useEffect(() => {
    setServiceDropdownOpen(false);
    setMobileServiceOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  const handleServiceMouseEnter = () => {
    if (serviceDropdownTimeout.current) {
      clearTimeout(serviceDropdownTimeout.current);
      serviceDropdownTimeout.current = null;
    }
    setServiceDropdownOpen(true);
  };

  const handleServiceMouseLeave = () => {
    serviceDropdownTimeout.current = setTimeout(() => {
      setServiceDropdownOpen(false);
    }, 150);
  };

  const markNotificationAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((notification) => (
      notification.id === id ? { ...notification, isRead: true } : notification
    )));

    try {
      await apiClient.patch(`/customer/notifications/${id}/read`);
    } catch {
      toast.error("Không thể cập nhật trạng thái thông báo");
    }
  };

  const markAllNotificationsRead = async () => {
    const unreadIds = unreadNotifications.map((notification) => notification.id);
    if (unreadIds.length === 0) return;

    setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true })));

    try {
      await Promise.all(unreadIds.map((id) => apiClient.patch(`/customer/notifications/${id}/read`)));
      toast.success("Đã đánh dấu tất cả là đã đọc");
    } catch {
      toast.error("Không thể cập nhật tất cả thông báo");
    }
  };

  const handleLogout = async () => {
    setProfileOpen(false);
    setNotifOpen(false);
    setIsOpen(false);
    await logout();
  };

  const avatarText = user?.displayName?.trim()?.charAt(0)?.toUpperCase() || "U";
  const renderNotificationDropdown = (panelClassName: string) => (
    <AnimatePresence>
      {notifOpen && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className={panelClassName}
        >
          <div className="flex items-center justify-between p-4 bg-surface-low">
            <h3 className="font-serif font-semibold text-foreground text-sm">Thông báo</h3>
            {unreadNotifications.length > 0 && (
              <button onClick={markAllNotificationsRead} className="font-body text-xs text-primary hover:underline">
                Đánh dấu tất cả
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => markNotificationAsRead(notification.id)}
                className={`w-full text-left p-4 border-b border-border hover:bg-surface-low transition-colors ${!notification.isRead ? "bg-primary/5" : ""}`}
              >
                <div className="flex items-start gap-3">
                  {!notification.isRead && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                  <div className={!notification.isRead ? "" : "ml-5"}>
                    {notification.title && (
                      <p className={`font-body text-xs mb-1 ${!notification.isRead ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                        {notification.title}
                      </p>
                    )}
                    <p className={`font-body text-sm ${!notification.isRead ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                      {notification.message}
                    </p>
                    <p className="font-body text-xs text-muted-foreground mt-1">
                      {formatNotificationTime(notification.createdAt)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
            {notifications.length === 0 && (
              <p className="p-4 font-body text-sm text-muted-foreground">Chưa có thông báo.</p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/logo2.png"
            alt=""
            aria-hidden="true"
            width={564}
            height={442}
            className="h-10 w-auto shrink-0 object-contain sm:h-11"
          />
          <span className="font-serif text-headline-md text-primary font-bold">NiChan</span>
          <span className="font-serif text-headline-md text-foreground font-light">Events</span>
        </Link>

        <div className="hidden lg:flex items-center gap-8">
          {links.map((link) => {
            // Special handling for "Dịch vụ" with dropdown
            if ('hasDropdown' in link && link.hasDropdown) {
              return (
                <div
                  key={link.path}
                  className="relative"
                  ref={serviceDropdownRef}
                  onMouseEnter={handleServiceMouseEnter}
                  onMouseLeave={handleServiceMouseLeave}
                >
                  <Link
                    to={link.path}
                    className={`font-body text-sm tracking-wide transition-colors duration-300 hover:text-primary inline-flex items-center gap-1 ${
                      location.pathname.startsWith("/dich-vu") ? "text-primary font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    {link.label}
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-300 ${serviceDropdownOpen ? "rotate-180" : ""}`}
                    />
                  </Link>

                  <AnimatePresence>
                    {serviceDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.96 }}
                        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                        className="absolute left-1/2 -translate-x-1/2 top-full pt-3 z-50"
                      >
                        <div className="w-64 bg-background rounded-2xl shadow-ambient-lg border border-border overflow-hidden">
                          {/* Header */}
                          <div className="px-4 pt-4 pb-3 border-b border-border">
                            <p className="font-body text-xs tracking-editorial text-primary font-semibold uppercase">Danh mục dịch vụ</p>
                          </div>

                          {/* Category list */}
                          <div className="p-2">
                            {serviceCategories.map((cat, i) => (
                              <motion.div
                                key={cat.id}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.04, duration: 0.2 }}
                              >
                                <Link
                                  to={`/dich-vu?category=${cat.slug}`}
                                  onClick={() => setServiceDropdownOpen(false)}
                                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-body text-sm text-foreground hover:bg-surface-low hover:text-primary transition-all duration-200 group"
                                >
                                  <span className="w-2 h-2 rounded-full bg-primary/30 group-hover:bg-primary transition-colors duration-200" />
                                  {cat.name}
                                </Link>
                              </motion.div>
                            ))}

                            {serviceCategories.length === 0 && (
                              <p className="px-3 py-2 font-body text-sm text-muted-foreground">Đang tải...</p>
                            )}
                          </div>

                          {/* Footer link */}
                          <div className="px-2 pb-2 pt-1 border-t border-border">
                            <Link
                              to="/dich-vu"
                              onClick={() => setServiceDropdownOpen(false)}
                              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-body text-sm font-semibold text-primary hover:bg-primary/5 transition-all duration-200"
                            >
                              <Sparkles size={14} />
                              Xem tất cả dịch vụ
                            </Link>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }

            return (
              <Link
                key={link.path}
                to={link.path}
                className={`font-body text-sm tracking-wide transition-colors duration-300 hover:text-primary ${
                  location.pathname === link.path ? "text-primary font-semibold" : "text-muted-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {isAuthenticated && user ? (
          <div className="hidden lg:flex items-center gap-3">
            {isCustomerUser && (
              <div className="relative" ref={desktopNotificationRef}>
                <button
                  onClick={() => {
                    setNotifOpen((open) => !open);
                    setProfileOpen(false);
                  }}
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-surface-low hover:text-foreground transition-all"
                  aria-label="Thông báo"
                >
                  <Bell size={20} />
                  {unreadNotifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full gradient-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                      {unreadNotifications.length}
                    </span>
                  )}
                </button>
                {renderNotificationDropdown("absolute right-0 top-full mt-2 w-80 bg-background rounded-2xl shadow-ambient-lg border border-border overflow-hidden z-50")}
              </div>
            )}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => {
                  setProfileOpen(!profileOpen);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-surface-low transition-all"
              >
                <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-body font-bold text-sm">
                  {avatarText}
                </div>
                <div className="text-left hidden xl:block">
                  <p className="font-body text-sm font-semibold text-foreground leading-tight">{user.displayName}</p>
                  <p className="font-body text-xs text-muted-foreground leading-tight">{roleLabel}</p>
                </div>
                <ChevronDown size={14} className={`text-muted-foreground transition-transform ${profileOpen ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-72 bg-background rounded-2xl shadow-ambient-lg border border-border overflow-hidden z-50"
                  >
                    <div className="p-5 bg-surface-low">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-body font-bold text-lg">
                          {avatarText}
                        </div>
                        <div>
                          <p className="font-body text-sm font-semibold text-foreground">{user.displayName}</p>
                          <span className="px-2 py-0.5 rounded-full text-xs font-body font-semibold bg-primary/10 text-primary">
                            {roleLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 space-y-3 border-b border-border">
                      <div className="flex items-center gap-3 text-sm font-body">
                        <Mail size={14} className="text-muted-foreground shrink-0" />
                        <span className="text-foreground">{user.email}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm font-body">
                        <Shield size={14} className="text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">{roleLabel}</span>
                      </div>
                    </div>

                    <div className="p-2">
                      <Link
                        to={profilePath}
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-body text-sm text-foreground hover:bg-surface-low transition-all w-full"
                      >
                        <User size={14} /> Hồ sơ cá nhân
                      </Link>
                      {panelPath && (
                        <Link
                          to={panelPath}
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-body text-sm text-foreground hover:bg-surface-low transition-all w-full"
                        >
                          <LayoutDashboard size={14} /> {currentRole === "customer" ? "Tổng quan" : "Quay lại Panel"}
                        </Link>
                      )}
                      <div className="my-1 border-t border-border" />
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-body text-sm text-destructive hover:bg-destructive/10 transition-all w-full"
                      >
                        <LogOut size={14} /> Đăng xuất
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex items-center gap-3">
            <Link to="/dang-nhap">
              <Button variant="tertiary" size="lg">
                Đăng nhập
              </Button>
            </Link>
            <Link to="/lien-he">
              <Button variant="hero" size="lg">
                Yêu cầu báo giá
              </Button>
            </Link>
          </div>
        )}

        <div className="flex items-center gap-2 lg:hidden">
          {isAuthenticated && user && isCustomerUser && (
            <div className="relative" ref={mobileNotificationRef}>
              <button
                onClick={() => {
                  setNotifOpen((open) => !open);
                  setIsOpen(false);
                }}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-surface-low hover:text-foreground transition-all"
                aria-label="Thông báo"
              >
                <Bell size={20} />
                {unreadNotifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full gradient-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                    {unreadNotifications.length}
                  </span>
                )}
              </button>
              {renderNotificationDropdown("absolute right-0 top-full mt-2 w-[min(calc(100vw-2rem),20rem)] bg-background rounded-2xl shadow-ambient-lg border border-border overflow-hidden z-50")}
            </div>
          )}
          <button onClick={() => { setIsOpen(!isOpen); setNotifOpen(false); }} className="text-foreground">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden glass overflow-hidden"
          >
            <div className="container mx-auto px-6 py-6 flex flex-col gap-4">
              {isAuthenticated && user && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-low mb-2">
                  <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-body font-bold">
                    {avatarText}
                  </div>
                  <div>
                    <p className="font-body text-sm font-semibold text-foreground">{user.displayName}</p>
                    <p className="font-body text-xs text-muted-foreground">{roleLabel}</p>
                    <p className="font-body text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              )}

              {links.map((link) => {
                // Mobile: "Dịch vụ" with expandable sub-menu
                if ('hasDropdown' in link && link.hasDropdown) {
                  return (
                    <div key={link.path}>
                      <button
                        onClick={() => setMobileServiceOpen(!mobileServiceOpen)}
                        className={`font-body text-base py-2 transition-colors flex items-center gap-1 w-full text-left ${
                          location.pathname.startsWith("/dich-vu") ? "text-primary font-semibold" : "text-muted-foreground"
                        }`}
                      >
                        {link.label}
                        <ChevronDown
                          size={16}
                          className={`transition-transform duration-300 ${mobileServiceOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      <AnimatePresence>
                        {mobileServiceOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="pl-4 border-l-2 border-primary/20 ml-1 mt-1 mb-2 flex flex-col gap-1">
                              {serviceCategories.map((cat) => (
                                <Link
                                  key={cat.id}
                                  to={`/dich-vu?category=${cat.slug}`}
                                  onClick={() => { setIsOpen(false); setMobileServiceOpen(false); }}
                                  className="font-body text-sm py-1.5 text-muted-foreground hover:text-primary transition-colors"
                                >
                                  {cat.name}
                                </Link>
                              ))}
                              <Link
                                to="/dich-vu"
                                onClick={() => { setIsOpen(false); setMobileServiceOpen(false); }}
                                className="font-body text-sm py-1.5 text-primary font-semibold"
                              >
                                Xem tất cả dịch vụ →
                              </Link>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                }

                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsOpen(false)}
                    className={`font-body text-base py-2 transition-colors ${
                      location.pathname === link.path ? "text-primary font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}

              {isAuthenticated && user ? (
                <>
                  <Link to={profilePath} onClick={() => setIsOpen(false)}>
                    <Button variant="outline" size="lg" className="w-full mt-2 gap-2">
                      <User size={16} /> Hồ sơ cá nhân
                    </Button>
                  </Link>
                  {panelPath && (
                    <Link to={panelPath} onClick={() => setIsOpen(false)}>
                      <Button variant="tertiary" size="lg" className="w-full gap-2">
                        <Settings size={16} /> {currentRole === "customer" ? "Tổng quan" : "Quay lại Panel"}
                      </Button>
                    </Link>
                  )}
                  <Button variant="tertiary" size="lg" className="w-full mt-2 gap-2" onClick={handleLogout}>
                    <LogOut size={16} /> Đăng xuất
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/dang-nhap" onClick={() => setIsOpen(false)}>
                    <Button variant="tertiary" size="lg" className="w-full mt-2">
                      Đăng nhập
                    </Button>
                  </Link>
                  <Link to="/lien-he" onClick={() => setIsOpen(false)}>
                    <Button variant="hero" size="lg" className="w-full">
                      Yêu cầu báo giá
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;

