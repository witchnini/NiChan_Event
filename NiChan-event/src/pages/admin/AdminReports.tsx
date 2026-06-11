import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BriefcaseBusiness,
  Calendar,
  Download,
  FileText,
  RefreshCw,
  Star,
  Target,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  getContractStatusLabel,
  getEventDisplayName,
  getEventStatusColor,
  getEventStatusLabel,
  getRequestStatusLabel,
  getTransactionStatusLabel,
} from "@/lib/eventDisplay";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

type CountItem = {
  key: string;
  count: number;
};

type MonthlyTrend = {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  requests: number;
  events: number;
};

type TopEvent = {
  id: string;
  name: string;
  type: string;
  status: string;
  eventDate?: string | null;
  guestCount?: number | null;
  progressPercent: number;
  budgetActual: number;
  customerUser?: { id: string; displayName: string } | null;
  organizerUser?: { id: string; displayName: string } | null;
  consultationRequest?: {
    customerName?: string | null;
    eventType?: string | null;
    note?: string | null;
  } | null;
  revenue: number;
  pendingRevenue: number;
  expenses: number;
  profit: number;
  contractValue: number;
  collectionRate: number;
  avgRating: number;
  reviewCount: number;
};

type StaffPerformance = {
  id: string;
  name: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  employmentStatus: string | null;
  assignments: number;
  confirmed: number;
  declined: number;
  completed: number;
  active: number;
  completionRate: number;
};

type AdminReportsOverview = {
  summary: {
    totalRequests: number;
    confirmedRequests: number;
    rejectedRequests: number;
    conversionRate: number;
    totalEvents: number;
    activeEvents: number;
    completedEvents: number;
    cancelledEvents: number;
    averageProgress: number;
    totalCustomers: number;
    totalOrganizers: number;
    totalStaff: number;
    totalVendors: number;
    totalRevenue: number;
    totalExpenses: number;
    profit: number;
    profitMargin: number;
    contractValue: number;
    collectedOnContracts: number;
    receivable: number;
    collectionRate: number;
    reviewCount: number;
    avgRating: number;
  };
  monthlyTrend: MonthlyTrend[];
  requestStatus: CountItem[];
  eventStatus: CountItem[];
  eventTypes: CountItem[];
  contractStatus: CountItem[];
  transactionStatus: CountItem[];
  revenueByType: { type: string; revenue: number }[];
  topEvents: TopEvent[];
  staffPerformance: StaffPerformance[];
};

const chartColors = [
  "hsl(355 63% 42%)",
  "hsl(113 33% 31%)",
  "hsl(38 72% 45%)",
  "hsl(355 55% 53%)",
  "hsl(38 35% 70%)",
  "hsl(50 8% 42%)",
];

const requestStatusOrder = ["new", "reviewing", "quoted", "confirmed", "rejected"];
const eventStatusOrder = ["draft", "quoted", "planning", "contracted", "in_progress", "completed", "cancelled"];

const number = (value: number) => Number(value || 0);

const money = (value: number) => `${number(value).toLocaleString("vi-VN")} đ`;

const moneyShort = (value: number) => {
  const amount = Math.abs(number(value));
  const sign = number(value) < 0 ? "-" : "";
  if (amount >= 1_000_000_000) return `${sign}${(amount / 1_000_000_000).toFixed(1)} tỷ`;
  if (amount >= 1_000_000) return `${sign}${Math.round(amount / 1_000_000)}tr`;
  if (amount >= 1_000) return `${sign}${Math.round(amount / 1_000)}k`;
  return `${sign}${Math.round(amount).toLocaleString("vi-VN")}đ`;
};

