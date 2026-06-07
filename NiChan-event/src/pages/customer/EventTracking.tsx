import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, Circle, Clock, MessageSquare, FileText, CreditCard, ArrowLeft, Paperclip, Send, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import ChatAttachment from "@/components/ChatAttachment";
import { apiClient } from "@/services/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { useChatSocket } from "@/hooks/useChatSocket";
import { toast } from "sonner";
import { getEventDisplayName, getEventStatusLabel, getMilestoneStatusLabel, getTransactionStatusLabel, eventStatusColors } from "@/lib/eventDisplay";

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
};

type Milestone = { id: string; title: string; dueDate?: string | null; milestoneDate?: string | null; status: string; description?: string | null };
type Message = { id: string; senderUserId: string; sender?: { displayName: string } | null; messageText: string; attachmentUrl?: string | null; attachmentType?: string | null; attachmentName?: string | null; sentAt: string };
type DocumentItem = { id: string; name?: string; fileName?: string; fileType?: string; createdAt: string; status?: string; event?: { id: string; name: string } };
type Transaction = { id: string; description: string; amount: string | number; transactionDate: string; paymentMethod?: string | null; status: string; event?: { id: string } };

const DEFAULT_MILESTONES: Milestone[] = [
  { id: "default-1", title: "Xác nhận yêu cầu", description: "Yêu cầu đã được tiếp nhận và xác nhận", status: "pending" },
  { id: "default-2", title: "Báo giá & Thống nhất", description: "Báo giá đã được gửi và xác nhận bởi khách hàng", status: "pending" },
  { id: "default-3", title: "Ký hợp đồng & Đặt cọc", description: "Hợp đồng đã ký, đặt cọc 30% đã thanh toán", status: "pending" },
  { id: "default-4", title: "Lên kế hoạch chi tiết", description: "Đang lập kế hoạch chi tiết cho sự kiện", status: "pending" },
  { id: "default-5", title: "Đặt venue & Nhà cung cấp", description: "Liên hệ và xác nhận venue, catering, décor", status: "pending" },
  { id: "default-6", title: "Tổng duyệt", description: "Tổng duyệt toàn bộ chương trình", status: "pending" },
  { id: "default-7", title: "Ngày sự kiện", description: "Ngày diễn ra sự kiện chính thức", status: "pending" },
];

const EventTracking = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"timeline" | "chat" | "documents" | "payment">("timeline");
  const [loading, setLoading] = useState(true);
  const [attaching, setAttaching] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [eventDetail, eventMilestones, chatMessages, docs, txs] = await Promise.all([
        apiClient.get<EventDetail>(`/customer/events/${id}`),
        apiClient.get<Milestone[]>(`/customer/events/${id}/milestones`),
        apiClient.get<Message[]>(`/customer/events/${id}/chat-messages`),
        apiClient.get<DocumentItem[]>("/customer/documents"),
        apiClient.get<Transaction[]>("/customer/transactions"),
      ]);
      setEvent(eventDetail);
      setMilestones(eventMilestones);
      setMessages(chatMessages);
      setDocuments(docs.filter(doc => !doc.event || doc.event.id === id));
      setTransactions(txs.filter(tx => !tx.event || tx.event.id === id));
    } catch (error) {
      toast.error("Không tải được chi tiết sự kiện");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  // Thêm tin nhắn vào danh sách, tránh trùng theo id (socket có thể gửi lại tin của chính mình)
  const appendMessage = (message: Message) => {
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
  };

  // Xóa tin nhắn khỏi danh sách (real-time)
  const removeMessage = (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  // Nhận tin nhắn real-time của sự kiện này
  useChatSocket(id, appendMessage, removeMessage);

  // Cuộn xuống tin mới nhất khi danh sách thay đổi
  useEffect(() => {
    if (activeTab === "chat") messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTab]);

  const totals = useMemo(() => {
    const paid = transactions.filter(tx => tx.status === "completed").reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const total = Number(event?.budgetEstimated || 0);
    return { total, paid, remaining: Math.max(total - paid, 0) };
  }, [event, transactions]);

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

  const money = (value: number) => value.toLocaleString("vi-VN") + "đ";

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
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-body text-sm whitespace-nowrap transition-all ${activeTab === tab.key ? "gradient-primary text-primary-foreground" : "bg-surface-lowest text-muted-foreground hover:text-foreground"}`}>
              <tab.icon size={16} /> {tab.label}
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
                        <p className="font-body text-sm text-muted-foreground">{defaultStep.description}</p>
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
              <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
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
                <div ref={messagesEndRef} />
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
              return (
                <div key={doc.id} className="flex items-center justify-between bg-surface-lowest rounded-xl p-5 shadow-ambient">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-surface-low flex items-center justify-center"><FileText size={18} className="text-primary" /></div>
                    <div>
                      <p className="font-body text-sm font-semibold text-foreground">{name}</p>
                      <p className="font-body text-xs text-muted-foreground">{doc.fileType || "Tệp"} - {new Date(doc.createdAt).toLocaleDateString("vi-VN")}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(name)}><Download size={14} /></Button>
                </div>
              );
            })}
            {documents.length === 0 && <p className="font-body text-sm text-muted-foreground">Chưa có tài liệu cho sự kiện này.</p>}
          </motion.div>
        )}

        {activeTab === "payment" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-surface-lowest rounded-xl p-5 shadow-ambient text-center"><p className="font-body text-sm text-muted-foreground">Tổng giá trị</p><p className="font-serif text-headline-lg text-foreground mt-1">{money(totals.total)}</p></div>
              <div className="bg-surface-lowest rounded-xl p-5 shadow-ambient text-center"><p className="font-body text-sm text-muted-foreground">Đã thanh toán</p><p className="font-serif text-headline-lg text-secondary mt-1">{money(totals.paid)}</p></div>
              <div className="bg-surface-lowest rounded-xl p-5 shadow-ambient text-center"><p className="font-body text-sm text-muted-foreground">Còn lại</p><p className="font-serif text-headline-lg text-primary mt-1">{money(totals.remaining)}</p></div>
            </div>
            <div className="space-y-4">
              <h3 className="font-serif text-headline-md text-foreground">Lịch sử giao dịch</h3>
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between bg-surface-lowest rounded-xl p-5 shadow-ambient">
                  <div><p className="font-body text-sm font-semibold text-foreground">{tx.description}</p><p className="font-body text-xs text-muted-foreground">{new Date(tx.transactionDate).toLocaleDateString("vi-VN")} - {tx.paymentMethod || "-"}</p></div>
                  <div className="text-right"><p className="font-serif font-semibold text-foreground">{money(Number(tx.amount || 0))}</p><span className={`text-xs font-body font-semibold ${tx.status === "completed" ? "text-secondary" : "text-muted-foreground"}`}>{getTransactionStatusLabel(tx.status)}</span></div>
                </div>
              ))}
              {transactions.length === 0 && <p className="font-body text-sm text-muted-foreground">Chưa có giao dịch cho sự kiện này.</p>}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default EventTracking;
