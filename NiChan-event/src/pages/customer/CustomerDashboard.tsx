import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, FileText, CreditCard, MessageSquare, Clock, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { apiClient } from "@/services/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getEventDisplayName, getEventStatusLabel, eventStatusColors } from "@/lib/eventDisplay";

type DashboardEvent = {
  id: string;
  name: string;
  type: string;
  eventDate?: string | null;
  status: string;
  progressPercent?: number | null;
  organizerUser?: { displayName: string } | null;
  customerUser?: { displayName: string } | null;
  consultationRequest?: { customerName?: string | null; eventType?: string | null; note?: string | null } | null;
};
type DashboardContract = { id: string; status: string; totalValue?: string | number | null };
type Transaction = { id: string; amount: string | number; status: string };
type Activity = { id: string; message: string; createdAt: string; iconName?: string | null };

type CustomerDashboardData = {
  events: DashboardEvent[];
  recentActivities: Activity[];
  contracts: DashboardContract[];
  transactions: Transaction[];
};

const activityIcon = (name?: string | null) => {
  if (name === "file") return FileText;
  if (name === "payment") return CreditCard;
  if (name === "message") return MessageSquare;
  return CheckCircle;
};

const moneyShort = (value: number) => value >= 1_000_000 ? `${Math.round(value / 1_000_000)}tr` : value.toLocaleString("vi-VN");

const CustomerDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState<CustomerDashboardData>({ events: [], recentActivities: [], contracts: [], transactions: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setData(await apiClient.get<CustomerDashboardData>("/customer/dashboard"));
      } catch (error) {
        toast.error("Không tải được dashboard khách hàng");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const stats = useMemo(() => {
    const activeEvents = data.events.filter(e => e.status !== "completed" && e.status !== "cancelled").length;
    const paid = data.transactions.filter(t => t.status === "completed").reduce((sum, t) => sum + Number(t.amount || 0), 0);
    return [
      { label: "Sự kiện", value: String(data.events.length), icon: Calendar, color: "text-primary" },
      { label: "Đang chuẩn bị", value: String(activeEvents), icon: Clock, color: "text-secondary" },
      { label: "Hợp đồng", value: String(data.contracts.length), icon: FileText, color: "text-primary" },
      { label: "Thanh toán", value: moneyShort(paid), icon: CreditCard, color: "text-secondary" },
    ];
  }, [data]);

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <h1 className="font-serif text-display-sm text-foreground mb-2">Xin chào, <span className="text-primary">{user?.displayName ?? "khách hàng"}</span></h1>
          <p className="font-body text-muted-foreground">{loading ? "Đang tải dữ liệu của bạn..." : "Quản lý sự kiện và theo dõi tiến độ của bạn."}</p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {stats.map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-surface-lowest rounded-xl p-5 shadow-ambient">
              <stat.icon size={20} className={stat.color} />
              <p className="font-serif text-headline-lg text-foreground mt-3">{stat.value}</p>
              <p className="font-body text-sm text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-headline-md text-foreground">Sự kiện của tôi</h2>
              <Link to="/dashboard/su-kien"><Button variant="tertiary" size="sm">Xem tất cả</Button></Link>
            </div>

            {data.events.map((event, i) => (
              <motion.div key={event.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1 }}>
                <Link to={`/dashboard/su-kien/${event.id}`} className="block bg-surface-lowest rounded-xl p-6 shadow-ambient hover:shadow-ambient-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-serif text-headline-md text-foreground">{getEventDisplayName(event)}</h3>
                      <p className="font-body text-sm text-muted-foreground mt-1">{event.type} - {event.eventDate ? new Date(event.eventDate).toLocaleDateString("vi-VN") : "-"}</p>
                      <p className="font-body text-sm text-muted-foreground mt-1">Quản lý dự án: {event.organizerUser?.displayName ?? "Chưa phân công"}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-body font-semibold ${eventStatusColors[event.status] ?? "bg-muted text-muted-foreground"}`}>{getEventStatusLabel(event.status)}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-body">
                      <span className="text-muted-foreground">Tiến độ</span>
                      <span className="text-foreground font-semibold">{event.progressPercent ?? 0}%</span>
                    </div>
                    <Progress value={event.progressPercent ?? 0} className="h-2" />
                  </div>
                </Link>
              </motion.div>
            ))}
            {data.events.length === 0 && <p className="font-body text-sm text-muted-foreground">Chưa có sự kiện nào.</p>}
          </div>

          <div>
            <h2 className="font-serif text-headline-md text-foreground mb-6">Hoạt động gần đây</h2>
            <div className="bg-surface-lowest rounded-xl p-6 shadow-ambient space-y-5">
              {data.recentActivities.map(activity => {
                const Icon = activityIcon(activity.iconName);
                return (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-surface-low flex items-center justify-center shrink-0">
                      <Icon size={14} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-body text-sm text-foreground">{activity.message}</p>
                      <p className="font-body text-xs text-muted-foreground mt-1">{new Date(activity.createdAt).toLocaleString("vi-VN")}</p>
                    </div>
                  </div>
                );
              })}
              {data.recentActivities.length === 0 && <p className="font-body text-sm text-muted-foreground">Chưa có hoạt động mới.</p>}
            </div>

            <div className="mt-6 space-y-3">
              <Link to="/lien-he">
                <Button variant="hero" className="w-full">Gửi yêu cầu mới <ArrowRight size={16} /></Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;