const monthLabel = (month: string) => {
  const [year, value] = month.split("-");
  return value && year ? `${value}/${year.slice(2)}` : month;
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa cập nhật";

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

const normalizeCount = (
  items: CountItem[],
  order: string[],
  label: (key: string) => string,
) => {
  const map = new Map(items.map((item) => [item.key, item.count]));
  const ordered = order
    .filter((key) => map.has(key))
    .map((key) => ({ key, label: label(key), count: map.get(key) ?? 0 }));
  const rest = items
    .filter((item) => !order.includes(item.key))
    .map((item) => ({ key: item.key, label: label(item.key), count: item.count }));
  return [...ordered, ...rest];
};

const AdminReports = () => {
  const [data, setData] = useState<AdminReportsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReports = async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    try {
      setError(null);
      const response = await apiClient.get<AdminReportsOverview>("/admin/reports/overview");
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải báo cáo admin");
    } finally {
      if (mode === "initial") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.get<AdminReportsOverview>("/admin/reports/overview");
        if (!cancelled) setData(response);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải báo cáo admin");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const monthlyTrend = useMemo(
    () =>
      (data?.monthlyTrend || []).map((item) => ({
        ...item,
        label: monthLabel(item.month),
      })),
    [data],
  );

  const requestStatusChart = useMemo(
    () => normalizeCount(data?.requestStatus || [], requestStatusOrder, getRequestStatusLabel),
    [data],
  );

  const eventStatusChart = useMemo(
    () =>
      normalizeCount(data?.eventStatus || [], eventStatusOrder, getEventStatusLabel).map((item, index) => ({
        ...item,
        color: chartColors[index % chartColors.length],
      })),
    [data],
  );

  const revenueByType = useMemo(
    () =>
      (data?.revenueByType || []).map((item, index) => ({
        ...item,
        color: chartColors[index % chartColors.length],
      })),
    [data],
  );

  const eventTypeTotal = useMemo(
    () => (data?.eventTypes || []).reduce((sum, item) => sum + item.count, 0),
    [data],
  );

  const handleExportCSV = () => {
    if (!data) return;

    const rows: (string | number)[][] = [
      ["TONG QUAN"],
      ["Chi so", "Gia tri"],
      ["Tong yeu cau", data.summary.totalRequests],
      ["Yeu cau da xac nhan", data.summary.confirmedRequests],
      ["Ti le chuyen doi", `${data.summary.conversionRate}%`],
      ["Tong du an", data.summary.totalEvents],
      ["Du an dang chay", data.summary.activeEvents],
      ["Du an hoan thanh", data.summary.completedEvents],
      ["Doanh thu", data.summary.totalRevenue],
      ["Chi phi", data.summary.totalExpenses],
      ["Loi nhuan", data.summary.profit],
      ["Cong no phai thu", data.summary.receivable],
      [""],
      ["DOANH THU THEO THANG"],
      ["Thang", "Doanh thu", "Chi phi", "Loi nhuan", "Yeu cau", "Du an moi"],
      ...data.monthlyTrend.map((item) => [
        item.month,
        item.revenue,
        item.expenses,
        item.profit,
        item.requests,
        item.events,
      ]),
      [""],
      ["TOP DU AN"],
      ["Du an", "Loai", "Khach hang", "Doanh thu", "Chi phi", "Loi nhuan", "Ti le thu"],
      ...data.topEvents.map((event) => [
        getEventDisplayName(event),
        event.type,
        event.customerUser?.displayName ?? event.consultationRequest?.customerName ?? "",
        event.revenue,
        event.expenses,
        event.profit,
        `${event.collectionRate}%`,
      ]),
      [""],
      ["HIEU SUAT NHAN SU"],
      ["Nhan su", "Vai tro", "Phan cong", "Xac nhan", "Hoan thanh", "Ti le hoan thanh"],
      ...data.staffPerformance.map((staff) => [
        staff.name,
        staff.jobTitle ?? "",
        staff.assignments,
        staff.confirmed,
        staff.completed,
        `${staff.completionRate}%`,
      ]),
    ];

    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bao-cao-thong-ke-admin-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Đã xuất báo cáo CSV");
  };

  if (loading) return <div className="font-body text-muted-foreground">Đang tải báo cáo...</div>;

  if (error || !data) {
    return (
      <div className="space-y-4">
        <p className="font-body text-destructive">{error || "Không có dữ liệu báo cáo"}</p>
        <Button variant="outline" onClick={() => loadReports("initial")}>
          <RefreshCw size={16} /> Tải lại
        </Button>
      </div>
    );
  }

  const kpis = [
    {
      label: "Doanh thu thực thu",
      value: moneyShort(data.summary.totalRevenue),
      hint: `Lợi nhuận ${moneyShort(data.summary.profit)} • biên ${data.summary.profitMargin}%`,
      icon: TrendingUp,
      color: data.summary.profit >= 0 ? "text-secondary" : "text-destructive",
    },
    {
      label: "Tỉ lệ chuyển đổi",
      value: `${data.summary.conversionRate}%`,
      hint: `${data.summary.confirmedRequests}/${data.summary.totalRequests} yêu cầu đã xác nhận`,
      icon: Target,
      color: "text-primary",
    },
    {
      label: "Dự án đang chạy",
      value: String(data.summary.activeEvents),
      hint: `${data.summary.completedEvents} hoàn thành / ${data.summary.totalEvents} tổng dự án`,
      icon: Calendar,
      color: "text-secondary",
    },
    {
      label: "Công nợ phải thu",
      value: moneyShort(data.summary.receivable),
      hint: `Đã thu ${data.summary.collectionRate}% giá trị hợp đồng`,
      icon: WalletCards,
      color: "text-primary",
    },
  ];

  const operatingStats = [
    { label: "Khách hàng", value: data.summary.totalCustomers, icon: Users },
    { label: "Organizer", value: data.summary.totalOrganizers, icon: BriefcaseBusiness },
    { label: "Nhân sự", value: data.summary.totalStaff, icon: Activity },
    { label: "Nhà cung cấp", value: data.summary.totalVendors, icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-headline-lg text-foreground">Báo cáo & Thống kê</h1>
          <p className="font-body text-sm text-muted-foreground">
            Tổng hợp vận hành, tài chính, chuyển đổi và hiệu suất nhân sự từ dữ liệu hệ thống
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => loadReports("refresh")} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> Làm mới
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download size={16} /> Xuất CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className="bg-surface-lowest rounded-xl p-5 shadow-ambient min-w-0"
          >
            <kpi.icon size={20} className={kpi.color} />
            <p className="font-serif text-headline-lg text-foreground mt-3 truncate">{kpi.value}</p>
            <p className="font-body text-sm text-foreground">{kpi.label}</p>
            <p className="font-body text-xs text-muted-foreground mt-1 line-clamp-2">{kpi.hint}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {operatingStats.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.04 }}
            className="bg-surface-lowest rounded-xl p-4 shadow-ambient flex items-center gap-3 min-w-0"
          >
            <div className="w-10 h-10 rounded-full bg-surface-low flex items-center justify-center shrink-0">
              <item.icon size={18} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-serif text-headline-md text-foreground">{item.value}</p>
              <p className="font-body text-xs text-muted-foreground truncate">{item.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="xl:col-span-2 bg-surface-lowest rounded-xl p-6 shadow-ambient"
        >
          <h3 className="font-serif text-headline-md text-foreground mb-6">Doanh thu, chi phí và lợi nhuận</h3>
          {monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(38 20% 86%)" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(50 8% 42%)" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(50 8% 42%)" }} tickFormatter={moneyShort} />
                <Tooltip
                  formatter={(value: number, name) => [money(value), name]}
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 40px rgba(0,0,0,0.05)" }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" name="Doanh thu" fill="hsl(113 33% 31%)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expenses" name="Chi phí" fill="hsl(355 63% 42%)" radius={[6, 6, 0, 0]} />
                <Line type="monotone" dataKey="profit" name="Lợi nhuận" stroke="hsl(38 72% 45%)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className="font-body text-sm text-muted-foreground">Chưa có dữ liệu tài chính theo tháng.</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-lowest rounded-xl p-6 shadow-ambient"
        >
          <h3 className="font-serif text-headline-md text-foreground mb-6">Phễu yêu cầu</h3>
          {requestStatusChart.length > 0 ? (
            <div className="space-y-4">
              {requestStatusChart.map((item) => {
                const percent = data.summary.totalRequests
                  ? Math.round((item.count / data.summary.totalRequests) * 100)
                  : 0;
                return (
                  <div key={item.key}>
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <span className="font-body text-sm text-foreground truncate">{item.label}</span>
                      <span className="font-body text-sm font-semibold text-muted-foreground whitespace-nowrap">
                        {item.count} • {percent}%
                      </span>
                    </div>
                    <Progress value={percent} className="h-2 bg-surface-high" />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="font-body text-sm text-muted-foreground">Chưa có yêu cầu tư vấn.</p>
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-lowest rounded-xl p-6 shadow-ambient"
        >
          <h3 className="font-serif text-headline-md text-foreground mb-6">Trạng thái dự án</h3>
          {eventStatusChart.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={eventStatusChart} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={82} innerRadius={52}>
                    {eventStatusChart.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-1 gap-2 mt-3">
                {eventStatusChart.map((item) => (
                  <div key={item.key} className="flex items-center gap-2 text-sm font-body">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                    <span className="text-foreground truncate">{item.label}</span>
                    <span className="text-muted-foreground ml-auto">{item.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="font-body text-sm text-muted-foreground">Chưa có dự án.</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-lowest rounded-xl p-6 shadow-ambient"
        >
          <h3 className="font-serif text-headline-md text-foreground mb-6">Doanh thu theo loại</h3>
          {revenueByType.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenueByType} layout="vertical" margin={{ left: 8, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(38 20% 86%)" />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="type"
                  tick={{ fontSize: 12, fill: "hsl(50 8% 42%)" }}
                  width={96}
                />
                <Tooltip formatter={(value: number) => money(value)} />
                <Bar dataKey="revenue" name="Doanh thu" radius={[0, 6, 6, 0]}>
                  {revenueByType.map((item) => (
                    <Cell key={item.type} fill={item.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="font-body text-sm text-muted-foreground">Chưa có doanh thu theo loại sự kiện.</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-lowest rounded-xl p-6 shadow-ambient"
        >
          <h3 className="font-serif text-headline-md text-foreground mb-6">Sức khỏe vận hành</h3>
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-body text-sm text-foreground">Tiến độ trung bình</span>
                <span className="font-body text-sm font-semibold text-primary">{data.summary.averageProgress}%</span>
              </div>
              <Progress value={data.summary.averageProgress} className="h-2 bg-surface-high" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-body text-sm text-foreground">Thu theo hợp đồng</span>
                <span className="font-body text-sm font-semibold text-secondary">{data.summary.collectionRate}%</span>
              </div>
              <Progress value={data.summary.collectionRate} className="h-2 bg-surface-high" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-surface-low rounded-xl p-3">
                <p className="font-body text-xs text-muted-foreground">Đánh giá TB</p>
                <p className="font-serif text-headline-md text-foreground flex items-center gap-1">
                  {data.summary.avgRating || "—"} <Star size={14} className="text-primary" />
                </p>
              </div>
              <div className="bg-surface-low rounded-xl p-3">
                <p className="font-body text-xs text-muted-foreground">Lượt đánh giá</p>
                <p className="font-serif text-headline-md text-foreground">{data.summary.reviewCount}</p>
              </div>
            </div>
            <div className="space-y-2">
              {data.eventTypes.slice(0, 4).map((type) => {
                const percent = eventTypeTotal ? Math.round((type.count / eventTypeTotal) * 100) : 0;
                return (
                  <div key={type.key} className="flex items-center justify-between gap-3 font-body text-sm">
                    <span className="text-foreground truncate">{type.key}</span>
                    <span className="text-muted-foreground whitespace-nowrap">{type.count} • {percent}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="xl:col-span-2 bg-surface-lowest rounded-xl p-6 shadow-ambient"
        >
          <div className="flex items-center justify-between gap-4 mb-6">
            <h3 className="font-serif text-headline-md text-foreground">Top dự án theo doanh thu</h3>
            <span className="font-body text-sm text-muted-foreground">{data.topEvents.length} dự án</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-sm font-body">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 text-muted-foreground font-semibold">Dự án</th>
                  <th className="text-left py-3 text-muted-foreground font-semibold">Khách hàng</th>
                  <th className="text-right py-3 text-muted-foreground font-semibold">Doanh thu</th>
                  <th className="text-right py-3 text-muted-foreground font-semibold">Chi phí</th>
                  <th className="text-right py-3 text-muted-foreground font-semibold">Lợi nhuận</th>
                  <th className="text-right py-3 text-muted-foreground font-semibold">% thu</th>
                  <th className="text-right py-3 text-muted-foreground font-semibold">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {data.topEvents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted-foreground py-10">Chưa có dự án phát sinh tài chính.</td>
                  </tr>
                )}
                {data.topEvents.map((event) => (
                  <tr key={event.id} className="border-b border-border last:border-0 hover:bg-surface-low/50">
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-foreground truncate max-w-[260px]">{getEventDisplayName(event)}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.type} • {formatDate(event.eventDate)} • {event.guestCount || 0} khách
                      </p>
                    </td>
                    <td className="py-3 text-foreground">
                      {event.customerUser?.displayName ?? event.consultationRequest?.customerName ?? "-"}
                    </td>
                    <td className="py-3 text-right text-secondary font-semibold">{moneyShort(event.revenue)}</td>
                    <td className="py-3 text-right text-foreground">{moneyShort(event.expenses)}</td>
                    <td className={`py-3 text-right font-semibold ${event.profit >= 0 ? "text-secondary" : "text-destructive"}`}>
                      {moneyShort(event.profit)}
                    </td>
                    <td className="py-3 text-right text-foreground">{event.collectionRate}%</td>
                    <td className="py-3 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${getEventStatusColor(event.status)}`}>
                        {getEventStatusLabel(event.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-lowest rounded-xl p-6 shadow-ambient"
        >
          <h3 className="font-serif text-headline-md text-foreground mb-6">Hiệu suất nhân sự</h3>
          <div className="space-y-3">
            {data.staffPerformance.slice(0, 8).map((staff) => (
              <div key={staff.id} className="bg-surface-low rounded-xl p-3">
                <div className="flex items-center gap-3">
                  {staff.avatarUrl ? (
                    <img src={staff.avatarUrl} alt={staff.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-surface-high flex items-center justify-center shrink-0 font-serif font-bold text-foreground">
                      {staff.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm font-semibold text-foreground truncate">{staff.name}</p>
                    <p className="font-body text-xs text-muted-foreground truncate">
                      {staff.jobTitle ?? "Nhân sự"} • {staff.assignments} phân công
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-serif font-bold text-secondary">{staff.completed}</p>
                    <p className="font-body text-xs text-muted-foreground">xong</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <Progress value={staff.completionRate} className="h-2 bg-surface-high" />
                  <span className="font-body text-xs font-semibold text-muted-foreground w-10 text-right">
                    {staff.completionRate}%
                  </span>
                </div>
              </div>
            ))}
            {data.staffPerformance.length === 0 && (
              <p className="font-body text-sm text-muted-foreground">Chưa có nhân sự được phân công.</p>
            )}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-lowest rounded-xl p-6 shadow-ambient"
        >
          <h3 className="font-serif text-headline-md text-foreground mb-6">Trạng thái hợp đồng</h3>
          <div className="grid grid-cols-2 gap-3">
            {data.contractStatus.map((item) => (
              <div key={item.key} className="bg-surface-low rounded-xl p-4">
                <p className="font-serif text-headline-md text-foreground">{item.count}</p>
                <p className="font-body text-sm text-muted-foreground">{getContractStatusLabel(item.key)}</p>
              </div>
            ))}
            {data.contractStatus.length === 0 && (
              <p className="font-body text-sm text-muted-foreground">Chưa có hợp đồng.</p>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-lowest rounded-xl p-6 shadow-ambient"
        >
          <h3 className="font-serif text-headline-md text-foreground mb-6">Trạng thái giao dịch</h3>
          <div className="grid grid-cols-2 gap-3">
            {data.transactionStatus.map((item) => (
              <div key={item.key} className="bg-surface-low rounded-xl p-4">
                <p className="font-serif text-headline-md text-foreground">{item.count}</p>
                <p className="font-body text-sm text-muted-foreground">{getTransactionStatusLabel(item.key)}</p>
              </div>
            ))}
            {data.transactionStatus.length === 0 && (
              <p className="font-body text-sm text-muted-foreground">Chưa có giao dịch.</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminReports;
