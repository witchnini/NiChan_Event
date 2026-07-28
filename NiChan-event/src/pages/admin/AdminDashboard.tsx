import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowUpRight,
  Calendar,
  Clock,
  DollarSign,
  FileSignature,
  FileText,
  ListTodo,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/services/apiClient";

type AdminDashboardResponse = {
  summary: {
    totalRequests: number;
    newRequests: number;
    requestsThisMonth: number;
    requestsTrend: number;
    totalEvents: number;
    activeEvents: number;
    newEventsThisMonth: number;
    eventsTrend: number;
    totalCustomers: number;
    newCustomersThisMonth: number;
    customersTrend: number;
    monthlyRevenue: number;
    revenueTrend: number;
  };
  actionItems: {
    unassignedRequests: number;
    overdueTasks: number;
    contractsAwaitingResponse: number;
  };
  monthlyRevenue: Record<string, number>;
  eventTypes: { type: string; _count: { type: number } }[];
  recentRequests: {
    id: string;
    customerName: string;
    eventType: string;
    budgetRange?: string | null;
    status: string;
    createdAt: string;
  }[];
  upcomingEvents: {
    id: string;
    name: string;
    eventDate?: string | null;
    progressPercent: number;
  }[];
};

const pieColors = [
  "hsl(355 63% 42%)",
  "hsl(113 33% 31%)",
  "hsl(355 55% 53%)",
  "hsl(38 35% 70%)",
  "hsl(38 20% 86%)",
];

const requestStatuses: { value: string; label: string; color: string }[] = [
  { value: "new",       label: "Mới",           color: "bg-primary/10 text-primary" },
  { value: "reviewing", label: "Đang xem xét",  color: "bg-muted text-muted-foreground" },
  { value: "quoted",    label: "Đã báo giá",    color: "bg-secondary/10 text-secondary" },
  { value: "confirmed", label: "Đã xác nhận",   color: "bg-secondary/20 text-secondary" },
  { value: "planning", label: "Lập kế hoạch",    color: "bg-primary/10 text-primary" },
  { value: "in_progress", label: "Đang triển khai", color: "bg-primary/15 text-primary" },
  { value: "completed", label: "Hoàn thành",     color: "bg-green-100 text-green-700" },
  { value: "cancelled", label: "Đã hủy",         color: "bg-destructive/10 text-destructive" },
  { value: "rejected",  label: "Từ chối",       color: "bg-destructive/10 text-destructive" },
];
const reqStatusLabel  = Object.fromEntries(requestStatuses.map(s => [s.value, s.label]));
const reqStatusColor  = Object.fromEntries(requestStatuses.map(s => [s.value, s.color]));

const formatMoney = (value: number) => `${Math.round(value / 1_000_000)}tr`;
const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa cập nhật");
const formatTrend = (value: number) => `${value > 0 ? "+" : ""}${value}% so với tháng trước`;
const formatMonth = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return `T${month}/${String(year).slice(-2)}`;
};

const eventTypeLabels: Record<string, string> = {
  wedding: "Tiệc cưới",
  conference: "Hội nghị",
  gala: "Gala",
  opening: "Khai trương",
  birthday: "Sinh nhật",
  corporate: "Doanh nghiệp",
};

const DashboardSkeleton = () => (
  <div className="space-y-6" aria-label="Đang tải dashboard">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-9 w-28" />
    </div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-36 rounded-xl" />
      ))}
    </div>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Skeleton className="h-80 rounded-xl lg:col-span-2" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
  </div>
);

