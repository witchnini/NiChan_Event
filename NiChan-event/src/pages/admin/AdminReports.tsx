import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Download, TrendingUp, Calendar, Users, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiClient } from "@/services/apiClient";

type ConversionReport = {
  total: number;
  confirmed: number;
  rejected: number;
  conversionRate: number;
};

type RevenueByType = {
  type: string;
  revenue: number;
};

type TopEvent = {
  id: string;
  name: string;
  type: string;
  guestCount?: number | null;
  budgetActual?: number | null;
};

const pieColors = [
  "hsl(355 63% 42%)",
  "hsl(113 33% 31%)",
  "hsl(355 55% 53%)",
  "hsl(38 35% 70%)",
  "hsl(38 20% 86%)",
];

const formatMoney = (value: number) => `${Math.round(value / 1_000_000)}tr`;

const AdminReports = () => {
  const [conversion, setConversion] = useState<ConversionReport | null>(null);
  const [revenueByType, setRevenueByType] = useState<RevenueByType[]>([]);
  const [topEvents, setTopEvents] = useState<TopEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [conversionData, revenueData, topEventsData] = await Promise.all([
          apiClient.get<ConversionReport>("/admin/reports/conversion"),
          apiClient.get<RevenueByType[]>("/admin/reports/revenue-by-type"),
          apiClient.get<TopEvent[]>("/admin/reports/top-events"),
        ]);

        if (cancelled) return;
        setConversion(conversionData);
        setRevenueByType(revenueData);
        setTopEvents(topEventsData);
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

  const conversionChart = useMemo(
    () => conversion ? [
      { name: "Tổng yêu cầu", value: conversion.total },
      { name: "Đã chốt", value: conversion.confirmed },
      { name: "Từ chối", value: conversion.rejected },
    ] : [],
    [conversion],
  );

  const revenueChart = useMemo(
    () => revenueByType.map((item, index) => ({
      name: item.type,
      value: Math.round(item.revenue / 1_000_000),
      color: pieColors[index % pieColors.length],
    })),
    [revenueByType],
  );

  const totalRevenue = useMemo(
    () => revenueByType.reduce((sum, item) => sum + Number(item.revenue || 0), 0),
    [revenueByType],
  );

  const handleExport = () => {
    const csvContent = "Metric,Value\n" +
      `Total Requests,${conversion?.total || 0}\n` +
      `Confirmed,${conversion?.confirmed || 0}\n` +
      `Rejected,${conversion?.rejected || 0}\n` +
      `Conversion Rate,${conversion?.conversionRate || 0}\n`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bao-cao-admin-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Đã xuất báo cáo CSV thành công");
  };

  if (loading) return <div className="font-body text-muted-foreground">Đang tải báo cáo...</div>;
  if (error || !conversion) return <div className="font-body text-destructive">{error || "Không có dữ liệu báo cáo"}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-headline-lg text-foreground">Báo cáo & Thống kê</h1>
          <p className="font-body text-sm text-muted-foreground">Chỉ hiển thị dữ liệu backend đang có thật</p>
        </div>
        <Button variant="outline" onClick={handleExport}><Download size={16} /> Xuất báo cáo</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Tổng doanh thu", value: formatMoney(totalRevenue), icon: TrendingUp, color: "text-secondary" },
          { label: "Tổng sự kiện top", value: String(topEvents.length), icon: Calendar, color: "text-primary" },
          { label: "Yêu cầu", value: String(conversion.total), icon: Users, color: "text-secondary" },
          { label: "Tỉ lệ chuyển đổi", value: `${conversion.conversionRate}%`, icon: Target, color: "text-primary" },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="bg-surface-lowest rounded-xl p-5 shadow-ambient"
          >
            <kpi.icon size={20} className={kpi.color} />
            <p className="font-serif text-headline-lg text-foreground mt-3">{kpi.value}</p>
            <p className="font-body text-sm text-muted-foreground">{kpi.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
          <h3 className="font-serif text-headline-md text-foreground mb-6">Tổng quan chuyển đổi</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={conversionChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(38 20% 86%)" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(50 8% 42%)" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(50 8% 42%)" }} />
              <Tooltip contentStyle={{ borderRadius: "12px", border: "none" }} />
              <Bar dataKey="value" fill="hsl(355 63% 42%)" radius={[6, 6, 0, 0]} name="Số lượng" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
          <h3 className="font-serif text-headline-md text-foreground mb-6">Doanh thu theo loại (triệu)</h3>
          {revenueChart.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart><Pie data={revenueChart} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={50}>{revenueChart.map((entry, i) => <Cell key={i} fill={entry.color} />)}</Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {revenueChart.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-xs font-body">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                    <span className="text-foreground">{item.name}</span>
                    <span className="text-muted-foreground ml-auto">{item.value}tr</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="font-body text-sm text-muted-foreground">Chưa có doanh thu theo loại.</p>
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
          <h3 className="font-serif text-headline-md text-foreground mb-6">Top sự kiện doanh thu cao nhất</h3>
          <div className="space-y-4">
            {topEvents.map((event, i) => (
              <div key={event.id} className="flex items-center gap-4">
                <span className="font-serif text-lg font-bold text-primary w-6">{i + 1}</span>
                <div className="flex-1">
                  <p className="font-body text-sm font-semibold text-foreground">{event.name}</p>
                  <p className="font-body text-xs text-muted-foreground">{event.type} • {event.guestCount || 0} khách</p>
                </div>
                <span className="font-serif font-bold text-foreground">{formatMoney(Number(event.budgetActual || 0))}</span>
              </div>
            ))}
            {topEvents.length === 0 && <p className="font-body text-sm text-muted-foreground">Chưa có sự kiện completed để xếp hạng.</p>}
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
          <h3 className="font-serif text-headline-md text-foreground mb-6">Ghi chú</h3>
          <div className="space-y-3 text-sm font-body text-muted-foreground">
            <p>Backend hiện chưa public endpoint `staff-performance`, nên phần hiệu suất nhân viên đã bỏ dữ liệu giả.</p>
            <p>Báo cáo này hiện bám đúng 3 endpoint thật: `conversion`, `revenue-by-type`, `top-events`.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminReports;
