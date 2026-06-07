export type EventDisplaySource = {
  name?: string | null;
  type?: string | null;
  customerUser?: { displayName?: string | null } | null;
  consultationRequest?: {
    customerName?: string | null;
    eventType?: string | null;
    note?: string | null;
  } | null;
};

export const parseEventNameFromNote = (note?: string | null): string | null => {
  if (!note) return null;

  const eventNameLine = note
    .split(/\r?\n/)
    .find((line) => {
      const normalized = line.trim().toLowerCase();
      return normalized.startsWith("ten su kien:") || normalized.startsWith("tên sự kiện:");
    });

  if (!eventNameLine) return null;

  const eventName = eventNameLine.split(":").slice(1).join(":").trim();
  return eventName || null;
};

const normalizeName = (value?: string | null) => value?.trim().toLowerCase() ?? "";

const getRequestedEventName = (event: EventDisplaySource) =>
  parseEventNameFromNote(event.consultationRequest?.note) ||
  event.consultationRequest?.eventType ||
  event.type ||
  event.name ||
  "-";

const isGeneratedEventName = (event: EventDisplaySource) => {
  const savedName = normalizeName(event.name);
  if (!savedName || !event.type) return false;

  const customerNames = [
    event.consultationRequest?.customerName,
    event.customerUser?.displayName,
  ]
    .map(normalizeName)
    .filter(Boolean);

  return customerNames.some(
    (customerName) => savedName === normalizeName(`${event.type} - ${customerName}`),
  );
};

export const getEventDisplayName = (event: EventDisplaySource) =>
  isGeneratedEventName(event) ? getRequestedEventName(event) : event.name || getRequestedEventName(event);

export const eventStatusLabels: Record<string, string> = {
  draft: "Nháp",
  planning: "Lập kế hoạch",
  quoted: "Đã báo giá",
  contracted: "Đã xác nhận",
  in_progress: "Đang triển khai",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

export const getEventStatusLabel = (status?: string | null) =>
  status ? eventStatusLabels[status] ?? status : "-";

export const eventStatusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  planning: "bg-primary/10 text-primary",
  quoted: "bg-secondary/10 text-secondary",
  contracted: "bg-secondary/20 text-secondary",
  in_progress: "bg-primary/15 text-primary",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-destructive/10 text-destructive",
};

export const getEventStatusColor = (status?: string | null) =>
  status ? eventStatusColors[status] ?? "bg-muted text-muted-foreground" : "bg-muted text-muted-foreground";

export const eventStatusFilters = [
  { value: "all", label: "Tất cả" },
  { value: "contracted", label: "Đã xác nhận" },
  { value: "quoted", label: "Đã báo giá" },
  { value: "planning", label: "Lập kế hoạch" },
  { value: "in_progress", label: "Đang triển khai" },
  { value: "completed", label: "Hoàn thành" },
  { value: "cancelled", label: "Đã hủy" },
];

export const requestStatusLabels: Record<string, string> = {
  new: "Mới",
  reviewing: "Đang xem xét",
  quoted: "Đã báo giá",
  confirmed: "Đã xác nhận",
  rejected: "Từ chối",
};

export const requestStatusColors: Record<string, string> = {
  new: "bg-primary/10 text-primary",
  reviewing: "bg-muted text-muted-foreground",
  quoted: "bg-secondary/10 text-secondary",
  confirmed: "bg-secondary/20 text-secondary",
  rejected: "bg-destructive/10 text-destructive",
};

export const requestStatusFilters = [
  { value: "new", label: "Mới" },
  { value: "reviewing", label: "Đang xem xét" },
  { value: "quoted", label: "Đã báo giá" },
  { value: "confirmed", label: "Đã xác nhận" },
  { value: "rejected", label: "Từ chối" },
];

export const getRequestStatusLabel = (status?: string | null) =>
  status ? requestStatusLabels[status] ?? status : "-";

export const getRequestStatusColor = (status?: string | null) =>
  status ? requestStatusColors[status] ?? "bg-muted text-muted-foreground" : "bg-muted text-muted-foreground";

export const contractStatusLabels: Record<string, string> = {
  draft: "Nháp",
  sent: "Đã gửi",
  active: "Đang hiệu lực",
  liquidated: "Đã thanh lý",
  cancelled: "Đã hủy",
};

export const getContractStatusLabel = (status?: string | null) =>
  status ? contractStatusLabels[status] ?? status : "-";

export const transactionStatusLabels: Record<string, string> = {
  pending: "Đang xử lý",
  completed: "Đã thanh toán",
  cancelled: "Đã hủy",
};

export const getTransactionStatusLabel = (status?: string | null) =>
  status ? transactionStatusLabels[status] ?? status : "-";

export const milestoneStatusLabels: Record<string, string> = {
  todo: "Chưa bắt đầu",
  current: "Đang thực hiện",
  in_progress: "Đang thực hiện",
  review: "Đang kiểm tra",
  done: "Hoàn thành",
  completed: "Hoàn thành",
};

export const getMilestoneStatusLabel = (status?: string | null) =>
  status ? milestoneStatusLabels[status] ?? status : "-";
