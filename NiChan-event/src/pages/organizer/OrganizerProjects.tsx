import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  Briefcase,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Edit2,
  Eye,
  ListChecks,
  Mail,
  MapPin,
  Milestone,
  Phone,
  PlayCircle,
  Plus,
  Search,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { apiClient } from "@/services/apiClient";
import { getSocket } from "@/services/socket";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  eventStatusLabels,
  eventStatusColors,
  eventStatusFilters,
  getEventStatusLabel,
  getMilestoneTitleLabel,
} from "@/lib/eventDisplay";
import ContractPdfButton from "@/components/features/contracts/ContractPdfButton";
import { type FullContract } from "@/components/features/contracts/ContractDocument";

type Project = {
  id: string;
  name: string;
  type: string;
  status: string;
  eventDate?: string | null;
  guestCount?: number | null;
  locationText?: string | null;
  progressPercent: number;
  organizerAssignmentStatus?: "pending" | "accepted" | "rejected" | null;
  organizerRejectionReason?: string | null;
  organizerRespondedAt?: string | null;
  customerUser: {
    id: string;
    displayName: string;
    email?: string | null;
    phone?: string | null;
    avatarUrl?: string | null;
  };
  consultationRequest?: {
    requestCode: string;
    status: string;
    customerName?: string | null;
    eventType?: string | null;
    note?: string | null;
    budgetRange?: string | null;
  } | null;
  _count: {
    tasks: number;
    milestones: number;
    vendors?: number;
    staffAssignments?: number;
  };
};

type OrganizerRequestAssignment = {
  id: string;
  requestCode: string;
  customerName: string;
  phone: string;
  email: string;
  eventType: string;
  eventDate?: string | null;
  guestCount?: number | null;
  budgetRange?: string | null;
  locationText?: string | null;
  note?: string | null;
  status: string;
  assignedManagerId?: string | null;
  organizerRequestStatus?: "pending" | "accepted" | "rejected" | null;
  organizerRequestRejectionReason?: string | null;
  organizerRequestRespondedAt?: string | null;
  assignmentHistory?: {
    id: string;
    status: "pending" | "accepted" | "rejected" | "reassigned";
    rejectionReason?: string | null;
    assignedAt: string;
    respondedAt?: string | null;
  }[];
  createdAt: string;
};

type OrganizerRequestAssignmentResponse = {
  request: OrganizerRequestAssignment;
  event?: { id: string; name: string } | null;
};

type ProjectDetail = Project & {
  summary?: string | null;
  milestones: {
    id: string;
    title: string;
    description?: string | null;
    milestoneDate?: string | null;
    status: string;
    sortOrder: number;
  }[];
  activities: {
    id: string;
    message: string;
    iconName?: string | null;
    createdAt: string;
  }[];
  _count: Project["_count"] & {
    contracts: number;
    documents: number;
  };
};

type StaffOption = {
  id: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  projectCount?: number;
  activeProjectCount?: number;
  completedProjectCount?: number;
  staffProfile?: {
    fullName?: string | null;
    jobTitle?: string | null;
    employmentStatus?: string | null;
    address?: string | null;
  } | null;
};

type ProjectStaffAssignment = {
  id: string;
  roleText: string;
  status: string;
  assignedAt: string;
  staffUser: {
    id: string;
    displayName: string;
    email?: string | null;
    phone?: string | null;
    avatarUrl?: string | null;
    staffProfile?: { jobTitle?: string | null } | null;
  };
};

type ProjectStaffResponse = {
  event: { id: string; name: string };
  assignments: ProjectStaffAssignment[];
};

type VendorCategory = { id: string; name: string };

type VendorOption = {
  id: string;
  name: string;
  categoryId?: string;
  category?: VendorCategory | null;
  phone?: string | null;
  email?: string | null;
  contactName?: string | null;
  bankAccountNumber?: string | null;
  address?: string | null;
  status?: string | null;
};

type ProjectVendor = {
  id: string;
  eventId: string;
  vendorId: string;
  serviceNote?: string | null;
  status: string;
  createdAt: string;
  vendor: VendorOption;
};

type BudgetItem = {
  id: string;
  category: string;
  estimatedAmount: string | number;
  actualAmount: string | number;
  note?: string | null;
  status: string;
  vendorId?: string | null;
  vendor?: { id: string; name: string } | null;
};

type BudgetHealth = {
  riskLevel: "empty" | "healthy" | "watch" | "at_risk" | "over_budget";
  percentUsed: number;
  variance: number;
  remaining: number;
  overrunItems: number;
  nearingLimitItems: number;
  alerts: string[];
};

type ProjectBudget = {
  project: { id: string; name: string };
  budget: { id: string; name: string };
  items: BudgetItem[];
  estimatedTotal: number;
  actualTotal: number;
  budgetHealth?: BudgetHealth;
};

type ProjectView = "overview" | "kanban" | "timeline" | "staff" | "vendors";

type KanbanTask = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: "low" | "medium" | "high";
  dueAt?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
  sortOrder?: number | null;
  assignee?: { id: string; displayName: string; avatarUrl?: string | null } | null;
};

type KanbanColumn = {
  id: string;
  title: string;
  tasks: KanbanTask[];
};

type KanbanResponse = {
  project: {
    id: string;
    name: string;
    status: string;
    eventDate?: string | null;
    guestCount?: number | null;
    progressPercent: number;
    customerUser?: { id: string; displayName: string; avatarUrl?: string | null };
    consultationRequest?: {
      requestCode: string;
      status: string;
      customerName?: string | null;
      eventType?: string | null;
      note?: string | null;
    } | null;
  };
  columns: KanbanColumn[];
};

const statuses = eventStatusFilters;
const statusLabel = eventStatusLabels;
const statusColors = eventStatusColors;

const priorityColors: Record<string, string> = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-primary/10 text-primary",
  low: "bg-muted text-muted-foreground",
};

const priorityLabel: Record<KanbanTask["priority"], string> = {
  high: "Cao",
  medium: "Trung bình",
  low: "Thấp",
};

const staffRoles = ["Event Manager", "Điều phối viên", "Thiết kế", "Lễ tân", "Âm thanh & ánh sáng", "MC"];
const emptyCreateStaffForm = { name: "", email: "", phone: "", jobTitle: "", employmentStatus: "active" };
const emptyVendorForm = { vendorId: "", serviceNote: "" };
const emptyVendorEditorForm = {
  name: "",
  categoryId: "",
  phone: "",
  email: "",
  bankAccountNumber: "",
  contactName: "",
  address: "",
  status: "active",
  serviceNote: "",
};
const NO_VENDOR = "none";
const isValidPhone = (value: string) => !value || /^0[3-9]\d{8}$/.test(value);

const staffEmploymentLabel = (status?: string | null) =>
  status === "inactive" ? "Tạm nghỉ" : "Đang làm việc";

const staffEmploymentClass = (status?: string | null) =>
  status === "inactive"
    ? "bg-destructive/10 text-destructive"
    : "bg-secondary/10 text-secondary";

const taskStatusLabel: Record<string, string> = {
  todo: "Chờ xử lý",
  in_progress: "Đang thực hiện",
  review: "Đang kiểm tra",
  done: "Hoàn thành",
};

const budgetStatusLabel: Record<string, string> = {
  planned: "Dự kiến",
  approved: "Đã duyệt",
  committed: "Đã cam kết",
  paid: "Đã thanh toán",
};

const budgetStatusBadge: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  approved: "bg-primary/10 text-primary",
  committed: "bg-amber-500/10 text-amber-600",
  paid: "bg-secondary/10 text-secondary",
};

const vendorStatusLabel: Record<string, string> = {
  active: "Đang hợp tác",
  paused: "Tạm dừng",
  inactive: "Ngừng hợp tác",
};

