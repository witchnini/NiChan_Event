import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Ban, CheckCircle, ChevronRight, Circle, Clock, Filter, ListChecks, MessageSquare, MessageCircle, FileText, CreditCard, ArrowLeft, Paperclip, Send, Download, Trash2, Eye, WalletCards, ClipboardCheck, ReceiptText, ThumbsUp, ThumbsDown, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import ChatAttachment from "@/components/features/chat/ChatAttachment";
import { apiClient } from "@/services/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { useChatSocket } from "@/hooks/useChatSocket";
import { toast } from "sonner";
import { getEventDisplayName, getEventStatusLabel, getTransactionStatusLabel, eventStatusColors } from "@/lib/eventDisplay";

type EventContract = {
  id: string;
  contractCode: string;
  status: string;
  totalValue: string | number;
  currentVersion?: string | null;
  sentAt?: string | null;
  signedAt?: string | null;
  respondedAt?: string | null;
  rejectionNote?: string | null;
  updatedAt?: string | null;
  transactions?: { id: string; amount: string | number; status: string; paymentMethod?: string | null }[];
  versions?: {
    paymentTerms?: string | null;
    lineItems?: ContractLineItem[];
  }[];
};

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

type EventDetail = {
  id: string;
  name: string;
  type: string;
  eventDate?: string | null;
  locationText?: string | null;
  status: string;
  progressPercent?: number | null;
  budgetEstimated?: string | number | null;
  organizerUser?: { displayName: string } | null;
  customerUser?: { displayName: string } | null;
  consultationRequest?: { customerName?: string | null; eventType?: string | null; note?: string | null } | null;
  contracts?: EventContract[];
};

type Milestone = { id: string; title: string; dueDate?: string | null; milestoneDate?: string | null; status: string; description?: string | null };
type Message = { id: string; senderUserId: string; sender?: { displayName: string } | null; messageText: string; attachmentUrl?: string | null; attachmentType?: string | null; attachmentName?: string | null; sentAt: string };
type DocumentItem = { id: string; name?: string; fileName?: string; fileType?: string; createdAt: string; status?: string; contractId?: string | null; fileUrl?: string | null; event?: { id: string; name: string } };
type CustomerTask = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: "low" | "medium" | "high";
  dueAt?: string | null;
  completedAt?: string | null;
  sortOrder?: number | null;
  createdAt?: string | null;
};
type Transaction = {
  id: string;
  description: string;
  amount: string | number;
  transactionDate: string;
  paymentMethod?: string | null;
  status: string;
  event?: { id: string };
  contract?: { id: string; contractCode: string; totalValue: string | number; status: string } | null;
};

type PaymentForm = {
  transactionId: string;
  contractId: string;
  amount: string;
  paymentMethod: string;
  note: string;
};

type FeedbackPanelState = {
  contractCode: string;
  note: string;
  respondedAt?: string | null;
  updatedAt?: string | null;
  mode: "cancelled" | "rejected";
};

type SettlementItemFeedback = {
  lineItemId: string;
  status: "agreed" | "feedback" | "pending";
  note: string;
};

type SavedFeedback = {
  id: string;
  contractLineItemId: string;
  status: string;
  feedbackNote: string | null;
  updatedAt: string;
};

const getNextScheduledTransaction = (items: Transaction[], contractId: string) =>
  items
    .filter(
      (transaction) =>
        transaction.status === "pending" &&
        !transaction.paymentMethod &&
        transaction.contract?.id === contractId,
    )
    .sort(
      (a, b) =>
        new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime() ||
        Number(a.amount || 0) - Number(b.amount || 0),
    )[0];

const DEFAULT_MILESTONES: Milestone[] = [
  { id: "default-1", title: "Xác nhận yêu cầu", description: "Yêu cầu đã được tiếp nhận và xác nhận", status: "pending" },
  { id: "default-2", title: "Báo giá & Thống nhất", description: "Báo giá đã được gửi và xác nhận bởi khách hàng", status: "pending" },
  { id: "default-3", title: "Ký hợp đồng & Đặt cọc", description: "Hợp đồng đã ký, đặt cọc 30% đã thanh toán", status: "pending" },
  { id: "default-4", title: "Lên kế hoạch chi tiết", description: "Đang lập kế hoạch chi tiết cho sự kiện", status: "pending" },
  { id: "default-5", title: "Đặt venue & Nhà cung cấp", description: "Liên hệ và xác nhận venue, catering, décor", status: "pending" },
  { id: "default-6", title: "Tổng duyệt", description: "Tổng duyệt toàn bộ chương trình", status: "pending" },
  { id: "default-7", title: "Ngày sự kiện", description: "Ngày diễn ra sự kiện chính thức", status: "pending" },
];

const PAYMENT_METHODS = ["Chuyển khoản", "Tiền mặt", "Thẻ", "Ví điện tử"];
const BILLABLE_CONTRACT_STATUSES = new Set(["sent", "active", "liquidated"]);

