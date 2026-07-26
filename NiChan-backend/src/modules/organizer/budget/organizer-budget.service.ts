import { prisma } from "../../../lib/prisma";
import { createError } from "../../../middleware/errorHandler";
import { z } from "zod";

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const budgetItemSchema = z.object({
  projectBudgetId: z.string().uuid(),
  category: z.string().min(1).max(100),
  estimatedAmount: z.number().nonnegative(),
  actualAmount: z.number().nonnegative().default(0),
  status: z.enum(["planned", "approved", "committed", "paid"]).default("planned"),
  note: z.string().max(500).optional(),
  vendorId: z.string().uuid().optional().nullable(),
});

export type BudgetItemInput = z.infer<typeof budgetItemSchema>;

type ActorContext = {
  userId: string;
  role: string;
};

type BudgetCategoryTemplateGroup = {
  id: string;
  label: string;
  matchKeywords: string[];
  categories: string[];
};

const BUDGET_CATEGORY_TEMPLATE_GROUPS: BudgetCategoryTemplateGroup[] = [
  {
    id: "wedding",
    label: "Tiệc cưới",
    matchKeywords: ["tiec cuoi", "cuoi", "wedding", "dam cuoi"],
    categories: [
      "Địa điểm & sảnh tiệc",
      "Catering & thực đơn",
      "Trang trí lễ đường",
      "Hoa tươi & backdrop",
      "Âm thanh ánh sáng",
      "MC & nghi thức",
      "Photo & video",
      "Trang phục & makeup",
      "Thiệp cưới & quà cảm ơn",
      "Nhân sự vận hành",
      "Di chuyển & lưu trú",
      "Dự phòng phát sinh",
    ],
  },
  {
    id: "conference",
    label: "Hội nghị & hội thảo",
    matchKeywords: ["hoi nghi", "hoi thao", "conference", "seminar", "workshop", "doanh nghiep"],
    categories: [
      "Địa điểm & phòng họp",
      "Sân khấu & booth",
      "Âm thanh trình chiếu",
      "Livestream & ghi hình",
      "Phiên dịch & kỹ thuật",
      "Badge, tài liệu & in ấn",
      "Tea break & catering",
      "Diễn giả & khách VIP",
      "Check-in & lễ tân",
      "Quà tặng đại biểu",
      "Truyền thông sự kiện",
      "Dự phòng phát sinh",
    ],
  },
  {
    id: "opening",
    label: "Lễ khai trương",
    matchKeywords: ["khai truong", "opening", "showroom", "ra mat", "launch"],
    categories: [
      "Mặt bằng & giấy phép",
      "Cổng chào & backdrop",
      "Thảm đỏ & khu VIP",
      "Nghi thức cắt băng",
      "Múa lân & biểu diễn",
      "Âm thanh ánh sáng",
      "Hoa tươi & quà khai trương",
      "POSM & booth trải nghiệm",
      "Photo, video & truyền thông",
      "Lễ tân & an ninh",
      "Tháo dỡ & bàn giao",
      "Dự phòng phát sinh",
    ],
  },
  {
    id: "birthday",
    label: "Sinh nhật",
    matchKeywords: ["sinh nhat", "birthday"],
    categories: [
      "Địa điểm & setup tiệc",
      "Trang trí chủ đề",
      "Backdrop & photobooth",
      "Bánh sinh nhật",
      "Catering & đồ uống",
      "Âm thanh ánh sáng",
      "Hoạt náo & trò chơi",
      "Quà tặng khách mời",
      "Photo & video",
      "Nhân sự hỗ trợ trẻ em",
      "Thu gom & bàn giao",
      "Dự phòng phát sinh",
    ],
  },
  {
    id: "gala",
    label: "Gala / Year End Party",
    matchKeywords: ["gala", "year end", "tat nien", "cuoi nam", "party", "vinh danh"],
    categories: [
      "Địa điểm & banquet",
      "Sân khấu, LED & layout",
      "Âm thanh ánh sáng",
      "Kịch bản & MC",
      "Tiết mục biểu diễn",
      "Trao giải & vật phẩm vinh danh",
      "Catering & đồ uống",
      "Check-in & lễ tân",
      "Photo, video & recap",
      "Quà tặng khách mời",
      "Nhân sự vận hành",
      "Dự phòng phát sinh",
    ],
  },
  {
    id: "roadshow",
    label: "Road Show",
    matchKeywords: ["road show", "roadshow", "activation", "di dong", "luu dong"],
    categories: [
      "Lộ trình & giấy phép",
      "Xe roadshow & nhiên liệu",
      "Branding xe & POSM",
      "Booth activation",
      "Nhân sự PG/PB",
      "Âm thanh di động",
      "Quà tặng & sampling",
      "Photo, video & social recap",
      "An ninh & điều phối giao thông",
      "Vận chuyển & hậu cần",
      "Bảo hiểm & y tế",
      "Dự phòng phát sinh",
    ],
  },
  {
    id: "online",
    label: "Online Event",
    matchKeywords: ["online event", "online", "webinar", "livestream", "virtual"],
    categories: [
      "Nền tảng & license",
      "Studio & bối cảnh quay",
      "Thiết bị ghi hình",
      "Kỹ thuật livestream",
      "MC / host online",
      "Slide, video & nội dung số",
      "Quản trị chat & Q&A",
      "Đăng ký & email nhắc lịch",
      "Truyền thông online",
      "Ghi hình & dựng recap",
      "Hỗ trợ kỹ thuật người tham dự",
      "Dự phòng phát sinh",
    ],
  },
  {
    id: "anniversary",
    label: "Sự kiện kỷ niệm",
    matchKeywords: ["ky niem", "anniversary", "tri an"],
    categories: [
      "Địa điểm & banquet",
      "Trang trí chủ đề",
      "Sân khấu & màn hình",
      "Âm thanh ánh sáng",
      "Kịch bản & MC",
      "Tiết mục biểu diễn",
      "Photo & video",
      "Catering & đồ uống",
      "Quà tri ân",
      "Check-in & khách VIP",
      "Truyền thông sự kiện",
      "Dự phòng phát sinh",
    ],
  },
  {
    id: "ceremony",
    label: "Lễ động thổ / khánh thành",
    matchKeywords: ["dong tho", "khoi cong", "khanh thanh", "inauguration", "groundbreaking"],
    categories: [
      "Mặt bằng & nhà bạt",
      "Sân khấu & khu đại biểu",
      "Nghi thức & vật phẩm lễ",
      "Âm thanh ngoài trời",
      "Bảng tên, tài liệu & in ấn",
      "Hoa tươi & trang trí",
      "Lễ tân & điều phối VIP",
      "An ninh, PCCC & y tế",
      "Photo, video & báo chí",
      "Tea break & nước uống",
      "Tháo dỡ & bàn giao",
      "Dự phòng phát sinh",
    ],
  },
  {
    id: "default",
    label: "Sự kiện tổng hợp",
    matchKeywords: [],
    categories: [
      "Địa điểm & mặt bằng",
      "Sân khấu & layout",
      "Trang trí & nhận diện",
      "Âm thanh ánh sáng",
      "Nội dung chương trình",
      "Catering & đồ uống",
      "Nhân sự vận hành",
      "Lễ tân & check-in",
      "Photo, video & truyền thông",
      "In ấn & vật phẩm",
      "Vận chuyển & hậu cần",
      "Dự phòng phát sinh",
    ],
  },
];

