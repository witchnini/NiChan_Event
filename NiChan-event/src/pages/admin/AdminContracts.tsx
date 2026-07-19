import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Ban,
  Calculator,
  ClipboardCheck,
  ClipboardList,
  Edit2,
  Eye,
  FileText,
  History,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";
import ContractPdfButton from "@/components/features/contracts/ContractPdfButton";

type ContractLineItem = {
  id?: string;
  category: string;
  description?: string | null;
  unit?: string | null;
  quantity: string | number;
  unitPrice: string | number;
  amount?: string | number | null;
  note?: string | null;
};

type ContractVersion = {
  id: string;
  versionLabel: string;
  purpose?: string;
  scopeText?: string;
  paymentTerms?: string;
  generalTerms?: string;
  documentUrl?: string | null;
  createdAt: string;
  lineItems?: ContractLineItem[];
};

type SettlementPreview = {
  contractId: string;
  contractCode: string;
  eventName: string;
  eventStatus: string;
  currentContractStatus: string;
  originalTotal: number;
  settlementTotal: number;
  difference: number;
  lineItems: ContractLineItem[];
  budgetItemCount: number;
};

type ContractDocument = {
  id: string;
  name: string;
  fileType: string;
  fileUrl: string;
  status: string;
};

type Contract = {
  id: string;
  contractCode: string;
  status: string;
  totalValue: string | number;
  currentVersion: string;
  sentAt?: string | null;
  signedAt?: string | null;
  respondedAt?: string | null;
  rejectionNote?: string | null;
  createdAt?: string | null;
  event?: {
    id: string;
    name: string;
    type?: string | null;
    eventDate?: string | null;
    locationText?: string | null;
    customerUser?: { id?: string; displayName?: string | null } | null;
    consultationRequest?: { customerName?: string | null; eventType?: string | null; note?: string | null } | null;
  } | null;
  customerUser?: { id: string; displayName: string; phone?: string | null; email?: string | null } | null;
  createdBy?: { id: string; displayName: string } | null;
  versions?: ContractVersion[];
  documents?: ContractDocument[];
};

type Project = {
  id: string;
  name: string;
  type: string;
  customerUser?: { id: string; displayName: string } | null;
  consultationRequest?: {
    id?: string;
    requestCode?: string;
    customerName?: string | null;
    eventType?: string | null;
    note?: string | null;
  } | null;
};

type BudgetItem = {
  id: string;
  category: string;
  estimatedAmount: string | number;
  actualAmount?: string | number;
  status: string;
};

type BudgetResponse = {
  items: BudgetItem[];
};

type ServiceCatalogItem = {
  id: string;
  title: string;
  shortDescription?: string | null;
  category?: { id?: string; name?: string | null; slug?: string | null } | null;
};

type ServiceCategoryItem = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isActive?: boolean;
};

type LineItemForm = {
  category: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  note: string;
};

type ContractForm = {
  eventId: string;
  customerUserId: string;
  versionLabel: string;
  totalValue: string;
  scopeText: string;
  paymentTerms: string;
  generalTerms: string;
  lineItems: LineItemForm[];
};

