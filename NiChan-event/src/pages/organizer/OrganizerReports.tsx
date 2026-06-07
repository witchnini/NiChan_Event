import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Download,
  Calendar,
  Wallet,
  FolderKanban,
  CheckCircle2,
  Star,
  TrendingUp,
  TrendingDown,
  Users,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { apiClient } from "@/services/apiClient";

type ProjectProgressItem = {
  id: string;
  name: string;
  status: string;
  eventDate?: string | null;
  progressPercent: number;
  taskTotal: number;
  taskDone: number;
  taskPercent: number;
};

type TaskCompletionItem = {
  status: string;
  _count: { status: number };
};

type BudgetOverviewItem = {
  id: string;
  name: string;
  estimated: number;
  actual: number;
  variance: number;
};

type SummaryItem = {
  totalEvents: number;
  activeEvents: number;
  completedEvents: number;
  cancelledEvents: number;
  totalTasks: number;
  doneTasks: number;
  completionRate: number;
  budgetEstimated: number;
  budgetActual: number;
  budgetVariance: number;
  vendorCount: number;
  staffCount: number;
  reviewCount: number;
  avgRating: number;
};

type StaffPerformanceItem = {
  id: string;
  name: string;
  avatarUrl: string | null;
  assignments: number;
  confirmed: number;
  completed: number;
};

const statusLabelMap: Record<string, string> = {
  todo: "Chờ xử lý",
  in_progress: "Đang làm",
  review: "Chờ duyệt",
  done: "Hoàn thành",
};

const statusColorMap: Record<string, string> = {
  todo: "hsl(38 35% 70%)",
  in_progress: "hsl(355 63% 42%)",
  review: "hsl(355 55% 53%)",
  done: "hsl(113 33% 31%)",
};