const normalizeBudgetTemplateText = (value?: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const pickBudgetCategoryGroup = (...contextParts: Array<string | null | undefined>) => {
  const normalizedContext = normalizeBudgetTemplateText(contextParts.filter(Boolean).join(" "));

  return (
    BUDGET_CATEGORY_TEMPLATE_GROUPS.find((group) =>
      group.matchKeywords.some((keyword) => normalizedContext.includes(keyword)),
    ) ?? BUDGET_CATEGORY_TEMPLATE_GROUPS[BUDGET_CATEGORY_TEMPLATE_GROUPS.length - 1]
  );
};

const buildBudgetCategorySuggestions = (group: BudgetCategoryTemplateGroup) =>
  group.categories.map((name, index) => ({
    id: `${group.id}-${index + 1}`,
    name,
  }));

const ensureVendorBelongsToProject = async (eventId: string, vendorId?: string | null) => {
  if (!vendorId) return;

  const assignment = await prisma.eventVendor.findFirst({
    where: { eventId, vendorId },
    select: { id: true },
  });
  if (!assignment) {
    throw createError("BAD_REQUEST", "Vendor must be assigned to the project first", 400);
  }
};

const getManagedEvent = async (projectId: string, actor: ActorContext) => {
  const event = await prisma.event.findFirst({
    where: {
      id: projectId,
      ...(actor.role === "admin"
        ? {}
        : { organizerUserId: actor.userId, organizerAssignmentStatus: "accepted" }),
    },
    select: {
      id: true,
      name: true,
      type: true,
      budgetEstimated: true,
      budgetActual: true,
      consultationRequest: { select: { eventType: true } },
    },
  });

  if (!event) throw createError("NOT_FOUND", "Project not found", 404);
  return event;
};

const getManagedBudget = async (projectBudgetId: string, actor: ActorContext) => {
  const budget = await prisma.projectBudget.findFirst({
    where: {
      id: projectBudgetId,
      ...(actor.role === "admin"
        ? {}
        : { event: { organizerUserId: actor.userId, organizerAssignmentStatus: "accepted" } }),
    },
    select: { id: true, eventId: true },
  });

  if (!budget) throw createError("NOT_FOUND", "Budget not found", 404);
  return budget;
};

const getManagedBudgetItem = async (id: string, actor: ActorContext) => {
  const item = await prisma.budgetItem.findFirst({
    where: {
      id,
      ...(actor.role === "admin"
        ? {}
        : {
            projectBudget: {
              event: {
                organizerUserId: actor.userId,
                organizerAssignmentStatus: "accepted",
              },
            },
          }),
    },
    include: { projectBudget: { select: { eventId: true } } },
  });

  if (!item) throw createError("NOT_FOUND", "Budget item not found", 404);
  return item;
};

const buildBudgetHealth = (
  items: { category: string; estimatedAmount: unknown; actualAmount: unknown }[],
  estimatedTotal: number,
  actualTotal: number,
) => {
  const variance = estimatedTotal - actualTotal;
  const percentUsed = estimatedTotal > 0 ? Math.round((actualTotal / estimatedTotal) * 100) : 0;
  const overrunItems = items.filter((item) => Number(item.actualAmount) > Number(item.estimatedAmount)).length;
  const nearingLimitItems = items.filter((item) => {
    const estimated = Number(item.estimatedAmount);
    if (estimated <= 0) return false;
    const actual = Number(item.actualAmount);
    return actual <= estimated && actual >= estimated * 0.8;
  }).length;

  const alerts: string[] = [];
  let riskLevel: "empty" | "healthy" | "watch" | "at_risk" | "over_budget" = "healthy";

  if (estimatedTotal <= 0) {
    riskLevel = "empty";
    alerts.push("Chưa có dự toán để đối chiếu chi phí thực tế.");
  } else if (actualTotal > estimatedTotal) {
    riskLevel = "over_budget";
    alerts.push(`Chi phí thực tế đã vượt dự toán ${Math.abs(variance).toLocaleString("vi-VN")} đ.`);
  } else if (percentUsed >= 90) {
    riskLevel = "at_risk";
    alerts.push(`Chi phí thực tế đã dùng ${percentUsed}% dự toán, cần rà soát trước khi phát sinh thêm.`);
  } else if (percentUsed >= 75) {
    riskLevel = "watch";
    alerts.push(`Chi phí thực tế đã dùng ${percentUsed}% dự toán, nên kiểm tra các khoản sắp cam kết.`);
  }

  if (overrunItems > 0) {
    alerts.push(`${overrunItems} hạng mục đang vượt dự toán chi tiết.`);
  }

  if (nearingLimitItems > 0 && riskLevel !== "over_budget") {
    alerts.push(`${nearingLimitItems} hạng mục đã dùng từ 80% dự toán trở lên.`);
  }

  return {
    riskLevel,
    percentUsed,
    variance,
    remaining: variance,
    overrunItems,
    nearingLimitItems,
    alerts,
  };
};

// ─── Budget ───────────────────────────────────────────────────────────────────

export const getProjectBudget = async (projectId: string, actor: ActorContext) => {
  const event = await getManagedEvent(projectId, actor);

  let budget = await prisma.projectBudget.findFirst({
    where: { eventId: projectId },
    include: {
      items: {
        include: { vendor: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  // Auto-create budget if none exists
  if (!budget) {
    budget = await prisma.projectBudget.create({
      data: { eventId: projectId, name: `Budget - ${event.name}`, currencyCode: "VND" },
      include: { items: { include: { vendor: { select: { id: true, name: true } } } } },
    });
  }

  const items = budget.items;
  const estimatedTotal = items.reduce((acc, i) => acc + Number(i.estimatedAmount), 0);
  const actualTotal = items.reduce((acc, i) => acc + Number(i.actualAmount), 0);
  const budgetHealth = buildBudgetHealth(items, estimatedTotal, actualTotal);
  const categoryGroup = pickBudgetCategoryGroup(
    event.consultationRequest?.eventType,
    event.type,
    event.name,
  );

  return {
    project: event,
    budget,
    items,
    estimatedTotal,
    actualTotal,
    budgetHealth,
    categoryGroup: { id: categoryGroup.id, label: categoryGroup.label },
    categorySuggestions: buildBudgetCategorySuggestions(categoryGroup),
  };
};

export const createBudgetItem = async (input: BudgetItemInput, actor: ActorContext) => {
  const budget = await getManagedBudget(input.projectBudgetId, actor);
  await ensureVendorBelongsToProject(budget.eventId, input.vendorId);

  return prisma.budgetItem.create({
    data: {
      projectBudgetId: input.projectBudgetId,
      category: input.category,
      estimatedAmount: input.estimatedAmount,
      actualAmount: input.actualAmount,
      status: input.status,
      note: input.note,
      vendorId: input.vendorId,
    },
    include: { vendor: { select: { id: true, name: true } } },
  });
};

export const updateBudgetItem = async (
  id: string,
  input: Partial<BudgetItemInput>,
  actor: ActorContext,
) => {
  const existing = await getManagedBudgetItem(id, actor);
  if (input.vendorId !== undefined) {
    await ensureVendorBelongsToProject(existing.projectBudget.eventId, input.vendorId);
  }

  return prisma.budgetItem.update({
    where: { id },
    data: {
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.estimatedAmount !== undefined ? { estimatedAmount: input.estimatedAmount } : {}),
      ...(input.actualAmount !== undefined ? { actualAmount: input.actualAmount } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.vendorId !== undefined ? { vendorId: input.vendorId } : {}),
    },
    include: { vendor: { select: { id: true, name: true } } },
  });
};

export const deleteBudgetItem = async (id: string, actor: ActorContext) => {
  await getManagedBudgetItem(id, actor);
  await prisma.budgetItem.delete({ where: { id } });
};