const AdminDashboard = () => {
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mountedRef = useRef(true);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<AdminDashboardResponse>("/admin/dashboard");
      if (!mountedRef.current) return;
      setData(response);
      setLastUpdated(new Date());
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Không thể tải dashboard admin");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadDashboard();
    return () => {
      mountedRef.current = false;
    };
  }, [loadDashboard]);

  const monthlyRevenue = useMemo(
    () =>
      Object.entries(data?.monthlyRevenue || {}).map(([month, revenue]) => ({
        month: formatMonth(month),
        revenue: Math.round(revenue / 1_000_000),
      })),
    [data],
  );

  const eventTypes = useMemo(
    () =>
      (data?.eventTypes || []).map((item, index) => ({
        name: eventTypeLabels[item.type.toLowerCase()] ?? item.type,
        value: item._count.type,
        color: pieColors[index % pieColors.length],
      })),
    [data],
  );

  if (loading) return <DashboardSkeleton />;
  if (error && !data) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
        <AlertCircle className="mx-auto mb-3 text-destructive" size={32} />
        <p className="font-body font-semibold text-foreground">Không thể tải dashboard</p>
        <p className="mt-1 font-body text-sm text-muted-foreground">{error}</p>
        <Button className="mt-4" variant="outline" onClick={() => void loadDashboard()}>
          <RefreshCw size={14} /> Thử lại
        </Button>
      </div>
    );
  }
  if (!data) return null;

  const stats = [
    { label: "Doanh thu tháng", value: formatMoney(data.summary.monthlyRevenue), trend: data.summary.revenueTrend, sub: `${data.summary.activeEvents} sự kiện đang chạy`, icon: DollarSign, color: "text-primary" },
    { label: "Sự kiện đang chạy", value: String(data.summary.activeEvents), trend: data.summary.eventsTrend, sub: `${data.summary.newEventsThisMonth} mới tháng này / ${data.summary.totalEvents} tổng`, icon: Calendar, color: "text-secondary" },
    { label: "Yêu cầu mới", value: String(data.summary.newRequests), trend: data.summary.requestsTrend, sub: `${data.summary.requestsThisMonth} tiếp nhận tháng này`, icon: FileText, color: "text-primary" },
    { label: "Khách hàng", value: String(data.summary.totalCustomers), trend: data.summary.customersTrend, sub: `${data.summary.newCustomersThisMonth} đăng ký mới tháng này`, icon: Users, color: "text-secondary" },
  ];

  const actionItems = [
    {
      label: "Yêu cầu chưa phân công",
      value: data.actionItems.unassignedRequests,
      description: "Cần chỉ định người tổ chức phụ trách",
      icon: UserRoundCheck,
      path: "/admin/yeu-cau",
    },
    {
      label: "Công việc quá hạn",
      value: data.actionItems.overdueTasks,
      description: "Cần kiểm tra tiến độ dự án",
      icon: ListTodo,
      path: "/admin/du-an",
    },
    {
      label: "Hợp đồng chờ phản hồi",
      value: data.actionItems.contractsAwaitingResponse,
      description: "Đã gửi và đang chờ khách hàng",
      icon: FileSignature,
      path: "/admin/hop-dong",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-headline-lg text-foreground">Tổng quan vận hành</h1>
          <p className="mt-1 font-body text-sm text-muted-foreground">
            Theo dõi doanh thu, yêu cầu và tiến độ sự kiện trên toàn hệ thống.
            {lastUpdated && ` Cập nhật lúc ${lastUpdated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadDashboard(true)} disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Đang cập nhật" : "Làm mới"}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 font-body text-sm text-destructive">
          <AlertCircle size={16} />
          Không thể cập nhật dữ liệu mới. Dashboard đang hiển thị dữ liệu lần tải gần nhất.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const positive = stat.trend >= 0;
          const TrendIcon = positive ? TrendingUp : TrendingDown;
          return (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="bg-surface-lowest rounded-xl p-5 shadow-ambient"
            >
              <div className="flex items-center justify-between mb-3">
                <stat.icon size={20} className={stat.color} />
                <span
                  className={`flex items-center gap-1 text-xs font-body font-semibold ${positive ? "text-secondary" : "text-destructive"}`}
                  title={formatTrend(stat.trend)}
                >
                  <TrendIcon size={12} /> {stat.trend > 0 ? "+" : ""}{stat.trend}%
                </span>
              </div>
              <p className="font-serif text-headline-lg text-foreground">{stat.value}</p>
              <p className="font-body text-sm text-muted-foreground">{stat.label}</p>
              <p className="font-body text-xs text-muted-foreground/80 mt-1">{stat.sub}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {actionItems.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.08 }}
          >
            <Link
              to={item.path}
              className="group flex h-full items-center gap-4 rounded-xl border border-border bg-surface-lowest p-4 shadow-ambient transition-colors hover:border-primary/30 hover:bg-primary/5"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <item.icon size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-body text-sm font-semibold text-foreground">{item.label}</p>
                  <span className={`font-serif text-headline-md ${item.value > 0 ? "text-primary" : "text-secondary"}`}>
                    {item.value}
                  </span>
                </div>
                <p className="mt-0.5 font-body text-xs text-muted-foreground">{item.description}</p>
              </div>
              <ArrowUpRight className="text-muted-foreground transition-colors group-hover:text-primary" size={16} />
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-2 bg-surface-lowest rounded-xl p-6 shadow-ambient">
          <h3 className="font-serif text-headline-md text-foreground mb-6">Doanh thu theo tháng (triệu VNĐ)</h3>
          {monthlyRevenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(38 20% 86%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(50 8% 42%)" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(50 8% 42%)" }} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 40px rgba(0,0,0,0.04)" }} />
                <Bar dataKey="revenue" fill="hsl(355 63% 42%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="font-body text-sm text-muted-foreground">Chưa có dữ liệu doanh thu theo tháng.</p>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
          <h3 className="font-serif text-headline-md text-foreground mb-6">Loại sự kiện</h3>
          {eventTypes.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={eventTypes} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={50}>
                    {eventTypes.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-4">
                {eventTypes.map((type) => (
                  <div key={type.name} className="flex items-center justify-between text-sm font-body">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: type.color }} />
                      <span className="text-foreground">{type.name}</span>
                    </div>
                    <span className="text-muted-foreground">{type.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="font-body text-sm text-muted-foreground">Chưa có dữ liệu loại sự kiện.</p>
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-serif text-headline-md text-foreground">Yêu cầu gần đây</h3>
            <Link to="/admin/yeu-cau" className="text-primary font-body text-sm hover:underline flex items-center gap-1">Xem tất cả <ArrowUpRight size={14} /></Link>
          </div>
          <div className="space-y-4">
            {data.recentRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between py-3 border-b border-border last:border-0 gap-3">
                <div className="min-w-0">
                  <p className="font-body text-sm font-semibold text-foreground truncate">{req.customerName}</p>
                  <p className="font-body text-xs text-muted-foreground truncate">
                    {req.eventType} • {req.budgetRange || "Chưa có ngân sách"} • {formatDate(req.createdAt)}
                  </p>
                </div>
                <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-body font-semibold ${reqStatusColor[req.status] ?? "bg-muted text-muted-foreground"}`}>
                  {reqStatusLabel[req.status] ?? req.status}
                </span>
              </div>
            ))}
            {data.recentRequests.length === 0 && <p className="font-body text-sm text-muted-foreground">Chưa có yêu cầu mới.</p>}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-serif text-headline-md text-foreground">Sự kiện sắp tới</h3>
            <Link to="/admin/du-an" className="text-primary font-body text-sm hover:underline flex items-center gap-1">Xem tất cả <ArrowUpRight size={14} /></Link>
          </div>
          <div className="space-y-4">
            {data.upcomingEvents.map((event) => (
              <div key={event.id} className="bg-surface-low rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-body text-sm font-semibold text-foreground">{event.name}</p>
                  <div className="flex items-center gap-1 text-xs font-body">
                    {event.progressPercent < 30 && <AlertCircle size={12} className="text-primary" />}
                    <span className={event.progressPercent < 30 ? "text-primary font-semibold" : "text-muted-foreground"}>
                      {event.progressPercent}%
                    </span>
                  </div>
                </div>
                <p className="font-body text-xs text-muted-foreground mb-2"><Clock size={12} className="inline mr-1" />{formatDate(event.eventDate)}</p>
                <div className="w-full bg-surface-high rounded-full h-2">
                  <div className="h-2 rounded-full gradient-primary transition-all" style={{ width: `${event.progressPercent}%` }} />
                </div>
              </div>
            ))}
            {data.upcomingEvents.length === 0 && <p className="font-body text-sm text-muted-foreground">Chưa có sự kiện sắp tới.</p>}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminDashboard;
