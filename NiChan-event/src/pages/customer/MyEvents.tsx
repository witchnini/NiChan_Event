import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import CustomerEventCard from "@/components/features/customer/CustomerEventCard";
import SectionHeading from "@/components/ui/section-heading";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";
import {
  eventStatusColors,
  eventStatusFilters,
  getEventDisplayName,
  getEventStatusLabel,
  getRequestStatusColor,
  getRequestStatusLabel,
  parseEventNameFromNote,
} from "@/lib/eventDisplay";

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

type CustomerRequest = {
  id: string;
  eventType: string;
  eventDate?: string | null;
  locationText?: string | null;
  guestCount?: number | null;
  budgetRange?: string | null;
  note?: string | null;
  status: string;
  assignedManager?: { displayName: string } | null;
  events: { id: string }[];
};

const REQUESTS_FILTER = "requests";
const statusFilters = [
  eventStatusFilters[0],
  { value: REQUESTS_FILTER, label: "Yêu cầu mới" },
  ...eventStatusFilters.slice(1),
];

const money = (value?: string | number | null) => Number(value || 0).toLocaleString("vi-VN") + "đ";

const MyEvents = () => {
  const [events, setEvents] = useState<CustomerEvent[]>([]);
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [eventData, requestData] = await Promise.all([
          activeFilter === REQUESTS_FILTER
            ? Promise.resolve([] as CustomerEvent[])
            : apiClient.get<CustomerEvent[]>("/customer/events", {
                status: activeFilter === "all" ? undefined : activeFilter,
              }),
          apiClient.get<CustomerRequest[]>("/customer/requests"),
        ]);
        setEvents(eventData);
        setRequests(requestData.filter((request) => request.events.length === 0));
      } catch (error) {
        toast.error("Không tải được danh sách sự kiện");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [activeFilter]);

  const visibleRequests = activeFilter === "all" || activeFilter === REQUESTS_FILTER ? requests : [];
  const hasItems = visibleRequests.length > 0 || events.length > 0;

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
            {!loading && !hasItems && (
              <div className="text-center py-16">
                <p className="font-body text-muted-foreground">Không có sự kiện nào trong danh mục này.</p>
              </div>
            )}
            {visibleRequests.map((request, i) => (
              <motion.div key={request.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <CustomerEventCard
                  to={`/dashboard/yeu-cau/${request.id}`}
                  title={parseEventNameFromNote(request.note) || request.eventType}
                  statusLabel={getRequestStatusLabel(request.status)}
                  statusClassName={getRequestStatusColor(request.status)}
                  eventDate={request.eventDate}
                  locationText={request.locationText}
                  guestCount={request.guestCount}
                  managerName={request.assignedManager?.displayName}
                  progressPercent={0}
                  budget={request.budgetRange || undefined}
                />
              </motion.div>
            ))}
            {events.map((event, i) => (
              <motion.div key={event.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <CustomerEventCard
                  to={`/dashboard/su-kien/${event.id}`}
                  title={getEventDisplayName(event)}
                  statusLabel={getEventStatusLabel(event.status)}
                  statusClassName={eventStatusColors[event.status] ?? "bg-muted text-muted-foreground"}
                  eventDate={event.eventDate}
                  locationText={event.locationText}
                  guestCount={event.guestCount}
                  managerName={event.organizerUser?.displayName}
                  progressPercent={event.progressPercent}
                  budget={money(event.budgetEstimated)}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default MyEvents;
