import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FolderKanban, Users, Building2, Wallet, Clock, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Progress } from "@/components/ui/progress";
import { apiClient } from "@/services/apiClient";

type OrganizerDashboardResponse = {
  projectProgress: {
    id: string;
    name: string;
    status: string;
    progressPercent: number;
    eventDate?: string | null;
    _count: { tasks: number };
  }[];
  tasksByStatus: {
    status: string;
    _count: { status: number };
  }[];
  upcomingTasks: {
    id: string;
    title: string;
    dueAt?: string | null;
    status: string;
    event?: { id: string; name: string };
  }[];
};

type StaffMember = { id: string };
type VendorItem = { id: string };
type BudgetOverview = { estimated: number; actual: number };

const statusLabelMap: Record<string, string> = {
  todo: "Chờ xử lý",
  in_progress: "Đang làm",
  review: "Chờ xử lý",
  done: "Hoàn thành",
};

const statusColorMap: Record<string, string> = {
  todo: "hsl(38 35% 70%)",
  in_progress: "hsl(355 63% 42%)",
  review: "hsl(355 55% 53%)",
  done: "hsl(113 33% 31%)",
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa cập nhật";

const formatCurrency = (value: number) => `${Math.round(value / 1_000_000)}tr`;

const OrganizerDashboard = () => {
  const [data, setData] = useState<OrganizerDashboardResponse | null>(null);
  const [staffCount, setStaffCount] = useState(0);
  const [vendorCount, setVendorCount] = useState(0);
  const [budgetTotal, setBudgetTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [dashboard, staff, vendors, budgetOverview] = await Promise.all([
          apiClient.get<OrganizerDashboardResponse>("/organizer/dashboard"),
          apiClient.get<StaffMember[]>("/organizer/staff"),
          apiClient.get<VendorItem[]>("/organizer/vendors"),
          apiClient.get<BudgetOverview[]>("/organizer/reports/budget-overview"),
        ]);

        if (cancelled) return;
        setData(dashboard);
        setStaffCount(staff.length);
        setVendorCount(vendors.length);
        setBudgetTotal(budgetOverview.reduce((sum, item) => sum + Number(item.estimated || 0), 0));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const taskPieData = useMemo(
    () =>
      (data?.tasksByStatus || []).map((item) => ({
        name: statusLabelMap[item.status] || item.status,
        value: item._count.status,
        color: statusColorMap[item.status] || "hsl(38 20% 86%)",
      })),
    [data],
  );

  const weeklyWorkload = useMemo(() => {
    const counts = new Map<string, number>();
    (data?.upcomingTasks || []).forEach((task) => {
      if (!task.dueAt) return;
      const day = new Date(task.dueAt).toLocaleDateString("vi-VN", { weekday: "short" });
      counts.set(day, (counts.get(day) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([day, tasks]) => ({ day, tasks }));
  }, [data]);

  const stats = [
    { label: "Dự án đang chạy", value: String(data?.projectProgress.length || 0), icon: FolderKanban, color: "text-primary" },
    { label: "Nhân sự hoạt động", value: String(staffCount), icon: Users, color: "text-secondary" },
    { label: "Nhà cung cấp", value: String(vendorCount), icon: Building2, color: "text-primary" },
    { label: "Tổng ngân sách", value: formatCurrency(budgetTotal), icon: Wallet, color: "text-secondary" },
  ];

  if (loading) return <div className="font-body text-muted-foreground">Đang tải dashboard...</div>;
  if (error || !data) return <div className="font-body text-destructive">{error || "Không có dữ liệu dashboard"}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-headline-lg text-foreground">Dashboard Ban tổ chức</h1>
        <p className="font-body text-sm text-muted-foreground mt-1">Tổng quan hoạt động tổ chức sự kiện từ dữ liệu thật</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="bg-surface-lowest rounded-xl p-5 shadow-ambient">
            <stat.icon size={20} className={stat.color} />
            <p className="font-serif text-headline-lg text-foreground mt-3">{stat.value}</p>
            <p className="font-body text-sm text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-surface-lowest rounded-xl p-6 shadow-ambient">
          <h3 className="font-serif text-headline-md text-foreground mb-6">Tiến độ dự án</h3>
          <div className="space-y-5">
            {data.projectProgress.map((project) => (
              <div key={project.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-body text-sm font-semibold text-foreground">{project.name}</p>
                    <p className="font-body text-xs text-muted-foreground">Deadline: {formatDate(project.eventDate)} • {project._count.tasks} task</p>
                  </div>
                  <span className="font-serif font-bold text-foreground text-sm">{project.progressPercent}%</span>
                </div>
                <Progress value={project.progressPercent} className="h-2" />
              </div>
            ))}
            {data.projectProgress.length === 0 && <p className="font-body text-sm text-muted-foreground">Chưa có dự án nào.</p>}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
          <h3 className="font-serif text-headline-md text-foreground mb-4">Phân bổ task</h3>
          {taskPieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart><Pie data={taskPieData} dataKey="value" cx="50%" cy="50%" outerRadius={65} innerRadius={40}>{taskPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}</Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {taskPieData.map((task) => (
                  <div key={task.name} className="flex items-center gap-2 text-xs font-body">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: task.color }} />
                    <span className="text-foreground">{task.name}</span>
                    <span className="text-muted-foreground ml-auto">{task.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="font-body text-sm text-muted-foreground">Chưa có dữ liệu task.</p>
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
          <h3 className="font-serif text-headline-md text-foreground mb-6">Khối lượng công việc sắp tới</h3>
          {weeklyWorkload.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyWorkload}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(38 20% 86%)" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: "hsl(50 8% 42%)" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(50 8% 42%)" }} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none" }} />
                <Bar dataKey="tasks" fill="hsl(113 33% 31%)" radius={[6, 6, 0, 0]} name="Tasks" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="font-body text-sm text-muted-foreground">Chưa có dữ liệu workload để hiển thị.</p>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="bg-surface-lowest rounded-xl p-6 shadow-ambient">
          <h3 className="font-serif text-headline-md text-foreground mb-6">Công việc sắp tới</h3>
          <div className="space-y-3">
            {data.upcomingTasks.map((task) => (
              <div key={task.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-low">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${task.status === "review" ? "bg-destructive/10" : "bg-surface-high"}`}>
                  {task.status === "review" ? <AlertTriangle size={14} className="text-destructive" /> : <Clock size={14} className="text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm font-semibold text-foreground truncate">{task.title}</p>
                  <p className="font-body text-xs text-muted-foreground">{task.event?.name || "Chưa gắn dự án"}</p>
                </div>
                <span className="font-body text-xs font-semibold shrink-0 text-muted-foreground">{formatDate(task.dueAt)}</span>
              </div>
            ))}
            {data.upcomingTasks.length === 0 && <p className="font-body text-sm text-muted-foreground">Không có task sắp tới.</p>}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default OrganizerDashboard;