const EventTracking = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [detailedTasks, setDetailedTasks] = useState<CustomerTask[]>([]);
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [taskFilter, setTaskFilter] = useState<"all" | "in_progress" | "done" | "todo">("all");
  const [feedbackPanel, setFeedbackPanel] = useState<FeedbackPanelState | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    transactionId: "",
    contractId: "",
    amount: "",
    paymentMethod: PAYMENT_METHODS[0],
    note: "",
  });
  const [activeTab, setActiveTab] = useState<"timeline" | "chat" | "documents" | "payment" | "settlement">("timeline");
  const [unreadChat, setUnreadChat] = useState(0);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const [loading, setLoading] = useState(true);
  const [attaching, setAttaching] = useState(false);
  const [paying, setPaying] = useState(false);
  const messagesListRef = useRef<HTMLDivElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const paymentFormRef = useRef<HTMLDivElement>(null);
  const [contractResponding, setContractResponding] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [settlementFeedbacks, setSettlementFeedbacks] = useState<Record<string, SettlementItemFeedback>>({});
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackLoaded, setFeedbackLoaded] = useState(false);
  const [expandedFeedback, setExpandedFeedback] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [id]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [eventDetail, eventMilestones, chatMessages, docs, txs, tasks] = await Promise.all([
        apiClient.get<EventDetail>(`/customer/events/${id}`),
        apiClient.get<Milestone[]>(`/customer/events/${id}/milestones`),
        apiClient.get<Message[]>(`/customer/events/${id}/chat-messages`),
        apiClient.get<DocumentItem[]>("/customer/documents"),
        apiClient.get<Transaction[]>("/customer/transactions"),
        apiClient.get<CustomerTask[]>(`/customer/events/${id}/tasks`).catch(() => [] as CustomerTask[]),
      ]);
      setEvent(eventDetail);
      setMilestones(eventMilestones);
      setMessages(chatMessages);
      setDocuments(docs.filter(doc => !doc.event || doc.event.id === id));
      setTransactions(txs.filter(tx => !tx.event || tx.event.id === id));
      setDetailedTasks(tasks);
    } catch (error) {
      toast.error("Không tải được chi tiết sự kiện");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "timeline" || tab === "chat" || tab === "documents" || tab === "payment" || tab === "settlement") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Thêm tin nhắn vào danh sách, tránh trùng theo id (socket có thể gửi lại tin của chính mình)
  const appendMessage = (message: Message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      // Chỉ đếm unread khi KHÔNG ở tab chat và tin nhắn không phải của mình
      if (message.senderUserId !== user?.userId && activeTabRef.current !== "chat") {
        setUnreadChat((count) => count + 1);
      }
      return [...prev, message];
    });
  };

  // Xóa tin nhắn khỏi danh sách (real-time)
  const removeMessage = (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  // Nhận tin nhắn real-time của sự kiện này
  useChatSocket(id, appendMessage, removeMessage);

  // Cuộn xuống tin mới nhất khi danh sách thay đổi
  useEffect(() => {
    if (activeTab !== "chat" || !messagesListRef.current) return;
    messagesListRef.current.scrollTop = messagesListRef.current.scrollHeight;
  }, [messages, activeTab]);

  const openFeedbackPanel = (contract: EventContract, mode: FeedbackPanelState["mode"]) => {
    const note = contract.rejectionNote?.trim();
    if (!note) return;
    setTaskPanelOpen(false);
    setFeedbackPanel({
      contractCode: contract.contractCode,
      note,
      respondedAt: contract.respondedAt,
      updatedAt: contract.updatedAt,
      mode,
    });
  };

  const closeFeedbackPanel = () => setFeedbackPanel(null);

  const contractSummaries = useMemo(() => (event?.contracts ?? [])
    .filter((contract) => BILLABLE_CONTRACT_STATUSES.has(contract.status))
    .map((contract) => {
      const completed = (contract.transactions ?? [])
        .filter((tx) => tx.status === "completed")
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const pending = (contract.transactions ?? [])
        .filter((tx) => tx.status === "pending" && tx.paymentMethod)
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const scheduled = (contract.transactions ?? [])
        .filter((tx) => tx.status === "pending" && !tx.paymentMethod)
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const totalValue = Number(contract.totalValue || 0);
      return {
        ...contract,
        totalValue,
        completed,
        pending,
        scheduled,
        outstanding: Math.max(totalValue - completed - pending, 0),
        payable: BILLABLE_CONTRACT_STATUSES.has(contract.status),
      };
    }), [event?.contracts]);

  const totals = useMemo(() => {
    const paid = transactions
      .filter((tx) => tx.status === "completed")
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const pending = transactions
      .filter((tx) => tx.status === "pending" && tx.paymentMethod)
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const scheduled = transactions
      .filter((tx) => tx.status === "pending" && !tx.paymentMethod)
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const contractTotal = contractSummaries.reduce((sum, contract) => sum + Number(contract.totalValue || 0), 0);
    const total = contractTotal || Number(event?.budgetEstimated || 0);
    return { total, paid, pending, scheduled, remaining: Math.max(total - paid - pending, 0) };
  }, [contractSummaries, event?.budgetEstimated, transactions]);

  const settlementLineItems = useMemo(
    () =>
      contractSummaries.flatMap((contract) => {
        // Prefer the settlement version if it exists, otherwise use latest version
        const settlementVersion = contract.versions?.find((v: { purpose?: string }) => v.purpose === "settlement");
        const version = settlementVersion ?? contract.versions?.[0];
        return (version?.lineItems ?? []).map((item) => ({
          ...item,
          contractCode: contract.contractCode,
        }));
      }),
    [contractSummaries],
  );

  const hasLiquidatedContract = contractSummaries.some((c) => c.status === "liquidated");

  // Load existing settlement feedbacks when switching to settlement tab
  useEffect(() => {
    if (activeTab !== "settlement" || feedbackLoaded || contractSummaries.length === 0) return;
    const loadFeedbacks = async () => {
      try {
        const allFeedbacks: Record<string, SettlementItemFeedback> = {};
        for (const contract of contractSummaries) {
          const saved = await apiClient.get<SavedFeedback[]>(
            `/customer/contracts/${contract.id}/settlement-feedback`,
          );
          for (const fb of saved) {
            allFeedbacks[fb.contractLineItemId] = {
              lineItemId: fb.contractLineItemId,
              status: fb.status as SettlementItemFeedback["status"],
              note: fb.feedbackNote || "",
            };
          }
        }
        setSettlementFeedbacks(allFeedbacks);
        setFeedbackLoaded(true);
      } catch {
        // Silently fail — feedbacks are optional
      }
    };
    void loadFeedbacks();
  }, [activeTab, feedbackLoaded, contractSummaries]);

  const setItemFeedback = (lineItemId: string, status: SettlementItemFeedback["status"], note?: string) => {
    setSettlementFeedbacks((prev) => ({
      ...prev,
      [lineItemId]: {
        lineItemId,
        status,
        note: note ?? prev[lineItemId]?.note ?? "",
      },
    }));
  };

  const updateFeedbackNote = (lineItemId: string, note: string) => {
    setSettlementFeedbacks((prev) => ({
      ...prev,
      [lineItemId]: {
        ...prev[lineItemId],
        lineItemId,
        status: prev[lineItemId]?.status ?? "feedback",
        note,
      },
    }));
  };

  const handleSubmitSettlementFeedback = async () => {
    const items = settlementLineItems
      .filter((item) => item.id && settlementFeedbacks[item.id]?.status && settlementFeedbacks[item.id].status !== "pending")
      .map((item) => ({
        lineItemId: item.id!,
        status: settlementFeedbacks[item.id!].status as "agreed" | "feedback",
        note: settlementFeedbacks[item.id!].note || undefined,
      }));

    if (items.length === 0) {
      toast.error("Vui lòng chọn đồng ý hoặc feedback cho ít nhất một hạng mục.");
      return;
    }

    // Find the contract to submit to
    const contractId = contractSummaries.find((c) => c.status === "active" || c.status === "liquidated")?.id;
    if (!contractId) {
      toast.error("Không tìm thấy hợp đồng để nghiệm thu.");
      return;
    }

    setFeedbackSubmitting(true);
    try {
      await apiClient.post(`/customer/contracts/${contractId}/settlement-feedback`, { items });
      const feedbackCount = items.filter((i) => i.status === "feedback").length;
      toast.success(
        feedbackCount > 0
          ? `Đã gửi nghiệm thu: ${items.length - feedbackCount} đồng ý, ${feedbackCount} cần xem lại.`
          : "Đã đồng ý tất cả hạng mục. Cảm ơn bạn!",
      );
      setExpandedFeedback(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gửi nghiệm thu thất bại.");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const feedbackStats = useMemo(() => {
    const total = settlementLineItems.filter((i) => i.id).length;
    const agreed = settlementLineItems.filter((i) => i.id && settlementFeedbacks[i.id]?.status === "agreed").length;
    const feedback = settlementLineItems.filter((i) => i.id && settlementFeedbacks[i.id]?.status === "feedback").length;
    const pending = total - agreed - feedback;
    return { total, agreed, feedback, pending };
  }, [settlementLineItems, settlementFeedbacks]);

  const taskStats = useMemo(() => {
    const total = detailedTasks.length;
    const done = detailedTasks.filter((t) => t.status === "done").length;
    const inProgress = detailedTasks.filter((t) => t.status === "in_progress").length;
    const review = detailedTasks.filter((t) => t.status === "review").length;
    const todo = detailedTasks.filter((t) => t.status === "todo").length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, inProgress, review, todo, percent };
  }, [detailedTasks]);

  const selectedContract = useMemo(
    () => contractSummaries.find((contract) => contract.id === paymentForm.contractId),
    [contractSummaries, paymentForm.contractId],
  );

  const selectedTransaction = useMemo(
    () => transactions.find((transaction) => transaction.id === paymentForm.transactionId),
    [paymentForm.transactionId, transactions],
  );

  const paymentLimit = selectedTransaction
    ? Number(selectedTransaction.amount || 0)
    : selectedContract?.outstanding ?? totals.remaining;

  useEffect(() => {
    const contractIdFromQuery = searchParams.get("contractId");
    setPaymentForm((current) => {
      if (current.transactionId) return current;

      const currentContract = contractSummaries.find(
        (contract) => contract.id === current.contractId && contract.payable && contract.outstanding > 0,
      );
      const queryContract = contractIdFromQuery
        ? contractSummaries.find((contract) => contract.id === contractIdFromQuery)
        : undefined;
      const nextContract =
        queryContract ??
        currentContract ??
        contractSummaries.find((contract) => contract.payable && contract.outstanding > 0);

      if (!nextContract) {
        return current.contractId ? { ...current, contractId: "" } : current;
      }
      const scheduledTransaction = getNextScheduledTransaction(transactions, nextContract.id);
      if (current.contractId === nextContract.id && current.transactionId === scheduledTransaction?.id) return current;

      return {
        ...current,
        transactionId: scheduledTransaction?.id ?? "",
        contractId: nextContract.id,
        amount: scheduledTransaction
          ? String(Number(scheduledTransaction.amount || 0))
          : nextContract.outstanding > 0
            ? String(nextContract.outstanding)
            : current.amount,
      };
    });
  }, [contractSummaries, searchParams, transactions]);

  const handleSendMessage = async () => {
    if (!id || !newMessage.trim()) return;
    try {
      const created = await apiClient.post<Message>(`/customer/events/${id}/chat-messages`, { message: newMessage });
      setNewMessage("");
      appendMessage(created);
    } catch (error) {
      toast.error("Gửi tin nhắn thất bại");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!id) return;
    try {
      await apiClient.del(`/customer/events/${id}/chat-messages/${messageId}`);
      removeMessage(messageId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xóa tin nhắn thất bại");
    }
  };

  const handleSendAttachment = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !id) return;

    setAttaching(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", "chat");
      const uploaded = await apiClient.upload<{ url: string; type: string; name: string }>(
        "/upload/file",
        form,
      );
      const created = await apiClient.post<Message>(`/customer/events/${id}/chat-messages`, {
        message: "",
        attachmentUrl: uploaded.url,
        attachmentType: uploaded.type,
        attachmentName: uploaded.name,
      });
      appendMessage(created);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gửi tệp thất bại");
    } finally {
      setAttaching(false);
    }
  };

  const handleDownload = (name: string) => {
    toast.success(`Đang tải "${name}"...`);
  };

  const selectPaymentContract = (contractId: string) => {
    const contract = contractSummaries.find((item) => item.id === contractId);
    const scheduledTransaction = getNextScheduledTransaction(transactions, contractId);
    setPaymentForm((current) => ({
      ...current,
      transactionId: scheduledTransaction?.id ?? "",
      contractId,
      amount: scheduledTransaction
        ? String(Number(scheduledTransaction.amount || 0))
        : contract?.outstanding
          ? String(contract.outstanding)
          : current.amount,
    }));
  };

  const selectPaymentTransaction = (transaction: Transaction) => {
    setPaymentForm((current) => ({
      ...current,
      transactionId: transaction.id,
      contractId: transaction.contract?.id ?? "",
      amount: String(Number(transaction.amount || 0)),
      paymentMethod: transaction.paymentMethod || current.paymentMethod || PAYMENT_METHODS[0],
      note: "",
    }));
    requestAnimationFrame(() => {
      paymentFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleSubmitPayment = async () => {
    if (!id) return;
    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0) {
      toast.error("Vui lòng nhập số tiền thanh toán hợp lệ");
      return;
    }
    if (!paymentForm.paymentMethod.trim()) {
      toast.error("Vui lòng chọn hình thức thanh toán");
      return;
    }
    if (paymentLimit <= 0) {
      toast.error("Không còn số tiền cần thanh toán");
      return;
    }
    if (amount > paymentLimit) {
      toast.error(`Số tiền không được vượt quá ${money(paymentLimit)}`);
      return;
    }

    setPaying(true);
    try {
      if (paymentForm.transactionId) {
        await apiClient.patch<Transaction>(`/customer/transactions/${paymentForm.transactionId}/pay`, {
          paymentMethod: paymentForm.paymentMethod,
          note: paymentForm.note.trim() || undefined,
        });
      } else {
        await apiClient.post<Transaction>("/customer/transactions", {
          eventId: id,
          contractId: paymentForm.contractId || undefined,
          amount,
          paymentMethod: paymentForm.paymentMethod,
          note: paymentForm.note.trim() || undefined,
        });
      }
      toast.success("Đã gửi thanh toán, vui lòng chờ admin xác nhận");
      setPaymentForm((current) => ({ ...current, transactionId: "", note: "" }));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gửi thanh toán thất bại");
    } finally {
      setPaying(false);
    }
  };

  const money = (value: number) => value.toLocaleString("vi-VN") + "đ";

  const latestContract = event?.contracts?.[0];
  const sentContract = latestContract?.status === "sent" ? latestContract : null;
  const activeContract = latestContract?.status === "active" || latestContract?.status === "liquidated"
    ? latestContract
    : null;
  const cancelledContract = latestContract?.status === "cancelled" ? latestContract : null;
  const rejectedContract = sentContract?.rejectionNote ? sentContract : null;
  const agreementDescription = cancelledContract
    ? "Hợp đồng đã bị admin hủy và không còn hiệu lực."
    : activeContract
      ? "Khách hàng đã đồng ý báo giá và các điều khoản hợp đồng."
      : rejectedContract
        ? "Khách hàng đã từ chối hợp đồng và gửi phản hồi."
        : sentContract
          ? "Hợp đồng đang chờ khách hàng xem xét và phản hồi."
          : DEFAULT_MILESTONES[1].description;

  const handleContractAccept = async (contractId: string) => {
    if (!confirm("Bạn xác nhận đồng ý với các điều khoản hợp đồng này?")) return;
    setContractResponding(true);
    try {
      await apiClient.patch(`/customer/contracts/${contractId}/respond`, { action: "accept" });
      toast.success("Đã xác nhận đồng ý hợp đồng");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Thao tác thất bại");
    } finally {
      setContractResponding(false);
    }
  };

  const handleContractReject = async () => {
    if (!rejectDialogOpen) return;
    setContractResponding(true);
    try {
      await apiClient.patch(`/customer/contracts/${rejectDialogOpen}/respond`, {
        action: "reject",
        rejectionNote: rejectionNote.trim() || undefined,
      });
      toast.success("Đã gửi phản hồi từ chối hợp đồng");
      setRejectDialogOpen(null);
      setRejectionNote("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Thao tác thất bại");
    } finally {
      setContractResponding(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link to="/dashboard/su-kien" className="flex items-center gap-2 text-muted-foreground font-body text-sm mb-4 hover:text-primary transition-colors">
            <ArrowLeft size={16} /> Quay lại danh sách
          </Link>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="font-serif text-display-sm text-foreground">{event ? getEventDisplayName(event) : (loading ? "Đang tải..." : "Không tìm thấy sự kiện")}</h1>
              <p className="font-body text-muted-foreground mt-1">{event?.type ?? "-"} - {event?.eventDate ? new Date(event.eventDate).toLocaleDateString("vi-VN") : "-"} - {event?.locationText || "-"}</p>
              <p className="font-body text-sm text-muted-foreground mt-1">Quản lý dự án: {event?.organizerUser?.displayName ?? "Chưa phân công"}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-4 py-2 rounded-full font-body text-sm font-semibold ${eventStatusColors[event?.status ?? ""] ?? "bg-muted text-muted-foreground"}`}>{getEventStatusLabel(event?.status)}</span>
              <span className="font-serif text-headline-md text-primary font-bold">{event?.progressPercent ?? 0}%</span>
            </div>
          </div>
          <Progress value={event?.progressPercent ?? 0} className="h-2 mt-4" />
        </motion.div>

        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {[
            { key: "timeline" as const, label: "Tiến độ", icon: Clock },
            { key: "chat" as const, label: "Trao đổi", icon: MessageSquare },
            { key: "documents" as const, label: "Tài liệu", icon: FileText },
            { key: "payment" as const, label: "Thanh toán", icon: CreditCard },
            { key: "settlement" as const, label: "Nghiệm thu", icon: ClipboardCheck },
          ].map(tab => (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key); if (tab.key === "chat") setUnreadChat(0); }}
              className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-body text-sm whitespace-nowrap transition-all ${activeTab === tab.key ? "gradient-primary text-primary-foreground" : "bg-surface-lowest text-muted-foreground hover:text-foreground"}`}>
              <tab.icon size={16} /> {tab.label}
              {tab.key === "chat" && unreadChat > 0 && activeTab !== "chat" && (
                <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] flex items-center justify-center font-bold animate-pulse">
                  {unreadChat > 99 ? "99+" : unreadChat}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "timeline" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl">
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
              {(() => {
                // Map event status → index of the step currently "in progress"
                // Steps before this index are "completed", this index is "in_progress", after are "pending"
                const EVENT_STATUS_TO_STEP: Record<string, number> = {
                  draft: 0,        // Xác nhận yêu cầu
                  planning: 3,     // Lên kế hoạch chi tiết
                  quoted: 1,       // Báo giá & Thống nhất
                  contracted: 2,   // Ký hợp đồng & Đặt cọc
                  in_progress: 4,  // Đặt venue & Nhà cung cấp
                  completed: 7,    // All done
                };
                const currentStepIndex = EVENT_STATUS_TO_STEP[event?.status ?? ""] ?? -1;

                return DEFAULT_MILESTONES.map((defaultStep, i) => {
                  const apiMilestone = milestones[i];
                  const milestoneDate = apiMilestone?.dueDate ?? apiMilestone?.milestoneDate ?? null;

                  // Determine status: use event status mapping, fallback to API milestone
                  let status: string;
                  if (currentStepIndex >= 0) {
                    if (i < currentStepIndex) status = "completed";
                    else if (i === currentStepIndex) status = "in_progress";
                    else status = "pending";
                  } else {
                    status = apiMilestone?.status ?? defaultStep.status;
                  }

                  return (
                    <motion.div key={defaultStep.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="relative flex items-start gap-6 mb-8">
                      <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${status === "done" || status === "completed" ? "bg-secondary text-secondary-foreground" : status === "current" || status === "in_progress" ? "gradient-primary text-primary-foreground animate-pulse" : "bg-surface-high text-muted-foreground"}`}>
                        {status === "done" || status === "completed" ? <CheckCircle size={18} /> : status === "current" || status === "in_progress" ? <Clock size={18} /> : <Circle size={18} />}
                      </div>
                      <div className="bg-surface-lowest rounded-xl p-5 shadow-ambient flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-serif text-foreground font-semibold">{defaultStep.title}</h3>
                          <span className="font-body text-xs text-muted-foreground">{milestoneDate ? new Date(milestoneDate).toLocaleDateString("vi-VN") : ""}</span>
                        </div>
                        <p className="font-body text-sm text-muted-foreground">
                          {i === 1 ? agreementDescription : defaultStep.description}
                        </p>

                        {/* Contract response UI for "Báo giá & Thống nhất" step */}
                        {i === 1 && cancelledContract && (
                          <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 flex items-start gap-2">
                            <Ban size={16} className="mt-0.5 shrink-0 text-destructive" />
                            <div className="min-w-0 flex-1">
                              <div className="sm:flex sm:items-center sm:gap-3">
                                <div className="min-w-0">
                                  <p className="font-body text-sm text-destructive font-semibold">Admin đã hủy hợp đồng</p>
                                  <p className="font-body text-xs text-muted-foreground break-words">{cancelledContract.contractCode}</p>
                                </div>
                                {cancelledContract.rejectionNote ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-2 rounded-lg border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive sm:ml-auto sm:mt-0"
                                    onClick={() => openFeedbackPanel(cancelledContract, "cancelled")}
                                  >
                                    <Eye size={14} className="mr-1" /> Xem phản hồi
                                  </Button>
                                ) : null}
                                {cancelledContract.updatedAt && (
                                  <span className="mt-1 block font-body text-xs text-muted-foreground sm:ml-auto sm:mt-0 sm:shrink-0">
                                    {new Date(cancelledContract.updatedAt).toLocaleDateString("vi-VN")}
                                  </span>
                                )}
                              </div>
                              <p className="mt-2 font-body text-xs text-muted-foreground">
                                Hợp đồng này không còn hiệu lực và đã được loại khỏi các khoản cần thanh toán.
                              </p>
                              {cancelledContract.rejectionNote && (
                                <p className="mt-1 font-body text-xs text-muted-foreground">
                                  Bấm Xem phản hồi để mở lại nội dung bạn đã gửi.
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                        {i === 1 && activeContract && (
                          <div className="mt-4 rounded-lg border border-secondary/20 bg-secondary/5 p-3 flex items-start gap-2">
                            <CheckCircle size={16} className="mt-0.5 shrink-0 text-secondary" />
                            <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-3">
                              <div className="min-w-0">
                                <p className="font-body text-sm text-secondary font-semibold">Đã đồng ý hợp đồng</p>
                                <p className="font-body text-xs text-muted-foreground break-words">{activeContract.contractCode}</p>
                              </div>
                              {activeContract.signedAt && (
                                <span className="mt-1 block font-body text-xs text-muted-foreground sm:ml-auto sm:mt-0 sm:shrink-0">
                                  {new Date(activeContract.signedAt).toLocaleDateString("vi-VN")}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {i === 1 && rejectedContract && (
                          <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 flex items-start gap-2">
                            <XCircle size={16} className="mt-0.5 shrink-0 text-destructive" />
                            <div className="min-w-0 flex-1">
                              <div className="sm:flex sm:items-center sm:gap-3">
                                <div className="min-w-0">
                                  <p className="font-body text-sm text-destructive font-semibold">Đã từ chối hợp đồng</p>
                                  <p className="font-body text-xs text-muted-foreground break-words">{rejectedContract.contractCode}</p>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-2 rounded-lg border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive sm:ml-auto sm:mt-0"
                                  onClick={() => openFeedbackPanel(rejectedContract, "rejected")}
                                >
                                  <Eye size={14} className="mr-1" /> Xem phản hồi
                                </Button>
                                {rejectedContract.respondedAt && (
                                  <span className="mt-1 block font-body text-xs text-muted-foreground sm:ml-auto sm:mt-0 sm:shrink-0">
                                    {new Date(rejectedContract.respondedAt).toLocaleDateString("vi-VN")}
                                  </span>
                                )}
                              </div>
                              <p className="mt-2 font-body text-xs text-muted-foreground">
                                Phản hồi đã được gửi. Vui lòng chờ hợp đồng được cập nhật.
                              </p>
                            </div>
                          </div>
                        )}
                        {i === 1 && sentContract && (
                          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <FileText size={16} className="text-primary" />
                              <span className="font-body text-sm font-semibold text-foreground">
                                {sentContract.contractCode}
                              </span>
                              <span className="font-body text-xs text-muted-foreground">
                                · {money(Number(sentContract.totalValue || 0))}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Link to={`/dashboard/hop-dong/${sentContract.id}`}>
                                <Button variant="outline" size="sm" className="rounded-lg">
                                  <Eye size={14} className="mr-1" /> Xem hợp đồng
                                </Button>
                              </Link>
                              <Button
                                variant="hero"
                                size="sm"
                                className="rounded-lg"
                                onClick={() => handleContractAccept(sentContract.id)}
                                disabled={contractResponding}
                              >
                                <CheckCircle size={14} className="mr-1" />
                                {contractResponding ? "Đang xử lý..." : sentContract.rejectionNote ? "Đồng ý lại" : "Đồng ý"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-lg text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                                onClick={() => {
                                  setRejectDialogOpen(sentContract.id);
                                  setRejectionNote(sentContract.rejectionNote ?? "");
                                }}
                                disabled={contractResponding}
                              >
                                <XCircle size={14} className="mr-1" />
                                {sentContract.rejectionNote ? "Sửa lý do" : "Từ chối"}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Compact summary + button for "Lên kế hoạch chi tiết" step */}
                        {i === 3 && detailedTasks.length > 0 && (
                          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <ListChecks size={16} className="text-primary shrink-0" />
                                  <span className="font-body text-sm font-semibold text-foreground">
                                    {taskStats.done}/{taskStats.total} công việc hoàn thành
                                  </span>
                                </div>
                                <Progress value={taskStats.percent} className="h-1.5 mb-2" />
                                <div className="flex flex-wrap gap-x-3 gap-y-1 font-body text-xs">
                                  {taskStats.inProgress > 0 && (
                                    <span className="flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                      <span className="text-muted-foreground">{taskStats.inProgress} đang làm</span>
                                    </span>
                                  )}
                                  {taskStats.review > 0 && (
                                    <span className="flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                      <span className="text-muted-foreground">{taskStats.review} kiểm tra</span>
                                    </span>
                                  )}
                                  {taskStats.todo > 0 && (
                                    <span className="flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                                      <span className="text-muted-foreground">{taskStats.todo} chờ xử lý</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="hero"
                                size="sm"
                                className="rounded-lg shrink-0"
                                onClick={() => { setFeedbackPanel(null); setTaskFilter("all"); setTaskPanelOpen(true); }}
                              >
                                Xem chi tiết <ChevronRight size={14} className="ml-0.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                        {i === 3 && detailedTasks.length === 0 && (status === "completed" || status === "in_progress") && (
                          <div className="mt-4 rounded-lg border border-border bg-surface-low p-3">
                            <p className="font-body text-xs text-muted-foreground flex items-center gap-2">
                              <ListChecks size={14} />
                              Chưa có kế hoạch chi tiết cho sự kiện này.
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                });
              })()}
            </div>
          </motion.div>
        )}

        {activeTab === "chat" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl">
            <div className="bg-surface-lowest rounded-xl shadow-ambient overflow-hidden">
              <div className="p-4 bg-surface-low">
                <h3 className="font-serif text-foreground font-semibold">Trao đổi với quản lý dự án</h3>
                <p className="font-body text-sm text-muted-foreground">{event?.organizerUser?.displayName ?? "Chưa phân công"}</p>
              </div>
              <div ref={messagesListRef} className="p-6 space-y-4 max-h-96 overflow-y-auto">
                {messages.map(msg => {
                  const isMine = msg.senderUserId === user?.userId;
                  return (
                    <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`group flex items-center gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
                      {isMine && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          title="Xóa tin nhắn"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <div className={`max-w-[80%] rounded-xl p-4 ${isMine ? "gradient-primary text-primary-foreground" : "bg-surface-low"}`}>
                        {!isMine && <p className="font-body text-xs text-primary font-semibold mb-1">{msg.sender?.displayName ?? "Quản lý"}</p>}
                        {msg.messageText && <p className="font-body text-sm">{msg.messageText}</p>}
                        <ChatAttachment url={msg.attachmentUrl} type={msg.attachmentType} name={msg.attachmentName} isMine={isMine} />
                        <p className={`font-body text-xs mt-2 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{new Date(msg.sentAt).toLocaleString("vi-VN")}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <div className="p-4 bg-surface-low flex gap-3">
                <input ref={chatFileInputRef} type="file" className="hidden" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" onChange={handleSendAttachment} />
                <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void handleSendMessage(); }} placeholder={attaching ? "Đang gửi tệp..." : "Nhập tin nhắn..."} className="flex-1 rounded-xl bg-surface-lowest font-body border-none" />
                <Button variant="ghost" size="icon" onClick={() => chatFileInputRef.current?.click()} disabled={attaching} title="Gửi hình ảnh / tệp"><Paperclip size={18} /></Button>
                <Button variant="hero" size="icon" onClick={handleSendMessage} disabled={!newMessage.trim()}><Send size={18} /></Button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "documents" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl space-y-4">
            {documents.map(doc => {
              const name = doc.name || doc.fileName || "Tài liệu";
              const isContract = Boolean(doc.contractId);
              return (
                <div key={doc.id} className="flex items-center justify-between bg-surface-lowest rounded-xl p-5 shadow-ambient">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-surface-low flex items-center justify-center"><FileText size={18} className="text-primary" /></div>
                    <div>
                      <p className="font-body text-sm font-semibold text-foreground">{name}</p>
                      <p className="font-body text-xs text-muted-foreground">{doc.fileType || "Tệp"} - {new Date(doc.createdAt).toLocaleDateString("vi-VN")}</p>
                    </div>
                  </div>
                  {isContract ? (
                    <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/hop-dong/${doc.contractId}`)}><Eye size={14} className="mr-1" /> Xem hợp đồng</Button>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(name)}><Download size={14} /></Button>
                  )}
                </div>
              );
            })}
            {documents.length === 0 && <p className="font-body text-sm text-muted-foreground">Chưa có tài liệu cho sự kiện này.</p>}
          </motion.div>
        )}

        {activeTab === "payment" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
              <div className="bg-surface-lowest rounded-xl p-5 shadow-ambient text-center"><p className="font-body text-sm text-muted-foreground">Tổng giá trị</p><p className="font-serif text-headline-lg text-foreground mt-1">{money(totals.total)}</p></div>
              <div className="bg-surface-lowest rounded-xl p-5 shadow-ambient text-center"><p className="font-body text-sm text-muted-foreground">Theo lịch</p><p className="font-serif text-headline-lg text-foreground mt-1">{money(totals.scheduled)}</p></div>
              <div className="bg-surface-lowest rounded-xl p-5 shadow-ambient text-center"><p className="font-body text-sm text-muted-foreground">Đã thanh toán</p><p className="font-serif text-headline-lg text-secondary mt-1">{money(totals.paid)}</p></div>
              <div className="bg-surface-lowest rounded-xl p-5 shadow-ambient text-center"><p className="font-body text-sm text-muted-foreground">Chờ xác nhận</p><p className="font-serif text-headline-lg text-primary mt-1">{money(totals.pending)}</p></div>
              <div className="bg-surface-lowest rounded-xl p-5 shadow-ambient text-center"><p className="font-body text-sm text-muted-foreground">Còn lại</p><p className="font-serif text-headline-lg text-primary mt-1">{money(totals.remaining)}</p></div>
            </div>
            <div className="space-y-4">
              <h3 className="font-serif text-headline-md text-foreground">Lịch sử giao dịch</h3>
              {transactions.map(tx => {
                const canSelectTransaction = tx.status === "pending" && !tx.paymentMethod && Number(tx.amount || 0) > 0;
                const isSelectedTransaction = paymentForm.transactionId === tx.id;
                const transactionStatusLabel =
                  tx.status === "pending" && !tx.paymentMethod
                    ? "Theo lịch thanh toán"
                    : getTransactionStatusLabel(tx.status);

                return (
                  <div key={tx.id} className="flex flex-col gap-4 bg-surface-lowest rounded-xl p-5 shadow-ambient sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-body text-sm font-semibold text-foreground">{tx.description}</p>
                      <p className="font-body text-xs text-muted-foreground">{new Date(tx.transactionDate).toLocaleDateString("vi-VN")} - {tx.paymentMethod || "-"}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                      <div className="text-left sm:text-right">
                        <p className="font-serif font-semibold text-foreground">{money(Number(tx.amount || 0))}</p>
                        <span className={`text-xs font-body font-semibold ${tx.status === "completed" ? "text-secondary" : "text-muted-foreground"}`}>{transactionStatusLabel}</span>
                      </div>
                      {canSelectTransaction && (
                        <Button
                          variant={isSelectedTransaction ? "outline" : "hero"}
                          size="sm"
                          onClick={() => selectPaymentTransaction(tx)}
                          disabled={isSelectedTransaction}
                        >
                          <CreditCard size={14} className="mr-1" />
                          {isSelectedTransaction ? "Đang chọn" : "Chọn thanh toán"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              {transactions.length === 0 && <p className="font-body text-sm text-muted-foreground">Chưa có giao dịch cho sự kiện này.</p>}
            </div>
            <div ref={paymentFormRef} className="bg-surface-lowest rounded-xl p-5 shadow-ambient space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface-low flex items-center justify-center">
                  <WalletCards size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-serif text-headline-md text-foreground">Gửi thanh toán</h3>
                  <p className="font-body text-xs text-muted-foreground">Admin sẽ xác nhận sau khi đối soát.</p>
                </div>
              </div>

              {selectedTransaction && (
                <div className="rounded-lg bg-surface-low px-4 py-3">
                  <p className="font-body text-sm font-semibold text-foreground">Đang chọn: {selectedTransaction.description}</p>
                  <p className="font-body text-xs text-muted-foreground mt-1">Số tiền đợt này: {money(Number(selectedTransaction.amount || 0))}</p>
                </div>
              )}

              {contractSummaries.length > 0 && (
                <div>
                  <label className="font-body text-sm text-foreground mb-1 block">Hợp đồng</label>
                  <Select value={paymentForm.contractId || "none"} onValueChange={(value) => value !== "none" && selectPaymentContract(value)} disabled={Boolean(selectedTransaction)}>
                    <SelectTrigger className="rounded-xl bg-surface-low border-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" disabled>Không có hợp đồng cần thanh toán</SelectItem>
                      {contractSummaries.map((contract) => (
                        <SelectItem key={contract.id} value={contract.id} disabled={!contract.payable || contract.outstanding <= 0}>
                          {contract.contractCode} - còn {money(contract.outstanding)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedContract?.versions?.[0]?.paymentTerms && (
                    <p className="font-body text-xs text-muted-foreground mt-2">{selectedContract.versions[0].paymentTerms}</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-body text-sm text-foreground mb-1 block">Số tiền *</label>
                  <Input
                    type="number"
                    min={0}
                    max={paymentLimit || undefined}
                    value={paymentForm.amount}
                    onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))}
                    disabled={Boolean(selectedTransaction)}
                    className="rounded-xl bg-surface-low border-none font-body"
                  />
                  <p className="font-body text-xs text-muted-foreground mt-2">Có thể thanh toán: {money(paymentLimit)}</p>
                </div>

                <div>
                  <label className="font-body text-sm text-foreground mb-1 block">Hình thức *</label>
                  <Select value={paymentForm.paymentMethod} onValueChange={(value) => setPaymentForm((current) => ({ ...current, paymentMethod: value }))}>
                    <SelectTrigger className="rounded-xl bg-surface-low border-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method} value={method}>{method}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="font-body text-sm text-foreground mb-1 block">Ghi chú</label>
                <Textarea
                  value={paymentForm.note}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder="Mã giao dịch / nội dung chuyển khoản"
                  className="rounded-xl bg-surface-low border-none font-body min-h-[92px]"
                />
              </div>

              <Button variant="hero" className="w-full" onClick={handleSubmitPayment} disabled={paying || paymentLimit <= 0}>
                <CreditCard size={16} /> {paying ? "Đang gửi..." : "Gửi thanh toán"}
              </Button>
            </div>
          </motion.div>
        )}

        {activeTab === "settlement" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl space-y-6">
            <div className="bg-surface-lowest rounded-xl p-5 shadow-ambient">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-surface-low flex items-center justify-center">
                    <ClipboardCheck size={18} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-serif text-headline-md text-foreground">Nghiệm thu & quyết toán</h3>
                    <p className="font-body text-sm text-muted-foreground mt-1">
                      {event?.status === "completed"
                        ? "Sự kiện đã hoàn thành, số liệu bên dưới là căn cứ thanh toán còn lại."
                        : "Bảng này đang là dự kiến và sẽ tự cập nhật khi sự kiện hoàn thành."}
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full font-body text-xs font-semibold ${event?.status === "completed" ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary"}`}>
                  {event?.status === "completed" ? "Đã hoàn thành" : "Đang triển khai"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mt-5">
                <div className="rounded-lg bg-surface-low p-4">
                  <p className="font-body text-xs text-muted-foreground">Giá trị hợp đồng</p>
                  <p className="font-serif text-headline-md text-foreground mt-1">{money(totals.total)}</p>
                </div>
                <div className="rounded-lg bg-surface-low p-4">
                  <p className="font-body text-xs text-muted-foreground">Đã thanh toán</p>
                  <p className="font-serif text-headline-md text-secondary mt-1">{money(totals.paid)}</p>
                </div>
                <div className="rounded-lg bg-surface-low p-4">
                  <p className="font-body text-xs text-muted-foreground">Chờ xác nhận</p>
                  <p className="font-serif text-headline-md text-primary mt-1">{money(totals.pending)}</p>
                </div>
                <div className="rounded-lg bg-surface-low p-4">
                  <p className="font-body text-xs text-muted-foreground">Theo lịch</p>
                  <p className="font-serif text-headline-md text-foreground mt-1">{money(totals.scheduled)}</p>
                </div>
                <div className="rounded-lg bg-surface-low p-4">
                  <p className="font-body text-xs text-muted-foreground">Còn phải thanh toán</p>
                  <p className="font-serif text-headline-md text-primary mt-1">{money(totals.remaining)}</p>
                </div>
              </div>
            </div>

            <div className="bg-surface-lowest rounded-xl p-5 shadow-ambient">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <ReceiptText size={18} className="text-primary" />
                  <h3 className="font-serif text-headline-md text-foreground">Hạng mục dịch vụ đã chốt</h3>
                </div>
                {feedbackStats.total > 0 && (
                  <div className="flex items-center gap-2 font-body text-xs">
                    {feedbackStats.agreed > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-secondary/10 text-secondary font-semibold">
                        <ThumbsUp size={12} /> {feedbackStats.agreed}
                      </span>
                    )}
                    {feedbackStats.feedback > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-destructive/10 text-destructive font-semibold">
                        <ThumbsDown size={12} /> {feedbackStats.feedback}
                      </span>
                    )}
                    {feedbackStats.pending > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground font-semibold">
                        <Circle size={12} /> {feedbackStats.pending}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="min-w-[900px] w-full text-sm font-body">
                  <thead className="bg-surface-low">
                    <tr>
                      <th className="px-3 py-2 text-left text-muted-foreground font-semibold">Hợp đồng</th>
                      <th className="px-3 py-2 text-left text-muted-foreground font-semibold">Hạng mục</th>
                      <th className="px-3 py-2 text-center text-muted-foreground font-semibold">SL</th>
                      <th className="px-3 py-2 text-center text-muted-foreground font-semibold">Đơn vị</th>
                      <th className="px-3 py-2 text-right text-muted-foreground font-semibold">Đơn giá</th>
                      <th className="px-3 py-2 text-right text-muted-foreground font-semibold">Thành tiền</th>
                      <th className="px-3 py-2 text-center text-muted-foreground font-semibold">Nghiệm thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlementLineItems.map((item, index) => {
                      const quantity = Number(item.quantity || 0);
                      const unitPrice = Number(item.unitPrice || 0);
                      const amount = Number(item.amount ?? quantity * unitPrice);
                      const itemId = item.id ?? `${item.contractCode}-${index}`;
                      const fb = item.id ? settlementFeedbacks[item.id] : undefined;
                      const fbStatus = fb?.status ?? "pending";
                      const isExpanded = expandedFeedback === itemId;
                      return (
                        <Fragment key={itemId}>
                          <tr className={`border-t border-border transition-colors ${
                            fbStatus === "agreed" ? "bg-secondary/5" : fbStatus === "feedback" ? "bg-destructive/5" : ""
                          }`}>
                            <td className="px-3 py-3 text-primary font-semibold">{item.contractCode}</td>
                            <td className="px-3 py-3">
                              <p className="font-semibold text-foreground">{item.category}</p>
                              {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                            </td>
                            <td className="px-3 py-3 text-center text-foreground">{quantity.toLocaleString("vi-VN")}</td>
                            <td className="px-3 py-3 text-center text-foreground">{item.unit || "-"}</td>
                            <td className="px-3 py-3 text-right text-foreground">{money(unitPrice)}</td>
                            <td className="px-3 py-3 text-right font-semibold text-foreground">{money(amount)}</td>
                            <td className="px-3 py-3">
                              {item.id ? (
                                <div className="flex flex-col items-center gap-1.5">
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      title="Đồng ý"
                                      onClick={() => { setItemFeedback(item.id!, "agreed"); setExpandedFeedback(null); }}
                                      className={`p-1.5 rounded-lg transition-all ${
                                        fbStatus === "agreed"
                                          ? "bg-secondary text-secondary-foreground shadow-sm scale-110"
                                          : "bg-surface-low text-muted-foreground hover:bg-secondary/20 hover:text-secondary"
                                      }`}
                                    >
                                      <ThumbsUp size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      title="Feedback"
                                      onClick={() => {
                                        setItemFeedback(item.id!, "feedback");
                                        setExpandedFeedback(isExpanded ? null : itemId);
                                      }}
                                      className={`p-1.5 rounded-lg transition-all ${
                                        fbStatus === "feedback"
                                          ? "bg-destructive text-destructive-foreground shadow-sm scale-110"
                                          : "bg-surface-low text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                                      }`}
                                    >
                                      <ThumbsDown size={14} />
                                    </button>
                                  </div>
                                  {fbStatus === "feedback" && fb?.note && !isExpanded && (
                                    <button
                                      type="button"
                                      onClick={() => setExpandedFeedback(itemId)}
                                      className="flex items-center gap-1 text-[11px] text-destructive hover:underline"
                                    >
                                      <MessageCircle size={10} /> Xem ghi chú
                                    </button>
                                  )}
                                  {fbStatus === "agreed" && (
                                    <span className="text-[11px] text-secondary font-semibold">Đồng ý</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                          {/* Inline feedback textarea — renders right below this item's row */}
                          {isExpanded && item.id && (
                            <tr className="border-t border-destructive/20 bg-destructive/5">
                              <td colSpan={7} className="px-4 py-3">
                                <div className="flex items-start gap-3">
                                  <MessageCircle size={16} className="mt-1 shrink-0 text-destructive" />
                                  <div className="flex-1 space-y-2">
                                    <p className="font-body text-xs font-semibold text-destructive">
                                      Feedback cho: {item.category}
                                    </p>
                                    <Textarea
                                      value={settlementFeedbacks[item.id]?.note ?? ""}
                                      onChange={(e) => updateFeedbackNote(item.id!, e.target.value)}
                                      placeholder="Nhập lý do không đồng ý (VD: Số lượng không đúng, giá cao hơn thỏa thuận...)"
                                      className="resize-none rounded-lg border-destructive/20 bg-background font-body text-sm min-h-[72px]"
                                      rows={2}
                                      autoFocus
                                    />
                                    <div className="flex justify-end">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs"
                                        onClick={() => setExpandedFeedback(null)}
                                      >
                                        Thu gọn
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {settlementLineItems.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                          Chưa có bảng hạng mục báo giá trong hợp đồng.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {settlementLineItems.length > 0 && settlementLineItems.some((i) => i.id) && (
                <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-lg bg-surface-low">
                  <div className="font-body text-sm text-muted-foreground">
                    {feedbackStats.pending > 0 ? (
                      <span>Còn <span className="font-semibold text-foreground">{feedbackStats.pending}</span> hạng mục chưa nghiệm thu</span>
                    ) : feedbackStats.feedback > 0 ? (
                      <span className="text-destructive">Có <span className="font-semibold">{feedbackStats.feedback}</span> hạng mục cần admin xem lại</span>
                    ) : (
                      <span className="text-secondary font-semibold">✓ Đã đồng ý tất cả hạng mục</span>
                    )}
                  </div>
                  <Button
                    variant="hero"
                    onClick={handleSubmitSettlementFeedback}
                    disabled={feedbackSubmitting || feedbackStats.agreed + feedbackStats.feedback === 0}
                    className="shrink-0"
                  >
                    <ClipboardCheck size={16} />
                    {feedbackSubmitting ? "Đang gửi..." : "Gửi nghiệm thu"}
                  </Button>
                </div>
              )}
            </div>

            <div className="bg-surface-lowest rounded-xl p-5 shadow-ambient">
              <h3 className="font-serif text-headline-md text-foreground mb-4">Kết luận quyết toán</h3>
              <div className="space-y-3 font-body text-sm">
                <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
                  <span className="text-muted-foreground">Giá trị hợp đồng và phụ lục đã chốt</span>
                  <span className="font-semibold text-foreground">{money(totals.total)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
                  <span className="text-muted-foreground">Tổng tiền khách hàng đã thanh toán và admin xác nhận</span>
                  <span className="font-semibold text-secondary">{money(totals.paid)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
                  <span className="text-muted-foreground">Khoản khách đã gửi, đang chờ xác nhận</span>
                  <span className="font-semibold text-primary">{money(totals.pending)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-foreground font-semibold">Số tiền còn phải thanh toán</span>
                  <span className="font-serif text-headline-md text-primary">{money(totals.remaining)}</span>
                </div>
              </div>
              {totals.remaining > 0 && (
                <Button variant="hero" className="mt-5" onClick={() => setActiveTab("payment")}>
                  <CreditCard size={16} /> Thanh toán phần còn lại
                </Button>
              )}
              {hasLiquidatedContract && (
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    const liquidatedContract = contractSummaries.find((c) => c.status === "liquidated");
                    if (liquidatedContract) navigate(`/dashboard/hop-dong/${liquidatedContract.id}?view=settlement`);
                  }}
                >
                  <ClipboardCheck size={16} /> Xem biên bản quyết toán
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Task detail slide-over panel */}
      <AnimatePresence>
        {taskPanelOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={() => setTaskPanelOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-background shadow-2xl flex flex-col"
            >
              {/* Panel header */}
              <div className="shrink-0 px-6 py-5 border-b border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
                      <ListChecks size={18} className="text-primary-foreground" />
                    </div>
                    <div>
                      <h2 className="font-serif text-headline-md text-foreground">Kế hoạch chi tiết</h2>
                      <p className="font-body text-xs text-muted-foreground mt-0.5">{taskStats.done}/{taskStats.total} công việc · {taskStats.percent}% hoàn thành</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setTaskPanelOpen(false)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-low transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
                <Progress value={taskStats.percent} className="h-1.5 mb-4" />

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <div className="rounded-lg bg-secondary/10 p-2 text-center">
                    <p className="font-serif text-headline-sm text-secondary">{taskStats.done}</p>
                    <p className="font-body text-[10px] text-secondary/80">Hoàn thành</p>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-2 text-center">
                    <p className="font-serif text-headline-sm text-primary">{taskStats.inProgress}</p>
                    <p className="font-body text-[10px] text-primary/80">Đang làm</p>
                  </div>
                  <div className="rounded-lg bg-amber-500/10 p-2 text-center">
                    <p className="font-serif text-headline-sm text-amber-600">{taskStats.review}</p>
                    <p className="font-body text-[10px] text-amber-600/80">Kiểm tra</p>
                  </div>
                  <div className="rounded-lg bg-surface-low p-2 text-center">
                    <p className="font-serif text-headline-sm text-muted-foreground">{taskStats.todo}</p>
                    <p className="font-body text-[10px] text-muted-foreground">Chờ xử lý</p>
                  </div>
                </div>

                {/* Filter tabs */}
                <div className="flex gap-1.5">
                  {([
                    { key: "all" as const, label: "Tất cả", count: taskStats.total },
                    { key: "in_progress" as const, label: "Đang làm", count: taskStats.inProgress + taskStats.review },
                    { key: "todo" as const, label: "Chờ xử lý", count: taskStats.todo },
                    { key: "done" as const, label: "Hoàn thành", count: taskStats.done },
                  ]).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setTaskFilter(tab.key)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-body text-xs transition-all ${
                        taskFilter === tab.key
                          ? "gradient-primary text-primary-foreground font-semibold"
                          : "bg-surface-low text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tab.label}
                      <span className={`text-[10px] ${taskFilter === tab.key ? "text-primary-foreground/70" : "text-muted-foreground"}`}>({tab.count})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Panel body — scrollable task list */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
                {(() => {
                  const now = new Date();
                  const filteredTasks = detailedTasks.filter((task) => {
                    if (taskFilter === "all") return true;
                    if (taskFilter === "in_progress") return task.status === "in_progress" || task.status === "review";
                    return task.status === taskFilter;
                  });

                  if (filteredTasks.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Filter size={32} className="text-muted-foreground/30 mb-3" />
                        <p className="font-body text-sm text-muted-foreground">Không có công việc nào trong bộ lọc này.</p>
                      </div>
                    );
                  }

                  const taskStatusConfig: Record<string, { label: string; class: string; dotClass: string }> = {
                    done: { label: "Hoàn thành", class: "bg-secondary/10 text-secondary", dotClass: "bg-secondary" },
                    in_progress: { label: "Đang làm", class: "bg-primary/10 text-primary", dotClass: "bg-primary" },
                    review: { label: "Kiểm tra", class: "bg-amber-500/10 text-amber-600", dotClass: "bg-amber-500" },
                    todo: { label: "Chờ xử lý", class: "bg-muted text-muted-foreground", dotClass: "bg-muted-foreground/40" },
                  };
                  const priorityConfig: Record<string, { label: string; class: string }> = {
                    high: { label: "Ưu tiên cao", class: "bg-destructive/10 text-destructive" },
                    medium: { label: "Trung bình", class: "bg-primary/10 text-primary" },
                    low: { label: "Thấp", class: "bg-muted text-muted-foreground" },
                  };

                  return filteredTasks.map((task) => {
                    const statusCfg = taskStatusConfig[task.status] ?? taskStatusConfig.todo;
                    const priorityCfg = priorityConfig[task.priority] ?? priorityConfig.medium;
                    const isDone = task.status === "done";
                    const isOverdue = !isDone && task.dueAt && new Date(task.dueAt) < now;

                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`group rounded-xl border p-4 transition-all hover:shadow-md ${
                          isOverdue
                            ? "border-destructive/25 bg-destructive/5"
                            : isDone
                              ? "border-secondary/15 bg-secondary/5"
                              : "border-border bg-surface-lowest hover:border-primary/20"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                            isDone
                              ? "bg-secondary text-secondary-foreground"
                              : isOverdue
                                ? "bg-destructive/20 text-destructive"
                                : "bg-surface-high text-muted-foreground"
                          }`}>
                            {isDone ? <CheckCircle size={14} /> : isOverdue ? <AlertTriangle size={14} /> : <Circle size={14} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`font-body text-sm font-semibold leading-snug ${
                              isDone ? "text-muted-foreground line-through" : "text-foreground"
                            }`}>
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="font-body text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                                {task.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold font-body ${statusCfg.class}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotClass}`} />
                                {statusCfg.label}
                              </span>
                              <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold font-body ${priorityCfg.class}`}>
                                {priorityCfg.label}
                              </span>
                              {task.dueAt && (
                                <span className={`inline-flex items-center gap-1 font-body text-[11px] ${
                                  isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"
                                }`}>
                                  <Clock size={11} />
                                  {new Date(task.dueAt).toLocaleDateString("vi-VN")}
                                  {isOverdue && " · Quá hạn"}
                                </span>
                              )}
                              {isDone && task.completedAt && (
                                <span className="font-body text-[11px] text-secondary flex items-center gap-1">
                                  <CheckCircle size={11} />
                                  {new Date(task.completedAt).toLocaleDateString("vi-VN")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  });
                })()}
              </div>

              {/* Panel footer */}
              <div className="shrink-0 px-6 py-4 border-t border-border bg-surface-lowest">
                <Button
                  variant="outline"
                  className="w-full rounded-xl"
                  onClick={() => setTaskPanelOpen(false)}
                >
                  Đóng
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {feedbackPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={closeFeedbackPanel}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-background shadow-2xl flex flex-col"
            >
              <div className="shrink-0 px-6 py-5 border-b border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${feedbackPanel.mode === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                      <MessageSquare size={18} />
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-serif text-headline-md text-foreground">Phản hồi của bạn</h2>
                      <p className="font-body text-xs text-muted-foreground mt-0.5 break-words">{feedbackPanel.contractCode}</p>
                    </div>
                  </div>
                  <button
                    onClick={closeFeedbackPanel}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-low transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className={`inline-flex rounded-full px-3 py-1 font-body text-xs font-semibold ${feedbackPanel.mode === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                  {feedbackPanel.mode === "cancelled" ? "Hợp đồng đã hủy" : "Đã từ chối hợp đồng"}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                <div className="rounded-xl border border-border bg-surface-lowest p-4">
                  <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nội dung</p>
                  <p className="mt-2 whitespace-pre-wrap font-body text-sm leading-relaxed text-foreground">{feedbackPanel.note}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-surface-low p-4">
                    <p className="font-body text-xs text-muted-foreground">Loại phản hồi</p>
                    <p className="mt-1 font-body text-sm font-semibold text-foreground">
                      {feedbackPanel.mode === "cancelled" ? "Đã gửi trước khi hủy" : "Đã gửi khi từ chối"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-surface-low p-4">
                    <p className="font-body text-xs text-muted-foreground">Thời gian</p>
                    <p className="mt-1 font-body text-sm font-semibold text-foreground">
                      {feedbackPanel.respondedAt
                        ? new Date(feedbackPanel.respondedAt).toLocaleDateString("vi-VN")
                        : feedbackPanel.updatedAt
                          ? new Date(feedbackPanel.updatedAt).toLocaleDateString("vi-VN")
                          : "-"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="shrink-0 px-6 py-4 border-t border-border bg-surface-lowest">
                <Button variant="outline" className="w-full rounded-xl" onClick={closeFeedbackPanel}>
                  Đóng
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Rejection dialog */}
      {rejectDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setRejectDialogOpen(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-2xl p-6 shadow-xl w-full max-w-md mx-4 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-headline-md text-foreground">Từ chối hợp đồng</h3>
            <p className="font-body text-sm text-muted-foreground">
              Vui lòng cho NiChan biết lý do để chúng tôi có thể điều chỉnh hợp đồng phù hợp hơn.
            </p>
            <Textarea
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
              placeholder="Nhập lý do từ chối (tùy chọn)..."
              rows={4}
              className="resize-none rounded-lg border-none bg-surface-lowest font-body"
            />
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setRejectDialogOpen(null)} className="rounded-lg">Hủy</Button>
              <Button
                variant="destructive"
                onClick={handleContractReject}
                disabled={contractResponding}
                className="rounded-lg"
              >
                {contractResponding ? "Đang gửi..." : "Xác nhận từ chối"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default EventTracking;