const eventStatusLabelMap: Record<string, string> = {
  draft: "Nháp",
  planning: "Lên kế hoạch",
  in_progress: "Đang triển khai",
  active: "Đang triển khai",
  completed: "Hoàn thành",
  cancelled: "Đã huỷ",
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa cập nhật";

const formatMoney = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  if (abs >= 1_000_000) return `${Math.round(value / 1_000_000)} tr`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)} k`;
  return `${value}`;
};

const OrganizerReports = () => {
  const [projects, setProjects] = useState<ProjectProgressItem[]>([]);
  const [taskCompletion, setTaskCompletion] = useState<TaskCompletionItem[]>([]);
  const [budgets, setBudgets] = useState<BudgetOverviewItem[]>([]);
  const [summary, setSummary] = useState<SummaryItem | null>(null);
  const [staff, setStaff] = useState<StaffPerformanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [projectData, completionData, budgetData, summaryData, staffData] = await Promise.all([
          apiClient.get<ProjectProgressItem[]>("/organizer/reports/project-progress"),
          apiClient.get<TaskCompletionItem[]>("/organizer/reports/task-completion"),
          apiClient.get<BudgetOverviewItem[]>("/organizer/reports/budget-overview"),
          apiClient.get<SummaryItem>("/organizer/reports/summary"),
          apiClient.get<StaffPerformanceItem[]>("/organizer/reports/staff-performance"),
        ]);

        if (cancelled) return;
        setProjects(projectData);
        setTaskCompletion(completionData);
        setBudgets(budgetData);
        setSummary(summaryData);
        setStaff(staffData);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải báo cáo");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const taskChartData = useMemo(
    () =>
      taskCompletion.map((item) => ({
        status: statusLabelMap[item.status] || item.status,
        count: item._count.status,
        color: statusColorMap[item.status] || "hsl(38 20% 86%)",
      })),
    [taskCompletion],
  );

  const budgetChartData = useMemo(
    () =>
      budgets.map((item) => ({
        name: item.name.length > 14 ? `${item.name.slice(0, 14)}…` : item.name,
        "Dự kiến": Math.round(item.estimated / 1_000_000),
        "Thực tế": Math.round(item.actual / 1_000_000),
      })),
    [budgets],
  );

  const kpis = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: "Tổng dự án",
        value: String(summary.totalEvents),
        hint: `${summary.activeEvents} đang chạy • ${summary.completedEvents} hoàn thành`,
        icon: FolderKanban,
        color: "text-primary",
      },
      {
        label: "Tỉ lệ hoàn thành task",
        value: `${summary.completionRate}%`,
        hint: `${summary.doneTasks}/${summary.totalTasks} task`,
        icon: CheckCircle2,
        color: "text-secondary",
      },
      {
        label: "Ngân sách thực tế",
        value: formatMoney(summary.budgetActual),
        hint: `Dự kiến ${formatMoney(summary.budgetEstimated)}`,
        icon: Wallet,
        color: "text-primary",
      },
      {
        label: "Đánh giá trung bình",
        value: summary.avgRating ? `${summary.avgRating}★` : "—",
        hint: `${summary.reviewCount} đánh giá • ${summary.staffCount} nhân sự`,
        icon: Star,
        color: "text-secondary",
      },
    ];
  }, [summary]);

  const handleExportCSV = () => {
    const lines: string[] = [];
    if (summary) {
      lines.push("TONG QUAN");
      lines.push("Chi so,Gia tri");
      lines.push(`Tong du an,${summary.totalEvents}`);
      lines.push(`Dang chay,${summary.activeEvents}`);
      lines.push(`Hoan thanh,${summary.completedEvents}`);
      lines.push(`Ti le hoan thanh task,${summary.completionRate}%`);
      lines.push(`Ngan sach du kien,${summary.budgetEstimated}`);
      lines.push(`Ngan sach thuc te,${summary.budgetActual}`);
      lines.push(`Chenh lech,${summary.budgetVariance}`);
      lines.push("");
    }
    lines.push("TIEN DO DU AN");
    lines.push("Du an,Trang thai,Tien do,Task hoan thanh,Tong task");
    projects.forEach((p) =>
      lines.push(`${p.name},${p.status},${p.progressPercent}%,${p.taskDone},${p.taskTotal}`),
    );
    lines.push("");
    lines.push("NGAN SACH");
    lines.push("Du an,Du kien,Thuc te,Chenh lech");
    budgets.forEach((b) => lines.push(`${b.name},${b.estimated},${b.actual},${b.variance}`));

    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bao-cao-tong-ket-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Đã xuất báo cáo CSV");
  };

  if (loading) return <div className="font-body text-muted-foreground">Đang tải báo cáo...</div>;
  if (error) return <div className="font-body text-destructive">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-headline-lg text-foreground">Báo cáo & Tổng kết</h1>
          <p className="font-body text-sm text-muted-foreground">
            Tổng hợp tiến độ, ngân sách và hiệu suất nhân sự từ dữ liệu thật
          </p>
        </div>
        <Button variant="outline" onClick={handleExportCSV}>
          <Download size={16} /> Xuất CSV
        </Button>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-surface-lowest rounded-xl p-5 shadow-ambient"
          >
            <kpi.icon size={20} className={kpi.color} />
            <p className="font-serif text-headline-lg text-foreground mt-3">{kpi.value}</p>
            <p className="font-body text-sm text-foreground">{kpi.label}</p>
            <p className="font-body text-xs text-muted-foreground mt-1">{kpi.hint}</p>
          </motion.div>
        ))}
      </div>

      {/* Project progress */}
      <div>
        <h2 className="font-serif text-headline-md text-foreground mb-4">Tiến độ dự án hiện tại</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {projects.map((project) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface-lowest rounded-xl p-6 shadow-ambient"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-serif text-headline-md text-foreground">{project.name}</h3>
                  <p className="font-body text-sm text-muted-foreground mt-1">
                    {eventStatusLabelMap[project.status] || project.status} • {formatDate(project.eventDate)}
                  </p>
                </div>
                <span className="font-serif font-bold text-foreground">{project.progressPercent}%</span>
              </div>
              <Progress value={project.progressPercent} className="h-2 mt-4" />
              <div className="grid grid-cols-3 gap-3 mt-5">
                <div className="bg-surface-low rounded-xl p-3 text-center">
                  <p className="font-body text-xs text-muted-foreground">Task hoàn thành</p>
                  <p className="font-serif font-bold text-foreground">{project.taskDone}</p>
                </div>
                <div className="bg-surface-low rounded-xl p-3 text-center">
                  <p className="font-body text-xs text-muted-foreground">Tổng task</p>
                  <p className="font-serif font-bold text-foreground">{project.taskTotal}</p>
                </div>
                <div className="bg-surface-low rounded-xl p-3 text-center">
                  <p className="font-body text-xs text-muted-foreground">Tỉ lệ xong</p>
                  <p className="font-serif font-bold text-secondary">{project.taskPercent}%</p>
                </div>
              </div>
            </motion.div>
          ))}
          {projects.length === 0 && (
            <p className="font-body text-sm text-muted-foreground">Chưa có dự án để báo cáo.</p>
          )}
        </div>
      </div>

      {/* Charts: task distribution + budget comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-lowest rounded-xl p-6 shadow-ambient"
        >
          <h3 className="font-serif text-headline-md text-foreground mb-6">Phân bố trạng thái task</h3>
          {taskChartData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={taskChartData} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} innerRadius={50}>
                    {taskChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "none" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {taskChartData.map((task) => (
                  <div key={task.status} className="flex items-center gap-2 text-xs font-body">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: task.color }} />
                    <span className="text-foreground">{task.status}</span>
                    <span className="text-muted-foreground ml-auto">{task.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="font-body text-sm text-muted-foreground">Chưa có dữ liệu task.</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-lowest rounded-xl p-6 shadow-ambient"
        >
          <h3 className="font-serif text-headline-md text-foreground mb-6">
            Ngân sách: dự kiến vs thực tế <span className="text-xs text-muted-foreground">(triệu đồng)</span>
          </h3>
          {budgetChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={budgetChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(38 20% 86%)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(50 8% 42%)" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(50 8% 42%)" }} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Dự kiến" fill="hsl(38 35% 70%)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Thực tế" fill="hsl(113 33% 31%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="font-body text-sm text-muted-foreground">Chưa có dữ liệu ngân sách.</p>
          )}
        </motion.div>
      </div>

      {/* Budget detail + staff performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-lowest rounded-xl p-6 shadow-ambient"
        >
          <h3 className="font-serif text-headline-md text-foreground mb-6">Chi tiết ngân sách</h3>
          <div className="space-y-4">
            {budgets.map((budget) => (
              <div key={budget.id} className="flex items-center justify-between bg-surface-low rounded-xl p-4">
                <div>
                  <p className="font-body text-sm font-semibold text-foreground">{budget.name}</p>
                  <p className="font-body text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Wallet size={12} /> {formatMoney(budget.estimated)} dự kiến / {formatMoney(budget.actual)} thực tế
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`font-serif font-bold flex items-center justify-end gap-1 ${
                      budget.variance >= 0 ? "text-secondary" : "text-destructive"
                    }`}
                  >
                    {budget.variance >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {formatMoney(budget.variance)}
                  </p>
                  <p className="font-body text-xs text-muted-foreground">
                    {budget.variance >= 0 ? "Còn dư" : "Vượt"}
                  </p>
                </div>
              </div>
            ))}
            {budgets.length === 0 && (
              <p className="font-body text-sm text-muted-foreground">Chưa có dữ liệu ngân sách.</p>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-lowest rounded-xl p-6 shadow-ambient"
        >
          <h3 className="font-serif text-headline-md text-foreground mb-6 flex items-center gap-2">
            <Users size={18} className="text-primary" /> Hiệu suất nhân sự
          </h3>
          <div className="space-y-3">
            {staff.map((member) => {
              const rate = member.assignments > 0 ? Math.round((member.completed / member.assignments) * 100) : 0;
              return (
                <div key={member.id} className="flex items-center gap-3 bg-surface-low rounded-xl p-3">
                  {member.avatarUrl ? (
                    <img src={member.avatarUrl} alt={member.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-surface-high flex items-center justify-center shrink-0 font-serif font-bold text-foreground">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm font-semibold text-foreground truncate">{member.name}</p>
                    <p className="font-body text-xs text-muted-foreground">
                      {member.assignments} phân công • {member.confirmed} xác nhận
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-serif font-bold text-secondary">{member.completed}</p>
                    <p className="font-body text-xs text-muted-foreground">{rate}% xong</p>
                  </div>
                </div>
              );
            })}
            {staff.length === 0 && (
              <p className="font-body text-sm text-muted-foreground">Chưa có nhân sự được phân công.</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default OrganizerReports;