const staffAssignmentStatusLabel: Record<string, string> = {
  invited: "Đã mời",
  confirmed: "Đã xác nhận",
  declined: "Từ chối",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MIN_GANTT_WEEKS = 10;

const priorityDurationDays: Record<KanbanTask["priority"], number> = {
  high: 7,
  medium: 14,
  low: 21,
};

const ganttStatusColors: Record<string, string> = {
  todo: "bg-primary-container/70",
  in_progress: "bg-primary",
  review: "bg-secondary/70",
  done: "bg-secondary",
};

const getTime = (value?: string | null) => {
  const time = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(time) ? time : null;
};

const startOfDay = (time: number) => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const allowedTaskMoves: Record<string, string[]> = {
  todo: ["in_progress"],
  in_progress: ["review", "todo"],
  review: ["done", "in_progress"],
  done: [],
};

type TaskFormState = {
  title: string;
  description: string;
  assigneeUserId: string;
  dueAt: string;
  priority: "low" | "medium" | "high";
};
const emptyForm: TaskFormState = {
  title: "",
  description: "",
  assigneeUserId: "",
  dueAt: "",
  priority: "medium",
};

type TaskTemplate = {
  id: string;
  phase: string;
  title: string;
  description: string;
  priority: KanbanTask["priority"];
  dueDaysFromEvent: number;
};

type TaskTemplateGroup = {
  id: string;
  label: string;
  matchKeywords: string[];
  tasks: TaskTemplate[];
};

const createTemplate = (
  id: string,
  phase: string,
  title: string,
  description: string,
  priority: KanbanTask["priority"],
  dueDaysFromEvent: number,
): TaskTemplate => ({ id, phase, title, description, priority, dueDaysFromEvent });

const TASK_TEMPLATE_GROUPS: TaskTemplateGroup[] = [
  {
    id: "wedding",
    label: "Tiệc cưới",
    matchKeywords: ["tiec cuoi", "cuoi", "wedding", "dam cuoi"],
    tasks: [
      createTemplate("wedding-concept", "Lập kế hoạch", "Chốt concept cưới và moodboard", "Thống nhất phong cách trang trí, màu chủ đạo và hạng mục ưu tiên với khách hàng.", "high", -45),
      createTemplate("wedding-venue", "Lập kế hoạch", "Khảo sát sảnh tiệc và sơ đồ bàn", "Kiểm tra mặt bằng, lối vào, khu vực lễ, sân khấu, bàn khách và luồng di chuyển.", "high", -35),
      createTemplate("wedding-menu", "Nhà cung cấp", "Chốt thực đơn và số lượng khách", "Xác nhận menu, số bàn dự phòng, yêu cầu đặc biệt và thời điểm khóa số lượng.", "medium", -25),
      createTemplate("wedding-decor", "Sản xuất", "Điều phối trang trí lễ đường và sảnh tiệc", "Phân công đội decor, hoa tươi, backdrop, photobooth và timeline setup.", "high", -14),
      createTemplate("wedding-script", "Vận hành", "Chốt kịch bản lễ cưới và timeline chương trình", "Hoàn thiện cue sheet cho MC, nghi lễ, âm nhạc, phát biểu và các điểm nhấn.", "high", -10),
      createTemplate("wedding-rehearsal", "Vận hành", "Tổng duyệt MC, âm thanh và ánh sáng", "Chạy thử nghi thức, nhạc nền, micro, ánh sáng sân khấu và tín hiệu điều phối.", "high", -3),
      createTemplate("wedding-guest-flow", "Ngày sự kiện", "Checklist đón khách và phân luồng bàn tiệc", "Chuẩn bị lễ tân, bảng sơ đồ bàn, line đón khách VIP và phương án xử lý phát sinh.", "medium", -1),
      createTemplate("wedding-handover", "Sau sự kiện", "Tổng kết sau tiệc và bàn giao tư liệu", "Chốt biên bản, hình ảnh/video, phản hồi khách hàng và các khoản cần đối soát.", "medium", 2),
    ],
  },
  {
    id: "conference",
    label: "Hội nghị & hội thảo",
    matchKeywords: ["hoi nghi", "hoi thao", "conference", "seminar", "workshop", "doanh nghiep"],
    tasks: [
      createTemplate("conference-agenda", "Lập kế hoạch", "Chốt agenda và flow check-in", "Khóa agenda, khung giờ check-in, phân luồng khách mời và điểm hỗ trợ thông tin.", "high", -30),
      createTemplate("conference-speakers", "Khách mời", "Xác nhận diễn giả và khách VIP", "Xác nhận hồ sơ diễn giả, thời lượng trình bày, nhu cầu kỹ thuật và lễ tân VIP.", "high", -25),
      createTemplate("conference-layout", "Sản xuất", "Thiết kế layout sân khấu, booth và khu vực networking", "Hoàn thiện sơ đồ sân khấu, booth tài trợ, bàn đăng ký và không gian giao lưu.", "medium", -20),
      createTemplate("conference-tech", "Kỹ thuật", "Kiểm tra thiết bị trình chiếu, âm thanh và phiên dịch", "Rà soát màn hình, máy chiếu, micro, clicker, livestream và cabin phiên dịch nếu có.", "high", -12),
      createTemplate("conference-materials", "Vận hành", "Chuẩn bị tài liệu, badge và QR check-in", "In ấn badge, tài liệu, standee, QR check-in và bộ vật phẩm cho người tham dự.", "medium", -7),
      createTemplate("conference-rehearsal", "Vận hành", "Chạy thử kỹ thuật toàn bộ chương trình", "Test slide, video, âm thanh, ánh sáng, livestream, tín hiệu chuyển cảnh và cue MC.", "high", -2),
      createTemplate("conference-live", "Ngày sự kiện", "Điều phối phiên họp và hỗ trợ diễn giả", "Theo sát từng phiên, hỗ trợ diễn giả, xử lý câu hỏi và cập nhật timeline thực tế.", "high", 0),
      createTemplate("conference-report", "Sau sự kiện", "Báo cáo attendance và feedback", "Tổng hợp số người tham dự, phản hồi, hình ảnh và các hạng mục cần cải thiện.", "medium", 2),
    ],
  },
  {
    id: "opening",
    label: "Lễ khai trương",
    matchKeywords: ["khai truong", "opening", "showroom", "ra mat", "launch"],
    tasks: [
      createTemplate("opening-site", "Lập kế hoạch", "Khảo sát mặt bằng và luồng khách", "Đánh giá lối vào, khu cắt băng, khu đón khách, bãi xe và điểm đặt backdrop.", "high", -25),
      createTemplate("opening-ritual", "Nghi thức", "Chốt nghi thức cắt băng và khai trương", "Xác nhận đại biểu, vật phẩm nghi thức, thứ tự phát biểu và cue cắt băng.", "high", -18),
      createTemplate("opening-decor", "Sản xuất", "Lên phương án trang trí cổng, backdrop và booth", "Chốt thiết kế cổng chào, thảm đỏ, hoa, standee, booth trải nghiệm và POSM.", "medium", -14),
      createTemplate("opening-safety", "Vận hành", "Kiểm tra giấy phép và an toàn khu vực setup", "Rà soát điện, PCCC, lối thoát hiểm, giấy phép âm thanh và các yêu cầu mặt bằng.", "high", -10),
      createTemplate("opening-show", "Nội dung", "Điều phối MC, múa lân và tiết mục biểu diễn", "Khóa kịch bản MC, thời lượng biểu diễn, vị trí chờ và tín hiệu vào sân khấu.", "medium", -7),
      createTemplate("opening-tech", "Kỹ thuật", "Chạy thử âm thanh, ánh sáng và hiệu ứng", "Test micro, loa, nhạc hiệu, ánh sáng, pháo giấy hoặc hiệu ứng được duyệt.", "high", -2),
      createTemplate("opening-vip", "Ngày sự kiện", "Checklist đón khách VIP và truyền thông tại chỗ", "Phân công lễ tân VIP, photographer, quay phim, vị trí báo chí và timeline đăng bài.", "high", 0),
      createTemplate("opening-handover", "Sau sự kiện", "Tháo dỡ, bàn giao và tổng kết hình ảnh", "Bàn giao mặt bằng, đối soát vendor, gom file hình ảnh và ghi nhận phản hồi.", "medium", 1),
    ],
  },
  {
    id: "birthday",
    label: "Sinh nhật",
    matchKeywords: ["sinh nhat", "birthday"],
    tasks: [
      createTemplate("birthday-theme", "Lập kế hoạch", "Chốt chủ đề và màu sắc trang trí", "Thống nhất concept, nhân vật/chủ đề, bảng màu và khu vực trang trí trọng tâm.", "high", -21),
      createTemplate("birthday-guests", "Khách mời", "Xác nhận danh sách khách và khu vực bàn tiệc", "Chốt số lượng khách, khu gia đình, khu trẻ em và nhu cầu chỗ ngồi đặc biệt.", "medium", -14),
      createTemplate("birthday-cake", "Nhà cung cấp", "Chốt bánh, quà tặng và hoạt động trò chơi", "Xác nhận bánh, quà cảm ơn, trò chơi, nhân sự hoạt náo và đạo cụ cần chuẩn bị.", "medium", -10),
      createTemplate("birthday-decor", "Sản xuất", "Điều phối backdrop, photobooth và sân khấu nhỏ", "Phân công decor, in ấn, bong bóng, bàn gallery và khu chụp hình.", "medium", -7),
      createTemplate("birthday-tech", "Kỹ thuật", "Kiểm tra âm thanh, ánh sáng và playlist", "Test loa, micro, nhạc sinh nhật, ánh sáng khu sân khấu và phương án dự phòng.", "medium", -2),
      createTemplate("birthday-setup", "Ngày sự kiện", "Setup khu đón khách và khu trẻ em", "Chuẩn bị bảng tên, quà, khu trò chơi, nhân sự hỗ trợ trẻ em và luồng vào tiệc.", "high", 0),
      createTemplate("birthday-handover", "Sau sự kiện", "Tổng kết và bàn giao ảnh/video", "Thu gom đạo cụ, đối soát chi phí, bàn giao ảnh/video và ghi nhận phản hồi.", "low", 1),
    ],
  },
  {
    id: "gala",
    label: "Gala / Year End Party",
    matchKeywords: ["gala", "year end", "tat nien", "cuoi nam", "party", "vinh danh"],
    tasks: [
      createTemplate("gala-theme", "Lập kế hoạch", "Chốt chủ đề gala và dress code", "Thống nhất chủ đề, màu nhận diện, dress code và trải nghiệm khách mời.", "high", -35),
      createTemplate("gala-awards", "Nội dung", "Lên kịch bản vinh danh và trao giải", "Chốt danh mục giải thưởng, người trao, thứ tự công bố và nội dung trình chiếu.", "high", -25),
      createTemplate("gala-seating", "Khách mời", "Chốt sơ đồ bàn và khu vực VIP", "Hoàn thiện seating plan, khu VIP, bàn lãnh đạo và phương án check-in.", "medium", -14),
      createTemplate("gala-stage", "Sản xuất", "Điều phối sân khấu, LED, âm thanh và ánh sáng", "Khóa thiết kế sân khấu, LED content, âm thanh, ánh sáng, hiệu ứng và nhân sự kỹ thuật.", "high", -10),
      createTemplate("gala-performance", "Nội dung", "Chuẩn bị tiết mục biểu diễn và cue list", "Chốt tiết mục, file nhạc, đạo cụ, vị trí chờ và tín hiệu vào/ra sân khấu.", "medium", -7),
      createTemplate("gala-rehearsal", "Vận hành", "Tổng duyệt chương trình", "Chạy rehearsal MC, trao giải, trình diễn, video, ánh sáng và đội điều phối.", "high", -2),
      createTemplate("gala-live", "Ngày sự kiện", "Điều phối check-in, tiệc và trao giải", "Theo sát timeline, khách VIP, bàn tiệc, cue trao giải và xử lý phát sinh.", "high", 0),
      createTemplate("gala-close", "Sau sự kiện", "Tổng kết chi phí và bàn giao tư liệu", "Đối soát vendor, tổng hợp hình ảnh/video, feedback và báo cáo ngân sách.", "medium", 2),
    ],
  },
  {
    id: "ceremony",
    label: "Lễ động thổ / khánh thành",
    matchKeywords: ["dong tho", "khoi cong", "khanh thanh", "inauguration", "groundbreaking", "ky niem"],
    tasks: [
      createTemplate("ceremony-site", "Lập kế hoạch", "Khảo sát mặt bằng và phương án setup", "Kiểm tra khu vực sân khấu, nhà bạt, lối VIP, bãi xe, điện và điều kiện thời tiết.", "high", -30),
      createTemplate("ceremony-ritual", "Nghi thức", "Chốt nghi thức và danh sách đại biểu", "Khóa thành phần đại biểu, thứ tự phát biểu, nghi thức chính và vai trò từng người.", "high", -21),
      createTemplate("ceremony-layout", "Sản xuất", "Lập sơ đồ sân khấu, nhà bạt và khu vực khách", "Hoàn thiện layout, khu lễ tân, khu báo chí, khu kỹ thuật và đường di chuyển.", "medium", -15),
      createTemplate("ceremony-items", "Nghi thức", "Chuẩn bị vật phẩm nghi lễ và bảng tên", "Chuẩn bị xẻng, mũ, găng tay, băng khánh thành, bảng tên, hoa và tài liệu đại biểu.", "medium", -10),
      createTemplate("ceremony-safety", "Vận hành", "Kiểm tra an toàn, điện và âm thanh ngoài trời", "Rà soát tải điện, dây dẫn, loa, micro, PCCC, lối thoát và phương án mưa.", "high", -5),
      createTemplate("ceremony-rehearsal", "Vận hành", "Tổng duyệt nghi thức và tuyến di chuyển VIP", "Chạy thử nghi thức chính, vị trí đứng, cue MC và tuyến di chuyển đại biểu.", "high", -1),
      createTemplate("ceremony-live", "Ngày sự kiện", "Điều phối ngày lễ và truyền thông hiện trường", "Theo sát timeline, lễ tân, báo chí, photographer, quay phim và xử lý phát sinh.", "high", 0),
      createTemplate("ceremony-handover", "Sau sự kiện", "Bàn giao mặt bằng và báo cáo sau sự kiện", "Tháo dỡ, bàn giao mặt bằng, đối soát vendor, gom tư liệu và báo cáo tổng kết.", "medium", 1),
    ],
  },
  {
    id: "default",
    label: "Sự kiện tổng hợp",
    matchKeywords: [],
    tasks: [
      createTemplate("default-brief", "Lập kế hoạch", "Chốt brief vận hành và mục tiêu sự kiện", "Thống nhất mục tiêu, phạm vi công việc, tiêu chí thành công và đầu mối phê duyệt.", "high", -30),
      createTemplate("default-budget", "Ngân sách", "Rà soát ngân sách và hạng mục ưu tiên", "Tách ngân sách theo hạng mục, xác định khoản bắt buộc và khoản có thể linh hoạt.", "high", -25),
      createTemplate("default-vendors", "Nhà cung cấp", "Chọn vendor phù hợp cho từng hạng mục", "Đề xuất, so sánh và chốt vendor theo chất lượng, thời gian đáp ứng và ngân sách.", "medium", -18),
      createTemplate("default-layout", "Sản xuất", "Chốt layout, timeline và nhân sự vận hành", "Hoàn thiện sơ đồ setup, timeline chi tiết, ca trực và người chịu trách nhiệm.", "high", -12),
      createTemplate("default-assets", "Sản xuất", "Chuẩn bị vật phẩm, thiết kế và tài liệu", "Rà soát file in ấn, vật phẩm, quà tặng, tài liệu và checklist bàn giao.", "medium", -7),
      createTemplate("default-rehearsal", "Vận hành", "Chạy thử kỹ thuật và tổng duyệt", "Test âm thanh, ánh sáng, trình chiếu, tín hiệu điều phối và kịch bản chính.", "high", -2),
      createTemplate("default-live", "Ngày sự kiện", "Điều phối ngày sự kiện theo checklist", "Theo sát timeline, check-in, khách VIP, vendor, nhân sự và phát sinh tại hiện trường.", "high", 0),
      createTemplate("default-report", "Sau sự kiện", "Tổng kết, đối soát và bàn giao sau sự kiện", "Đối soát chi phí, tài liệu, hình ảnh/video, phản hồi khách hàng và bài học cải tiến.", "medium", 2),
    ],
  },
];

const normalizeTemplateText = (value?: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const normalizeTaskTitle = (value?: string | null) =>
  normalizeTemplateText(value).replace(/\s+/g, " ").trim();

const pickTaskTemplateGroup = (context: string) => {
  const normalized = normalizeTemplateText(context);
  return (
    TASK_TEMPLATE_GROUPS.find((group) =>
      group.matchKeywords.some((keyword) => normalized.includes(keyword)),
    ) ?? TASK_TEMPLATE_GROUPS[TASK_TEMPLATE_GROUPS.length - 1]
  );
};

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa cập nhật";

const formatCurrency = (value?: string | number | null) =>
  `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const toApiDateTime = (value: string) =>
  value ? new Date(`${value}T00:00:00`).toISOString() : undefined;

const isOverdue = (value?: string | null) =>
  !!value && new Date(value).getTime() < Date.now();

const parseEventNameFromNote = (note?: string | null): string | null => {
  if (!note) return null;

  const eventNameLine = note
    .split(/\r?\n/)
    .find((line) => line.trim().toLowerCase().startsWith("ten su kien:"));

  if (!eventNameLine) return null;

  const eventName = eventNameLine.split(":").slice(1).join(":").trim();
  return eventName || null;
};

const getRejectedRequestHistoryItem = (request: OrganizerRequestAssignment) =>
  request.assignmentHistory?.find((item) => item.status === "rejected");

const normalizeName = (value?: string | null) => value?.trim().toLowerCase() ?? "";

const getRequestProjectName = (project: Pick<Project, "name" | "type" | "consultationRequest">) =>
  parseEventNameFromNote(project.consultationRequest?.note) ||
  project.consultationRequest?.eventType ||
  project.type;

const isGeneratedProjectName = (project: Pick<Project, "name" | "type" | "customerUser" | "consultationRequest">) => {
  const savedName = normalizeName(project.name);
  const customerNames = [
    project.consultationRequest?.customerName,
    project.customerUser.displayName,
  ]
    .map(normalizeName)
    .filter(Boolean);

  return customerNames.some(
    (customerName) => savedName === normalizeName(`${project.type} - ${customerName}`),
  );
};

const getProjectDisplayName = (project: Pick<Project, "name" | "type" | "customerUser" | "consultationRequest">) => {
  const requestName = getRequestProjectName(project);
  return isGeneratedProjectName(project) ? requestName : project.name;
};

const getProjectCustomerName = (project: Pick<Project, "customerUser" | "consultationRequest">) =>
  project.consultationRequest?.customerName || project.customerUser.displayName;

const OrganizerProjects = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [requestAssignments, setRequestAssignments] = useState<OrganizerRequestAssignment[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [projectStaff, setProjectStaff] = useState<ProjectStaffAssignment[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [vendorCategories, setVendorCategories] = useState<VendorCategory[]>([]);
  const [projectVendors, setProjectVendors] = useState<ProjectVendor[]>([]);
  const [projectBudget, setProjectBudget] = useState<ProjectBudget | null>(null);
  const [projectContracts, setProjectContracts] = useState<FullContract[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [kanban, setKanban] = useState<KanbanResponse | null>(null);
  const [view, setView] = useState<ProjectView>("overview");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [vendorListOpen, setVendorListOpen] = useState(false);
  const [vendorEditorOpen, setVendorEditorOpen] = useState(false);
  const [viewVendorItem, setViewVendorItem] = useState<VendorOption | null>(null);
  const [vendorDetailFromList, setVendorDetailFromList] = useState(false);
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [staffListOpen, setStaffListOpen] = useState(false);
  const [createStaffDialogOpen, setCreateStaffDialogOpen] = useState(false);
  const [viewStaffItem, setViewStaffItem] = useState<StaffOption | null>(null);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const [customTaskMode, setCustomTaskMode] = useState(false);
  const [taskTemplateSearch, setTaskTemplateSearch] = useState("");
  const [selectedTaskTemplateIds, setSelectedTaskTemplateIds] = useState<string[]>([]);
  const [targetStatus, setTargetStatus] = useState("todo");
  const [form, setForm] = useState(emptyForm);
  const [vendorForm, setVendorForm] = useState(emptyVendorForm);
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorEditorForm, setVendorEditorForm] = useState(emptyVendorEditorForm);
  const [editingProjectVendor, setEditingProjectVendor] = useState<ProjectVendor | null>(null);
  const [vendorSaving, setVendorSaving] = useState(false);
  const [staffForm, setStaffForm] = useState({ staffUserId: "", roleText: "", status: "invited" });
  const [editingStaffAssignment, setEditingStaffAssignment] = useState<ProjectStaffAssignment | null>(null);
  const [staffSearch, setStaffSearch] = useState("");
  const [createStaffForm, setCreateStaffForm] = useState(emptyCreateStaffForm);
  const [createStaffSaving, setCreateStaffSaving] = useState(false);
  const [respondingAssignmentId, setRespondingAssignmentId] = useState<string | null>(null);
  const [assignmentRequestsOpen, setAssignmentRequestsOpen] = useState(false);
  const [rejectionProject, setRejectionProject] = useState<Project | null>(null);
  const [rejectionRequest, setRejectionRequest] = useState<OrganizerRequestAssignment | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [contextLoading, setContextLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assigneeOptions = useMemo(() => {
    const self = user
      ? [{ id: user.userId, displayName: `${user.displayName} (tôi)`, email: user.email }]
      : [];
    const merged = [...self, ...staff];
    return merged.filter((item, index) => merged.findIndex((other) => other.id === item.id) === index);
  }, [staff, user]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const acceptedProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          project.organizerAssignmentStatus === "accepted" &&
          project.status !== "cancelled",
      ),
    [projects],
  );
  const pendingRequestAssignments = useMemo(
    () =>
      requestAssignments.filter(
        (request) =>
          request.assignedManagerId === user?.userId &&
          request.organizerRequestStatus === "pending",
      ),
    [requestAssignments, user?.userId],
  );
  const pendingProjectAssignments = useMemo(
    () =>
      projects.filter(
        (project) =>
          project.organizerAssignmentStatus === "pending" &&
          project.status !== "cancelled",
      ),
    [projects],
  );
  const cancelledProjectHistory = useMemo(
    () => projects.filter((project) => project.status === "cancelled"),
    [projects],
  );
  const rejectedRequestHistory = useMemo(
    () =>
      requestAssignments.filter(
        (request) =>
          request.assignmentHistory?.some((item) => item.status === "rejected") ||
          (request.assignedManagerId === user?.userId &&
            request.organizerRequestStatus === "rejected"),
      ),
    [requestAssignments, user?.userId],
  );
  const rejectedProjectHistory = useMemo(
    () =>
      projects.filter(
        (project) =>
          project.organizerAssignmentStatus === "rejected" &&
          project.status !== "cancelled",
      ),
    [projects],
  );
  const assignmentHistoryCount =
    cancelledProjectHistory.length +
    rejectedRequestHistory.length +
    rejectedProjectHistory.length;
  const pendingAssignmentCount = pendingRequestAssignments.length + pendingProjectAssignments.length;
  const activeProject = projectDetail ?? selectedProject;
  const activeProjectDisplayName = activeProject ? getProjectDisplayName(activeProject) : kanban?.project.name ?? "";
  const activeProjectCustomerName = activeProject
    ? getProjectCustomerName(activeProject)
    : kanban?.project.customerUser?.displayName ?? "-";

  const availableStaffForProject = useMemo(() => {
    const assignedIds = new Set(projectStaff.map((assignment) => assignment.staffUser.id));
    return staff.filter((person) => !assignedIds.has(person.id));
  }, [projectStaff, staff]);

  const filteredStaffCatalog = useMemo(() => {
    const keyword = staffSearch.trim().toLowerCase();
    if (!keyword) return staff;

    return staff.filter((person) =>
      [person.displayName, person.staffProfile?.fullName, person.staffProfile?.jobTitle, person.email, person.phone]
        .some((value) => value?.toLowerCase().includes(keyword)),
    );
  }, [staff, staffSearch]);

  const assignableVendorChoices = useMemo(
    () => vendors.filter((vendor) => vendor.status !== "inactive"),
    [vendors],
  );

  const availableVendorsForProject = useMemo(() => {
    const assignedIds = new Set(projectVendors.map((assignment) => assignment.vendorId));
    return assignableVendorChoices.filter((vendor) => !assignedIds.has(vendor.id));
  }, [assignableVendorChoices, projectVendors]);

  const filteredVendorCatalog = useMemo(() => {
    const keyword = vendorSearch.trim().toLowerCase();
    if (!keyword) return vendors;

    return vendors.filter((vendor) =>
      [vendor.name, vendor.category?.name, vendor.contactName, vendor.phone, vendor.email, vendor.address]
        .some((value) => value?.toLowerCase().includes(keyword)),
    );
  }, [vendorSearch, vendors]);

  const projectVendorChoices = useMemo(
    () => projectVendors
      .map((assignment) => assignment.vendor)
      .filter((vendor) => vendor.status !== "inactive"),
    [projectVendors],
  );

  const budgetItems = useMemo(() => projectBudget?.items ?? [], [projectBudget]);
  const projectBudgetAlert = projectBudget?.budgetHealth?.alerts?.[0] ?? null;
  const contractFinancials = useMemo(() => {
    const contractStats = projectContracts.map((contract) => {
      const transactions = contract.transactions ?? [];
      const totalValue = Number(contract.totalValue || 0);
      const paid = transactions
        .filter((transaction) => transaction.status === "completed")
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
      const pending = transactions
        .filter((transaction) => transaction.status === "pending" && transaction.paymentMethod)
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
      const scheduled = transactions
        .filter((transaction) => transaction.status === "pending" && !transaction.paymentMethod)
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

      return {
        id: contract.id,
        contractCode: contract.contractCode,
        totalValue,
        paid,
        pending,
        scheduled,
        remaining: Math.max(totalValue - paid - pending, 0),
        lineItemCount: contract.versions?.[0]?.lineItems?.length ?? 0,
      };
    });

    return {
      contracts: contractStats,
      totalValue: contractStats.reduce((sum, contract) => sum + contract.totalValue, 0),
      paid: contractStats.reduce((sum, contract) => sum + contract.paid, 0),
      pending: contractStats.reduce((sum, contract) => sum + contract.pending, 0),
      scheduled: contractStats.reduce((sum, contract) => sum + contract.scheduled, 0),
      remaining: contractStats.reduce((sum, contract) => sum + contract.remaining, 0),
    };
  }, [projectContracts]);

  const vendorBudgetStats = useMemo(() => {
    return budgetItems.reduce<Record<string, { count: number; estimated: number; actual: number }>>((acc, item) => {
      if (!item.vendorId) return acc;
      const current = acc[item.vendorId] ?? { count: 0, estimated: 0, actual: 0 };
      acc[item.vendorId] = {
        count: current.count + 1,
        estimated: current.estimated + Number(item.estimatedAmount || 0),
        actual: current.actual + Number(item.actualAmount || 0),
      };
      return acc;
    }, {});
  }, [budgetItems]);

  const filteredProjects = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return acceptedProjects.filter((project) => {
      const matchesStatus = filterStatus === "all" || project.status === filterStatus;
      const matchesSearch =
        !keyword ||
        getProjectDisplayName(project).toLowerCase().includes(keyword) ||
        project.name.toLowerCase().includes(keyword) ||
        project.consultationRequest?.eventType?.toLowerCase().includes(keyword) ||
        project.consultationRequest?.note?.toLowerCase().includes(keyword) ||
        project.type.toLowerCase().includes(keyword) ||
        getProjectCustomerName(project).toLowerCase().includes(keyword);
      return matchesStatus && matchesSearch;
    });
  }, [acceptedProjects, filterStatus, search]);

  const allColumns = useMemo(() => kanban?.columns ?? [], [kanban]);
  const allTasks = useMemo(() => allColumns.flatMap((column) => column.tasks), [allColumns]);
  const taskTemplateContext = useMemo(
    () =>
      [
        activeProjectDisplayName,
        activeProject?.type,
        activeProject?.consultationRequest?.eventType,
        activeProject?.consultationRequest?.note,
        kanban?.project.name,
        kanban?.project.consultationRequest?.eventType,
        kanban?.project.consultationRequest?.note,
      ]
        .filter(Boolean)
        .join(" "),
    [
      activeProjectDisplayName,
      activeProject?.type,
      activeProject?.consultationRequest?.eventType,
      activeProject?.consultationRequest?.note,
      kanban?.project.name,
      kanban?.project.consultationRequest?.eventType,
      kanban?.project.consultationRequest?.note,
    ],
  );
  const taskTemplateGroup = useMemo(
    () => pickTaskTemplateGroup(taskTemplateContext),
    [taskTemplateContext],
  );
  const serviceTaskTemplates = taskTemplateGroup.tasks;
  const usedTaskTitles = useMemo(
    () => new Set(allTasks.map((task) => normalizeTaskTitle(task.title))),
    [allTasks],
  );
  const missingServiceTaskTemplates = useMemo(
    () => serviceTaskTemplates.filter((template) => !usedTaskTitles.has(normalizeTaskTitle(template.title))),
    [serviceTaskTemplates, usedTaskTitles],
  );
  const filteredServiceTaskTemplates = useMemo(() => {
    const keyword = normalizeTemplateText(taskTemplateSearch).trim();
    if (!keyword) return serviceTaskTemplates;

    return serviceTaskTemplates.filter((template) =>
      [
        template.phase,
        template.title,
        template.description,
        priorityLabel[template.priority],
      ].some((value) => normalizeTemplateText(value).includes(keyword)),
    );
  }, [serviceTaskTemplates, taskTemplateSearch]);
  const selectedTaskTemplates = useMemo(
    () => serviceTaskTemplates.filter((template) => selectedTaskTemplateIds.includes(template.id)),
    [selectedTaskTemplateIds, serviceTaskTemplates],
  );
  const canSaveTask = editingTask || customTaskMode
    ? !!form.title.trim()
    : selectedTaskTemplates.length > 0;
  const saveTaskLabel = editingTask
    ? "Cập nhật"
    : !customTaskMode && selectedTaskTemplates.length > 1
      ? `Thêm ${selectedTaskTemplates.length} công việc`
      : "Thêm";
  const overdueTasks = useMemo(
    () => allTasks.filter((task) => task.status !== "done" && isOverdue(task.dueAt)).length,
    [allTasks],
  );
  const ganttData = useMemo(() => {
    const sortedTasks = [...allTasks].sort((a, b) => {
      const left = getTime(a.dueAt) ?? getTime(a.createdAt) ?? Number.MAX_SAFE_INTEGER;
      const right = getTime(b.dueAt) ?? getTime(b.createdAt) ?? Number.MAX_SAFE_INTEGER;
      return left - right || (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.title.localeCompare(b.title);
    });
    const eventTime = getTime(kanban?.project.eventDate);
    const fallbackStartTime = eventTime
      ? startOfDay(eventTime - (MIN_GANTT_WEEKS - 1) * WEEK_MS)
      : startOfDay(Date.now());

    const rawItems = sortedTasks.map((task, index) => {
      const dueTime = getTime(task.dueAt);
      const createdTime = getTime(task.createdAt);
      const completedTime = getTime(task.completedAt);
      const estimatedDays = priorityDurationDays[task.priority] ?? priorityDurationDays.medium;
      const startTime = startOfDay(
        dueTime !== null
          ? dueTime - estimatedDays * DAY_MS
          : createdTime ?? fallbackStartTime + index * 3 * DAY_MS,
      );
      const endSource = dueTime ?? completedTime ?? startTime + estimatedDays * DAY_MS;
      const endTime = startOfDay(Math.max(endSource, startTime + DAY_MS));

      return {
        task,
        startTime,
        endTime,
      };
    });

    if (rawItems.length === 0) {
      return {
        items: [],
        weekLabels: Array.from({ length: MIN_GANTT_WEEKS }, (_, index) => `Tuần ${index + 1}`),
        gridTemplateColumns: `repeat(${MIN_GANTT_WEEKS}, minmax(86px, 1fr))`,
        minWidth: 1060,
      };
    }

    const chartStartTime = startOfDay(Math.min(...rawItems.map((item) => item.startTime)));
    const chartEndSource = Math.max(...rawItems.map((item) => item.endTime), eventTime ?? 0);
    const weekCount = Math.max(
      MIN_GANTT_WEEKS,
      Math.ceil((chartEndSource - chartStartTime + DAY_MS) / WEEK_MS),
    );
    const chartEndTime = chartStartTime + weekCount * WEEK_MS;
    const chartSpan = Math.max(chartEndTime - chartStartTime, WEEK_MS);
    const items = rawItems.map((item) => {
      const left = clamp(((item.startTime - chartStartTime) / chartSpan) * 100, 0, 100);
      const right = clamp(((item.endTime - chartStartTime) / chartSpan) * 100, 0, 100);
      const width = Math.min(100, Math.max(2.5, right - left));

      return {
        ...item,
        left: Math.min(left, 100 - width),
        width,
      };
    });

    return {
      items,
      weekLabels: Array.from({ length: weekCount }, (_, index) => `Tuần ${index + 1}`),
      gridTemplateColumns: `repeat(${weekCount}, minmax(86px, 1fr))`,
      minWidth: 200 + weekCount * 86,
    };
  }, [allTasks, kanban?.project.eventDate]);

  const stats = useMemo(() => {
    const active = acceptedProjects.filter((project) => !["completed", "cancelled"].includes(project.status)).length;
    const running = acceptedProjects.filter((project) => project.status === "in_progress").length;
    const completed = acceptedProjects.filter((project) => project.status === "completed").length;
    const avgProgress = acceptedProjects.length
      ? Math.round(acceptedProjects.reduce((sum, project) => sum + project.progressPercent, 0) / acceptedProjects.length)
      : 0;
    return [
      { label: "Dự án đang xử lý", value: String(active), icon: ListChecks, color: "text-primary" },
      { label: "Đang triển khai", value: String(running), icon: PlayCircle, color: "text-secondary" },
      { label: "Đã hoàn thành", value: String(completed), icon: CheckCircle, color: "text-secondary" },
      { label: "Tiến độ TB", value: `${avgProgress}%`, icon: Activity, color: "text-primary" },
    ];
  }, [acceptedProjects]);

  const loadProjectContext = async (projectId: string) => {
    if (!projectId) {
      setProjectDetail(null);
      setKanban(null);
      setProjectStaff([]);
      setProjectVendors([]);
      setProjectBudget(null);
      setProjectContracts([]);
      return;
    }

    setContextLoading(true);
    try {
      const [detailData, kanbanData, staffData, vendorData, budgetData, contractsData] = await Promise.all([
        apiClient.get<ProjectDetail>(`/organizer/projects/${projectId}`),
        apiClient.get<KanbanResponse>(`/organizer/projects/${projectId}/kanban`),
        apiClient.get<ProjectStaffResponse>(`/organizer/staff/events/${projectId}`),
        apiClient.get<ProjectVendor[]>(`/organizer/projects/${projectId}/vendors`),
        apiClient.get<ProjectBudget>(`/organizer/budgets/${projectId}`),
        apiClient.get<FullContract[]>(`/organizer/projects/${projectId}/contracts`),
      ]);
      setProjectDetail(detailData);
      setKanban(kanbanData);
      setProjectStaff(staffData.assignments);
      setProjectVendors(vendorData);
      setProjectBudget(budgetData);
      setProjectContracts(contractsData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không tải được dự án");
    } finally {
      setContextLoading(false);
    }
  };

  const loadProjects = async (preferredId?: string) => {
    const data = await apiClient.get<Project[]>("/organizer/projects");
    setProjects(data);
    const manageableProjects = data.filter(
      (project) => project.organizerAssignmentStatus === "accepted",
    );
    const nextId =
      manageableProjects.find((project) => project.id === (preferredId || selectedProjectId))?.id ??
      manageableProjects[0]?.id ??
      "";
    setSelectedProjectId(nextId);
    return nextId;
  };

  const loadRequestAssignments = async () => {
    try {
      const data = await apiClient.get<OrganizerRequestAssignment[]>("/organizer/requests/assignments");
      setRequestAssignments(Array.isArray(data) ? data : []);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      setRequestAssignments([]);
      toast.error(err instanceof Error ? err.message : "Không tải được yêu cầu tư vấn được phân công");
      return [];
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [projectData, requestAssignmentData, staffData, vendorData, vendorCategoryData] = await Promise.all([
          apiClient.get<Project[]>("/organizer/projects"),
          apiClient
            .get<OrganizerRequestAssignment[]>("/organizer/requests/assignments")
            .catch(() => []),
          apiClient.get<StaffOption[]>("/organizer/staff", { pageSize: 100 }),
          apiClient.get<VendorOption[]>("/organizer/vendors", { pageSize: 100 }),
          apiClient.get<VendorCategory[]>("/organizer/vendor-categories"),
        ]);
        if (cancelled) return;
        setProjects(projectData);
        setRequestAssignments(Array.isArray(requestAssignmentData) ? requestAssignmentData : []);
        setStaff(staffData);
        setVendors(vendorData);
        setVendorCategories(vendorCategoryData);
        const firstId =
          projectData.find((project) => project.organizerAssignmentStatus === "accepted")?.id ?? "";
        setSelectedProjectId(firstId);
        if (firstId) await loadProjectContext(firstId);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không tải được dự án");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedProjectId || loading) return;
    void loadProjectContext(selectedProjectId);
  }, [selectedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time: auto-refresh khi admin phân công hoặc cập nhật dự án
  const refreshRef = useRef<() => Promise<void>>();
  refreshRef.current = async () => {
    await loadRequestAssignments();
    const currentId = await loadProjects(selectedProjectId);
    if (currentId) await loadProjectContext(currentId);
  };

  useEffect(() => {
    const socket = getSocket();
    const ASSIGNMENT_TYPES = new Set([
      "request",
      "project",
      "request_assignment_accepted",
      "request_assignment_rejected",
      "project_assignment_accepted",
      "project_assignment_rejected",
    ]);
    const handleNotification = (payload: { type?: string }) => {
      if (payload.type && ASSIGNMENT_TYPES.has(payload.type)) {
        void refreshRef.current?.();
      }
    };
    socket.on("notification", handleNotification);
    return () => {
      socket.off("notification", handleNotification);
    };
  }, []);

  const refresh = async () => {
    await loadRequestAssignments();
    const currentId = await loadProjects(selectedProjectId);
    if (currentId) await loadProjectContext(currentId);
  };

  const buildTaskFormFromTemplate = (template: TaskTemplate, assigneeUserId = ""): TaskFormState => {
    const eventTime = getTime(activeProject?.eventDate ?? kanban?.project.eventDate);
    const dueAt = eventTime === null
      ? ""
      : toDateInputValue(new Date(startOfDay(eventTime) + template.dueDaysFromEvent * DAY_MS));

    return {
      title: template.title,
      description: template.description,
      assigneeUserId,
      dueAt,
      priority: template.priority,
    };
  };

  const toggleTaskTemplate = (template: TaskTemplate) => {
    if (usedTaskTitles.has(normalizeTaskTitle(template.title))) return;

    setCustomTaskMode(false);
    const selected = selectedTaskTemplateIds.includes(template.id);
    const nextIds = selected
      ? selectedTaskTemplateIds.filter((id) => id !== template.id)
      : [...selectedTaskTemplateIds, template.id];
    const primaryTemplate = selected
      ? serviceTaskTemplates.find((item) => item.id === nextIds[0])
      : template;

    setSelectedTaskTemplateIds(nextIds);
    setForm((current) =>
      primaryTemplate
        ? buildTaskFormFromTemplate(primaryTemplate, current.assigneeUserId)
        : { ...emptyForm, assigneeUserId: current.assigneeUserId },
    );
  };

  const selectTemplateMode = () => {
    setCustomTaskMode(false);
    const firstTemplate = missingServiceTaskTemplates[0];
    setSelectedTaskTemplateIds(firstTemplate ? [firstTemplate.id] : []);
    if (firstTemplate) {
      setForm((current) => buildTaskFormFromTemplate(firstTemplate, current.assigneeUserId));
    }
  };

  const selectAllMissingTemplates = () => {
    setCustomTaskMode(false);
    const selectableTemplates = missingServiceTaskTemplates;
    setSelectedTaskTemplateIds(selectableTemplates.map((template) => template.id));
    const firstTemplate = selectableTemplates[0];
    if (firstTemplate) {
      setForm((current) => buildTaskFormFromTemplate(firstTemplate, current.assigneeUserId));
    }
  };

  const clearSelectedTemplates = () => {
    setSelectedTaskTemplateIds([]);
    setForm((current) => ({ ...emptyForm, assigneeUserId: current.assigneeUserId }));
  };

  const selectCustomTask = () => {
    setCustomTaskMode(true);
    setSelectedTaskTemplateIds([]);
    setForm((current) => ({
      ...emptyForm,
      assigneeUserId: current.assigneeUserId,
    }));
  };

  const openAdd = (columnId: string) => {
    const firstTemplate = missingServiceTaskTemplates[0];

    setTargetStatus(columnId);
    setEditingTask(null);
    setTaskTemplateSearch("");
    setCustomTaskMode(!firstTemplate);
    setSelectedTaskTemplateIds(firstTemplate ? [firstTemplate.id] : []);
    setForm(firstTemplate ? buildTaskFormFromTemplate(firstTemplate) : emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (task: KanbanTask) => {
    setTargetStatus(task.status);
    setEditingTask(task);
    setCustomTaskMode(false);
    setTaskTemplateSearch("");
    setSelectedTaskTemplateIds([]);
    setForm({
      title: task.title,
      description: task.description || "",
      assigneeUserId: task.assignee?.id ?? "",
      dueAt: task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : "",
      priority: task.priority,
    });
    setDialogOpen(true);
  };

  const saveTask = async () => {
    if (!selectedProjectId) return;

    try {
      if (!editingTask && !customTaskMode) {
        if (selectedTaskTemplates.length === 0) {
          toast.error("Hãy chọn ít nhất một việc mẫu");
          return;
        }

        await Promise.all(
          selectedTaskTemplates.map((template, index) => {
            const taskForm = selectedTaskTemplates.length === 1
              ? form
              : buildTaskFormFromTemplate(template, form.assigneeUserId);

            return apiClient.post("/organizer/tasks", {
              title: taskForm.title.trim(),
              description: taskForm.description.trim() || undefined,
              assigneeUserId: taskForm.assigneeUserId || null,
              dueAt: toApiDateTime(taskForm.dueAt),
              priority: taskForm.priority,
              eventId: selectedProjectId,
              status: targetStatus,
              sortOrder: index,
            });
          }),
        );

        toast.success(`Đã thêm ${selectedTaskTemplates.length} công việc`);
        setDialogOpen(false);
        await refresh();
        return;
      }

      if (!form.title.trim()) return;
      if (!editingTask && usedTaskTitles.has(normalizeTaskTitle(form.title))) {
        toast.error("Công việc này đã có trong dự án");
        return;
      }

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        assigneeUserId: form.assigneeUserId || null,
        dueAt: toApiDateTime(form.dueAt),
        priority: form.priority,
      };

      if (editingTask) {
        await apiClient.put(`/organizer/tasks/${editingTask.id}`, payload);
        toast.success("Đã cập nhật công việc");
      } else {
        await apiClient.post("/organizer/tasks", {
          ...payload,
          eventId: selectedProjectId,
          status: targetStatus,
          sortOrder: 0,
        });
        toast.success("Đã thêm công việc mới");
      }

      setDialogOpen(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể lưu công việc");
    }
  };

  const moveTask = async (task: KanbanTask, toStatus: string) => {
    try {
      await apiClient.patch(`/organizer/tasks/${task.id}/status`, { status: toStatus });
      toast.success("Đã chuyển công việc");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể chuyển công việc");
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await apiClient.del(`/organizer/tasks/${taskId}`);
      toast.success("Đã xóa công việc");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể xóa công việc");
    }
  };

  const changeProjectStatus = async (status: string) => {
    if (!selectedProjectId) return;
    try {
      await apiClient.patch(`/organizer/projects/${selectedProjectId}/status`, { status });
      toast.success("Đã cập nhật trạng thái dự án");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể cập nhật trạng thái dự án");
    }
  };

  const openAssignVendorFromList = (vendorId: string) => {
    setVendorForm({ vendorId, serviceNote: "" });
    setVendorListOpen(false);
    setVendorDialogOpen(true);
  };

  const openVendorDetails = (vendor: VendorOption, fromList = false) => {
    setVendorDetailFromList(fromList);
    if (fromList) setVendorListOpen(false);
    setViewVendorItem(vendor);
  };

  const closeVendorDetails = () => {
    setViewVendorItem(null);
    if (vendorDetailFromList) setVendorListOpen(true);
    setVendorDetailFromList(false);
  };

  const openCreateVendor = () => {
    setEditingProjectVendor(null);
    setVendorEditorForm({
      ...emptyVendorEditorForm,
      categoryId: vendorCategories[0]?.id ?? "",
    });
    setVendorEditorOpen(true);
  };

  const openEditVendor = (assignment: ProjectVendor) => {
    setEditingProjectVendor(assignment);
    setVendorEditorForm({
      name: assignment.vendor.name,
      categoryId: assignment.vendor.categoryId ?? assignment.vendor.category?.id ?? "",
      phone: assignment.vendor.phone ?? "",
      email: assignment.vendor.email ?? "",
      bankAccountNumber: assignment.vendor.bankAccountNumber ?? "",
      contactName: assignment.vendor.contactName ?? "",
      address: assignment.vendor.address ?? "",
      status: assignment.vendor.status ?? "active",
      serviceNote: assignment.serviceNote ?? "",
    });
    setVendorEditorOpen(true);
  };

  const saveVendor = async () => {
    if (!selectedProjectId) return;

    const name = vendorEditorForm.name.trim();
    const address = vendorEditorForm.address.trim();
    if (!name || !vendorEditorForm.categoryId || !address) {
      toast.error("Vui lòng nhập tên, danh mục và địa chỉ nhà cung cấp");
      return;
    }

    const payload = {
      name,
      categoryId: vendorEditorForm.categoryId,
      phone: vendorEditorForm.phone.trim() || undefined,
      email: vendorEditorForm.email.trim() || undefined,
      bankAccountNumber: vendorEditorForm.bankAccountNumber.trim() || undefined,
      contactName: vendorEditorForm.contactName.trim() || undefined,
      address,
    };

    setVendorSaving(true);
    try {
      if (editingProjectVendor) {
        await apiClient.put(`/organizer/vendors/${editingProjectVendor.vendorId}`, payload);
        if (vendorEditorForm.status !== editingProjectVendor.vendor.status) {
          await apiClient.patch(`/organizer/vendors/${editingProjectVendor.vendorId}/status`, {
            status: vendorEditorForm.status,
          });
        }
        await apiClient.put(
          `/organizer/projects/${selectedProjectId}/vendors/${editingProjectVendor.id}`,
          { serviceNote: vendorEditorForm.serviceNote.trim() || null },
        );
        toast.success("Đã cập nhật nhà cung cấp");
      } else {
        const createdVendor = await apiClient.post<VendorOption>("/organizer/vendors", payload);
        await apiClient.post(`/organizer/projects/${selectedProjectId}/vendors`, {
          vendorId: createdVendor.id,
          serviceNote: vendorEditorForm.serviceNote.trim() || undefined,
        });
        toast.success("Đã tạo và gắn nhà cung cấp vào dự án");
      }

      setVendorEditorOpen(false);
      setEditingProjectVendor(null);
      setVendorEditorForm(emptyVendorEditorForm);
      const vendorData = await apiClient.get<VendorOption[]>("/organizer/vendors", { pageSize: 100 });
      setVendors(vendorData);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể lưu nhà cung cấp");
    } finally {
      setVendorSaving(false);
    }
  };

  const assignProjectVendor = async () => {
    if (!selectedProjectId || !vendorForm.vendorId) {
      toast.error("Vui lòng chọn nhà cung cấp");
      return;
    }

    try {
      await apiClient.post(`/organizer/projects/${selectedProjectId}/vendors`, {
        vendorId: vendorForm.vendorId,
        serviceNote: vendorForm.serviceNote.trim() || undefined,
      });
      toast.success("Đã gắn nhà cung cấp vào dự án");
      setVendorDialogOpen(false);
      setVendorForm(emptyVendorForm);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể gắn nhà cung cấp");
    }
  };

  const removeProjectVendor = async (assignment: ProjectVendor) => {
    if (!selectedProjectId) return;

    const assignedBudgetItems = budgetItems.filter((item) => item.vendorId === assignment.vendorId).length;
    if (
      assignedBudgetItems > 0 &&
      !window.confirm(
        `Gỡ ${assignment.vendor.name} khỏi dự án? ${assignedBudgetItems} hạng mục chi phí đang gắn với nhà cung cấp này sẽ được bỏ liên kết.`,
      )
    ) {
      return;
    }

    try {
      await apiClient.del(`/organizer/projects/${selectedProjectId}/vendors/${assignment.id}`);
      toast.success("Đã gỡ nhà cung cấp khỏi dự án");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể gỡ nhà cung cấp");
    }
  };

  const assignBudgetItemVendor = async (itemId: string, vendorId: string) => {
    if (!selectedProjectId) return;

    try {
      await apiClient.put(`/organizer/budget-items/${itemId}`, {
        vendorId: vendorId === NO_VENDOR ? null : vendorId,
      });
      toast.success("Đã cập nhật nhà cung cấp cho hạng mục");
      await loadProjectContext(selectedProjectId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể cập nhật hạng mục");
    }
  };

  const openAssignStaffFromList = (person: StaffOption) => {
    setEditingStaffAssignment(null);
    setStaffForm({
      staffUserId: person.id,
      roleText: person.staffProfile?.jobTitle ?? "",
      status: "invited",
    });
    setViewStaffItem(null);
    setStaffListOpen(false);
    setStaffDialogOpen(true);
  };

  const openEditProjectStaff = (assignment: ProjectStaffAssignment) => {
    setEditingStaffAssignment(assignment);
    setStaffForm({
      staffUserId: assignment.staffUser.id,
      roleText: assignment.roleText,
      status: assignment.status,
    });
    setStaffDialogOpen(true);
  };

  const saveProjectStaff = async () => {
    if (!selectedProjectId || !staffForm.staffUserId || !staffForm.roleText.trim()) {
      toast.error("Vui lòng chọn nhân sự và nhập vai trò trong dự án");
      return;
    }

    try {
      if (editingStaffAssignment) {
        await apiClient.patch(`/organizer/staff/assignments/${editingStaffAssignment.id}`, {
          roleText: staffForm.roleText.trim(),
          status: staffForm.status,
        });
        toast.success("Đã cập nhật phân công nhân sự");
      } else {
        await apiClient.post(`/organizer/staff/events/${selectedProjectId}`, {
          staffUserId: staffForm.staffUserId,
          roleText: staffForm.roleText.trim(),
        });
        toast.success("Đã thêm nhân sự vào dự án");
      }
      setStaffDialogOpen(false);
      setEditingStaffAssignment(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể lưu phân công nhân sự");
    }
  };

  const handleCreateStaff = async () => {
    const name = createStaffForm.name.trim();
    const email = createStaffForm.email.trim().toLowerCase();
    const phone = createStaffForm.phone.trim();
    const jobTitle = createStaffForm.jobTitle.trim();

    if (!name || !email || !jobTitle) {
      toast.error("Vui lòng nhập họ tên, email và vai trò");
      return;
    }
    if (!isValidPhone(phone)) {
      toast.error("Số điện thoại phải đúng định dạng Việt Nam, ví dụ 0901234567");
      return;
    }

    setCreateStaffSaving(true);
    try {
      await apiClient.post("/organizer/staff", {
        name,
        email,
        phone: phone || undefined,
        jobTitle,
        employmentStatus: createStaffForm.employmentStatus,
      });
      toast.success("Đã tạo nhân sự mới");
      setCreateStaffDialogOpen(false);
      setCreateStaffForm(emptyCreateStaffForm);
      const staffData = await apiClient.get<StaffOption[]>("/organizer/staff", { pageSize: 100 });
      setStaff(staffData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể tạo nhân sự");
    } finally {
      setCreateStaffSaving(false);
    }
  };

  const removeProjectStaff = async (assignment: ProjectStaffAssignment) => {
    if (!window.confirm(`Gỡ ${assignment.staffUser.displayName} khỏi dự án?`)) return;

    try {
      await apiClient.del(`/organizer/staff/assignments/${assignment.id}`);
      toast.success("Đã gỡ nhân sự khỏi dự án");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể gỡ nhân sự");
    }
  };

  const respondToAssignment = async (
    project: Project,
    action: "accept" | "reject",
    reason?: string,
  ) => {
    setRespondingAssignmentId(project.id);
    try {
      await apiClient.patch(`/organizer/projects/${project.id}/assignment-response`, {
        action,
        reason,
      });
      toast.success(action === "accept" ? "Đã chấp nhận dự án" : "Đã gửi lý do từ chối");
      if (action === "reject") {
        setRejectionProject(null);
        setRejectionReason("");
      }
      await loadProjects(action === "accept" ? project.id : undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể phản hồi phân công");
    } finally {
      setRespondingAssignmentId(null);
    }
  };

  const respondToRequestAssignment = async (
    request: OrganizerRequestAssignment,
    action: "accept" | "reject",
    reason?: string,
  ) => {
    setRespondingAssignmentId(request.id);
    try {
      const response = await apiClient.patch<OrganizerRequestAssignmentResponse>(
        `/organizer/requests/${request.id}/assignment-response`,
        {
          action,
          reason,
        },
      );
      toast.success(action === "accept" ? "Đã nhận yêu cầu tư vấn" : "Đã gửi lý do từ chối");
      if (action === "reject") {
        setRejectionRequest(null);
        setRejectionReason("");
      }
      await loadRequestAssignments();
      if (action === "accept") {
        const currentId = await loadProjects(response.event?.id);
        if (currentId) await loadProjectContext(currentId);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể phản hồi yêu cầu");
    } finally {
      setRespondingAssignmentId(null);
    }
  };

  if (loading) return <div className="font-body text-muted-foreground">Đang tải dự án...</div>;
  if (error) return <div className="font-body text-destructive">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-headline-lg text-foreground">Quản lý dự án</h1>
          <p className="font-body text-sm text-muted-foreground">
            {acceptedProjects.length} dự án đã nhận
          </p>
        </div>
        <div className="flex p-1 rounded-xl bg-surface-low self-start lg:self-auto">
          {[
            { value: "overview", label: "Tổng quan" },
            { value: "kanban", label: "Kanban" },
            { value: "timeline", label: "Timeline" },
            { value: "vendors", label: "Nhà cung cấp" },
            { value: "staff", label: "Nhân sự" },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setView(item.value as ProjectView)}
              className={`px-4 py-2 rounded-lg font-body text-sm transition-all ${
                view === item.value
                  ? "bg-background shadow-ambient text-foreground font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface-lowest shadow-ambient">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          aria-expanded={assignmentRequestsOpen}
          aria-controls="assignment-requests-content"
          onClick={() => setAssignmentRequestsOpen((open) => !open)}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Mail size={18} className="shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <h2 className="font-body text-sm font-semibold text-foreground">Yêu cầu phân công</h2>
              <p className="truncate font-body text-xs text-muted-foreground">
                {pendingAssignmentCount > 0
                  ? `Có yêu cầu mới cần phản hồi · ${assignmentHistoryCount} mục trong lịch sử`
                  : `${assignmentHistoryCount} mục trong lịch sử phân công · Bấm để xem`}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 font-body text-xs font-semibold ${
                pendingAssignmentCount > 0
                  ? "bg-amber-100 text-amber-800"
                  : "bg-surface-low text-muted-foreground"
              }`}
              aria-label={`${pendingAssignmentCount} yêu cầu đang chờ`}
            >
              {pendingAssignmentCount}
            </span>
            <ChevronDown
              size={18}
              className={`text-muted-foreground transition-transform ${
                assignmentRequestsOpen ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>

        {assignmentRequestsOpen && (
          <div id="assignment-requests-content" className="border-t border-border p-4">
            {pendingAssignmentCount > 0 ? (
              <div className="space-y-3">
            {pendingRequestAssignments.map((request) => (
              <div
                key={request.id}
                className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950 shadow-ambient"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-background px-2 py-0.5 font-body text-xs font-semibold text-primary">
                        Yêu cầu tư vấn
                      </span>
                      <span className="rounded-full bg-background px-2 py-0.5 font-body text-xs font-semibold text-muted-foreground">
                        {request.requestCode}
                      </span>
                      <p className="font-body font-semibold text-foreground">
                        {parseEventNameFromNote(request.note) || request.eventType}
                      </p>
                    </div>
                    <p className="mt-1 font-body text-sm text-muted-foreground">
                      {request.customerName} · {request.guestCount ?? 0} khách · {request.budgetRange || "Chưa có ngân sách"}
                    </p>
                    <p className="mt-1 font-body text-xs text-muted-foreground">
                      {request.eventDate ? new Date(request.eventDate).toLocaleDateString("vi-VN") : "Chưa có ngày"} · {request.locationText || "Chưa có địa điểm"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      disabled={respondingAssignmentId === request.id}
                      onClick={() => {
                        setRejectionRequest(request);
                        setRejectionProject(null);
                        setRejectionReason("");
                      }}
                    >
                      Từ chối
                    </Button>
                    <Button
                      disabled={respondingAssignmentId === request.id}
                      onClick={() => void respondToRequestAssignment(request, "accept")}
                    >
                      <CheckCircle size={16} className="mr-2" />
                      Nhận yêu cầu
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {pendingProjectAssignments.map((project) => (
              <div
                key={project.id}
                className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950 shadow-ambient"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-background px-2 py-0.5 font-body text-xs font-semibold text-primary">
                        Dự án
                      </span>
                      <p className="font-body font-semibold text-foreground">{getProjectDisplayName(project)}</p>
                    </div>
                    <p className="mt-1 font-body text-sm text-muted-foreground">{getProjectCustomerName(project)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={respondingAssignmentId === project.id}
                      onClick={() => {
                        setRejectionProject(project);
                        setRejectionRequest(null);
                        setRejectionReason("");
                      }}
                    >
                      Từ chối
                    </Button>
                    <Button
                      disabled={respondingAssignmentId === project.id}
                      onClick={() => void respondToAssignment(project, "accept")}
                    >
                      <CheckCircle size={16} className="mr-2" />
                      Chấp nhận
                    </Button>
                  </div>
                </div>
              </div>
            ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-surface-low p-5 text-center">
                <CheckCircle className="mx-auto text-emerald-600" size={24} />
                <p className="mt-2 font-body text-sm font-semibold text-foreground">
                  Không có yêu cầu mới
                </p>
                <p className="mt-1 font-body text-xs text-muted-foreground">
                  Lời mời mới sẽ xuất hiện tại đây sau khi admin phân công cho bạn.
                </p>
              </div>
            )}

            <div className="mt-5 border-t border-border pt-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-body text-sm font-semibold text-foreground">
                    Lịch sử phân công
                  </h3>
                  <p className="font-body text-xs text-muted-foreground">
                    Các yêu cầu đã từ chối hoặc dự án đã hủy được giữ lại để đối chiếu.
                  </p>
                </div>
                <span className="rounded-full bg-destructive/10 px-2.5 py-1 font-body text-xs font-semibold text-destructive">
                  {assignmentHistoryCount}
                </span>
              </div>

              {assignmentHistoryCount > 0 ? (
                <div className="space-y-2">
                  {rejectedRequestHistory.map((request) => (
                    <div
                      key={`request-${request.id}`}
                      className="rounded-xl border border-border bg-surface-low p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-background px-2 py-0.5 font-body text-[11px] font-semibold text-primary">
                          {request.requestCode}
                        </span>
                        <p className="font-body text-sm font-semibold text-foreground">
                          {parseEventNameFromNote(request.note) || request.eventType}
                        </p>
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-body text-[11px] font-semibold text-destructive">
                          Đã từ chối
                        </span>
                      </div>
                      <p className="mt-1 font-body text-xs text-muted-foreground">
                        {request.customerName}
                        {" · "}
                        {request.eventDate
                          ? new Date(request.eventDate).toLocaleDateString("vi-VN")
                          : "Chưa có ngày tổ chức"}
                        {(getRejectedRequestHistoryItem(request)?.respondedAt ??
                          request.organizerRequestRespondedAt)
                          ? ` · Phản hồi ${new Date(
                              (getRejectedRequestHistoryItem(request)?.respondedAt ??
                                request.organizerRequestRespondedAt)!,
                            ).toLocaleDateString("vi-VN")}`
                          : ""}
                      </p>
                      {(getRejectedRequestHistoryItem(request)?.rejectionReason ??
                        request.organizerRequestRejectionReason) && (
                        <p className="mt-2 font-body text-xs text-destructive">
                          Lý do:{" "}
                          {getRejectedRequestHistoryItem(request)?.rejectionReason ??
                            request.organizerRequestRejectionReason}
                        </p>
                      )}
                    </div>
                  ))}

                  {rejectedProjectHistory.map((project) => (
                    <div
                      key={`rejected-project-${project.id}`}
                      className="rounded-xl border border-border bg-surface-low p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-body text-sm font-semibold text-foreground">
                          {getProjectDisplayName(project)}
                        </p>
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-body text-[11px] font-semibold text-destructive">
                          Đã từ chối
                        </span>
                      </div>
                      <p className="mt-1 font-body text-xs text-muted-foreground">
                        {getProjectCustomerName(project)}
                        {project.consultationRequest?.requestCode
                          ? ` · ${project.consultationRequest.requestCode}`
                          : ""}
                      </p>
                      {project.organizerRejectionReason && (
                        <p className="mt-2 font-body text-xs text-destructive">
                          Lý do: {project.organizerRejectionReason}
                        </p>
                      )}
                    </div>
                  ))}

                  {cancelledProjectHistory.map((project) => (
                    <div
                      key={`cancelled-project-${project.id}`}
                      className="flex flex-col gap-3 rounded-xl border border-border bg-surface-low p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-body text-sm font-semibold text-foreground">
                            {getProjectDisplayName(project)}
                          </p>
                          <span className={`rounded-full px-2 py-0.5 font-body text-[11px] font-semibold ${eventStatusColors.cancelled}`}>
                            {getEventStatusLabel(project.status)}
                          </span>
                        </div>
                        <p className="mt-1 font-body text-xs text-muted-foreground">
                          {getProjectCustomerName(project)}
                          {project.consultationRequest?.requestCode
                            ? ` · ${project.consultationRequest.requestCode}`
                            : ""}
                          {" · "}
                          {project.eventDate
                            ? new Date(project.eventDate).toLocaleDateString("vi-VN")
                            : "Chưa có ngày tổ chức"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => {
                          setSelectedProjectId(project.id);
                          setView("overview");
                          void loadProjectContext(project.id);
                        }}
                      >
                        <Eye size={15} className="mr-2" />
                        Xem lại
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-surface-low p-4 text-center">
                  <p className="font-body text-sm font-medium text-foreground">
                    Chưa có lịch sử phân công
                  </p>
                  <p className="mt-1 font-body text-xs text-muted-foreground">
                    Yêu cầu đã từ chối hoặc dự án bị hủy sẽ được giữ lại tại đây.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-surface-lowest rounded-xl p-5 shadow-ambient">
            <stat.icon size={20} className={stat.color} />
            <p className="font-serif text-headline-lg text-foreground mt-3">{stat.value}</p>
            <p className="font-body text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[340px,1fr] gap-5">
        <div className="space-y-4">
          <div className="bg-surface-lowest rounded-xl p-4 shadow-ambient space-y-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm dự án, khách hàng..."
                className="pl-9 rounded-xl bg-surface-low font-body border-none"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {statuses.map((status) => (
                <button
                  key={status.value}
                  onClick={() => setFilterStatus(status.value)}
                  className={`px-3 py-1.5 rounded-lg font-body text-xs transition-all ${
                    filterStatus === status.value
                      ? "gradient-primary text-primary-foreground"
                      : "bg-surface-low text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredProjects.map((project) => {
              const projectName = getProjectDisplayName(project);

              return (
                <button
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  className={`w-full text-left bg-surface-lowest rounded-xl p-4 shadow-ambient transition-all ${
                    selectedProjectId === project.id ? "ring-2 ring-primary" : "hover:bg-surface-low"
                  }`}
                >
                  <div className="space-y-2">
                    <p
                      className="font-body text-sm font-semibold text-foreground leading-snug line-clamp-2 break-words"
                      title={projectName}
                    >
                      {projectName}
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 font-body text-xs text-muted-foreground truncate">
                        {getProjectCustomerName(project)} - {formatDate(project.eventDate)}
                      </p>
                      <span className={`shrink-0 whitespace-nowrap px-2 py-1 rounded-full text-[11px] font-body font-semibold ${statusColors[project.status] ?? "bg-muted text-muted-foreground"}`}>
                        {statusLabel[project.status] ?? project.status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs font-body text-muted-foreground">
                    <span>{project._count.tasks} công việc · {project._count.vendors ?? 0} NCC</span>
                    <span>{project.progressPercent}%</span>
                  </div>
                  <Progress value={project.progressPercent} className="h-2 mt-2 bg-surface-high" />
                </button>
              );
            })}

            {filteredProjects.length === 0 && (
              <div className="bg-surface-lowest rounded-xl p-6 shadow-ambient text-sm font-body text-muted-foreground">
                Không có dự án phù hợp.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5 min-w-0">
          {kanban?.project && (
            <div className="bg-surface-lowest rounded-xl p-5 shadow-ambient">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-serif text-headline-md text-foreground break-words">{activeProjectDisplayName}</h2>
                  <div className="flex flex-wrap gap-3 mt-2 font-body text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Calendar size={14} /> {formatDate(kanban.project.eventDate)}</span>
                    <span className="inline-flex items-center gap-1"><Users size={14} /> {kanban.project.guestCount ?? 0} khách</span>
                    <span className="inline-flex items-center gap-1"><UserRound size={14} /> {activeProjectCustomerName}</span>
                    <span className="inline-flex items-center gap-1"><Briefcase size={14} /> {projectVendors.length} NCC</span>
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <Progress value={kanban.project.progressPercent} className="h-2 max-w-sm bg-surface-high" />
                    <span className="font-body text-sm font-semibold text-foreground">{kanban.project.progressPercent}%</span>
                  </div>
                </div>
                <div className="flex flex-col items-start lg:items-end gap-2">
                  <select
                    value={kanban.project.status}
                    onChange={(event) => changeProjectStatus(event.target.value)}
                    className={`rounded-xl px-3 py-2 font-body text-sm font-semibold ${statusColors[kanban.project.status] ?? "bg-muted text-muted-foreground"}`}
                    aria-label="Trạng thái dự án"
                  >
                    {statuses.filter((status) => status.value !== "all").map((status) => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {contextLoading && (
            <div className="font-body text-sm text-muted-foreground">Đang cập nhật dữ liệu...</div>
          )}

          {view === "overview" && projectDetail && (
            <div className="grid grid-cols-1 2xl:grid-cols-[1fr,360px] gap-5">
              <div className="2xl:col-span-2 bg-surface-lowest rounded-xl p-5 shadow-ambient">
                <h3 className="font-serif text-headline-md text-foreground mb-4">Thông tin dự án</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-body text-sm">
                  <Info label="Khách hàng" value={projectDetail.customerUser.displayName} />
                  <Info label="Liên hệ" value={projectDetail.customerUser.phone || projectDetail.customerUser.email || "-"} />
                  <Info label="Loại sự kiện" value={projectDetail.type} />
                  <Info label="Địa điểm" value={projectDetail.locationText || "-"} />
                  <Info label="Mã yêu cầu" value={projectDetail.consultationRequest?.requestCode || "-"} />
                  <Info label="Ngân sách dự kiến" value={projectDetail.consultationRequest?.budgetRange || "-"} />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                  <Metric label="Công việc" value={projectDetail._count.tasks} />
                  <Metric label="Mốc" value={projectDetail.milestones.length} />
                  <Metric label="Nhân sự" value={projectDetail._count.staffAssignments ?? 0} />
                  <Metric label="NCC" value={projectDetail._count.vendors ?? 0} />
                </div>
              </div>

              <div className="2xl:col-span-2 bg-surface-lowest rounded-xl p-5 shadow-ambient">
                <h3 className="font-serif text-headline-md text-foreground mb-4">Mốc triển khai</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  {projectDetail.milestones.map((milestone) => (
                    <div key={milestone.id} className="rounded-lg border border-border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <Milestone size={16} className="text-primary" />
                        <span className={`text-[11px] font-body font-semibold px-2 py-0.5 rounded-full ${statusColors[milestone.status] ?? "bg-muted text-muted-foreground"}`}>
                          {taskStatusLabel[milestone.status] ?? milestone.status}
                        </span>
                      </div>
                      <p className="font-body text-sm font-semibold text-foreground mt-3">
                        {getMilestoneTitleLabel(milestone.title)}
                      </p>
                      <p className="font-body text-xs text-muted-foreground mt-1">{formatDate(milestone.milestoneDate)}</p>
                    </div>
                  ))}
                  {projectDetail.milestones.length === 0 && (
                    <p className="font-body text-sm text-muted-foreground">Chưa có mốc triển khai.</p>
                  )}
                </div>
              </div>

              <div className="2xl:col-span-2 bg-surface-lowest rounded-xl p-5 shadow-ambient">
                <h3 className="font-serif text-headline-md text-foreground mb-4">Hợp đồng</h3>
                {projectContracts.length > 0 && (
                  <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-4">
                    <div className="rounded-lg bg-surface-low p-3">
                      <p className="font-body text-[11px] text-muted-foreground">Giá trị HĐ</p>
                      <p className="font-body text-sm font-semibold text-foreground mt-1">{formatCurrency(contractFinancials.totalValue)}</p>
                    </div>
                    <div className="rounded-lg bg-surface-low p-3">
                      <p className="font-body text-[11px] text-muted-foreground">Đã thu</p>
                      <p className="font-body text-sm font-semibold text-secondary mt-1">{formatCurrency(contractFinancials.paid)}</p>
                    </div>
                    <div className="rounded-lg bg-surface-low p-3">
                      <p className="font-body text-[11px] text-muted-foreground">Chờ xác nhận</p>
                      <p className="font-body text-sm font-semibold text-primary mt-1">{formatCurrency(contractFinancials.pending)}</p>
                    </div>
                    <div className="rounded-lg bg-surface-low p-3">
                      <p className="font-body text-[11px] text-muted-foreground">Theo lịch</p>
                      <p className="font-body text-sm font-semibold text-foreground mt-1">{formatCurrency(contractFinancials.scheduled)}</p>
                    </div>
                    <div className="rounded-lg bg-surface-low p-3">
                      <p className="font-body text-[11px] text-muted-foreground">Còn thu</p>
                      <p className="font-body text-sm font-semibold text-primary mt-1">{formatCurrency(contractFinancials.remaining)}</p>
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  {projectContracts.map((contract) => {
                    const contractStats = contractFinancials.contracts.find((item) => item.id === contract.id);
                    return (
                    <div key={contract.contractCode} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border p-4">
                      <div>
                        <p className="font-body text-sm font-semibold text-foreground">
                          {contract.contractCode}
                          <span className="text-muted-foreground font-normal"> · Phiên bản {contract.currentVersion}</span>
                        </p>
                        <p className="font-body text-xs text-muted-foreground mt-1">
                          Giá trị: {Number(contract.totalValue || 0).toLocaleString("vi-VN")} ₫
                          {contract.sentAt ? ` · Đã gửi ${new Date(contract.sentAt).toLocaleDateString("vi-VN")}` : ""}
                        </p>
                        {contractStats && (
                          <p className="font-body text-xs text-muted-foreground mt-1">
                            Đã thu {formatCurrency(contractStats.paid)} · Theo lịch {formatCurrency(contractStats.scheduled)} · Còn thu {formatCurrency(contractStats.remaining)}
                            {contractStats.lineItemCount > 0 ? ` · ${contractStats.lineItemCount} hạng mục` : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/ban-to-chuc/hop-dong/${contract.id}`)}>
                          <Eye size={14} className="mr-1" /> Xem
                        </Button>
                        <ContractPdfButton contract={contract} detailPath={`/organizer/contracts/${contract.id}`} variant="outline" label="Tải PDF" />
                      </div>
                    </div>
                  )})}
                  {projectContracts.length === 0 && (
                    <p className="font-body text-sm text-muted-foreground">Chưa có hợp đồng cho dự án này.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {view === "kanban" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl bg-surface-lowest p-4 shadow-ambient sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ListChecks size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-serif text-headline-sm text-foreground">
                      Checklist vận hành {taskTemplateGroup.label}
                    </h3>
                    <p className="mt-1 font-body text-sm text-muted-foreground">
                      Chọn việc mẫu hoặc tạo việc mới cho dự án · {serviceTaskTemplates.length - missingServiceTaskTemplates.length}/{serviceTaskTemplates.length} việc mẫu đã có
                    </p>
                  </div>
                </div>
                <Button
                  variant="hero"
                  size="sm"
                  onClick={() => openAdd("todo")}
                  className="shrink-0 rounded-xl"
                >
                  <Plus size={14} /> Thêm công việc
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4">
                {allColumns.map((column) => (
                  <div key={column.id} className="bg-surface-low rounded-xl p-4 min-w-0">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-serif font-semibold text-foreground text-sm">{column.title}</h3>
                        <span className="font-body text-xs text-muted-foreground bg-surface-high rounded-full px-2 py-0.5">
                          {column.tasks.length}
                        </span>
                      </div>
                      <button
                        onClick={() => openAdd(column.id)}
                        className="text-muted-foreground hover:text-foreground"
                        title="Thêm công việc"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    <div className="space-y-3 min-h-[120px]">
                      <AnimatePresence>
                        {column.tasks.map((task) => (
                          <motion.div
                            key={task.id}
                            layout
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            className="bg-surface-lowest rounded-xl p-4 shadow-ambient group"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-body text-sm font-semibold text-foreground break-words">{task.title}</p>
                                <div className="flex flex-wrap gap-2 mt-2 text-xs font-body">
                                  <span className={`px-2 py-0.5 rounded-full font-semibold ${priorityColors[task.priority]}`}>
                                    {priorityLabel[task.priority]}
                                  </span>
                                  <span className={isOverdue(task.dueAt) && task.status !== "done" ? "text-destructive" : "text-muted-foreground"}>
                                    <Calendar size={11} className="inline mr-1" /> {task.dueAt ? formatDate(task.dueAt) : "Chưa có hạn"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 mt-2">
                                  <div className="w-5 h-5 rounded-full bg-secondary/20 flex items-center justify-center">
                                    <Users size={10} className="text-secondary" />
                                  </div>
                                  <span className="font-body text-xs text-muted-foreground">
                                    {task.assignee?.displayName || "Chưa phân công"}
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEdit(task)} className="text-muted-foreground hover:text-foreground" title="Sửa">
                                  <Edit2 size={13} />
                                </button>
                                <button onClick={() => deleteTask(task.id)} className="text-muted-foreground hover:text-destructive" title="Xóa">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            <div className="flex gap-1 mt-3 pt-2 border-t border-border flex-wrap">
                              {(allowedTaskMoves[task.status] ?? []).map((nextStatus) => {
                                const target = allColumns.find((item) => item.id === nextStatus);
                                if (!target) return null;
                                return (
                                  <button
                                    key={nextStatus}
                                    onClick={() => moveTask(task, nextStatus)}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-body text-muted-foreground hover:bg-surface-low"
                                  >
                                    <ChevronRight size={10} /> {target.title}
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === "vendors" && (
            <div className="space-y-5">
              <div className="bg-surface-lowest rounded-xl p-5 shadow-ambient">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                  <div>
                    <h3 className="font-serif text-headline-md text-foreground">Nhà cung cấp dự án</h3>
                    <p className="font-body text-sm text-muted-foreground">
                      {projectVendors.length} nhà cung cấp đang được gắn vào dự án này
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => {
                        setVendorSearch("");
                        setVendorListOpen(true);
                      }}
                    >
                      <Eye size={14} /> Xem tất cả NCC
                    </Button>
                    <Button variant="hero" size="sm" onClick={openCreateVendor}>
                      <Plus size={14} /> Thêm NCC mới
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {projectVendors.map((assignment) => {
                    const statsForVendor = vendorBudgetStats[assignment.vendorId] ?? { count: 0, estimated: 0, actual: 0 };

                    return (
                      <div key={assignment.id} className="rounded-xl border border-border p-4 bg-background">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-body text-sm font-semibold text-foreground truncate">
                              {assignment.vendor.name}
                            </p>
                            <p className="font-body text-xs text-muted-foreground truncate">
                              {assignment.vendor.category?.name || assignment.vendor.contactName || assignment.vendor.email || "-"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openVendorDetails(assignment.vendor)}
                              className="text-muted-foreground hover:text-primary"
                              title="Xem thông tin nhà cung cấp"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => openEditVendor(assignment)}
                              className="text-muted-foreground hover:text-primary"
                              title="Chỉnh sửa nhà cung cấp"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => removeProjectVendor(assignment)}
                              className="text-muted-foreground hover:text-destructive"
                              title="Gỡ nhà cung cấp"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 space-y-1 font-body text-xs text-muted-foreground">
                          <p>Phạm vi: <span className="text-foreground font-semibold">{assignment.serviceNote || "Chưa ghi chú"}</span></p>
                          <p>Liên hệ: {assignment.vendor.phone || assignment.vendor.email || "-"}</p>
                          <p className="flex items-start gap-1">
                            <MapPin size={12} className="mt-0.5 shrink-0" />
                            <span>{assignment.vendor.address || "Chưa có địa chỉ"}</span>
                          </p>
                          <p>Hạng mục: {statsForVendor.count} · Dự toán {formatCurrency(statsForVendor.estimated)}</p>
                          <p>Thực tế: {formatCurrency(statsForVendor.actual)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {projectVendors.length === 0 && (
                  <div className="rounded-xl bg-surface-low p-6 font-body text-sm text-muted-foreground">
                    Chưa có nhà cung cấp nào trong dự án này.
                  </div>
                )}
              </div>

              <div className="bg-surface-lowest rounded-xl p-5 shadow-ambient overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                  <div>
                    <h3 className="font-serif text-headline-md text-foreground">Phân bổ hạng mục chi phí</h3>
                    <p className="font-body text-sm text-muted-foreground">
                      {budgetItems.length} hạng mục · Dự toán {formatCurrency(projectBudget?.estimatedTotal ?? 0)}
                    </p>
                  </div>
                  {projectBudgetAlert && (
                    <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-destructive/10 px-3 py-1.5 font-body text-xs font-semibold text-destructive">
                      <AlertCircle size={14} className="shrink-0" />
                      <span className="truncate">{projectBudgetAlert}</span>
                    </span>
                  )}
                </div>

                {budgetItems.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm font-body">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 text-muted-foreground font-semibold">Hạng mục</th>
                          <th className="text-right py-3 text-muted-foreground font-semibold">Dự toán</th>
                          <th className="text-right py-3 text-muted-foreground font-semibold">Thực tế</th>
                          <th className="text-left py-3 text-muted-foreground font-semibold pl-4">Trạng thái</th>
                          <th className="text-left py-3 text-muted-foreground font-semibold pl-4">Nhà cung cấp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {budgetItems.map((item) => {
                          const currentVendorOutsideChoices =
                            item.vendorId && !projectVendorChoices.some((vendor) => vendor.id === item.vendorId);

                          return (
                            <tr key={item.id} className="border-b border-border last:border-0 hover:bg-surface-low/50">
                              <td className="py-3">
                                <p className="font-semibold text-foreground">{item.category}</p>
                                {item.note && <p className="text-xs text-muted-foreground mt-0.5">{item.note}</p>}
                              </td>
                              <td className="py-3 text-right text-foreground">{formatCurrency(item.estimatedAmount)}</td>
                              <td className="py-3 text-right text-foreground">{formatCurrency(item.actualAmount)}</td>
                              <td className="py-3 pl-4">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-body font-semibold ${budgetStatusBadge[item.status] ?? "bg-muted text-muted-foreground"}`}>
                                  {budgetStatusLabel[item.status] ?? item.status}
                                </span>
                              </td>
                              <td className="py-3 pl-4">
                                <select
                                  value={item.vendorId ?? NO_VENDOR}
                                  onChange={(event) => assignBudgetItemVendor(item.id, event.target.value)}
                                  disabled={projectVendorChoices.length === 0 && !item.vendorId}
                                  className="w-full min-w-[220px] rounded-xl bg-surface-low p-2.5 font-body text-sm text-foreground border-none disabled:opacity-60"
                                  aria-label={`Nhà cung cấp cho ${item.category}`}
                                >
                                  <option value={NO_VENDOR}>Chưa gắn NCC</option>
                                  {currentVendorOutsideChoices && (
                                    <option value={item.vendorId ?? ""}>
                                      {item.vendor?.name ?? "NCC hiện tại"}
                                    </option>
                                  )}
                                  {projectVendorChoices.map((vendor) => (
                                    <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="font-body text-sm text-muted-foreground">Chưa có hạng mục chi phí cho dự án này.</p>
                )}
              </div>
            </div>
          )}

          {view === "staff" && (
            <div className="bg-surface-lowest rounded-xl p-5 shadow-ambient">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h3 className="font-serif text-headline-md text-foreground">Nhân sự dự án</h3>
                  <p className="font-body text-sm text-muted-foreground">
                    {projectStaff.length} nhân sự đang được gắn vào dự án này
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => {
                      setStaffSearch("");
                      setViewStaffItem(null);
                      setStaffListOpen(true);
                    }}
                  >
                    <Eye size={14} /> Xem tất cả nhân sự
                  </Button>
                  <Button
                    variant="hero"
                    size="sm"
                    onClick={() => setCreateStaffDialogOpen(true)}
                  >
                    <Plus size={14} /> Thêm nhân sự mới
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {projectStaff.map((assignment) => (
                  <div key={assignment.id} className="rounded-xl border border-border p-4 bg-background">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-body text-sm font-semibold text-foreground truncate">
                          {assignment.staffUser.displayName}
                        </p>
                        <p className="font-body text-xs text-muted-foreground truncate">
                          {assignment.staffUser.staffProfile?.jobTitle || assignment.staffUser.email || "-"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditProjectStaff(assignment)}
                          className="text-muted-foreground hover:text-primary"
                          title="Sửa phân công"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => removeProjectStaff(assignment)}
                          className="text-muted-foreground hover:text-destructive"
                          title="Gỡ nhân sự"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1 font-body text-xs text-muted-foreground">
                      <p>Vai trò: <span className="text-foreground font-semibold">{assignment.roleText}</span></p>
                      <p>Trạng thái: {staffAssignmentStatusLabel[assignment.status] ?? assignment.status}</p>
                      <p>Liên hệ: {assignment.staffUser.phone || assignment.staffUser.email || "-"}</p>
                    </div>
                  </div>
                ))}
              </div>

              {projectStaff.length === 0 && (
                <div className="rounded-xl bg-surface-low p-6 font-body text-sm text-muted-foreground">
                  Chưa có nhân sự nào trong dự án này. Organizer có thể thêm nhân sự phù hợp cho từng vai trò triển khai.
                </div>
              )}
            </div>
          )}

          {view === "timeline" && (
            <div className="bg-surface-lowest rounded-xl p-5 shadow-ambient overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <h3 className="font-serif text-headline-md text-foreground">Gantt Chart - Timeline dự án</h3>
                {overdueTasks > 0 && (
                  <span className="font-body text-xs font-semibold text-destructive bg-destructive/10 rounded-full px-3 py-1">
                    {overdueTasks} công việc trễ hạn
                  </span>
                )}
              </div>

              {ganttData.items.length > 0 ? (
                <div className="overflow-x-auto pb-1">
                  <div className="font-body" style={{ minWidth: `${ganttData.minWidth}px` }}>
                    <div className="grid grid-cols-[200px,1fr] border-b border-border pb-3">
                      <div className="text-xs font-semibold text-muted-foreground">Task</div>
                      <div
                        className="grid text-center text-xs text-muted-foreground"
                        style={{ gridTemplateColumns: ganttData.gridTemplateColumns }}
                      >
                        {ganttData.weekLabels.map((label) => (
                          <div key={label}>{label}</div>
                        ))}
                      </div>
                    </div>

                    <div className="divide-y divide-border/70">
                      {ganttData.items.map((item) => {
                        const task = item.task;
                        const isLate = task.status !== "done" && isOverdue(task.dueAt);
                        const barColor = isLate
                          ? "bg-destructive/80"
                          : ganttStatusColors[task.status] ?? "bg-muted-foreground/60";

                        return (
                          <div key={task.id} className="grid grid-cols-[200px,1fr] items-center py-3">
                            <div className="min-w-0 pr-4">
                              <p className="truncate text-sm font-semibold text-foreground" title={task.title}>
                                {task.title}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground" title={activeProjectDisplayName}>
                                {activeProjectDisplayName}
                              </p>
                            </div>

                            <div className="relative h-8">
                              <div
                                className="absolute inset-0 grid"
                                style={{ gridTemplateColumns: ganttData.gridTemplateColumns }}
                              >
                                {ganttData.weekLabels.map((label) => (
                                  <span key={label} className="border-l border-border/60 first:border-l-0" />
                                ))}
                              </div>
                              <button
                                type="button"
                                onClick={() => openEdit(task)}
                                className={`absolute top-1/2 h-4 -translate-y-1/2 rounded-full ${barColor} shadow-sm transition-all hover:h-5 hover:shadow-ambient`}
                                style={{ left: `${item.left}%`, width: `${item.width}%` }}
                                title={`${task.title} - ${task.assignee?.displayName || "Chưa phân công"} - ${task.dueAt ? formatDate(task.dueAt) : "Chưa có hạn"}`}
                                aria-label={`Sửa công việc ${task.title}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="font-body text-sm text-muted-foreground">Chưa có công việc trong dự án này.</p>
              )}

              <div className="mt-4 flex flex-wrap gap-3 font-body text-xs text-muted-foreground">
                {Object.entries(taskStatusLabel).map(([status, label]) => (
                  <span key={status} className="inline-flex items-center gap-2">
                    <span className={`h-2.5 w-6 rounded-full ${ganttStatusColors[status] ?? "bg-muted-foreground/60"}`} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={Boolean(rejectionProject || rejectionRequest)}
        onOpenChange={(open) => {
          if (!open && !respondingAssignmentId) {
            setRejectionProject(null);
            setRejectionRequest(null);
            setRejectionReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {rejectionRequest ? "Từ chối yêu cầu tư vấn" : "Từ chối dự án"}
            </DialogTitle>
            <DialogDescription>
              Lý do sẽ được gửi cho admin để họ xử lý và phân công lại.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="font-body text-sm font-semibold text-foreground">
              {rejectionRequest
                ? `${rejectionRequest.requestCode} · ${parseEventNameFromNote(rejectionRequest.note) || rejectionRequest.eventType}`
                : rejectionProject
                  ? getProjectDisplayName(rejectionProject)
                  : ""}
            </p>
            <textarea
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              maxLength={1000}
              rows={5}
              autoFocus
              placeholder="Ví dụ: Trùng lịch với dự án khác trong ngày diễn ra sự kiện..."
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 font-body text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-right font-body text-xs text-muted-foreground">
              {rejectionReason.length}/1000
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={Boolean(respondingAssignmentId)}
              onClick={() => {
                setRejectionProject(null);
                setRejectionRequest(null);
                setRejectionReason("");
              }}
            >
              Quay lại
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectionReason.trim() || Boolean(respondingAssignmentId)}
              onClick={() => {
                if (rejectionRequest) {
                  void respondToRequestAssignment(rejectionRequest, "reject", rejectionReason.trim());
                  return;
                }
                if (rejectionProject) {
                  void respondToAssignment(rejectionProject, "reject", rejectionReason.trim());
                }
              }}
            >
              Xác nhận từ chối
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={vendorDialogOpen} onOpenChange={setVendorDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Gắn nhà cung cấp vào dự án</DialogTitle>
            <DialogDescription className="sr-only">
              Biểu mẫu chọn nhà cung cấp cho dự án đang chọn.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="font-body text-sm text-foreground mb-1 block">Nhà cung cấp</label>
              <select
                value={vendorForm.vendorId}
                onChange={(event) => setVendorForm((current) => ({ ...current, vendorId: event.target.value }))}
                className="w-full rounded-xl bg-surface-low p-2.5 font-body text-sm text-foreground border-none"
              >
                <option value="">Chọn nhà cung cấp</option>
                {availableVendorsForProject.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name} - {vendor.category?.name || "NCC"} - {vendor.address || "Chưa có địa chỉ"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-body text-sm text-foreground mb-1 block">Phạm vi phụ trách</label>
              <Input
                value={vendorForm.serviceNote}
                onChange={(event) => setVendorForm((current) => ({ ...current, serviceNote: event.target.value }))}
                placeholder="VD: Âm thanh, sân khấu, hoa trang trí..."
                className="rounded-xl border-none bg-surface-low"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVendorDialogOpen(false)}>Hủy</Button>
            <Button variant="hero" onClick={assignProjectVendor} disabled={!vendorForm.vendorId}>Gắn NCC</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={vendorListOpen} onOpenChange={setVendorListOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">Tất cả nhà cung cấp</DialogTitle>
            <DialogDescription>
              Xem và chọn nhà cung cấp để gắn vào dự án đang mở.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={vendorSearch}
              onChange={(event) => setVendorSearch(event.target.value)}
              placeholder="Tìm theo tên, danh mục, liên hệ hoặc địa chỉ..."
              className="pl-9 rounded-xl border-none bg-surface-low"
            />
          </div>

          <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {filteredVendorCatalog.map((vendor) => {
              const assigned = projectVendors.some((assignment) => assignment.vendorId === vendor.id);
              const inactive = vendor.status === "inactive";

              return (
                <div
                  key={vendor.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-body text-sm font-semibold text-foreground">{vendor.name}</p>
                      <span className={`rounded-full px-2 py-0.5 font-body text-[11px] font-semibold ${
                        vendor.status === "active"
                          ? "bg-secondary/10 text-secondary"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {vendorStatusLabel[vendor.status ?? "active"] ?? vendor.status}
                      </span>
                    </div>
                    <p className="mt-1 font-body text-xs text-muted-foreground">
                      {vendor.category?.name ?? "Chưa phân loại"} · {vendor.contactName || vendor.phone || vendor.email || "Chưa có liên hệ"}
                    </p>
                    <p className="mt-1 flex items-start gap-1 font-body text-xs text-muted-foreground">
                      <MapPin size={12} className="mt-0.5 shrink-0" />
                      <span>{vendor.address || "Chưa có địa chỉ"}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => openVendorDetails(vendor, true)}
                    >
                      <Eye size={14} /> Chi tiết
                    </Button>
                    <Button
                      variant={assigned ? "outline" : "hero"}
                      size="sm"
                      className="rounded-xl"
                      disabled={assigned || inactive}
                      onClick={() => openAssignVendorFromList(vendor.id)}
                    >
                      {assigned ? "Đã gắn" : inactive ? "Không khả dụng" : "Chọn NCC"}
                    </Button>
                  </div>
                </div>
              );
            })}

            {filteredVendorCatalog.length === 0 && (
              <div className="rounded-xl bg-surface-low p-6 text-center font-body text-sm text-muted-foreground">
                Không tìm thấy nhà cung cấp phù hợp.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setVendorListOpen(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!viewVendorItem}
        onOpenChange={(open) => {
          if (!open) closeVendorDetails();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Thông tin nhà cung cấp</DialogTitle>
            <DialogDescription>
              Thông tin liên hệ và trạng thái hợp tác của nhà cung cấp.
            </DialogDescription>
          </DialogHeader>

          {viewVendorItem && (
            <div className="space-y-4 font-body text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Tên nhà cung cấp</p>
                <p className="mt-1 text-base font-semibold text-foreground">{viewVendorItem.name}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Info label="Danh mục" value={viewVendorItem.category?.name ?? "Chưa phân loại"} />
                <Info
                  label="Trạng thái"
                  value={vendorStatusLabel[viewVendorItem.status ?? "active"] ?? viewVendorItem.status ?? "-"}
                />
                <Info label="Người liên hệ" value={viewVendorItem.contactName || "Chưa cập nhật"} />
                <Info label="Số điện thoại" value={viewVendorItem.phone || "Chưa cập nhật"} />
                <Info label="Email" value={viewVendorItem.email || "Chưa cập nhật"} />
                <Info
                  label="Số tài khoản ngân hàng"
                  value={viewVendorItem.bankAccountNumber || "Chưa cập nhật"}
                />
              </div>
              <Info label="Địa chỉ" value={viewVendorItem.address || "Chưa cập nhật"} />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeVendorDetails}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={vendorEditorOpen} onOpenChange={setVendorEditorOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {editingProjectVendor ? "Chỉnh sửa nhà cung cấp" : "Thêm nhà cung cấp mới"}
            </DialogTitle>
            <DialogDescription>
              {editingProjectVendor
                ? "Thông tin liên hệ được dùng chung; phạm vi phụ trách chỉ áp dụng cho dự án này."
                : "Nhà cung cấp mới sẽ được tạo và gắn ngay vào dự án đang chọn."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="font-body text-sm text-foreground mb-1 block">Tên nhà cung cấp *</label>
                <Input
                  value={vendorEditorForm.name}
                  onChange={(event) => setVendorEditorForm((current) => ({ ...current, name: event.target.value }))}
                  className="rounded-xl border-none bg-surface-low"
                />
              </div>
              <div>
                <label className="font-body text-sm text-foreground mb-1 block">Danh mục *</label>
                <select
                  value={vendorEditorForm.categoryId}
                  onChange={(event) => setVendorEditorForm((current) => ({ ...current, categoryId: event.target.value }))}
                  className="w-full rounded-xl bg-surface-low p-2.5 font-body text-sm text-foreground border-none"
                >
                  <option value="">Chọn danh mục</option>
                  {vendorCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="font-body text-sm text-foreground mb-1 block">Người liên hệ</label>
                <Input
                  value={vendorEditorForm.contactName}
                  onChange={(event) => setVendorEditorForm((current) => ({ ...current, contactName: event.target.value }))}
                  className="rounded-xl border-none bg-surface-low"
                />
              </div>
              <div>
                <label className="font-body text-sm text-foreground mb-1 block">Số điện thoại</label>
                <Input
                  value={vendorEditorForm.phone}
                  onChange={(event) => setVendorEditorForm((current) => ({ ...current, phone: event.target.value }))}
                  className="rounded-xl border-none bg-surface-low"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="font-body text-sm text-foreground mb-1 block">Email</label>
                <Input
                  type="email"
                  value={vendorEditorForm.email}
                  onChange={(event) => setVendorEditorForm((current) => ({ ...current, email: event.target.value }))}
                  className="rounded-xl border-none bg-surface-low"
                />
              </div>
              <div>
                <label className="font-body text-sm text-foreground mb-1 block">Số tài khoản ngân hàng</label>
                <Input
                  value={vendorEditorForm.bankAccountNumber}
                  onChange={(event) => setVendorEditorForm((current) => ({ ...current, bankAccountNumber: event.target.value }))}
                  className="rounded-xl border-none bg-surface-low"
                />
              </div>
            </div>
            <div>
              <label className="font-body text-sm text-foreground mb-1 block">Địa chỉ *</label>
              <Input
                value={vendorEditorForm.address}
                onChange={(event) => setVendorEditorForm((current) => ({ ...current, address: event.target.value }))}
                className="rounded-xl border-none bg-surface-low"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="font-body text-sm text-foreground mb-1 block">Phạm vi phụ trách</label>
                <Input
                  value={vendorEditorForm.serviceNote}
                  onChange={(event) => setVendorEditorForm((current) => ({ ...current, serviceNote: event.target.value }))}
                  placeholder="VD: Âm thanh, sân khấu..."
                  className="rounded-xl border-none bg-surface-low"
                />
              </div>
              <div>
                <label className="font-body text-sm text-foreground mb-1 block">Trạng thái</label>
                <select
                  value={vendorEditorForm.status}
                  onChange={(event) => setVendorEditorForm((current) => ({ ...current, status: event.target.value }))}
                  disabled={!editingProjectVendor}
                  className="w-full rounded-xl bg-surface-low p-2.5 font-body text-sm text-foreground border-none disabled:opacity-60"
                >
                  <option value="active">Đang hợp tác</option>
                  <option value="paused">Tạm dừng</option>
                  <option value="inactive">Ngừng hợp tác</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVendorEditorOpen(false)} disabled={vendorSaving}>Hủy</Button>
            <Button variant="hero" onClick={saveVendor} disabled={vendorSaving || vendorCategories.length === 0}>
              {vendorSaving ? "Đang lưu..." : editingProjectVendor ? "Cập nhật" : "Tạo và gắn NCC"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-12">
            <DialogTitle className="font-serif">{editingTask ? "Sửa công việc" : "Thêm công việc mới"}</DialogTitle>
            {!editingTask && (
              <DialogDescription className="line-clamp-2">
                Chọn nhanh từ checklist {taskTemplateGroup.label} hoặc tạo công việc mới khi dự án phát sinh việc ngoài mẫu.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="space-y-3">
              {!editingTask && (
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-low p-1">
                  <button
                    type="button"
                    onClick={selectTemplateMode}
                    className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 font-body text-sm font-semibold transition ${
                      !customTaskMode
                        ? "bg-background text-foreground shadow-ambient"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <ListChecks size={15} /> Việc mẫu
                  </button>
                  <button
                    type="button"
                    onClick={selectCustomTask}
                    className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 font-body text-sm font-semibold transition ${
                      customTaskMode
                        ? "bg-background text-foreground shadow-ambient"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Plus size={15} /> Việc mới
                  </button>
                </div>
              )}

              {editingTask ? (
                <div>
                  <label className="font-body text-sm text-foreground mb-1 block">Công việc</label>
                  <Input
                    value={form.title}
                    disabled
                    className="rounded-xl border-none bg-surface-low"
                  />
                </div>
              ) : customTaskMode ? (
                <div className="rounded-xl border border-border bg-surface-lowest p-4">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Plus size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-body text-sm font-semibold text-foreground">Tạo công việc mới</p>
                      <p className="mt-1 font-body text-xs leading-relaxed text-muted-foreground">
                        Dùng cho việc phát sinh riêng của dự án, không nằm trong checklist mẫu.
                      </p>
                    </div>
                  </div>
                  <label className="font-body text-sm text-foreground mb-1 block">Tên công việc mới *</label>
                  <Input
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    placeholder="VD: Chuẩn bị khu vực livestream phụ..."
                    className="rounded-xl border-none bg-surface-low"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-surface-lowest p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-body text-sm font-semibold text-foreground">Checklist {taskTemplateGroup.label}</p>
                      <p className="mt-1 font-body text-xs text-muted-foreground">
                        Còn {missingServiceTaskTemplates.length} việc mẫu chưa có · Đã chọn {selectedTaskTemplates.length}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg px-3"
                        onClick={selectAllMissingTemplates}
                        disabled={missingServiceTaskTemplates.length === 0}
                      >
                        Chọn tất cả
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg px-3"
                        onClick={clearSelectedTemplates}
                        disabled={selectedTaskTemplates.length === 0}
                      >
                        Bỏ chọn
                      </Button>
                      <span className="rounded-full bg-surface-low px-2 py-1 font-body text-[11px] font-semibold text-muted-foreground">
                        {filteredServiceTaskTemplates.length} kết quả
                      </span>
                    </div>
                    <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 font-body text-[11px] font-semibold text-emerald-700">
                      Đã chấp nhận phân công
                    </span>
                  </div>

                  <div className="relative mt-3">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={taskTemplateSearch}
                      onChange={(event) => setTaskTemplateSearch(event.target.value)}
                      placeholder="Tìm theo tên, giai đoạn hoặc mô tả..."
                      className="rounded-xl border-none bg-surface-low pl-9"
                    />
                  </div>

                  <div className="mt-3 max-h-[220px] space-y-2 overflow-y-auto pr-1 sm:max-h-[260px]">
                    {filteredServiceTaskTemplates.map((template) => {
                      const alreadyAdded = usedTaskTitles.has(normalizeTaskTitle(template.title));
                      const selected = selectedTaskTemplateIds.includes(template.id);
                      const templateForm = buildTaskFormFromTemplate(template, form.assigneeUserId);

                      return (
                        <button
                          key={template.id}
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() => toggleTaskTemplate(template)}
                          className={`w-full rounded-lg border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-55 ${
                            selected
                              ? "border-primary bg-primary/10"
                              : "border-border bg-surface-low hover:border-primary/60 hover:bg-surface-high"
                          }`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-background px-2 py-0.5 font-body text-[11px] font-semibold text-muted-foreground">
                                  {template.phase}
                                </span>
                                <span className={`rounded-full px-2 py-0.5 font-body text-[11px] font-semibold ${priorityColors[template.priority]}`}>
                                  {priorityLabel[template.priority]}
                                </span>
                                <span className="rounded-full bg-background px-2 py-0.5 font-body text-[11px] font-semibold text-muted-foreground">
                                  {templateForm.dueAt ? formatDate(templateForm.dueAt) : "Chưa có hạn"}
                                </span>
                                {alreadyAdded && (
                                  <span className="rounded-full bg-secondary/10 px-2 py-0.5 font-body text-[11px] font-semibold text-secondary">
                                    Đã có
                                  </span>
                                )}
                              </div>
                              <p className="font-body text-sm font-semibold leading-snug text-foreground">
                                {template.title}
                              </p>
                              <p className="mt-1 font-body text-xs leading-relaxed text-muted-foreground">
                                {template.description}
                              </p>
                            </div>
                            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                              selected ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
                            }`}>
                              {selected ? <CheckCircle size={15} /> : <Plus size={14} />}
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    {filteredServiceTaskTemplates.length === 0 && (
                      <div className="rounded-lg bg-surface-low p-5 text-center font-body text-sm text-muted-foreground">
                        Không tìm thấy việc mẫu phù hợp.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {!editingTask && !customTaskMode && selectedTaskTemplates.length > 1 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_240px]">
                <div className="rounded-xl bg-surface-low p-4 font-body text-sm text-muted-foreground">
                  Đã chọn {selectedTaskTemplates.length} việc mẫu. Hệ thống sẽ dùng mô tả, deadline và mức ưu tiên gợi ý riêng cho từng việc.
                </div>
                <div>
                  <label className="font-body text-sm text-foreground mb-1 block">Phụ trách chung</label>
                  <select
                    value={form.assigneeUserId}
                    onChange={(event) => setForm({ ...form, assigneeUserId: event.target.value })}
                    className="w-full rounded-xl bg-surface-low p-2.5 font-body text-sm text-foreground border-none"
                  >
                    <option value="">Chưa phân công</option>
                    {assigneeOptions.map((person) => (
                      <option key={person.id} value={person.id}>{person.displayName}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="font-body text-sm text-foreground mb-1 block">Mô tả</label>
                  <Input
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    placeholder="Mô tả ngắn..."
                    className="rounded-xl border-none bg-surface-low"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="font-body text-sm text-foreground mb-1 block">Deadline</label>
                    <Input
                      type="date"
                      value={form.dueAt}
                      onChange={(event) => setForm({ ...form, dueAt: event.target.value })}
                      className="rounded-xl border-none bg-surface-low"
                    />
                  </div>
                  <div>
                    <label className="font-body text-sm text-foreground mb-1 block">Ưu tiên</label>
                    <select
                      value={form.priority}
                      onChange={(event) => setForm({ ...form, priority: event.target.value as "low" | "medium" | "high" })}
                      className="w-full rounded-xl bg-surface-low p-2.5 font-body text-sm text-foreground border-none"
                    >
                      <option value="high">Cao</option>
                      <option value="medium">Trung bình</option>
                      <option value="low">Thấp</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-body text-sm text-foreground mb-1 block">Phụ trách</label>
                    <select
                      value={form.assigneeUserId}
                      onChange={(event) => setForm({ ...form, assigneeUserId: event.target.value })}
                      className="w-full rounded-xl bg-surface-low p-2.5 font-body text-sm text-foreground border-none"
                    >
                      <option value="">Chưa phân công</option>
                      {assigneeOptions.map((person) => (
                        <option key={person.id} value={person.id}>{person.displayName}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t border-border bg-background px-5 py-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button variant="hero" onClick={saveTask} disabled={!canSaveTask}>
              {saveTaskLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createStaffDialogOpen} onOpenChange={setCreateStaffDialogOpen}>
        <DialogContent className="sm:max-w-[460px] rounded-2xl border-foreground/30 bg-background p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Thêm nhân sự mới</DialogTitle>
            <DialogDescription className="sr-only">
              Biểu mẫu tạo tài khoản nhân sự mới trong hệ thống.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="font-body text-sm text-foreground mb-1 block">Họ và tên *</label>
              <Input
                value={createStaffForm.name}
                onChange={(event) => setCreateStaffForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Nguyễn Văn A"
                className="rounded-xl border-none bg-surface-low"
              />
            </div>

            <div>
              <label className="font-body text-sm text-foreground mb-1 block">Vai trò *</label>
              <select
                value={createStaffForm.jobTitle}
                onChange={(event) => setCreateStaffForm((current) => ({ ...current, jobTitle: event.target.value }))}
                className="w-full rounded-xl bg-surface-low p-2.5 font-body text-sm text-foreground border-none"
              >
                <option value="">Chọn vai trò</option>
                {staffRoles.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-body text-sm text-foreground mb-1 block">Số điện thoại</label>
                <Input
                  value={createStaffForm.phone}
                  onChange={(event) => setCreateStaffForm((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="0901234567"
                  className="rounded-xl border-none bg-surface-low"
                />
              </div>
              <div>
                <label className="font-body text-sm text-foreground mb-1 block">Email *</label>
                <Input
                  type="email"
                  value={createStaffForm.email}
                  onChange={(event) => setCreateStaffForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="email@example.com"
                  className="rounded-xl border-none bg-surface-low"
                />
              </div>
            </div>

            <div>
              <label className="font-body text-sm text-foreground mb-1 block">Trạng thái</label>
              <select
                value={createStaffForm.employmentStatus}
                onChange={(event) => setCreateStaffForm((current) => ({ ...current, employmentStatus: event.target.value }))}
                className="w-full rounded-xl bg-surface-low p-2.5 font-body text-sm text-foreground border-none"
              >
                <option value="active">Đang làm việc</option>
                <option value="inactive">Tạm nghỉ</option>
              </select>
            </div>
          </div>

          <DialogFooter className="pt-1">
            <Button variant="outline" onClick={() => setCreateStaffDialogOpen(false)} disabled={createStaffSaving}>
              Hủy
            </Button>
            <Button variant="hero" onClick={handleCreateStaff} disabled={createStaffSaving}>
              {createStaffSaving ? "Đang tạo..." : "Tạo nhân sự"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={staffListOpen}
        onOpenChange={(open) => {
          setStaffListOpen(open);
          if (!open) setViewStaffItem(null);
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-serif">Tất cả nhân sự</DialogTitle>
            <DialogDescription>
              Xem thông tin và chọn nhân sự để phân công vào dự án đang mở.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={staffSearch}
              onChange={(event) => setStaffSearch(event.target.value)}
              placeholder="Tìm theo tên, vai trò hoặc liên hệ..."
              className="pl-9 rounded-xl border-none bg-surface-low"
            />
          </div>

          <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {filteredStaffCatalog.map((person) => {
              const assigned = projectStaff.some((assignment) => assignment.staffUser.id === person.id);
              const expanded = viewStaffItem?.id === person.id;
              const displayName = person.staffProfile?.fullName || person.displayName;
              const employmentStatus = person.staffProfile?.employmentStatus;
              const activeProjectCount = person.activeProjectCount ?? 0;
              const completedProjectCount = person.completedProjectCount ?? 0;
              const projectCount = person.projectCount ?? activeProjectCount + completedProjectCount;

              return (
                <div
                  key={person.id}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
                        {person.avatarUrl ? (
                          <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <UserRound size={18} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-body text-sm font-semibold text-foreground">
                            {displayName}
                          </p>
                          <span className={`rounded-full px-2 py-0.5 font-body text-[11px] font-semibold ${staffEmploymentClass(employmentStatus)}`}>
                            {staffEmploymentLabel(employmentStatus)}
                          </span>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-body text-[11px] font-semibold text-primary">
                            {activeProjectCount} đang làm
                          </span>
                          <span className="rounded-full bg-surface-high px-2 py-0.5 font-body text-[11px] font-semibold text-muted-foreground">
                            {completedProjectCount} đã làm
                          </span>
                        </div>
                        <p className="mt-1 font-body text-xs text-muted-foreground">
                          {person.staffProfile?.jobTitle || "Chưa có vai trò"} · {person.phone || person.email || "Chưa có liên hệ"}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => setViewStaffItem(expanded ? null : person)}
                      >
                        <Eye size={14} /> {expanded ? "Ẩn thông tin" : "Thông tin"}
                      </Button>
                      <Button
                        variant={assigned ? "outline" : "hero"}
                        size="sm"
                        className="rounded-xl"
                        disabled={assigned}
                        onClick={() => openAssignStaffFromList(person)}
                      >
                        {assigned ? "Đã phân công" : "Chọn nhân sự"}
                      </Button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="mt-4 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Info label="Họ tên" value={displayName} />
                      <Info label="Vai trò" value={person.staffProfile?.jobTitle || "Chưa cập nhật"} />
                      <Info label="Trạng thái" value={staffEmploymentLabel(employmentStatus)} />
                      <Info label="Đang làm" value={`${activeProjectCount} dự án`} />
                      <Info label="Đã làm" value={`${completedProjectCount} dự án`} />
                      <Info label="Tổng đã & đang làm" value={`${projectCount} dự án`} />
                      <div className="rounded-lg bg-surface-low p-3">
                        <p className="flex items-center gap-1.5 font-body text-xs text-muted-foreground">
                          <Phone size={12} /> Số điện thoại
                        </p>
                        <p className="mt-1 break-words font-body text-sm font-semibold text-foreground">
                          {person.phone || "Chưa cập nhật"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-surface-low p-3 sm:col-span-2">
                        <p className="flex items-center gap-1.5 font-body text-xs text-muted-foreground">
                          <Mail size={12} /> Email
                        </p>
                        <p className="mt-1 break-all font-body text-sm font-semibold text-foreground">
                          {person.email || "Chưa cập nhật"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredStaffCatalog.length === 0 && (
              <div className="rounded-xl bg-surface-low p-6 text-center font-body text-sm text-muted-foreground">
                Không tìm thấy nhân sự phù hợp.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStaffListOpen(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={staffDialogOpen}
        onOpenChange={(open) => {
          setStaffDialogOpen(open);
          if (!open) setEditingStaffAssignment(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {editingStaffAssignment ? "Sửa phân công nhân sự" : "Phân công nhân sự vào dự án"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {editingStaffAssignment
                ? "Biểu mẫu cập nhật vai trò và trạng thái phân công."
                : "Biểu mẫu thêm nhân sự đã tạo vào dự án đang chọn."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="font-body text-sm text-foreground mb-1 block">Nhân sự</label>
              {editingStaffAssignment ? (
                <Input
                  value={editingStaffAssignment.staffUser.displayName}
                  disabled
                  className="rounded-xl border-none bg-surface-low"
                />
              ) : (
                <select
                  value={staffForm.staffUserId}
                  onChange={(event) => setStaffForm((current) => ({ ...current, staffUserId: event.target.value }))}
                  className="w-full rounded-xl bg-surface-low p-2.5 font-body text-sm text-foreground border-none"
                >
                  <option value="">Chọn nhân sự</option>
                  {availableStaffForProject.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.displayName} - {person.staffProfile?.jobTitle || person.email || "Nhân sự"}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="font-body text-sm text-foreground mb-1 block">Vai trò trong dự án</label>
              <Input
                value={staffForm.roleText}
                onChange={(event) => setStaffForm((current) => ({ ...current, roleText: event.target.value }))}
                placeholder="VD: Điều phối sảnh, lễ tân, âm thanh..."
                className="rounded-xl border-none bg-surface-low"
              />
            </div>
            {editingStaffAssignment && (
              <div>
                <label className="font-body text-sm text-foreground mb-1 block">Trạng thái phân công</label>
                <select
                  value={staffForm.status}
                  onChange={(event) => setStaffForm((current) => ({ ...current, status: event.target.value }))}
                  className="w-full rounded-xl bg-surface-low p-2.5 font-body text-sm text-foreground border-none"
                >
                  {Object.entries(staffAssignmentStatusLabel).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStaffDialogOpen(false)}>Hủy</Button>
            <Button variant="hero" onClick={saveProjectStaff}>
              {editingStaffAssignment ? "Cập nhật" : "Phân công"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg bg-surface-low p-3">
    <p className="font-body text-xs text-muted-foreground">{label}</p>
    <p className="font-body text-sm font-semibold text-foreground mt-1 break-words">{value}</p>
  </div>
);

const Metric = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-lg bg-surface-low p-3">
    <p className="font-serif text-headline-md text-foreground">{value}</p>
    <p className="font-body text-xs text-muted-foreground">{label}</p>
  </div>
);

export default OrganizerProjects;
