import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Calendar, Users, DollarSign, FileText, Clock, AlertCircle, ArrowUpRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
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
  { value: "completed", label: "Hoàn thành",     color: "bg-green-100 text-green-700" },
  { value: "cancelled", label: "Đã hủy",         color: "bg-destructive/10 text-destructive" },
  { value: "rejected",  label: "Từ chối",       color: "bg-destructive/10 text-destructive" },
];
const reqStatusLabel  = Object.fromEntries(requestStatuses.map(s => [s.value, s.label]));
const reqStatusColor  = Object.fromEntries(requestStatuses.map(s => [s.value, s.color]));

const formatMoney = (value: number) => `${Math.round(value / 1_000_000)}tr`;
const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa cập nhật");
const formatTrend = (value: number) => `${value > 0 ? "+" : ""}${value}% so với tháng trước`;

const AdminDashboard = () => {
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.get<AdminDashboardResponse>("/admin/dashboard");
        if (!cancelled) setData(response);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải dashboard admin");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const monthlyRevenue = useMemo(
    () =>
      Object.entries(data?.monthlyRevenue || {}).map(([month, revenue]) => ({
        month,
        revenue: Math.round(revenue / 1_000_000),
      })),
    [data],
  );

  const eventTypes = useMemo(
    () =>
      (data?.eventTypes || []).map((item, index) => ({
        name: item.type,
        value: item._count.type,
        color: pieColors[index % pieColors.length],
      })),
    [data],
  );

  if (loading) return <div className="font-body text-muted-foreground">Đang tải dashboard...</div>;
  if (error || !data) return <div className="font-body text-destructive">{error || "Không có dữ liệu dashboard"}</div>;

  const stats = [
    { label: "Doanh thu tháng", value: formatMoney(data.summary.monthlyRevenue), trend: data.summary.revenueTrend, sub: `${data.summary.activeEvents} sự kiện đang chạy`, icon: DollarSign, color: "text-primary" },
    { label: "Sự kiện đang chạy", value: String(data.summary.activeEvents), trend: data.summary.eventsTrend, sub: `${data.summary.newEventsThisMonth} mới tháng này / ${data.summary.totalEvents} tổng`, icon: Calendar, color: "text-secondary" },
    { label: "Yêu cầu mới", value: String(data.summary.newRequests), trend: data.summary.requestsTrend, sub: `${data.summary.requestsThisMonth} tiếp nhận tháng này`, icon: FileText, color: "text-primary" },
    { label: "Khách hàng", value: String(data.summary.totalCustomers), trend: data.summary.customersTrend, sub: `${data.summary.newCustomersThisMonth} đăng ký mới tháng này`, icon: Users, color: "text-secondary" },
  ];

  return (
    <div className="space-y-6">
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
            <a href="/admin/yeu-cau" className="text-primary font-body text-sm hover:underline flex items-center gap-1">Xem tất cả <ArrowUpRight size={14} /></a>
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
            <a href="/admin/du-an" className="text-primary font-body text-sm hover:underline flex items-center gap-1">Xem tất cả <ArrowUpRight size={14} /></a>
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
