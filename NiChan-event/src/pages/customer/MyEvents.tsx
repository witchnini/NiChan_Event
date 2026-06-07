import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, MapPin, Users, ArrowRight, UserRound } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import SectionHeading from "@/components/SectionHeading";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";
import { getEventDisplayName, getEventStatusLabel, eventStatusFilters, eventStatusColors } from "@/lib/eventDisplay";

type CustomerEvent = {
  id: string;
  name: string;
  type: string;
  eventDate?: string | null;
  locationText?: string | null;
  guestCount?: number | null;
  status: string;
  progressPercent?: number | null;
  budgetEstimated?: string | number | null;
  organizerUser?: { displayName: string } | null;
  customerUser?: { displayName: string } | null;
  consultationRequest?: { customerName?: string | null; eventType?: string | null; note?: string | null } | null;
};

const statusFilters = eventStatusFilters;

const money = (value?: string | number | null) => Number(value || 0).toLocaleString("vi-VN") + "đ";

const MyEvents = () => {
  const [events, setEvents] = useState<CustomerEvent[]>([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setEvents(await apiClient.get<CustomerEvent[]>("/customer/events", { status: activeFilter === "all" ? undefined : activeFilter }));
      } catch (error) {
        toast.error("Không tải được danh sách sự kiện");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [activeFilter]);

  return (
    <div className="min-h-screen pt-24 pb-16">
      <section className="py-12 bg-surface-low">
        <div className="container mx-auto px-6">
          <SectionHeading label="Sự kiện của tôi" title="Danh sách sự kiện" subtitle="Theo dõi và quản lý tất cả sự kiện của bạn." />
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-6">
          <div className="flex gap-3 mb-8 flex-wrap">
            {statusFilters.map(tab => (
              <button key={tab.value} onClick={() => setActiveFilter(tab.value)}
                className={`px-4 py-2 rounded-xl font-body text-sm transition-all ${activeFilter === tab.value ? "gradient-primary text-primary-foreground" : "bg-surface-lowest text-muted-foreground hover:text-foreground"}`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {loading && <p className="font-body text-muted-foreground">Đang tải sự kiện...</p>}
            {!loading && events.length === 0 && (
              <div className="text-center py-16">
                <p className="font-body text-muted-foreground">Không có sự kiện nào trong danh mục này.</p>
              </div>
            )}
            {events.map((event, i) => (
              <motion.div key={event.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Link to={`/dashboard/su-kien/${event.id}`} className="block bg-surface-lowest rounded-xl p-6 shadow-ambient hover:shadow-ambient-lg transition-shadow">
                  <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-serif text-headline-md text-foreground">{getEventDisplayName(event)}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-body font-semibold ${eventStatusColors[event.status] ?? "bg-muted text-muted-foreground"}`}>{getEventStatusLabel(event.status)}</span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm font-body text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar size={14} /> {event.eventDate ? new Date(event.eventDate).toLocaleDateString("vi-VN") : "-"}</span>
                        <span className="flex items-center gap-1"><MapPin size={14} /> {event.locationText || "-"}</span>
                        <span className="flex items-center gap-1"><Users size={14} /> {event.guestCount ?? 0} khách</span>
                        <span className="flex items-center gap-1"><UserRound size={14} /> Quản lý dự án: {event.organizerUser?.displayName ?? "Chưa phân công"}</span>
                      </div>
                    </div>
                    <div className="w-full md:w-48 space-y-2">
                      <div className="flex items-center justify-between text-sm font-body">
                        <span className="text-muted-foreground">Tiến độ</span>
                        <span className="text-foreground font-semibold">{event.progressPercent ?? 0}%</span>
                      </div>
                      <Progress value={event.progressPercent ?? 0} className="h-2" />
                      <p className="text-sm font-body text-muted-foreground">Ngân sách: {money(event.budgetEstimated)}</p>
                    </div>
                    <ArrowRight size={20} className="text-muted-foreground hidden md:block" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default MyEvents;