type LineItemEditorOptions = {
  items: LineItemForm[];
  total: number;
  totalLabel: string;
  unitPriceLabel: string;
  descriptionPlaceholder: string;
  onUpdate: (index: number, patch: Partial<LineItemForm>) => void;
  onCategoryChange: (index: number, category: string) => void;
  onApplyTemplate: (index: number, templateId: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onApplySuggested: () => void;
  onImportBudget: () => void;
  applySuggestedDisabled: boolean;
  importBudgetDisabled: boolean;
  importBudgetLabel: string;
  helperText: string;
};

const statusList = [
  { label: "Bản nháp", value: "draft" },
  { label: "Đã gửi", value: "sent" },
  { label: "Hiệu lực", value: "active" },
  { label: "Đã thanh lý", value: "liquidated" },
  { label: "Đã hủy", value: "cancelled" },
];

const statusLabel: Record<string, string> = {
  draft: "Bản nháp",
  sent: "Đã gửi",
  active: "Hiệu lực",
  liquidated: "Đã thanh lý",
  cancelled: "Đã hủy",
  completed: "Hoàn thành",
};

const statusColors: Record<string, string> = {
  active: "bg-secondary/10 text-secondary",
  sent: "bg-primary/10 text-primary",
  completed: "bg-muted text-muted-foreground",
  liquidated: "bg-muted text-muted-foreground",
  draft: "bg-surface-high text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

const unitOptions = [
  "gói",
  "buổi",
  "ngày",
  "giờ",
  "khách",
  "người",
  "suất",
  "bàn",
  "bộ",
  "cái",
  "chiếc",
  "m2",
  "m",
  "xe",
  "chuyến",
  "lượt",
  "phòng",
  "đêm",
  "tháng",
];

const AUTO_SERVICE_VALUE = "__auto_service__";
const SERVICE_CATEGORY_VALUE_PREFIX = "__service_category__:";
const MANUAL_TEMPLATE_VALUE = "__manual_template__";
const AUTO_TERMS_TEMPLATE_VALUE = "__auto_terms_template__";
const MANUAL_TERMS_TEMPLATE_VALUE = "__manual_terms_template__";

type ContractLineItemTemplate = {
  id: string;
  category: string;
  description: string;
  unit: string;
};

type ContractLineItemTemplateGroup = {
  id: string;
  label: string;
  keywords: string[];
  items: ContractLineItemTemplate[];
};

type ContractTermsTemplate = {
  id: string;
  label: string;
  scopeText: string;
  paymentTerms: string;
  generalTerms: string;
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const commonLineItemTemplates: ContractLineItemTemplate[] = [
  {
    id: "common-project-management",
    category: "Quản lý dự án & điều phối tổng thể",
    description: "Lập kế hoạch triển khai, điều phối nhân sự, nhà cung cấp và kiểm soát tiến độ trước - trong - sau sự kiện.",
    unit: "gói",
  },
  {
    id: "common-concept-script",
    category: "Thiết kế concept & kịch bản chương trình",
    description: "Xây dựng ý tưởng chủ đạo, moodboard, timeline chi tiết và kịch bản điều phối phù hợp mục tiêu sự kiện.",
    unit: "gói",
  },
  {
    id: "common-onsite-operation",
    category: "Vận hành onsite",
    description: "Bố trí đội ngũ điều phối tại hiện trường, kiểm tra checklist vận hành và xử lý phát sinh trong ngày diễn ra.",
    unit: "buổi",
  },
];

const contractLineItemTemplateGroups: ContractLineItemTemplateGroup[] = [
  {
    id: "wedding",
    label: "Tiệc cưới",
    keywords: ["tiệc cưới", "dam cuoi", "wedding", "cuoi", "le cuoi"],
    items: [
      {
        id: "wedding-planning",
        category: "Lập kế hoạch & điều phối tiệc cưới",
        description: "Tư vấn lịch trình, phân bổ đầu việc, điều phối gia đình hai bên và giám sát toàn bộ timeline ngày cưới.",
        unit: "gói",
      },
      {
        id: "wedding-decoration",
        category: "Trang trí cổng hoa, sân khấu & bàn gallery",
        description: "Thiết kế và thi công khu vực đón khách, backdrop, sân khấu, lối đi và bàn gallery theo concept đã duyệt.",
        unit: "gói",
      },
      {
        id: "wedding-av",
        category: "Âm thanh, ánh sáng & màn hình",
        description: "Cung cấp hệ thống âm thanh, ánh sáng sân khấu, màn hình trình chiếu và kỹ thuật viên vận hành trong tiệc.",
        unit: "buổi",
      },
      {
        id: "wedding-catering",
        category: "Thực đơn tiệc cưới",
        description: "Phục vụ thực đơn tiệc theo số lượng khách, bao gồm set menu, đồ uống cơ bản và nhân sự phục vụ tại bàn.",
        unit: "suất",
      },
      {
        id: "wedding-media",
        category: "Chụp ảnh & quay phim cưới",
        description: "Ghi lại khoảnh khắc lễ cưới, tiệc đãi khách và bàn giao bộ ảnh/video highlight sau chương trình.",
        unit: "gói",
      },
    ],
  },
  {
    id: "birthday",
    label: "Sinh nhật",
    keywords: ["sinh nhật", "birthday", "sinh nhat"],
    items: [
      {
        id: "birthday-concept",
        category: "Concept & trang trí sinh nhật",
        description: "Thiết kế chủ đề, phối màu, backdrop, bàn gallery và các chi tiết trang trí phù hợp nhân vật chính.",
        unit: "gói",
      },
      {
        id: "birthday-entertainment",
        category: "MC, hoạt náo & trò chơi",
        description: "Dẫn dắt chương trình, tổ chức mini game và kết nối khách mời theo không khí thân mật của buổi tiệc.",
        unit: "buổi",
      },
      {
        id: "birthday-catering",
        category: "Tea break, bánh & đồ uống",
        description: "Chuẩn bị bánh sinh nhật, finger food, nước uống và khu vực phục vụ phù hợp quy mô khách mời.",
        unit: "suất",
      },
      {
        id: "birthday-media",
        category: "Chụp ảnh tiệc sinh nhật",
        description: "Ghi lại khoảnh khắc khai tiệc, thổi nến, giao lưu và các hoạt động chính của buổi sinh nhật.",
        unit: "buổi",
      },
    ],
  },
  {
    id: "anniversary",
    label: "Kỷ niệm",
    keywords: ["kỷ niệm", "ky niem", "anniversary", "le ky niem"],
    items: [
      {
        id: "anniversary-script",
        category: "Kịch bản lễ kỷ niệm",
        description: "Xây dựng timeline nghi thức, phát biểu, vinh danh và các điểm nhấn cảm xúc xuyên suốt chương trình.",
        unit: "gói",
      },
      {
        id: "anniversary-stage",
        category: "Sân khấu, backdrop & khu vực check-in",
        description: "Thiết kế nhận diện không gian sự kiện, thi công sân khấu, backdrop, standee và khu vực đón khách.",
        unit: "gói",
      },
      {
        id: "anniversary-performance",
        category: "Nghi thức & tiết mục biểu diễn",
        description: "Tổ chức phần nghi thức, tiết mục văn nghệ, trình chiếu hình ảnh và các hoạt động tri ân khách mời.",
        unit: "buổi",
      },
      {
        id: "anniversary-media",
        category: "Truyền thông hình ảnh sự kiện",
        description: "Chụp ảnh, quay phim, dựng highlight và bàn giao tư liệu truyền thông sau chương trình.",
        unit: "gói",
      },
    ],
  },
  {
    id: "conference",
    label: "Hội nghị & hội thảo",
    keywords: ["hội nghị", "hội thảo", "hoi nghi", "hoi thao", "conference", "seminar", "workshop", "doanh nghiep"],
    items: [
      {
        id: "conference-venue",
        category: "Địa điểm & setup phòng họp",
        description: "Bố trí không gian hội nghị, sơ đồ chỗ ngồi, bàn ghế, biển tên và khu vực tiếp đón theo layout đã duyệt.",
        unit: "buổi",
      },
      {
        id: "conference-equipment",
        category: "Thiết bị trình chiếu & âm thanh hội nghị",
        description: "Cung cấp máy chiếu/màn LED, micro, loa, clicker, đường truyền kỹ thuật và nhân sự vận hành thiết bị.",
        unit: "buổi",
      },
      {
        id: "conference-checkin",
        category: "Check-in, lễ tân & tài liệu khách mời",
        description: "Chuẩn bị danh sách khách, QR/check-in, tài liệu, bảng tên và đội ngũ lễ tân hỗ trợ khách tham dự.",
        unit: "gói",
      },
      {
        id: "conference-catering",
        category: "Tea break & phục vụ hội nghị",
        description: "Sắp xếp tea break, nước uống, khu vực phục vụ và nhân sự hỗ trợ trong các khoảng nghỉ chương trình.",
        unit: "suất",
      },
      {
        id: "conference-livestream",
        category: "Livestream & ghi hình hội nghị",
        description: "Thiết lập ghi hình/livestream, thu âm nội dung chính và bàn giao file tư liệu sau chương trình.",
        unit: "gói",
      },
    ],
  },
  {
    id: "groundbreaking",
    label: "Động thổ & khởi công",
    keywords: ["động thổ", "khởi công", "dong tho", "khoi cong", "groundbreaking", "construction"],
    items: [
      {
        id: "groundbreaking-layout",
        category: "Mặt bằng nghi lễ & khu vực đón khách",
        description: "Khảo sát mặt bằng, bố trí sơ đồ nghi lễ, khu vực khách mời, lối di chuyển và điểm đặt vật phẩm nghi thức.",
        unit: "gói",
      },
      {
        id: "groundbreaking-tent-stage",
        category: "Nhà bạt, sân khấu & backdrop khởi công",
        description: "Thi công nhà bạt, sân khấu, backdrop, thảm, bục nghi thức và nhận diện thương hiệu tại khu vực tổ chức.",
        unit: "gói",
      },
      {
        id: "groundbreaking-ritual",
        category: "Bộ nghi thức động thổ",
        description: "Chuẩn bị xẻng, cát, mâm nghi thức, băng khánh thành và đạo cụ phục vụ phần lễ khởi công.",
        unit: "bộ",
      },
      {
        id: "groundbreaking-av",
        category: "Âm thanh, ánh sáng ngoài trời",
        description: "Cung cấp hệ thống âm thanh, micro, nguồn điện kỹ thuật và đội ngũ vận hành phù hợp không gian ngoài trời.",
        unit: "buổi",
      },
      {
        id: "groundbreaking-reception",
        category: "Lễ tân & điều phối khách mời",
        description: "Bố trí nhân sự hướng dẫn, đón tiếp đại biểu, ổn định vị trí và điều phối luồng khách trong phần nghi lễ.",
        unit: "người",
      },
    ],
  },
  {
    id: "opening",
    label: "Khai trương",
    keywords: ["khai trương", "khai truong", "opening", "grand opening", "showroom"],
    items: [
      {
        id: "opening-gate-backdrop",
        category: "Cổng chào, backdrop & khu vực khai trương",
        description: "Thiết kế và thi công cổng chào, backdrop, standee, khu vực check-in và nhận diện thương hiệu tại điểm mở bán.",
        unit: "gói",
      },
      {
        id: "opening-ribbon",
        category: "Nghi thức cắt băng khai trương",
        description: "Chuẩn bị bộ cắt băng, khay kéo, hoa cài, cue nghi thức và điều phối đại biểu tham gia phần lễ.",
        unit: "bộ",
      },
      {
        id: "opening-performance",
        category: "Múa lân, trống hội & tiết mục chào mừng",
        description: "Tổ chức tiết mục khai màn tạo không khí, thu hút khách mời và tăng điểm nhấn cho thời khắc khai trương.",
        unit: "buổi",
      },
      {
        id: "opening-av",
        category: "Âm thanh, ánh sáng khai trương",
        description: "Cung cấp loa, micro, mixer, ánh sáng cơ bản và kỹ thuật viên vận hành trong suốt chương trình.",
        unit: "buổi",
      },
      {
        id: "opening-media",
        category: "Chụp ảnh, quay phim & tư liệu truyền thông",
        description: "Ghi lại nghi thức khai trương, khách mời, không gian thương hiệu và bàn giao tư liệu truyền thông sau sự kiện.",
        unit: "gói",
      },
    ],
  },
  {
    id: "inauguration",
    label: "Khánh thành",
    keywords: ["khánh thành", "khanh thanh", "inauguration", "ribbon cutting"],
    items: [
      {
        id: "inauguration-ceremony",
        category: "Kịch bản nghi thức khánh thành",
        description: "Xây dựng trình tự nghi lễ, phát biểu, cắt băng/mở bảng và điều phối khách mời VIP theo timeline.",
        unit: "gói",
      },
      {
        id: "inauguration-stage",
        category: "Sân khấu, backdrop & nhận diện công trình",
        description: "Thi công sân khấu, backdrop, bảng tên, thảm đỏ và các hạng mục nhận diện cho khu vực khánh thành.",
        unit: "gói",
      },
      {
        id: "inauguration-av",
        category: "Âm thanh, ánh sáng & kỹ thuật",
        description: "Cung cấp hệ thống âm thanh, micro, ánh sáng, nguồn điện và kỹ thuật viên trực chương trình.",
        unit: "buổi",
      },
      {
        id: "inauguration-reception",
        category: "Lễ tân, đón tiếp & quà lưu niệm",
        description: "Bố trí nhân sự đón khách, khu vực ký tên, hướng dẫn chỗ ngồi và chuẩn bị quà lưu niệm theo danh sách.",
        unit: "gói",
      },
    ],
  },
  {
    id: "gala",
    label: "Gala Dinner",
    keywords: [
      "gala",
      "gala dinner",
      "dinner",
      "tiệc gala",
      "tiec gala",
      "tri ân khách hàng",
      "tri an khach hang",
      "tri ân",
      "tri an",
      "khách hàng",
      "khach hang",
      "customer appreciation",
      "client appreciation",
    ],
    items: [
      {
        id: "gala-concept",
        category: "Concept & kịch bản Gala Dinner",
        description: "Xây dựng chủ đề, flow chương trình, nghi thức khai tiệc, vinh danh và các điểm nhấn giải trí trong đêm gala.",
        unit: "gói",
      },
      {
        id: "gala-stage-led",
        category: "Sân khấu, LED, âm thanh & ánh sáng",
        description: "Thiết kế sân khấu, màn LED, hệ thống âm thanh ánh sáng và nhân sự kỹ thuật vận hành đêm tiệc.",
        unit: "gói",
      },
      {
        id: "gala-mc-artist",
        category: "MC, nghệ sĩ & tiết mục biểu diễn",
        description: "Sắp xếp MC, ca sĩ/nhóm biểu diễn, rehearsal và điều phối tiết mục theo kịch bản đã duyệt.",
        unit: "buổi",
      },
      {
        id: "gala-banquet",
        category: "Tiệc, đồ uống & phục vụ bàn",
        description: "Phối hợp thực đơn, set bàn, đồ uống và nhân sự phục vụ trong suốt thời lượng Gala Dinner.",
        unit: "suất",
      },
      {
        id: "gala-awards",
        category: "Vinh danh, trao giải & bốc thăm",
        description: "Chuẩn bị hạng mục trao giải, slide vinh danh, đạo cụ sân khấu và điều phối bốc thăm/trao quà.",
        unit: "gói",
      },
    ],
  },
  {
    id: "year-end-party",
    label: "Year End Party",
    keywords: ["year end party", "year-end", "tất niên", "tat nien", "cuối năm", "cuoi nam", "yep"],
    items: [
      {
        id: "yep-concept",
        category: "Concept & kịch bản Year End Party",
        description: "Xây dựng chủ đề tiệc cuối năm, timeline tổng kết, vinh danh, giải trí và hoạt động gắn kết nội bộ.",
        unit: "gói",
      },
      {
        id: "yep-stage",
        category: "Sân khấu, backdrop & photobooth",
        description: "Thiết kế sân khấu, backdrop, khu vực chụp hình, nhận diện doanh nghiệp và không gian check-in.",
        unit: "gói",
      },
      {
        id: "yep-av",
        category: "Âm thanh, ánh sáng & LED",
        description: "Cung cấp hệ thống âm thanh ánh sáng, màn LED/trình chiếu và kỹ thuật viên vận hành chương trình.",
        unit: "buổi",
      },
      {
        id: "yep-mc-performance",
        category: "MC, nghệ sĩ & game sân khấu",
        description: "Dẫn dắt chương trình, tổ chức game, tiết mục biểu diễn và kết nối khách mời trong đêm tiệc.",
        unit: "buổi",
      },
      {
        id: "yep-banquet",
        category: "Tiệc cuối năm & đồ uống",
        description: "Phối hợp thực đơn tiệc, đồ uống, setup bàn và nhân sự phục vụ theo số lượng nhân sự tham dự.",
        unit: "suất",
      },
    ],
  },
];

const termsText = (...lines: string[]) => lines.join("\n");

const commonContractTermsTemplate: ContractTermsTemplate = {
  id: "common",
  label: "Dịch vụ chung",
  scopeText: termsText(
    "1. NiChan tư vấn mục tiêu, quy mô, đối tượng khách mời và xây dựng kế hoạch tổ chức tổng thể cho sự kiện.",
    "2. NiChan lập timeline triển khai, checklist hạng mục, phương án nhân sự, nhà cung cấp và điều phối các đầu việc đã thống nhất.",
    "3. NiChan chuẩn bị phương án vận hành tại hiện trường, giám sát setup, điều phối chương trình và hỗ trợ xử lý phát sinh hợp lý trong phạm vi hợp đồng.",
    "4. Các hạng mục vật tư, nhân sự, địa điểm, thiết bị, truyền thông và dịch vụ bổ sung được thực hiện theo bảng báo giá/hạng mục đính kèm hợp đồng.",
    "5. Sau chương trình, NiChan phối hợp nghiệm thu, bàn giao tài liệu/hình ảnh/sản phẩm liên quan nếu có trong phạm vi đã báo giá.",
  ),
  paymentTerms: termsText(
    "1. Đợt 1: Khách hàng thanh toán 50% tổng giá trị hợp đồng trong vòng 03 ngày làm việc kể từ ngày ký hợp đồng để NiChan giữ lịch, đặt cọc nhà cung cấp và bắt đầu triển khai.",
    "2. Đợt 2: Khách hàng thanh toán 30% tổng giá trị hợp đồng chậm nhất 07 ngày trước ngày tổ chức sự kiện hoặc trước thời điểm bắt đầu setup theo timeline được duyệt.",
    "3. Đợt 3: Khách hàng thanh toán 20% còn lại trong vòng 03 ngày làm việc sau khi hai bên nghiệm thu hoàn thành chương trình.",
    "4. Chi phí phát sinh ngoài phạm vi đã duyệt phải được hai bên xác nhận bằng văn bản/tin nhắn/email và thanh toán theo tiến độ phát sinh thực tế.",
    "5. Các khoản thanh toán được thực hiện bằng chuyển khoản hoặc phương thức khác do hai bên thống nhất; phí ngân hàng, thuế và chi phí giao dịch phát sinh do bên thanh toán chịu, trừ khi có thỏa thuận khác.",
  ),
  generalTerms: termsText(
    "1. Hai bên cam kết phối hợp cung cấp thông tin, phê duyệt nội dung, thiết kế, timeline và danh sách khách mời đúng thời hạn để bảo đảm tiến độ tổ chức.",
    "2. Mọi thay đổi về quy mô, thời gian, địa điểm, kịch bản, số lượng khách hoặc hạng mục dịch vụ cần được thông báo sớm và có thể làm thay đổi chi phí, tiến độ hoặc phương án vận hành.",
    "3. NiChan không chịu trách nhiệm đối với các chậm trễ hoặc thiệt hại phát sinh từ nguyên nhân bất khả kháng như thiên tai, dịch bệnh, yêu cầu từ cơ quan nhà nước, mất điện diện rộng, sự cố an ninh hoặc các yếu tố ngoài kiểm soát hợp lý.",
    "4. Tài sản, thiết bị, đạo cụ thuê/mượn phải được sử dụng đúng mục đích. Trường hợp hư hỏng, mất mát do lỗi của khách hàng hoặc khách mời, chi phí bồi hoàn được tính theo giá trị thực tế.",
    "5. Thông tin, hình ảnh, dữ liệu và tài liệu nội bộ của hai bên được bảo mật, trừ trường hợp sử dụng cho mục đích truyền thông đã được bên còn lại đồng ý.",
  ),
};

const contractTermsTemplates: ContractTermsTemplate[] = [
  {
    id: "wedding",
    label: "Tiệc cưới",
    scopeText: termsText(
      "1. NiChan tư vấn concept cưới, màu sắc chủ đạo, phong cách trang trí, timeline lễ/tiệc và phương án điều phối phù hợp với hai gia đình.",
      "2. NiChan triển khai các hạng mục trong bảng báo giá như cổng hoa, backdrop, sân khấu, bàn gallery, lối đi, âm thanh ánh sáng, MC, chụp ảnh/quay phim, catering và nhân sự phục vụ.",
      "3. NiChan phối hợp với cô dâu chú rể, đại diện gia đình, địa điểm tổ chức và các nhà cung cấp để chốt layout, thời gian setup, chạy chương trình và tháo dỡ sau tiệc.",
      "4. Số lượng khách, bàn tiệc, thực đơn, nghi thức lễ và các tiết mục đặc biệt được thực hiện theo thông tin đã duyệt trước ngày tổ chức.",
      "5. Các hạng mục phát sinh như tăng số bàn, nâng cấp hoa tươi, bổ sung màn LED, tiết mục biểu diễn hoặc thay đổi layout sẽ được báo giá và xác nhận riêng.",
    ),
    paymentTerms: termsText(
      "1. Đợt 1: Thanh toán 50% giá trị hợp đồng trong vòng 03 ngày làm việc sau khi ký để giữ lịch, đặt cọc địa điểm/nhà cung cấp và bắt đầu thiết kế concept.",
      "2. Đợt 2: Thanh toán 30% chậm nhất 10 ngày trước ngày cưới để hoàn tất đặt hàng vật tư, nhân sự, thiết bị và các hạng mục sản xuất.",
      "3. Đợt 3: Thanh toán 20% còn lại trong vòng 03 ngày sau tiệc cưới, sau khi hai bên đối soát hạng mục hoàn thành và chi phí phát sinh nếu có.",
      "4. Các phát sinh do thay đổi số lượng khách, bàn tiệc, thực đơn hoặc nâng cấp trang trí sau thời điểm chốt phương án sẽ được thanh toán trước khi triển khai.",
    ),
    generalTerms: termsText(
      "1. Phương án trang trí, layout bàn tiệc, kịch bản, danh sách nghi thức và timeline cần được khách hàng phê duyệt trước ngày cưới tối thiểu 07 ngày.",
      "2. Thay đổi số lượng khách/bàn tiệc cần thông báo theo thời hạn của địa điểm hoặc nhà cung cấp catering; thay đổi muộn có thể phát sinh chi phí.",
      "3. Hoa tươi, vật liệu trang trí và màu sắc thực tế có thể chênh lệch nhẹ do mùa vụ, nguồn cung và điều kiện ánh sáng tại địa điểm.",
      "4. Khách hàng chịu trách nhiệm xin phép địa điểm đối với các hạng mục đặc biệt như pháo kim tuyến, khói lạnh, confetti, nến, vật treo hoặc setup ngoài quy định.",
      "5. NiChan được quyền điều chỉnh phương án vận hành tại hiện trường nếu cần để bảo đảm an toàn, tiến độ và trải nghiệm khách mời.",
    ),
  },
  {
    id: "birthday",
    label: "Sinh nhật",
    scopeText: termsText(
      "1. NiChan tư vấn chủ đề sinh nhật, phong cách trang trí, màu sắc, khu vực check-in, bàn gallery và các hoạt động phù hợp với nhân vật chính.",
      "2. NiChan triển khai backdrop, trang trí không gian, bánh/tea break, MC hoặc hoạt náo, âm thanh cơ bản, chụp ảnh và điều phối chương trình theo bảng báo giá.",
      "3. NiChan chuẩn bị timeline đón khách, khai tiệc, thổi nến, trò chơi/giao lưu, chụp ảnh lưu niệm và hỗ trợ gia đình trong quá trình tổ chức.",
      "4. Các yêu cầu cá nhân hóa như tên, tuổi, hình ảnh, mascot, quà tặng hoặc tiết mục bất ngờ được thực hiện theo nội dung khách hàng cung cấp và duyệt trước.",
      "5. Hạng mục phát sinh về số lượng khách, đồ ăn, quà tặng, trang trí bổ sung hoặc kéo dài thời lượng sẽ được xác nhận và báo giá riêng.",
    ),
    paymentTerms: termsText(
      "1. Đợt 1: Thanh toán 50% giá trị hợp đồng sau khi ký để NiChan giữ lịch, thiết kế chủ đề và đặt các hạng mục trang trí/catering.",
      "2. Đợt 2: Thanh toán 30% chậm nhất 05 ngày trước sự kiện để hoàn tất sản xuất vật phẩm cá nhân hóa, chuẩn bị nhân sự và đặt hàng dịch vụ.",
      "3. Đợt 3: Thanh toán 20% còn lại trong vòng 02 ngày sau sự kiện sau khi nghiệm thu các hạng mục đã thực hiện.",
      "4. Các hạng mục cá nhân hóa hoặc đặt mua riêng theo yêu cầu có thể cần thanh toán trước 100% tại thời điểm xác nhận.",
    ),
    generalTerms: termsText(
      "1. Khách hàng cung cấp tên, tuổi, hình ảnh, danh sách khách, yêu cầu màu sắc/chủ đề và nội dung cá nhân hóa trước ngày tổ chức tối thiểu 05 ngày.",
      "2. Các vật phẩm in ấn, bánh, quà tặng hoặc đạo cụ cá nhân hóa sau khi đã sản xuất không thể hủy hoặc thay đổi miễn phí.",
      "3. Trường hợp sự kiện tổ chức tại nhà riêng/căn hộ/nhà hàng, khách hàng hỗ trợ quyền ra vào, khu vực setup, thang máy, điện nước và quy định của địa điểm.",
      "4. NiChan không chịu trách nhiệm với các sự cố do khách mời tự ý di chuyển, tháo lắp hoặc sử dụng sai mục đích đồ trang trí/thiết bị.",
      "5. Thời gian setup và tháo dỡ được thực hiện theo khung giờ địa điểm cho phép; phát sinh ngoài khung giờ có thể tính thêm chi phí nhân sự.",
    ),
  },
  {
    id: "anniversary",
    label: "Kỷ niệm",
    scopeText: termsText(
      "1. NiChan tư vấn chủ đề kỷ niệm, thông điệp chương trình, timeline nghi thức, phát biểu, vinh danh và các điểm nhấn cảm xúc.",
      "2. NiChan triển khai sân khấu, backdrop, khu vực check-in, âm thanh ánh sáng, trình chiếu hình ảnh/video, MC, tiết mục biểu diễn và nhân sự điều phối theo báo giá.",
      "3. NiChan phối hợp chuẩn bị nội dung vinh danh, kịch bản trao quà/tri ân, thứ tự đại biểu, cue âm thanh ánh sáng và luồng di chuyển trên sân khấu.",
      "4. Tư liệu hình ảnh, logo, danh sách khách mời, bài phát biểu và nội dung trình chiếu do khách hàng cung cấp và chịu trách nhiệm về tính chính xác.",
      "5. Các hạng mục truyền thông, quay phim, chụp ảnh, dựng highlight hoặc quà lưu niệm được bàn giao theo phạm vi đã thống nhất.",
    ),
    paymentTerms: termsText(
      "1. Đợt 1: Thanh toán 50% giá trị hợp đồng sau khi ký để bắt đầu xây dựng kịch bản, thiết kế nhận diện và đặt lịch nhà cung cấp.",
      "2. Đợt 2: Thanh toán 30% chậm nhất 07 ngày trước chương trình để hoàn tất sản xuất backdrop, tư liệu trình chiếu, thiết bị và nhân sự.",
      "3. Đợt 3: Thanh toán 20% còn lại trong vòng 03 ngày sau khi nghiệm thu chương trình và bàn giao các sản phẩm hậu kỳ nếu có.",
      "4. Hạng mục quà tặng, cúp vinh danh, in ấn hoặc sản xuất vật phẩm theo yêu cầu có thể cần đặt cọc/thanh toán trước theo báo giá nhà cung cấp.",
    ),
    generalTerms: termsText(
      "1. Nội dung phát biểu, danh sách vinh danh, logo, hình ảnh, video và thông tin doanh nghiệp cần được khách hàng phê duyệt cuối trước chương trình tối thiểu 05 ngày.",
      "2. Mọi thay đổi về thứ tự nghi thức, danh sách vinh danh hoặc đại biểu sau khi đã chốt kịch bản có thể ảnh hưởng đến timeline và chi phí vận hành.",
      "3. Khách hàng chịu trách nhiệm bản quyền đối với hình ảnh, âm nhạc, video hoặc nội dung nội bộ cung cấp cho chương trình.",
      "4. NiChan được quyền điều chỉnh kỹ thuật trình chiếu/âm thanh ánh sáng tại hiện trường để phù hợp điều kiện thực tế và an toàn vận hành.",
      "5. Các sản phẩm hậu kỳ được chỉnh sửa theo số vòng góp ý đã thống nhất; yêu cầu chỉnh sửa vượt phạm vi có thể phát sinh chi phí.",
    ),
  },
  {
    id: "conference",
    label: "Hội nghị & hội thảo",
    scopeText: termsText(
      "1. NiChan tư vấn mô hình hội nghị/hội thảo, layout phòng, sơ đồ chỗ ngồi, luồng check-in, timeline nội dung và phương án kỹ thuật.",
      "2. NiChan triển khai địa điểm/setup phòng, thiết bị trình chiếu, âm thanh, micro, lễ tân, tài liệu, bảng tên, tea break, livestream/ghi hình và nhân sự vận hành theo báo giá.",
      "3. NiChan phối hợp với diễn giả, đại diện khách hàng, địa điểm và đội kỹ thuật để kiểm tra file trình chiếu, rehearsal, cue chương trình và hỗ trợ khách tham dự.",
      "4. Danh sách khách, nội dung tài liệu, slide, kịch bản phát biểu và yêu cầu bảo mật thông tin do khách hàng cung cấp đúng hạn.",
      "5. Các thay đổi về số lượng khách, thiết bị, thời lượng phiên họp, phiên song song hoặc yêu cầu hybrid/online sẽ được xác nhận và báo giá bổ sung nếu phát sinh.",
    ),
    paymentTerms: termsText(
      "1. Đợt 1: Thanh toán 50% giá trị hợp đồng sau khi ký để giữ địa điểm, đặt thiết bị, nhân sự và bắt đầu chuẩn bị tài liệu.",
      "2. Đợt 2: Thanh toán 30% chậm nhất 07 ngày trước sự kiện để hoàn tất chi phí địa điểm, tea break/catering và kỹ thuật.",
      "3. Đợt 3: Thanh toán 20% còn lại trong vòng 03 ngày sau khi nghiệm thu chương trình, đối soát số lượng khách thực tế và các phát sinh nếu có.",
      "4. Chi phí địa điểm, dịch thuật, phiên dịch, thiết bị chuyên dụng hoặc nền tảng trực tuyến có thể áp dụng điều kiện thanh toán riêng theo nhà cung cấp.",
    ),
    generalTerms: termsText(
      "1. Khách hàng cung cấp nội dung chương trình, danh sách khách, tài liệu, slide, yêu cầu bảo mật và thông tin diễn giả trước sự kiện tối thiểu 05 ngày.",
      "2. File trình chiếu, video, âm thanh và thiết bị cá nhân của diễn giả cần được kiểm tra kỹ thuật trước chương trình theo lịch rehearsal.",
      "3. Số lượng khách thực tế vượt số lượng đã chốt có thể phát sinh chi phí tea break, ghế ngồi, tài liệu, nhân sự và thiết bị bổ sung.",
      "4. Đối với hội nghị/hội thảo trực tuyến hoặc hybrid, chất lượng truyền dẫn phụ thuộc vào đường truyền internet, nền tảng sử dụng và thiết bị đầu cuối của người tham dự.",
      "5. Nội dung chuyên môn, phát ngôn của diễn giả và tài liệu do khách hàng cung cấp thuộc trách nhiệm của khách hàng.",
    ),
  },
  {
    id: "groundbreaking",
    label: "Động thổ & khởi công",
    scopeText: termsText(
      "1. NiChan khảo sát mặt bằng, tư vấn layout khu nghi lễ, khu đại biểu, khu đón khách, lối di chuyển, vị trí sân khấu, nhà bạt và khu vực động thổ/khởi công.",
      "2. NiChan triển khai nhà bạt, sân khấu, backdrop, thảm, bàn ghế, âm thanh ngoài trời, bộ nghi thức, lễ tân, điều phối đại biểu và nhân sự kỹ thuật theo báo giá.",
      "3. NiChan xây dựng timeline nghi lễ, cue phát biểu, nghi thức xúc cát/cắt băng/khởi công và phương án điều phối khách mời tại công trường.",
      "4. Khách hàng cung cấp giấy phép, quyền sử dụng mặt bằng, nguồn điện/nước, phương án an ninh, an toàn lao động và danh sách đại biểu đúng thời hạn.",
      "5. Các hạng mục phát sinh do điều kiện mặt bằng, thời tiết, yêu cầu an toàn, thay đổi quy mô hoặc bổ sung thiết bị sẽ được xác nhận và báo giá riêng.",
    ),
    paymentTerms: termsText(
      "1. Đợt 1: Thanh toán 60% giá trị hợp đồng sau khi ký để đặt nhà bạt, thiết bị, vật tư nghi lễ và nhân sự thi công.",
      "2. Đợt 2: Thanh toán 30% chậm nhất 05 ngày trước ngày tổ chức hoặc trước thời điểm bắt đầu thi công setup tại mặt bằng.",
      "3. Đợt 3: Thanh toán 10% còn lại trong vòng 03 ngày sau khi hoàn tất tháo dỡ, nghiệm thu và đối soát phát sinh nếu có.",
      "4. Các chi phí xin phép, bảo vệ, điện công suất lớn, xe nâng/cẩu, gia cố mặt bằng hoặc thiết bị an toàn đặc biệt do khách hàng thanh toán hoặc được báo giá riêng.",
    ),
    generalTerms: termsText(
      "1. Khách hàng chịu trách nhiệm bảo đảm pháp lý, quyền sử dụng mặt bằng, an toàn công trường và các giấy phép cần thiết cho việc tổ chức.",
      "2. NiChan có quyền điều chỉnh setup hoặc tạm dừng thi công nếu điều kiện mặt bằng, thời tiết, nguồn điện hoặc an toàn lao động không bảo đảm.",
      "3. Các hạng mục ngoài trời có thể chịu ảnh hưởng bởi mưa, gió, nền đất, bụi công trường hoặc điều kiện thi công; hai bên thống nhất phương án dự phòng trước sự kiện.",
      "4. Thiết bị, nhà bạt, sân khấu và vật tư phải được bảo vệ trong thời gian lưu tại công trường; mất mát/hư hỏng do bên thứ ba hoặc khách hàng quản lý sẽ được bồi hoàn theo thực tế.",
      "5. Thay đổi vị trí setup, thời gian thi công hoặc quy mô sau khi đã khảo sát có thể phát sinh chi phí nhân sự, vận chuyển và vật tư.",
    ),
  },
  {
    id: "opening",
    label: "Khai trương",
    scopeText: termsText(
      "1. NiChan tư vấn concept khai trương, layout cổng chào/backdrop/check-in, timeline nghi thức, hoạt động thu hút khách và điểm nhấn thương hiệu.",
      "2. NiChan triển khai cổng chào, backdrop, standee, âm thanh ánh sáng, nghi thức cắt băng, múa lân/tiết mục chào mừng, lễ tân, chụp ảnh/quay phim và điều phối chương trình theo báo giá.",
      "3. NiChan phối hợp với địa điểm, đội vận hành cửa hàng/showroom và đại diện khách hàng để bảo đảm setup không ảnh hưởng hoạt động kinh doanh.",
      "4. Nội dung thương hiệu, logo, thông điệp, danh sách đại biểu, quà tặng và ưu đãi khai trương do khách hàng cung cấp và phê duyệt trước.",
      "5. Hạng mục phát sinh như roadshow, KOL/KOC, truyền thông, livestream, sampling, quà tặng hoặc kéo dài thời lượng sẽ được xác nhận và báo giá bổ sung.",
    ),
    paymentTerms: termsText(
      "1. Đợt 1: Thanh toán 50% giá trị hợp đồng sau khi ký để giữ lịch, thiết kế nhận diện và đặt các hạng mục sản xuất/biểu diễn.",
      "2. Đợt 2: Thanh toán 30% chậm nhất 05 ngày trước ngày khai trương để hoàn tất vật tư, nhân sự, thiết bị và tiết mục.",
      "3. Đợt 3: Thanh toán 20% còn lại trong vòng 03 ngày sau chương trình sau khi nghiệm thu và đối soát phát sinh.",
      "4. Các hạng mục truyền thông, KOL/KOC, booking nghệ sĩ hoặc vật phẩm quà tặng có thể cần thanh toán trước theo điều kiện của nhà cung cấp.",
    ),
    generalTerms: termsText(
      "1. Khách hàng cung cấp logo, guideline thương hiệu, thông điệp, danh sách khách mời và yêu cầu địa điểm trước ngày tổ chức tối thiểu 05 ngày.",
      "2. Khách hàng chịu trách nhiệm xin phép địa điểm/chính quyền nếu có hoạt động ngoài trời, âm thanh lớn, múa lân, roadshow hoặc chiếm dụng không gian công cộng.",
      "3. Thời gian setup/tháo dỡ phải phù hợp với quy định tòa nhà, trung tâm thương mại, showroom hoặc cửa hàng; phát sinh ngoài khung giờ có thể tính thêm chi phí.",
      "4. Các hoạt động khuyến mãi, sampling, quà tặng và thông tin thương mại do khách hàng chịu trách nhiệm pháp lý.",
      "5. NiChan có quyền điều chỉnh cue chương trình tại hiện trường để bảo đảm an toàn, hình ảnh thương hiệu và trải nghiệm khách mời.",
    ),
  },
  {
    id: "inauguration",
    label: "Khánh thành",
    scopeText: termsText(
      "1. NiChan tư vấn kịch bản khánh thành, nghi thức cắt băng/mở bảng, layout sân khấu, khu đại biểu, khu đón khách và luồng tham quan công trình.",
      "2. NiChan triển khai sân khấu, backdrop, thảm đỏ, âm thanh ánh sáng, bộ nghi thức, lễ tân, quà lưu niệm, chụp ảnh/quay phim và nhân sự điều phối theo báo giá.",
      "3. NiChan phối hợp chuẩn bị thứ tự đại biểu, cue phát biểu, nghi thức, hướng dẫn khách mời và phương án vận hành tại khu vực công trình.",
      "4. Khách hàng cung cấp thông tin công trình, danh sách đại biểu, logo, bài phát biểu, giấy phép và quy định an toàn của địa điểm.",
      "5. Các hạng mục phát sinh như tham quan công trình, tiệc nhẹ, truyền thông báo chí, bảo vệ, xe điện/xe đưa đón hoặc thiết bị đặc biệt được xác nhận riêng.",
    ),
    paymentTerms: termsText(
      "1. Đợt 1: Thanh toán 50% giá trị hợp đồng sau khi ký để giữ lịch, thiết kế nhận diện và đặt các hạng mục nghi thức/thiết bị.",
      "2. Đợt 2: Thanh toán 30% chậm nhất 07 ngày trước ngày khánh thành để hoàn tất sản xuất, vận chuyển, nhân sự và thiết bị.",
      "3. Đợt 3: Thanh toán 20% còn lại trong vòng 03 ngày sau khi nghiệm thu chương trình và bàn giao sản phẩm hậu kỳ nếu có.",
      "4. Chi phí phát sinh về an ninh, giấy phép, thiết bị ngoài trời, gia cố mặt bằng hoặc truyền thông báo chí được thanh toán theo báo giá bổ sung.",
    ),
    generalTerms: termsText(
      "1. Khách hàng chịu trách nhiệm bảo đảm địa điểm đủ điều kiện tổ chức, an toàn cho khách mời và có các giấy phép cần thiết.",
      "2. Danh sách đại biểu, nghi thức, bài phát biểu, nội dung bảng tên/cắt băng và logo cần được phê duyệt cuối trước chương trình tối thiểu 05 ngày.",
      "3. NiChan có quyền điều chỉnh layout hoặc timeline nếu điều kiện công trình, thời tiết, an ninh hoặc yêu cầu kỹ thuật thay đổi.",
      "4. Khách hàng chịu trách nhiệm với nội dung công bố, thông tin công trình, tài liệu truyền thông và phát ngôn của đại diện khách mời.",
      "5. Thiết bị/vật tư lưu tại công trình cần được bảo vệ; mất mát/hư hỏng ngoài phạm vi kiểm soát của NiChan sẽ được bồi hoàn theo giá trị thực tế.",
    ),
  },
  {
    id: "gala",
    label: "Gala Dinner",
    scopeText: termsText(
      "1. NiChan tư vấn concept Gala Dinner, kịch bản tổng thể, nghi thức khai tiệc, phần vinh danh/tri ân, tiết mục biểu diễn và hoạt động tương tác khách mời.",
      "2. NiChan triển khai sân khấu, backdrop/photobooth, LED, âm thanh ánh sáng, MC, nghệ sĩ/tiết mục, banquet, lễ tân, chụp ảnh/quay phim và điều phối chương trình theo báo giá.",
      "3. NiChan phối hợp với khách hàng để chuẩn bị danh sách khách VIP, kịch bản trao giải, slide vinh danh, âm nhạc, video, quà tặng và timeline phục vụ tiệc.",
      "4. Nội dung thương hiệu, danh sách vinh danh, hình ảnh, video, thông điệp tri ân và quà tặng do khách hàng cung cấp, NiChan hỗ trợ sắp xếp vào flow chương trình.",
      "5. Các hạng mục phát sinh như nâng cấp nghệ sĩ, mở rộng sân khấu, tăng số khách, bổ sung tiệc/đồ uống, livestream hoặc truyền thông được xác nhận và báo giá riêng.",
    ),
    paymentTerms: termsText(
      "1. Đợt 1: Thanh toán 50% giá trị hợp đồng sau khi ký để giữ lịch, booking địa điểm/nhà cung cấp/nghệ sĩ và bắt đầu thiết kế concept.",
      "2. Đợt 2: Thanh toán 30% chậm nhất 10 ngày trước chương trình để hoàn tất chi phí sản xuất sân khấu, thiết bị, nhân sự, banquet và biểu diễn.",
      "3. Đợt 3: Thanh toán 20% còn lại trong vòng 03 ngày sau chương trình sau khi nghiệm thu, đối soát số lượng khách và phát sinh nếu có.",
      "4. Booking nghệ sĩ, MC, địa điểm, banquet hoặc vật phẩm sản xuất riêng có thể áp dụng điều kiện đặt cọc/thanh toán riêng theo nhà cung cấp.",
    ),
    generalTerms: termsText(
      "1. Khách hàng cung cấp danh sách khách, danh sách vinh danh, logo, guideline thương hiệu, nội dung trình chiếu và yêu cầu nghi thức trước chương trình tối thiểu 07 ngày.",
      "2. Số lượng khách chốt là cơ sở để đặt banquet, bàn ghế, nhân sự phục vụ và quà tặng; thay đổi muộn có thể phát sinh chi phí hoặc không bảo đảm đủ dịch vụ.",
      "3. Lịch rehearsal, soundcheck và setup phụ thuộc vào quy định của địa điểm; phát sinh ngoài khung giờ được phép có thể tính thêm chi phí.",
      "4. Nội dung biểu diễn, âm nhạc, hình ảnh, video và phát ngôn trên sân khấu cần phù hợp quy định pháp luật, quy định địa điểm và định hướng thương hiệu của khách hàng.",
      "5. NiChan được quyền điều chỉnh cue vận hành tại hiện trường để bảo đảm timing tiệc, an toàn kỹ thuật và trải nghiệm khách mời.",
    ),
  },
  {
    id: "year-end-party",
    label: "Year End Party",
    scopeText: termsText(
      "1. NiChan tư vấn concept Year End Party, thông điệp tổng kết năm, timeline vinh danh, game sân khấu, tiết mục biểu diễn và hoạt động gắn kết nội bộ.",
      "2. NiChan triển khai sân khấu, backdrop/photobooth, âm thanh ánh sáng/LED, MC, nghệ sĩ, game, banquet, lễ tân, chụp ảnh/quay phim và điều phối chương trình theo báo giá.",
      "3. NiChan phối hợp chuẩn bị danh sách vinh danh, kịch bản bốc thăm/trao giải, slide tổng kết, video nội bộ, quà tặng và cue sân khấu.",
      "4. Khách hàng cung cấp dữ liệu nhân sự, nội dung tổng kết, danh sách khách, cơ cấu giải thưởng, hình ảnh/video nội bộ và guideline thương hiệu đúng hạn.",
      "5. Các hạng mục phát sinh như tăng số khách, nâng cấp tiệc, thêm tiết mục, bổ sung giải thưởng/quà tặng, livestream hoặc kéo dài thời lượng sẽ được báo giá riêng.",
    ),
    paymentTerms: termsText(
      "1. Đợt 1: Thanh toán 50% giá trị hợp đồng sau khi ký để giữ lịch cao điểm cuối năm, booking địa điểm/nhà cung cấp và bắt đầu thiết kế concept.",
      "2. Đợt 2: Thanh toán 30% chậm nhất 10 ngày trước chương trình để hoàn tất sản xuất, thiết bị, banquet, nhân sự và tiết mục.",
      "3. Đợt 3: Thanh toán 20% còn lại trong vòng 03 ngày sau chương trình sau khi nghiệm thu và đối soát phát sinh.",
      "4. Vì mùa cao điểm cuối năm, các booking địa điểm, nghệ sĩ, MC, thiết bị hoặc quà tặng có thể cần đặt cọc/thanh toán trước theo điều kiện nhà cung cấp.",
    ),
    generalTerms: termsText(
      "1. Khách hàng cung cấp danh sách nhân sự/khách mời, danh sách vinh danh, cơ cấu giải thưởng, nội dung tổng kết và tư liệu trình chiếu trước chương trình tối thiểu 07 ngày.",
      "2. Số lượng khách chốt là cơ sở để đặt tiệc, bàn ghế, quà tặng và nhân sự; thay đổi sau hạn chốt có thể phát sinh chi phí hoặc không bảo đảm đủ số lượng.",
      "3. Nội dung game, bốc thăm, trao giải và truyền thông nội bộ do khách hàng phê duyệt; NiChan hỗ trợ điều phối và bảo mật thông tin theo phạm vi hợp đồng.",
      "4. Lịch setup/rehearsal phụ thuộc vào địa điểm và mùa cao điểm; khách hàng phối hợp phê duyệt kịp thời để tránh ảnh hưởng tiến độ.",
      "5. NiChan có quyền điều chỉnh timeline vận hành tại hiện trường để cân bằng phần tiệc, vinh danh, biểu diễn và hoạt động nội bộ.",
    ),
  },
];

const getContractTermsTemplateByGroupId = (groupId?: string) =>
  contractTermsTemplates.find((template) => template.id === groupId) ?? commonContractTermsTemplate;

const mergeLineItemTemplates = (templates: ContractLineItemTemplate[]) => {
  const seen = new Set<string>();
  return templates.filter((template) => {
    if (seen.has(template.id)) return false;
    seen.add(template.id);
    return true;
  });
};

const scoreTemplateGroup = (contextText: string, group: ContractLineItemTemplateGroup) => {
  const normalizedContext = normalizeText(contextText);
  return group.keywords.reduce((score, keyword) => {
    const normalizedKeyword = normalizeText(keyword);
    if (!normalizedKeyword || !normalizedContext.includes(normalizedKeyword)) return score;
    return score + (normalizedKeyword.includes(" ") ? 3 : 1);
  }, 0);
};

const getBestTemplateGroup = (contextText: string) =>
  contractLineItemTemplateGroups
    .map((group) => ({ group, score: scoreTemplateGroup(contextText, group) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.group;

const getContractTermsTemplate = (contextText: string) =>
  getContractTermsTemplateByGroupId(getBestTemplateGroup(contextText)?.id);

const getSuggestedLineItemTemplates = (contextText: string) => {
  const normalizedContext = normalizeText(contextText);
  if (!normalizedContext.trim()) return commonLineItemTemplates;

  const scoredGroups = contractLineItemTemplateGroups
    .map((group) => ({ group, score: scoreTemplateGroup(contextText, group) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scoredGroups.length === 0) return commonLineItemTemplates;

  const bestScore = scoredGroups[0].score;
  return mergeLineItemTemplates(
    scoredGroups
      .filter((item) => item.score === bestScore)
      .flatMap((item) => item.group.items),
  );
};

const findLineItemTemplateByCategory = (templates: ContractLineItemTemplate[], category: string) => {
  const normalizedCategory = normalizeText(category.trim());
  if (!normalizedCategory) return undefined;
  return templates.find((template) => normalizeText(template.category) === normalizedCategory);
};

const serviceContextText = (service?: ServiceCatalogItem | null) =>
  service
    ? [service.title, service.shortDescription, service.category?.name, service.category?.slug]
        .filter(Boolean)
        .join(" ")
    : "";

const serviceCategorySelectValue = (categoryId: string) => `${SERVICE_CATEGORY_VALUE_PREFIX}${categoryId}`;

const serviceCategoryIdFromValue = (value: string) =>
  value.startsWith(SERVICE_CATEGORY_VALUE_PREFIX)
    ? value.slice(SERVICE_CATEGORY_VALUE_PREFIX.length)
    : "";

const serviceCategoryContextText = (category?: ServiceCategoryItem | null) =>
  category
    ? [category.name, category.slug, category.description]
        .filter(Boolean)
        .join(" ")
    : "";

const findBestServiceForContext = (services: ServiceCatalogItem[], contextText: string) => {
  const normalizedContext = normalizeText(contextText);
  if (!normalizedContext.trim()) return undefined;

  const contextTokens = normalizedContext
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);

  return services
    .map((service) => {
      const normalizedService = normalizeText(serviceContextText(service));
      const directMatches = [
        normalizeText(service.title),
        normalizeText(service.category?.name ?? ""),
      ].filter(Boolean);
      const directScore =
        directMatches.some((value) => normalizedContext.includes(value)) ? 8 : 0;
      const tokenScore = contextTokens.reduce(
        (score, token) => score + (normalizedService.includes(token) ? 1 : 0),
        0,
      );
      return { service, score: directScore + tokenScore };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.service;
};

const suggestUnitForCategory = (category: string) => {
  const text = normalizeText(category);
  if (!text.trim()) return "gói";

  if (/(catering|thuc don|do an|do uong|tea break|suat|ban tiec)/.test(text)) return "suất";
  if (/(khach|ve moi|dai bieu|tham du|check-in|check in)/.test(text)) return "khách";
  if (/(nhan su|le tan|pg|pb|bao ve|an ninh|ky thuat|mc|host|nhiep anh|quay phim)/.test(text)) return "người";
  if (/(dia diem|sanh|venue|phong hop|studio|mat bang)/.test(text)) return "buổi";
  if (/(xe|van chuyen|di chuyen|logistics|roadshow)/.test(text)) return "chuyến";
  if (/(luu tru|khach san|hotel)/.test(text)) return "đêm";
  if (/(in an|qua tang|posm|thiep|badge|tai lieu|vat pham|backdrop|booth)/.test(text)) return "bộ";
  if (/(tham|vai|decal|san khau|san|dien tich|mat dung)/.test(text)) return "m2";
  if (/(thue thiet bi|loa|mic|micro|den|led|man hinh|camera|ban ghe)/.test(text)) return "cái";
  if (/(livestream|tong duyet|setup|thao do|van hanh|bieu dien|tiet muc)/.test(text)) return "buổi";

  return "gói";
};

const emptyLineItem = (): LineItemForm => ({
  category: "",
  description: "",
  unit: "gói",
  quantity: "1",
  unitPrice: "",
  note: "",
});

const settlementLineItemsFromPreview = (preview: SettlementPreview): LineItemForm[] =>
  preview.lineItems.length > 0
    ? preview.lineItems.map((item) => ({
        category: item.category ?? "",
        description: String(item.description ?? ""),
        unit: String(item.unit ?? "gói"),
        quantity: String(item.quantity ?? 1),
        unitPrice: String(item.unitPrice ?? 0),
        note: String(item.note ?? ""),
      }))
    : [emptyLineItem()];

const emptyForm = (): ContractForm => ({
  eventId: "",
  customerUserId: "",
  versionLabel: "1.0",
  totalValue: "",
  scopeText: "",
  paymentTerms: "",
  generalTerms: "",
  lineItems: [emptyLineItem()],
});

const money = (value: string | number) => Number(value || 0).toLocaleString("vi-VN") + " đ";

const toNumber = (value: string | number | null | undefined) => Number(value || 0);

const lineAmount = (item: LineItemForm | ContractLineItem) =>
  toNumber(item.quantity) * toNumber(item.unitPrice);

const roundSellingPrice = (value: number) => Math.round(value / 1000) * 1000;

const lineItemFromTemplate = (
  template: ContractLineItemTemplate,
  current?: LineItemForm,
): LineItemForm => ({
  category: template.category,
  description: template.description,
  unit: template.unit,
  quantity: current?.quantity && toNumber(current.quantity) > 0 ? current.quantity : "1",
  unitPrice: current?.unitPrice ?? "",
  note: current?.note ?? "",
});

const isEmptyLineItem = (item: LineItemForm) =>
  !item.category.trim() &&
  !item.description.trim() &&
  !item.unitPrice.trim() &&
  !item.note.trim();

const appendLineItems = (currentItems: LineItemForm[], nextItems: LineItemForm[]) =>
  currentItems.length === 1 && isEmptyLineItem(currentItems[0])
    ? nextItems
    : [...currentItems, ...nextItems];

const AdminContracts = () => {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [serviceCatalog, setServiceCatalog] = useState<ServiceCatalogItem[]>([]);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategoryItem[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState(AUTO_SERVICE_VALUE);
  const [termsTemplateId, setTermsTemplateId] = useState(AUTO_TERMS_TEMPLATE_VALUE);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<Contract | null>(null);
  const [viewItem, setViewItem] = useState<Contract | null>(null);
  const [form, setForm] = useState<ContractForm>(emptyForm);
  const [markupPercent, setMarkupPercent] = useState("30");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [settlementPreview, setSettlementPreview] = useState<SettlementPreview | null>(null);
  const [settlementLineItems, setSettlementLineItems] = useState<LineItemForm[]>([]);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [settlementCreating, setSettlementCreating] = useState(false);

  const quoteTotal = useMemo(
    () => form.lineItems.reduce((sum, item) => sum + lineAmount(item), 0),
    [form.lineItems],
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === form.eventId),
    [form.eventId, projects],
  );

  const projectContextText = useMemo(
    () =>
      [
        selectedProject?.name,
        selectedProject?.type,
        selectedProject?.consultationRequest?.eventType,
        selectedProject?.consultationRequest?.note,
        editItem?.event?.name,
        editItem?.event?.type,
        editItem?.event?.consultationRequest?.eventType,
        editItem?.event?.consultationRequest?.note,
        settlementPreview?.eventName,
      ]
        .filter(Boolean)
        .join(" "),
    [editItem, selectedProject, settlementPreview],
  );

  const inferredService = useMemo(
    () => findBestServiceForContext(serviceCatalog, projectContextText),
    [projectContextText, serviceCatalog],
  );

  const selectedService = useMemo(
    () =>
      selectedServiceId === AUTO_SERVICE_VALUE || selectedServiceId.startsWith(SERVICE_CATEGORY_VALUE_PREFIX)
        ? inferredService
        : serviceCatalog.find((service) => service.id === selectedServiceId),
    [inferredService, selectedServiceId, serviceCatalog],
  );

  const selectedServiceCategory = useMemo(
    () =>
      serviceCategories.find(
        (category) => category.id === serviceCategoryIdFromValue(selectedServiceId),
      ),
    [selectedServiceId, serviceCategories],
  );

  const lineItemContextText = [
    projectContextText,
    selectedServiceId === AUTO_SERVICE_VALUE
      ? ""
      : serviceCategoryContextText(selectedServiceCategory) || serviceContextText(selectedService),
  ]
    .filter(Boolean)
    .join(" ");

  const suggestedTemplateGroup = useMemo(
    () => getBestTemplateGroup(lineItemContextText),
    [lineItemContextText],
  );

  const suggestedLineItemTemplates = useMemo(
    () => getSuggestedLineItemTemplates(lineItemContextText),
    [lineItemContextText],
  );

  const lineItemTemplateOptions = useMemo(
    () => mergeLineItemTemplates([...suggestedLineItemTemplates, ...commonLineItemTemplates]),
    [suggestedLineItemTemplates],
  );

  const lineItemContextLabel =
    selectedServiceId !== AUTO_SERVICE_VALUE && selectedServiceCategory
      ? selectedServiceCategory.name
      : selectedServiceId !== AUTO_SERVICE_VALUE && selectedService
        ? selectedService.title
      : suggestedTemplateGroup?.label ??
        inferredService?.title ??
        selectedProject?.consultationRequest?.eventType ??
        selectedProject?.type ??
        editItem?.event?.type ??
        "Dịch vụ chung";
  const autoServiceLabel = `Theo dự án - ${lineItemContextLabel}`;
  const selectedServiceLabel =
    selectedServiceId === AUTO_SERVICE_VALUE
      ? autoServiceLabel
      : selectedServiceCategory?.name ?? selectedService?.title ?? "Chọn dịch vụ";
  const selectedTermsTemplate = useMemo(() => {
    if (termsTemplateId === MANUAL_TERMS_TEMPLATE_VALUE) return null;
    if (termsTemplateId === AUTO_TERMS_TEMPLATE_VALUE) {
      return getContractTermsTemplate(lineItemContextText);
    }
    return getContractTermsTemplateByGroupId(termsTemplateId);
  }, [lineItemContextText, termsTemplateId]);
  const selectedTermsTemplateLabel =
    termsTemplateId === MANUAL_TERMS_TEMPLATE_VALUE
      ? "Nhập tay"
      : termsTemplateId === AUTO_TERMS_TEMPLATE_VALUE
        ? `Tự động - ${selectedTermsTemplate?.label ?? lineItemContextLabel}`
        : selectedTermsTemplate?.label ?? "Chọn mẫu";

  const loadContracts = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<Contract[]>("/admin/contracts", {
        search,
        status: filterStatus === "all" ? undefined : filterStatus,
        pageSize: 100,
      });
      setContracts(data);
    } catch (error) {
      toast.error("Không tải được danh sách hợp đồng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadContracts();
  }, [search, filterStatus]);

  const loadProjects = async () => {
    try {
      const data = await apiClient.get<Project[]>("/admin/projects", { pageSize: 100 });
      setProjects(data);
    } catch (error) {
      toast.error("Không tải được danh sách dự án");
    }
  };

  const loadServices = async () => {
    if ((serviceCatalog.length > 0 && serviceCategories.length > 0) || servicesLoading) return;

    setServicesLoading(true);
    try {
      const [services, categories] = await Promise.all([
        apiClient.get<ServiceCatalogItem[]>("/admin/content/services", {
          active: true,
          pageSize: 100,
        }),
        apiClient.get<ServiceCategoryItem[]>("/admin/content/service-categories"),
      ]);
      setServiceCatalog(services);
      setServiceCategories(categories.filter((category) => category.isActive !== false));
    } catch (error) {
      toast.error("Không tải được danh sách dịch vụ gợi ý");
    } finally {
      setServicesLoading(false);
    }
  };

  const loadBudgetItems = async (eventId: string) => {
    if (!eventId) {
      setBudgetItems([]);
      return;
    }

    setBudgetLoading(true);
    try {
      const data = await apiClient.get<BudgetResponse>(`/organizer/budgets/${eventId}`);
      setBudgetItems(data.items ?? []);
    } catch (error) {
      setBudgetItems([]);
      toast.error("Không tải được ngân sách nội bộ của dự án");
    } finally {
      setBudgetLoading(false);
    }
  };

  const openCreate = () => {
    setForm(emptyForm());
    setBudgetItems([]);
    setSelectedServiceId(AUTO_SERVICE_VALUE);
    setTermsTemplateId(AUTO_TERMS_TEMPLATE_VALUE);
    setCreateOpen(true);
    void loadProjects();
    void loadServices();
  };

  const selectProject = (eventId: string) => {
    const project = projects.find((item) => item.id === eventId);
    setForm((current) => ({
      ...current,
      eventId,
      customerUserId: project?.customerUser?.id ?? "",
    }));
    setSelectedServiceId(AUTO_SERVICE_VALUE);
    setTermsTemplateId(AUTO_TERMS_TEMPLATE_VALUE);
    void loadServices();
    void loadBudgetItems(eventId);
  };

  const updateLineItem = (index: number, patch: Partial<LineItemForm>) => {
    setForm((current) => ({
      ...current,
      lineItems: current.lineItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  };

  const updateLineItemCategory = (index: number, category: string) => {
    setForm((current) => ({
      ...current,
      lineItems: current.lineItems.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const matchedTemplate = findLineItemTemplateByCategory(lineItemTemplateOptions, category);
        const suggestedUnit = suggestUnitForCategory(category);
        const shouldAutoUpdateUnit = !item.unit || item.unit === "gói" || item.unit === suggestUnitForCategory(item.category);
        const descriptionLooksAuto =
          !item.description.trim() ||
          lineItemTemplateOptions.some(
            (template) => normalizeText(template.description) === normalizeText(item.description),
          );
        return {
          ...item,
          category,
          description: matchedTemplate && descriptionLooksAuto ? matchedTemplate.description : item.description,
          unit: shouldAutoUpdateUnit ? matchedTemplate?.unit ?? suggestedUnit : item.unit,
        };
      }),
    }));
  };

  const applyLineItemTemplate = (index: number, templateId: string) => {
    if (templateId === MANUAL_TEMPLATE_VALUE) return;

    const template = lineItemTemplateOptions.find((item) => item.id === templateId);
    if (!template) return;

    setForm((current) => ({
      ...current,
      lineItems: current.lineItems.map((item, itemIndex) =>
        itemIndex === index ? lineItemFromTemplate(template, item) : item,
      ),
    }));
  };

  const selectedLineItemTemplateValue = (item: LineItemForm) => {
    const matchedTemplate = findLineItemTemplateByCategory(lineItemTemplateOptions, item.category);
    if (!matchedTemplate) return MANUAL_TEMPLATE_VALUE;

    const descriptionIsTemplate =
      !item.description.trim() ||
      normalizeText(item.description) === normalizeText(matchedTemplate.description);
    return descriptionIsTemplate ? matchedTemplate.id : MANUAL_TEMPLATE_VALUE;
  };

  const addLineItem = () => {
    setForm((current) => ({ ...current, lineItems: [...current.lineItems, emptyLineItem()] }));
  };

  const removeLineItem = (index: number) => {
    setForm((current) => ({
      ...current,
      lineItems:
        current.lineItems.length === 1
          ? [emptyLineItem()]
          : current.lineItems.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const importBudgetAsQuote = () => {
    if (budgetItems.length === 0) {
      toast.error("Dự án chưa có hạng mục ngân sách để nhập");
      return;
    }

    const markup = Number(markupPercent || 0);
    const multiplier = 1 + markup / 100;
    const nextItems = budgetItems.map((item) => {
      const template = findLineItemTemplateByCategory(lineItemTemplateOptions, item.category);
      return {
        category: item.category,
        description: template?.description ?? "",
        unit: template?.unit ?? suggestUnitForCategory(item.category),
        quantity: "1",
        unitPrice: String(roundSellingPrice(toNumber(item.estimatedAmount) * multiplier)),
        note: "",
      };
    });

    setForm((current) => ({
      ...current,
      lineItems: appendLineItems(current.lineItems, nextItems),
    }));
    toast.success(`Đã thêm ${nextItems.length} hạng mục từ ngân sách nội bộ`);
  };

  const applySuggestedLineItems = () => {
    const templates = lineItemTemplateOptions.length > 0
      ? lineItemTemplateOptions
      : commonLineItemTemplates;

    setForm((current) => ({
      ...current,
      lineItems: appendLineItems(
        current.lineItems,
        templates.map((template) => lineItemFromTemplate(template)),
      ),
    }));
    toast.success(`Đã thêm ${templates.length} hạng mục cho ${lineItemContextLabel}`);
  };

  const applyTermsTemplate = () => {
    if (!selectedTermsTemplate) {
      toast.error("Vui lòng chọn một mẫu điều khoản hoặc nhập tay bên dưới");
      return;
    }

    setForm((current) => ({
      ...current,
      scopeText: selectedTermsTemplate.scopeText,
      paymentTerms: selectedTermsTemplate.paymentTerms,
      generalTerms: selectedTermsTemplate.generalTerms,
    }));
    toast.success(`Đã áp dụng điều khoản mẫu ${selectedTermsTemplate.label}`);
  };

  const normalizedLineItems = (items = form.lineItems) =>
    items
      .map((item) => ({
        category: item.category.trim(),
        description: item.description.trim() || null,
        unit: item.unit.trim() || null,
        quantity: toNumber(item.quantity),
        unitPrice: toNumber(item.unitPrice),
        note: item.note.trim() || null,
      }))
      .filter((item) => item.category && item.quantity > 0 && item.unitPrice > 0);

  const validateForm = (mode: "create" | "edit") => {
    if (!form.eventId || !form.customerUserId) {
      toast.error("Vui lòng chọn dự án/sự kiện");
      return false;
    }

    if (mode === "create" && toNumber(form.totalValue) <= 0) {
      toast.error("Tổng giá trị hợp đồng phải lớn hơn 0");
      return false;
    }

    if (mode === "edit" && (quoteTotal <= 0 || normalizedLineItems().length === 0)) {
      toast.error("Tổng giá trị hợp đồng phải lớn hơn 0");
      return false;
    }

    if (!form.scopeText.trim() || !form.paymentTerms.trim() || !form.generalTerms.trim()) {
      toast.error("Vui lòng nhập đầy đủ phạm vi, thanh toán và điều khoản chung");
      return false;
    }

    return true;
  };

  const handleCreate = async () => {
    if (!validateForm("create")) return;

    setSaving(true);
    try {
      await apiClient.post("/admin/contracts", {
        eventId: form.eventId,
        customerUserId: form.customerUserId,
        totalValue: toNumber(form.totalValue),
        versionLabel: form.versionLabel || "1.0",
        scopeText: form.scopeText,
        paymentTerms: form.paymentTerms,
        generalTerms: form.generalTerms,
      });
      toast.success("Đã tạo hợp đồng");
      setCreateOpen(false);
      setForm(emptyForm());
      await loadContracts();
    } catch (error) {
      toast.error("Tạo hợp đồng thất bại");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = async (contract: Contract) => {
    try {
      const detail = await apiClient.get<Contract>(`/admin/contracts/${contract.id}`);
      const latest = detail.versions?.[0];
      const lineItems = latest?.lineItems?.length
        ? latest.lineItems.map((item) => ({
            category: item.category ?? "",
            description: item.description ?? "",
            unit: item.unit ?? "gói",
            quantity: String(item.quantity ?? 1),
            unitPrice: String(item.unitPrice ?? 0),
            note: item.note ?? "",
          }))
        : [{
            ...emptyLineItem(),
            category: "Dịch vụ tổ chức sự kiện",
            unitPrice: String(detail.totalValue ?? ""),
          }];

      setForm({
        eventId: detail.event?.id ?? "",
        customerUserId: detail.customerUser?.id ?? "",
        versionLabel: detail.currentVersion ?? "1.0",
        totalValue: String(detail.totalValue ?? ""),
        scopeText: latest?.scopeText ?? "",
        paymentTerms: latest?.paymentTerms ?? "",
        generalTerms: latest?.generalTerms ?? "",
        lineItems,
      });
      setEditItem(detail);
      setSelectedServiceId(AUTO_SERVICE_VALUE);
      setTermsTemplateId(AUTO_TERMS_TEMPLATE_VALUE);
      void loadServices();
      void loadBudgetItems(detail.event?.id ?? "");
    } catch (error) {
      toast.error("Không tải được chi tiết hợp đồng");
    }
  };

  const handleEdit = async () => {
    if (!editItem || !validateForm("edit")) return;

    setSaving(true);
    try {
      await apiClient.put(`/admin/contracts/${editItem.id}`, {
        totalValue: quoteTotal,
        versionLabel: form.versionLabel,
        scopeText: form.scopeText,
        paymentTerms: form.paymentTerms,
        generalTerms: form.generalTerms,
        lineItems: normalizedLineItems(),
      });
      toast.success("Đã cập nhật hợp đồng");
      setEditItem(null);
      await loadContracts();
    } catch (error) {
      toast.error("Cập nhật hợp đồng thất bại");
    } finally {
      setSaving(false);
    }
  };

  const openView = async (contract: Contract) => {
    setViewItem(contract);
    try {
      const detail = await apiClient.get<Contract>(`/admin/contracts/${contract.id}`);
      setViewItem(detail);
    } catch (error) {
      // Giữ dữ liệu đang có trên dòng bảng.
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.del(`/admin/contracts/${id}`);
      toast.success("Đã xóa hợp đồng");
      await loadContracts();
    } catch (error) {
      toast.error("Xóa hợp đồng thất bại");
    }
  };

  const handleSend = async (contract: Contract) => {
    const isResend = contract.status === "sent" && !!contract.rejectionNote;
    if (isResend && !confirm(`Khách hàng đã từ chối hợp đồng ${contract.contractCode}. Bạn muốn gửi lại?`)) return;
    try {
      await apiClient.patch(`/admin/contracts/${contract.id}/send`);
      toast.success(isResend ? `Đã gửi lại hợp đồng ${contract.contractCode}` : `Đã gửi hợp đồng ${contract.contractCode}`);
      await loadContracts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gửi hợp đồng thất bại");
    }
  };

  const handleCancel = async (contract: Contract) => {
    if (!confirm(`Bạn chắc chắn muốn hủy hợp đồng ${contract.contractCode}? Các phiếu thanh toán chờ xử lý sẽ bị hủy theo.`)) return;
    try {
      await apiClient.patch(`/admin/contracts/${contract.id}/cancel`);
      toast.success(`Đã hủy hợp đồng ${contract.contractCode}`);
      await loadContracts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Hủy hợp đồng thất bại");
    }
  };

  const openSettlementPreview = async (contract: Contract) => {
    setSettlementLoading(true);
    setSelectedServiceId(AUTO_SERVICE_VALUE);
    void loadServices();
    try {
      const preview = await apiClient.get<SettlementPreview>(
        `/admin/contracts/${contract.id}/settlement-preview`,
      );
      setSettlementPreview(preview);
      setSettlementLineItems(settlementLineItemsFromPreview(preview));
    } catch (error) {
      toast.error("Không tải được dữ liệu quyết toán. Hãy kiểm tra budget đã có chi phí thực tế chưa.");
    } finally {
      setSettlementLoading(false);
    }
  };

  const settlementTotal = useMemo(
    () => settlementLineItems.reduce((sum, item) => sum + toNumber(item.quantity) * toNumber(item.unitPrice), 0),
    [settlementLineItems],
  );

  const updateSettlementItem = (index: number, patch: Partial<LineItemForm>) => {
    setSettlementLineItems((items) =>
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const updateSettlementItemCategory = (index: number, category: string) => {
    setSettlementLineItems((items) =>
      items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const matchedTemplate = findLineItemTemplateByCategory(lineItemTemplateOptions, category);
        const suggestedUnit = suggestUnitForCategory(category);
        const shouldAutoUpdateUnit = !item.unit || item.unit === "gói" || item.unit === suggestUnitForCategory(item.category);
        const descriptionLooksAuto =
          !item.description.trim() ||
          lineItemTemplateOptions.some(
            (template) => normalizeText(template.description) === normalizeText(item.description),
          );
        return {
          ...item,
          category,
          description: matchedTemplate && descriptionLooksAuto ? matchedTemplate.description : item.description,
          unit: shouldAutoUpdateUnit ? matchedTemplate?.unit ?? suggestedUnit : item.unit,
        };
      }),
    );
  };

  const applySettlementLineItemTemplate = (index: number, templateId: string) => {
    if (templateId === MANUAL_TEMPLATE_VALUE) return;

    const template = lineItemTemplateOptions.find((item) => item.id === templateId);
    if (!template) return;

    setSettlementLineItems((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? lineItemFromTemplate(template, item) : item,
      ),
    );
  };

  const addSettlementLineItem = () => {
    setSettlementLineItems((items) => [...items, emptyLineItem()]);
  };

  const removeSettlementLineItem = (index: number) => {
    setSettlementLineItems((items) =>
      items.length === 1 ? [emptyLineItem()] : items.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const applySuggestedSettlementLineItems = () => {
    const templates = lineItemTemplateOptions.length > 0
      ? lineItemTemplateOptions
      : commonLineItemTemplates;

    setSettlementLineItems((items) =>
      appendLineItems(
        items,
        templates.map((template) => lineItemFromTemplate(template)),
      ),
    );
    toast.success(`Đã thêm ${templates.length} hạng mục quyết toán cho ${lineItemContextLabel}`);
  };

  const importBudgetAsSettlement = () => {
    if (!settlementPreview || settlementPreview.budgetItemCount === 0) {
      toast.error("Chưa có hạng mục ngân sách thực tế để nhập");
      return;
    }

    setSettlementLineItems(settlementLineItemsFromPreview(settlementPreview));
    toast.success("Đã nhập hạng mục quyết toán từ ngân sách thực tế");
  };

  const handleCreateSettlement = async () => {
    if (!settlementPreview) return;
    const validItems = settlementLineItems.filter(
      (item) => item.category.trim() && toNumber(item.unitPrice) > 0,
    );
    if (validItems.length === 0) {
      toast.error("Cần ít nhất 1 hạng mục có giá trị");
      return;
    }
    setSettlementCreating(true);
    try {
      await apiClient.post(`/admin/contracts/${settlementPreview.contractId}/settlement`, {
        lineItems: validItems.map((item) => ({
          category: item.category.trim(),
          description: item.description.trim() || null,
          unit: item.unit.trim() || null,
          quantity: toNumber(item.quantity) || 1,
          unitPrice: toNumber(item.unitPrice),
          note: item.note.trim() || null,
        })),
      });
      toast.success("Đã tạo biên bản quyết toán thành công");
      setSettlementPreview(null);
      setSettlementLineItems([]);
      await loadContracts();
    } catch (error) {
      toast.error("Tạo biên bản quyết toán thất bại");
    } finally {
      setSettlementCreating(false);
    }
  };

  const renderLineItemEditor = ({
    items,
    total,
    totalLabel,
    unitPriceLabel,
    descriptionPlaceholder,
    onUpdate,
    onCategoryChange,
    onApplyTemplate,
    onAdd,
    onRemove,
    onApplySuggested,
    onImportBudget,
    applySuggestedDisabled,
    importBudgetDisabled,
    importBudgetLabel,
    helperText,
  }: LineItemEditorOptions) => (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-low p-3 lg:flex-row lg:items-end">
        <div className="w-full lg:w-72">
          <label className="mb-1 block font-body text-sm text-foreground">Dịch vụ gợi ý</label>
          <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
            <SelectTrigger className="rounded-lg border-none bg-surface-lowest font-body">
              <span className="truncate">{selectedServiceLabel}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO_SERVICE_VALUE}>
                {autoServiceLabel}
              </SelectItem>
              {serviceCategories.map((category) => (
                <SelectItem key={category.id} value={serviceCategorySelectValue(category.id)}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full md:w-36">
          <label className="mb-1 block font-body text-sm text-foreground">Markup (%)</label>
          <Input
            type="number"
            min={0}
            value={markupPercent}
            onChange={(event) => setMarkupPercent(event.target.value)}
            className="rounded-lg border-none bg-surface-lowest font-body"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onApplySuggested}
          disabled={applySuggestedDisabled}
          className="rounded-lg"
        >
          <ClipboardList size={16} /> Áp dụng hạng mục
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onImportBudget}
          disabled={importBudgetDisabled}
          className="rounded-lg"
        >
          <Calculator size={16} /> {importBudgetLabel}
        </Button>
        <p className="font-body text-xs text-muted-foreground">
          {helperText}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-[1160px] w-full border-collapse text-sm">
          <thead className="bg-surface-low">
            <tr>
              <th className="w-80 px-3 py-2 text-left font-body font-semibold">Hạng mục</th>
              <th className="w-[420px] px-3 py-2 text-left font-body font-semibold">Mô tả</th>
              <th className="w-24 px-3 py-2 text-left font-body font-semibold">SL</th>
              <th className="w-24 px-3 py-2 text-left font-body font-semibold">Đơn vị</th>
              <th className="w-36 px-3 py-2 text-left font-body font-semibold">{unitPriceLabel}</th>
              <th className="w-36 px-3 py-2 text-right font-body font-semibold">Thành tiền</th>
              <th className="w-12 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="border-t border-border">
                <td className="px-3 py-2 align-top">
                  <div className="space-y-2">
                    <Input
                      value={item.category}
                      onChange={(event) => onCategoryChange(index, event.target.value)}
                      placeholder="Nhập tên hạng mục"
                      className="h-9 rounded-lg border-none bg-surface-lowest font-body font-medium text-foreground"
                    />
                    <Select
                      value={selectedLineItemTemplateValue(item)}
                      onValueChange={(value) => onApplyTemplate(index, value)}
                    >
                      <SelectTrigger className="h-7 rounded-lg border border-border bg-background px-2 font-body text-xs text-muted-foreground hover:text-foreground">
                        <span className="flex min-w-0 items-center gap-1">
                          <ClipboardList size={12} className="shrink-0" />
                          <span className="truncate">Chọn mẫu có mô tả sẵn</span>
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={MANUAL_TEMPLATE_VALUE}>Nhập tay</SelectItem>
                        {lineItemTemplateOptions.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </td>
                <td className="px-3 py-2 align-top">
                  <Textarea
                    value={item.description}
                    onChange={(event) => onUpdate(index, { description: event.target.value })}
                    placeholder={descriptionPlaceholder}
                    rows={3}
                    className="min-h-[78px] resize-y rounded-lg border-none bg-surface-lowest font-body leading-relaxed text-foreground"
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.quantity}
                    onChange={(event) => onUpdate(index, { quantity: event.target.value })}
                    className="h-9 rounded-lg border-none bg-surface-lowest font-body"
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <Select value={item.unit || "gói"} onValueChange={(value) => onUpdate(index, { unit: value })}>
                    <SelectTrigger className="h-9 rounded-lg border-none bg-surface-lowest font-body">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {unitOptions.map((unit) => (
                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2 align-top">
                  <Input
                    type="number"
                    min={0}
                    value={item.unitPrice}
                    onChange={(event) => onUpdate(index, { unitPrice: event.target.value })}
                    className="h-9 rounded-lg border-none bg-surface-lowest font-body"
                  />
                </td>
                <td className="px-3 py-2 text-right align-middle font-body font-semibold">
                  {money(lineAmount(item))}
                </td>
                <td className="px-2 py-2 align-top">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-destructive"
                    onClick={() => onRemove(index)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" size="sm" onClick={onAdd} className="rounded-lg">
          <Plus size={14} /> Thêm hạng mục
        </Button>
        <div className="text-right font-body">
          <p className="text-xs text-muted-foreground">{totalLabel}</p>
          <p className="text-lg font-bold text-foreground">{money(total)}</p>
        </div>
      </div>
    </div>
  );

  const renderContractForm = (mode: "create" | "edit") => (
    <div className="space-y-5">
      {mode === "create" ? (
        <div>
          <label className="mb-1 block font-body text-sm text-foreground">Dự án / Sự kiện *</label>
          <Select value={form.eventId} onValueChange={selectProject}>
            <SelectTrigger className="rounded-lg">
              <SelectValue placeholder="Chọn dự án" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name} - {project.customerUser?.displayName ?? "Chưa có khách hàng"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="rounded-lg bg-surface-low px-3 py-2">
          <p className="font-body text-xs text-muted-foreground">Sự kiện</p>
          <p className="font-body text-sm font-semibold text-foreground">{editItem?.event?.name ?? "-"}</p>
        </div>
      )}

      <div>
        <label className="mb-1 block font-body text-sm text-foreground">Phiên bản *</label>
        <Input
          value={form.versionLabel}
          onChange={(event) => setForm((current) => ({ ...current, versionLabel: event.target.value }))}
          placeholder="1.0"
          className="rounded-lg border-none bg-surface-lowest font-body"
        />
      </div>

      {mode === "create" ? (
        <div>
          <label className="mb-1 block font-body text-sm text-foreground">Tổng giá trị hợp đồng dự kiến *</label>
          <Input
            type="number"
            value={form.totalValue}
            onChange={(event) => setForm((current) => ({ ...current, totalValue: event.target.value }))}
            placeholder="Nhập tổng giá trị (đ)"
            min={0}
            className="rounded-lg border-none bg-surface-lowest font-body"
          />
          {toNumber(form.totalValue) > 0 && (
            <p className="mt-1 font-body text-xs text-muted-foreground">
              {money(form.totalValue)} — Chi tiết các hạng mục sẽ được quyết toán sau khi sự kiện hoàn thành.
            </p>
          )}
        </div>
      ) : (
        <div>
          <label className="mb-1 block font-body text-sm text-foreground">Bảng báo giá *</label>
          {renderLineItemEditor({
            items: form.lineItems,
            total: quoteTotal,
            totalLabel: "Tổng giá trị báo khách",
            unitPriceLabel: "Đơn giá bán",
            descriptionPlaceholder: "Mô tả gửi khách",
            onUpdate: updateLineItem,
            onCategoryChange: updateLineItemCategory,
            onApplyTemplate: applyLineItemTemplate,
            onAdd: addLineItem,
            onRemove: removeLineItem,
            onApplySuggested: applySuggestedLineItems,
            onImportBudget: importBudgetAsQuote,
            applySuggestedDisabled: !form.eventId && !selectedService && !selectedServiceCategory,
            importBudgetDisabled: budgetLoading || !form.eventId,
            importBudgetLabel: budgetLoading ? "Đang tải..." : "Nhập từ ngân sách",
            helperText: servicesLoading
              ? "Đang tải dịch vụ..."
              : `${lineItemTemplateOptions.length} hạng mục mẫu · ${budgetItems.length > 0 ? `${budgetItems.length} hạng mục ngân sách` : "chưa có ngân sách"}`,
          })}
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface-low p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="mb-1 block font-body text-sm text-foreground">Mẫu phạm vi & điều khoản</label>
            <Select value={termsTemplateId} onValueChange={setTermsTemplateId}>
              <SelectTrigger className="rounded-lg border-none bg-surface-lowest font-body">
                <span className="truncate">{selectedTermsTemplateLabel}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTO_TERMS_TEMPLATE_VALUE}>
                  Tự động theo dịch vụ gợi ý - {selectedTermsTemplate?.label ?? lineItemContextLabel}
                </SelectItem>
                <SelectItem value={MANUAL_TERMS_TEMPLATE_VALUE}>Nhập tay</SelectItem>
                <SelectItem value={commonContractTermsTemplate.id}>{commonContractTermsTemplate.label}</SelectItem>
                {contractTermsTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={applyTermsTemplate}
            disabled={!selectedTermsTemplate}
            className="rounded-lg"
          >
            <ClipboardList size={16} /> Áp dụng điều khoản mẫu
          </Button>
        </div>
      </div>

      <div>
        <label className="mb-1 block font-body text-sm text-foreground">Phạm vi công việc *</label>
        <Textarea
          value={form.scopeText}
          onChange={(event) => setForm((current) => ({ ...current, scopeText: event.target.value }))}
          rows={7}
          className="min-h-[170px] resize-y rounded-lg border-none bg-surface-lowest font-body leading-relaxed"
        />
      </div>
      <div>
        <label className="mb-1 block font-body text-sm text-foreground">Điều khoản thanh toán *</label>
        <Textarea
          value={form.paymentTerms}
          onChange={(event) => setForm((current) => ({ ...current, paymentTerms: event.target.value }))}
          rows={6}
          className="min-h-[150px] resize-y rounded-lg border-none bg-surface-lowest font-body leading-relaxed"
        />
      </div>
      <div>
        <label className="mb-1 block font-body text-sm text-foreground">Điều khoản chung *</label>
        <Textarea
          value={form.generalTerms}
          onChange={(event) => setForm((current) => ({ ...current, generalTerms: event.target.value }))}
          rows={7}
          className="min-h-[170px] resize-y rounded-lg border-none bg-surface-lowest font-body leading-relaxed"
        />
      </div>
      {mode === "edit" && (
        <p className="font-body text-xs text-muted-foreground">
          Lưu thay đổi nội dung sẽ tạo một phiên bản hợp đồng mới.
        </p>
      )}
    </div>
  );

  const latestLineItems = viewItem?.versions?.[0]?.lineItems ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-serif text-headline-lg text-foreground">Quản lý hợp đồng</h1>
          <p className="font-body text-sm text-muted-foreground">
            {loading ? "Đang tải..." : `${contracts.length} hợp đồng`}
          </p>
        </div>
        <Button variant="hero" size="sm" onClick={openCreate}>
          <Plus size={16} /> Tạo hợp đồng
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo số HĐ, sự kiện..."
            className="rounded-lg border-none bg-surface-lowest pl-10 font-body"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[{ label: "Tất cả", value: "all" }, ...statusList].map((status) => (
            <button
              key={status.value}
              onClick={() => setFilterStatus(status.value)}
              className={`rounded-lg px-3 py-2 font-body text-sm transition-all ${
                filterStatus === status.value
                  ? "gradient-primary text-primary-foreground"
                  : "bg-surface-lowest text-muted-foreground hover:text-foreground"
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="overflow-hidden rounded-lg bg-surface-lowest shadow-ambient"
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-low">
              <TableHead>Số HĐ</TableHead>
              <TableHead>Sự kiện</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead>Giá trị</TableHead>
              <TableHead>Ngày gửi</TableHead>
              <TableHead>Phiên bản</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && contracts.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center font-body text-sm text-muted-foreground">
                  Chưa có hợp đồng nào
                </TableCell>
              </TableRow>
            )}
            {contracts.map((contract) => (
              <TableRow key={contract.id} className="hover:bg-surface-low/50">
                <TableCell className="font-body text-sm font-semibold text-primary">{contract.contractCode}</TableCell>
                <TableCell className="font-body text-sm text-foreground">{contract.event?.name ?? "-"}</TableCell>
                <TableCell className="font-body text-sm text-foreground">{contract.customerUser?.displayName ?? "-"}</TableCell>
                <TableCell className="font-body text-sm font-semibold text-foreground">{money(contract.totalValue)}</TableCell>
                <TableCell className="font-body text-sm text-foreground">
                  {contract.sentAt ? new Date(contract.sentAt).toLocaleDateString("vi-VN") : "-"}
                </TableCell>
                <TableCell className="font-body text-sm text-muted-foreground">v{contract.currentVersion}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1 font-body text-xs font-semibold ${statusColors[contract.status] ?? "bg-muted text-muted-foreground"}`}>
                      {statusLabel[contract.status] ?? contract.status}
                    </span>
                    {contract.status === "sent" && contract.rejectionNote && (
                      <span
                        className="rounded-full bg-destructive/10 px-2 py-0.5 font-body text-[10px] font-semibold text-destructive cursor-help"
                        title={`KH từ chối: ${contract.rejectionNote}`}
                      >
                        KH từ chối
                      </span>
                    )}
                    {contract.status === "active" && contract.respondedAt && (
                      <span className="rounded-full bg-secondary/10 px-2 py-0.5 font-body text-[10px] font-semibold text-secondary">
                        KH đồng ý
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => navigate(`/admin/hop-dong/${contract.id}`)}
                      title="Xem bản đầy đủ"
                    >
                      <Eye size={14} />
                    </Button>
                    <ContractPdfButton
                      contract={contract}
                      detailPath={`/admin/contracts/${contract.id}`}
                      variant="ghost"
                      size="icon"
                      label=""
                      className="h-8 w-8 rounded-lg"
                    />
                    {contract.status === "draft" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => handleSend(contract)}
                        title="Gửi khách"
                      >
                        <Send size={14} />
                      </Button>
                    )}
                    {contract.status === "sent" && contract.rejectionNote && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-amber-500 hover:text-amber-600"
                        onClick={() => handleSend(contract)}
                        title="Gửi lại hợp đồng"
                      >
                        <Send size={14} />
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                          <MoreHorizontal size={14} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/admin/hop-dong/${contract.id}`)}>
                          <Eye size={12} className="mr-2" /> Xem bản đầy đủ
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openView(contract)}>
                          <FileText size={12} className="mr-2" /> Xem nhanh
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(contract)}>
                          <Edit2 size={12} className="mr-2" /> Chỉnh sửa
                        </DropdownMenuItem>
                        {contract.status === "draft" && (
                          <DropdownMenuItem onClick={() => handleSend(contract)}>
                            <Send size={12} className="mr-2" /> Gửi khách hàng
                          </DropdownMenuItem>
                        )}
                        {contract.status === "sent" && contract.rejectionNote && (
                          <>
                            <DropdownMenuSeparator />
                            <div className="px-2 py-1.5">
                              <p className="font-body text-xs font-semibold text-destructive mb-1">Phản hồi từ KH:</p>
                              <p className="font-body text-xs text-muted-foreground italic">"{contract.rejectionNote}"</p>
                            </div>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEdit(contract)}>
                              <Edit2 size={12} className="mr-2" /> Sửa & gửi lại
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSend(contract)}>
                              <Send size={12} className="mr-2" /> Gửi lại ngay
                            </DropdownMenuItem>
                          </>
                        )}
                        {(contract.status === "active" || contract.status === "sent") && (
                          <DropdownMenuItem onClick={() => openSettlementPreview(contract)}>
                            <ClipboardCheck size={12} className="mr-2" /> Tạo biên bản quyết toán
                          </DropdownMenuItem>
                        )}
                        {contract.status === "liquidated" && (
                          <DropdownMenuItem onClick={() => navigate(`/admin/hop-dong/${contract.id}?view=settlement`)}>
                            <ClipboardCheck size={12} className="mr-2" /> Xem biên bản quyết toán
                          </DropdownMenuItem>
                        )}
                        {(contract.status === "draft" || contract.status === "sent") && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleCancel(contract)} className="text-destructive">
                              <Ban size={12} className="mr-2" /> Hủy hợp đồng
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDelete(contract.id)} className="text-destructive">
                          <Trash2 size={12} className="mr-2" /> Xóa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </motion.div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92vh] w-[95vw] overflow-y-auto sm:max-w-[1280px] xl:max-w-[1440px]">
          <DialogHeader>
            <DialogTitle className="font-serif">Tạo hợp đồng mới</DialogTitle>
          </DialogHeader>
          {renderContractForm("create")}
          <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 border-t border-border bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button variant="hero" onClick={handleCreate} disabled={saving}>
              {saving ? "Đang lưu..." : "Tạo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-h-[92vh] w-[95vw] overflow-y-auto sm:max-w-[1280px] xl:max-w-[1440px]">
          <DialogHeader>
            <DialogTitle className="font-serif">Chỉnh sửa hợp đồng {editItem?.contractCode}</DialogTitle>
          </DialogHeader>
          {renderContractForm("edit")}
          <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 border-t border-border bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <Button variant="outline" onClick={() => setEditItem(null)}>Hủy</Button>
            <Button variant="hero" onClick={handleEdit} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-serif">Hợp đồng {viewItem?.contractCode}</DialogTitle>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-4 font-body text-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-low">
                  <FileText size={22} className="text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{viewItem.event?.name ?? "-"}</p>
                  <p className="text-muted-foreground">
                    {viewItem.customerUser?.displayName ?? "-"}
                    {viewItem.customerUser?.phone ? ` - ${viewItem.customerUser.phone}` : ""}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-muted-foreground">Giá trị</p>
                  <p className="font-semibold text-foreground">{money(viewItem.totalValue)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phiên bản</p>
                  <p className="text-foreground">v{viewItem.currentVersion}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Trạng thái</p>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[viewItem.status] ?? "bg-muted text-muted-foreground"}`}>
                    {statusLabel[viewItem.status] ?? viewItem.status}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground">Ngày gửi</p>
                  <p className="text-foreground">{viewItem.sentAt ? new Date(viewItem.sentAt).toLocaleDateString("vi-VN") : "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ngày ký</p>
                  <p className="text-foreground">{viewItem.signedAt ? new Date(viewItem.signedAt).toLocaleDateString("vi-VN") : "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Người tạo</p>
                  <p className="text-foreground">{viewItem.createdBy?.displayName ?? "-"}</p>
                </div>
              </div>

              {viewItem.rejectionNote && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <p className="font-body text-xs font-semibold text-destructive mb-1">⚠ Phản hồi từ khách hàng:</p>
                  <p className="font-body text-sm text-foreground italic">"{viewItem.rejectionNote}"</p>
                  {viewItem.respondedAt && (
                    <p className="font-body text-xs text-muted-foreground mt-2">
                      Ngày phản hồi: {new Date(viewItem.respondedAt).toLocaleDateString("vi-VN")}
                    </p>
                  )}
                </div>
              )}

              {latestLineItems.length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="mb-2 text-muted-foreground">Bảng báo giá khách</p>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="min-w-[620px] w-full border-collapse text-xs">
                      <thead className="bg-surface-low">
                        <tr>
                          <th className="px-3 py-2 text-left">Hạng mục</th>
                          <th className="px-3 py-2 text-center">SL</th>
                          <th className="px-3 py-2 text-center">Đơn vị</th>
                          <th className="px-3 py-2 text-right">Đơn giá</th>
                          <th className="px-3 py-2 text-right">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latestLineItems.map((item, index) => (
                          <tr key={item.id ?? index} className="border-t border-border">
                            <td className="px-3 py-2">
                              <p className="font-semibold">{item.category}</p>
                              {item.description && <p className="text-muted-foreground">{item.description}</p>}
                            </td>
                            <td className="px-3 py-2 text-center">{toNumber(item.quantity).toLocaleString("vi-VN")}</td>
                            <td className="px-3 py-2 text-center">{item.unit || "-"}</td>
                            <td className="px-3 py-2 text-right">{money(item.unitPrice)}</td>
                            <td className="px-3 py-2 text-right font-semibold">{money(item.amount ?? lineAmount(item))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {viewItem.versions?.[0] && (
                <div className="space-y-3 border-t border-border pt-3">
                  <div>
                    <p className="mb-1 text-muted-foreground">Phạm vi công việc</p>
                    <p className="whitespace-pre-wrap text-foreground">{viewItem.versions[0].scopeText || "-"}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-muted-foreground">Điều khoản thanh toán</p>
                    <p className="whitespace-pre-wrap text-foreground">{viewItem.versions[0].paymentTerms || "-"}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-muted-foreground">Điều khoản chung</p>
                    <p className="whitespace-pre-wrap text-foreground">{viewItem.versions[0].generalTerms || "-"}</p>
                  </div>
                </div>
              )}

              {viewItem.versions && viewItem.versions.length > 1 && (
                <div className="border-t border-border pt-3">
                  <p className="mb-2 flex items-center gap-1 text-muted-foreground">
                    <History size={12} /> Lịch sử phiên bản
                  </p>
                  <div className="space-y-1">
                    {viewItem.versions.map((version) => (
                      <div key={version.id} className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground">v{version.versionLabel}</span>
                        <span className="text-muted-foreground">{new Date(version.createdAt).toLocaleString("vi-VN")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewItem(null)}>Đóng</Button>
            {viewItem && (
              <ContractPdfButton
                contract={viewItem}
                detailPath={`/admin/contracts/${viewItem.id}`}
                variant="outline"
                label="Tải PDF"
              />
            )}
            {viewItem?.status === "draft" && (
              <Button
                variant="hero"
                onClick={() => {
                  if (viewItem) void handleSend(viewItem);
                  setViewItem(null);
                }}
              >
                <Send size={14} className="mr-1" /> Gửi khách
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settlement editable dialog */}
      <Dialog open={!!settlementPreview} onOpenChange={() => { setSettlementPreview(null); setSettlementLineItems([]); }}>
        <DialogContent className="max-h-[92vh] w-[95vw] overflow-y-auto sm:max-w-[1280px] xl:max-w-[1440px]">
          <DialogHeader>
            <DialogTitle className="font-serif">Tạo biên bản quyết toán</DialogTitle>
          </DialogHeader>
          {settlementPreview && (
            <div className="space-y-5">
              {/* Contract info */}
              <div className="rounded-lg bg-surface-low p-4 space-y-2 font-body text-sm">
                <p className="text-muted-foreground">Hợp đồng: <span className="font-semibold text-foreground">{settlementPreview.contractCode}</span></p>
                <p className="text-muted-foreground">Sự kiện: <span className="font-semibold text-foreground">{settlementPreview.eventName}</span></p>
              </div>

              {/* Summary totals */}
              <div className="rounded-lg border border-border p-4 space-y-3 font-body text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Giá trị hợp đồng ban đầu</span>
                  <span className="font-semibold text-foreground">{money(settlementPreview.originalTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tổng chi phí thực tế (bên dưới)</span>
                  <span className="font-semibold text-foreground">{money(settlementTotal)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-3">
                  <span className="font-semibold text-foreground">Chênh lệch</span>
                  {(() => {
                    const diff = settlementTotal - settlementPreview.originalTotal;
                    return (
                      <span className={`font-semibold ${diff > 0 ? "text-destructive" : diff < 0 ? "text-secondary" : "text-foreground"}`}>
                        {diff > 0 ? "+" : ""}{money(diff)}
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div className="space-y-3">
                <p className="font-body text-sm font-semibold text-foreground">Chi tiết hạng mục quyết toán</p>
                {renderLineItemEditor({
                  items: settlementLineItems,
                  total: settlementTotal,
                  totalLabel: "Tổng giá trị quyết toán",
                  unitPriceLabel: "Đơn giá quyết toán",
                  descriptionPlaceholder: "Mô tả hoặc nhà cung cấp",
                  onUpdate: updateSettlementItem,
                  onCategoryChange: updateSettlementItemCategory,
                  onApplyTemplate: applySettlementLineItemTemplate,
                  onAdd: addSettlementLineItem,
                  onRemove: removeSettlementLineItem,
                  onApplySuggested: applySuggestedSettlementLineItems,
                  onImportBudget: importBudgetAsSettlement,
                  applySuggestedDisabled: !selectedService && !selectedServiceCategory && lineItemTemplateOptions.length === 0,
                  importBudgetDisabled: !settlementPreview || settlementPreview.budgetItemCount === 0,
                  importBudgetLabel: "Nhập từ ngân sách",
                  helperText: servicesLoading
                    ? "Đang tải dịch vụ..."
                    : `${lineItemTemplateOptions.length} hạng mục mẫu · ${settlementPreview.budgetItemCount > 0 ? `${settlementPreview.budgetItemCount} hạng mục ngân sách thực tế` : "chưa có ngân sách thực tế"}`,
                })}
              </div>

              <div className="rounded-lg bg-surface-low p-3 font-body text-xs text-muted-foreground">
                Khi xác nhận, hệ thống sẽ tạo phiên bản quyết toán (QT-1.0), cập nhật giá trị hợp đồng, và chuyển trạng thái sang "Đã thanh lý".
              </div>
            </div>
          )}
          <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 border-t border-border bg-background/95 px-6 py-4 backdrop-blur">
            <Button variant="outline" onClick={() => { setSettlementPreview(null); setSettlementLineItems([]); }}>Hủy</Button>
            <Button
              variant="hero"
              onClick={handleCreateSettlement}
              disabled={settlementCreating || settlementLineItems.filter((i) => i.category.trim() && toNumber(i.unitPrice) > 0).length === 0}
            >
              <ClipboardCheck size={14} className="mr-1" />
              {settlementCreating ? "Đang tạo..." : "Xác nhận quyết toán"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminContracts;
