import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle, ClipboardCheck, Clock, CreditCard, FileText, MessageSquare } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { apiClient } from "@/services/apiClient";
import { getRequestStatusColor, getRequestStatusLabel, parseEventNameFromNote } from "@/lib/eventDisplay";
import { toast } from "sonner";

type CustomerRequest = {
  id: string;
  requestCode: string;
  eventType: string;
  eventDate?: string | null;
  locationText?: string | null;
  note?: string | null;
  status: string;
  assignedManager?: { displayName: string } | null;
  events: { id: string; name: string; status: string }[];
};

type DetailTab = "timeline" | "chat" | "documents" | "payment" | "settlement";

const tabs = [
  { key: "timeline" as const, label: "Tiến độ", icon: Clock },
  { key: "chat" as const, label: "Trao đổi", icon: MessageSquare },
  { key: "documents" as const, label: "Tài liệu", icon: FileText },
  { key: "payment" as const, label: "Thanh toán", icon: CreditCard },
  { key: "settlement" as const, label: "Nghiệm thu", icon: ClipboardCheck },
];

const milestones = [
  { title: "Xác nhận yêu cầu", description: "Yêu cầu đã được tiếp nhận và đang chờ xác nhận" },
  { title: "Báo giá & Thống nhất", description: "Trao đổi và thống nhất báo giá cùng khách hàng" },
  { title: "Ký hợp đồng & Đặt cọc", description: "Hoàn tất hợp đồng và khoản đặt cọc" },
  { title: "Lên kế hoạch chi tiết", description: "Lập kế hoạch chi tiết cho sự kiện" },
  { title: "Đặt venue & Nhà cung cấp", description: "Liên hệ và xác nhận các nhà cung cấp" },
  { title: "Tổng duyệt", description: "Tổng duyệt toàn bộ chương trình" },
  { title: "Ngày sự kiện", description: "Ngày diễn ra sự kiện chính thức" },
  { title: "Hoàn thành", description: "Hoàn tất quyết toán, thanh toán và thanh lý hợp đồng" },
];

const requestProgress: Record<string, { percent: number; step: number }> = {
  new: { percent: 5, step: 0 },
  reviewing: { percent: 10, step: 0 },
  quoted: { percent: 20, step: 1 },
  confirmed: { percent: 25, step: 2 },
  planning: { percent: 40, step: 3 },
  in_progress: { percent: 60, step: 5 },
  completed: { percent: 100, step: 8 },
  cancelled: { percent: 0, step: -1 },
  rejected: { percent: 0, step: -1 },
};

const emptyTabMessages: Record<Exclude<DetailTab, "timeline">, string> = {
  chat: "Kênh trao đổi sẽ được mở ngay khi yêu cầu được xác nhận thành sự kiện.",
  documents: "Tài liệu của sự kiện sẽ xuất hiện tại đây sau khi yêu cầu được xác nhận.",
  payment: "Chưa có khoản thanh toán nào cho yêu cầu này.",
  settlement: "Nghiệm thu sẽ được mở khi sự kiện đi vào giai đoạn hoàn thành.",
};

const RequestTracking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState<CustomerRequest | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("timeline");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const data = await apiClient.get<CustomerRequest>(`/customer/requests/${id}`);
        if (data.events[0]) {
          navigate(`/dashboard/su-kien/${data.events[0].id}`, { replace: true });
          return;
        }
        setRequest(data);
      } catch {
        toast.error("Không tải được thông tin sự kiện");
        navigate("/dashboard", { replace: true });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id, navigate]);

  const progress = requestProgress[request?.status ?? ""] ?? { percent: 0, step: -1 };
  const eventName = request ? parseEventNameFromNote(request.note) || request.eventType : "";

  return (
    <div className="min-h-screen pb-16 pt-24">
      <div className="container mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link to="/dashboard/su-kien" className="mb-4 flex items-center gap-2 font-body text-sm text-muted-foreground transition-colors hover:text-primary">
            <ArrowLeft size={16} /> Quay lại danh sách
          </Link>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="font-serif text-display-sm text-foreground">
                {request ? eventName : loading ? "Đang tải..." : "Không tìm thấy sự kiện"}
              </h1>
              <p className="mt-1 font-body text-muted-foreground">
                {request?.eventType ?? "-"} - {request?.eventDate ? new Date(request.eventDate).toLocaleDateString("vi-VN") : "-"} - {request?.locationText || "-"}
              </p>
              <p className="mt-1 font-body text-sm text-muted-foreground">
                Quản lý dự án: {request?.assignedManager?.displayName ?? "Chưa phân công"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-4 py-2 font-body text-sm font-semibold ${getRequestStatusColor(request?.status ?? "")}`}>
                {getRequestStatusLabel(request?.status ?? "")}
              </span>
              <span className="font-serif text-headline-md font-bold text-primary">{progress.percent}%</span>
            </div>
          </div>
          <Progress value={progress.percent} className="mt-4 h-2" />
        </motion.div>

        <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex items-center gap-2 whitespace-nowrap rounded-xl px-5 py-2.5 font-body text-sm transition-all ${
                activeTab === tab.key
                  ? "gradient-primary text-primary-foreground"
                  : "bg-surface-lowest text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "timeline" ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl">
            <div className="relative">
              <div className="absolute bottom-0 left-5 top-0 w-0.5 bg-border" />
              {milestones.map((milestone, index) => {
                const completed = progress.step >= 0 && index < progress.step;
                const current = index === progress.step;
                return (
                  <div key={milestone.title} className="relative mb-8 flex gap-6">
                    <div className={`z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      completed ? "bg-secondary text-secondary-foreground" : current ? "bg-primary text-primary-foreground" : "bg-surface-lowest text-muted-foreground"
                    }`}>
                      {completed ? <CheckCircle size={20} /> : <Clock size={18} />}
                    </div>
                    <div className={`flex-1 rounded-xl bg-surface-lowest p-5 shadow-ambient ${current ? "ring-1 ring-primary/20" : ""}`}>
                      <h3 className="font-serif text-lg font-semibold text-foreground">{milestone.title}</h3>
                      <p className="mt-1 font-body text-sm text-muted-foreground">{milestone.description}</p>
                      {current && (
                        <p className="mt-3 font-body text-xs font-semibold text-primary">
                          {request?.status === "rejected" ? "Yêu cầu chưa được chấp thuận" : `Đang xử lý · ${request?.requestCode}`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl rounded-xl bg-surface-lowest p-8 text-center shadow-ambient">
            <p className="font-body text-sm text-muted-foreground">{emptyTabMessages[activeTab]}</p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default RequestTracking;
