import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, CheckCircle2, Download, Eye, FileText, MessageSquare, Paperclip, Search, Send, Trash2, Upload, Users, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ChatAttachment from "@/components/features/chat/ChatAttachment";
import ContractPdfButton from "@/components/features/contracts/ContractPdfButton";
import { apiClient } from "@/services/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { useChatSocket } from "@/hooks/useChatSocket";
import { toast } from "sonner";

type Project = {
  id: string;
  name: string;
  type: string;
  status: string;
  eventDate?: string | null;
  guestCount?: number | null;
  customerUser: { displayName: string; email?: string | null; phone?: string | null };
  _count: { staffAssignments?: number; tasks?: number };
};

type Message = {
  id: string;
  senderUserId: string;
  sender?: { displayName: string } | null;
  messageText: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  attachmentName?: string | null;
  sentAt: string;
};

type DocumentItem = {
  id: string;
  name?: string;
  fileType?: string;
  fileUrl?: string;
  contractId?: string | null;
  uploadedById?: string | null;
  createdAt: string;
  status?: string;
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa cập nhật";

const getProjectSortOrder = (status: string) => {
  if (status === "cancelled") return 2;
  if (status === "completed") return 1;
  return 0;
};

const sortProjectsByStatus = (projects: Project[]) =>
  [...projects].sort((a, b) => getProjectSortOrder(a.status) - getProjectSortOrder(b.status));

const OrganizerCommunication = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"chat" | "documents">("chat");

  // Theo dõi tin nhắn chưa đọc theo từng project (local, không phụ thuộc hook global)
  const [unreadByProject, setUnreadByProject] = useState<Record<string, number>>({});

  // Refs để appendMessage đọc giá trị mới nhất mà không cần re-subscribe
  const selectedProjectIdRef = useRef(selectedProjectId);
  selectedProjectIdRef.current = selectedProjectId;
  const tabRef = useRef(tab);
  tabRef.current = tab;

  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [newMessage, setNewMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [contextLoading, setContextLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const filteredProjects = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const matchingProjects = keyword ? projects.filter((project) =>
      [project.name, project.type, project.customerUser.displayName]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword)),
    ) : projects;
    return sortProjectsByStatus(matchingProjects);
  }, [projects, search]);

  const loadContext = async (projectId: string) => {
    if (!projectId) {
      setMessages([]);
      setDocuments([]);
      return;
    }

    setContextLoading(true);
    try {
      const [chatMessages, docs] = await Promise.all([
        apiClient.get<Message[]>(`/organizer/events/${projectId}/chat-messages`),
        apiClient.get<DocumentItem[]>(`/organizer/events/${projectId}/documents`),
      ]);
      setMessages(chatMessages);
      setDocuments(docs);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không tải được dữ liệu trao đổi");
    } finally {
      setContextLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const projectData = await apiClient.get<Project[]>("/organizer/projects");
        setProjects(projectData);
        const firstId = sortProjectsByStatus(projectData)[0]?.id ?? "";
        setSelectedProjectId(firstId);
        if (firstId) await loadContext(firstId);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không tải được danh sách dự án");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    if (!selectedProjectId || loading) return;
    void loadContext(selectedProjectId);
  }, [selectedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Thêm tin nhắn vào danh sách, tránh trùng theo id (socket có thể gửi lại tin của chính mình)
  const appendMessage = (message: Message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      // Chỉ đếm unread khi tin nhắn không phải của mình VÀ project đó không đang được xem ở tab chat
      const isViewingThisChat =
        message.eventId === selectedProjectIdRef.current && tabRef.current === "chat";
      if (message.senderUserId !== user?.userId && !isViewingThisChat) {
        setUnreadByProject((counts) => ({
          ...counts,
          [message.eventId]: (counts[message.eventId] ?? 0) + 1,
        }));
      }
      return [...prev, message];
    });
  };

  // Xóa tin nhắn khỏi danh sách (real-time)
  const removeMessage = (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  // Nhận tin nhắn real-time của dự án đang chọn
  useChatSocket(selectedProjectId || undefined, appendMessage, removeMessage);

  // Cuộn xuống tin mới nhất khi danh sách thay đổi
  useEffect(() => {
    if (tab === "chat") messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, tab]);

  const handleSendMessage = async () => {
    if (!selectedProjectId || !newMessage.trim()) return;
    setSending(true);
    try {
      const created = await apiClient.post<Message>(
        `/organizer/events/${selectedProjectId}/chat-messages`,
        { message: newMessage.trim() },
      );
      setNewMessage("");
      appendMessage(created);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gửi tin nhắn thất bại");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedProjectId) return;
    try {
      await apiClient.del(`/organizer/events/${selectedProjectId}/chat-messages/${messageId}`);
      removeMessage(messageId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xóa tin nhắn thất bại");
    }
  };

  const handleSendAttachment = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedProjectId) return;

    setAttaching(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", "chat");
      const uploaded = await apiClient.upload<{ url: string; type: string; name: string }>(
        "/upload/file",
        form,
      );
      const created = await apiClient.post<Message>(
        `/organizer/events/${selectedProjectId}/chat-messages`,
        {
          message: "",
          attachmentUrl: uploaded.url,
          attachmentType: uploaded.type,
          attachmentName: uploaded.name,
        },
      );
      appendMessage(created);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gửi tệp thất bại");
    } finally {
      setAttaching(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedProjectId) return;

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", file.name);

      const token = localStorage.getItem("nichan_token");
      const res = await fetch(`/api/organizer/events/${selectedProjectId}/documents`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      const json = await res.json().catch(() => ({ success: false }));
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Tải lên thất bại");
      }

      toast.success("Đã tải lên tài liệu");
      const docs = await apiClient.get<DocumentItem[]>(
        `/organizer/events/${selectedProjectId}/documents`,
      );
      setDocuments(docs);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Tải lên thất bại");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (doc: DocumentItem) => {
    if (!selectedProjectId) return;
    if (!window.confirm(`Xóa tài liệu "${doc.name || "Tài liệu"}"?`)) return;

    try {
      await apiClient.del(`/organizer/events/${selectedProjectId}/documents/${doc.id}`);
      setDocuments((current) => current.filter((item) => item.id !== doc.id));
      toast.success("Đã xóa tài liệu");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xóa tài liệu thất bại");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-headline-lg text-foreground">Trao đổi với khách hàng</h1>
        <p className="font-body text-sm text-muted-foreground">
          {loading ? "Đang tải..." : "Nhắn tin và chia sẻ tài liệu với khách hàng theo từng dự án"}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[340px,1fr] gap-5">
        <div className="space-y-4">
          <div className="bg-surface-lowest rounded-xl p-4 shadow-ambient">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm dự án..."
                className="pl-9 rounded-xl bg-surface-low font-body border-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  setSelectedProjectId(project.id);
                  if (tab === "chat") setUnreadByProject((c) => { const n = { ...c }; delete n[project.id]; return n; });
                }}
                className={`w-full text-left bg-surface-lowest rounded-xl p-4 shadow-ambient transition-all relative ${
                  selectedProjectId === project.id ? "ring-2 ring-primary" : "hover:bg-surface-low"
                }`}
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-body text-sm font-semibold text-foreground">
                    <span className="truncate">{project.name}</span>
                    {project.status === "completed" && (
                      <CheckCircle2 size={16} className="shrink-0 text-emerald-600" aria-label="Sự kiện đã hoàn thành" />
                    )}
                    {project.status === "cancelled" && (
                      <XCircle size={16} className="shrink-0 text-destructive" aria-label="Sự kiện đã bị hủy" />
                    )}
                  </p>
                  <p className="font-body text-xs text-muted-foreground truncate">
                    {project.customerUser.displayName} - {formatDate(project.eventDate)}
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-2 font-body text-xs text-muted-foreground">
                  <Calendar size={12} /> {project.type} · {project.guestCount ?? 0} khách
                </div>
                {(unreadByProject[project.id] ?? 0) > 0 && (
                  <span className="absolute top-3 right-3 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] flex items-center justify-center font-bold animate-pulse">
                    {unreadByProject[project.id] > 99 ? "99+" : unreadByProject[project.id]}
                  </span>
                )}
              </button>
            ))}

            {filteredProjects.length === 0 && !loading && (
              <div className="bg-surface-lowest rounded-xl p-6 shadow-ambient text-sm font-body text-muted-foreground">
                Chưa có dự án được phân công.
              </div>
            )}
          </div>
        </div>

        <div className="bg-surface-lowest rounded-xl p-5 shadow-ambient min-w-0">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-5">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 font-serif text-headline-md text-foreground">
                <span className="truncate">{selectedProject?.name ?? "Chưa chọn dự án"}</span>
                {selectedProject?.status === "completed" && (
                  <CheckCircle2 size={20} className="shrink-0 text-emerald-600" aria-label="Sự kiện đã hoàn thành" />
                )}
                {selectedProject?.status === "cancelled" && (
                  <XCircle size={20} className="shrink-0 text-destructive" aria-label="Sự kiện đã bị hủy" />
                )}
              </h2>
              <div className="flex flex-wrap gap-3 mt-2 font-body text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Users size={14} /> {selectedProject?.customerUser.displayName ?? "-"}</span>
                <span className="inline-flex items-center gap-1"><Calendar size={14} /> {formatDate(selectedProject?.eventDate)}</span>
              </div>
            </div>
            <div className="flex p-1 rounded-xl bg-surface-low">
              <button onClick={() => { setTab("chat"); setUnreadByProject((c) => { const n = { ...c }; delete n[selectedProjectId]; return n; }); }} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-body text-sm transition-all ${tab === "chat" ? "bg-background shadow-ambient text-foreground font-semibold" : "text-muted-foreground"}`}>
                <MessageSquare size={14} /> Trao đổi
              </button>
              <button onClick={() => setTab("documents")} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-body text-sm transition-all ${tab === "documents" ? "bg-background shadow-ambient text-foreground font-semibold" : "text-muted-foreground"}`}>
                <FileText size={14} /> Tài liệu
              </button>
            </div>
          </div>

          {!selectedProjectId && !loading && (
            <div className="rounded-xl bg-surface-low p-6 font-body text-sm text-muted-foreground">
              Chọn một dự án để bắt đầu trao đổi.
            </div>
          )}

          {selectedProjectId && tab === "chat" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border overflow-hidden">
              <div className="p-4 bg-surface-low">
                <h3 className="font-serif text-foreground font-semibold">Trao đổi với khách hàng</h3>
                <p className="font-body text-sm text-muted-foreground">{selectedProject?.customerUser.displayName ?? "-"}</p>
              </div>
              <div className="p-6 space-y-4 max-h-[28rem] overflow-y-auto">
                {messages.map((msg) => {
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
                        {!isMine && <p className="font-body text-xs text-primary font-semibold mb-1">{msg.sender?.displayName ?? "Khách hàng"}</p>}
                        {msg.messageText && <p className="font-body text-sm">{msg.messageText}</p>}
                        <ChatAttachment url={msg.attachmentUrl} type={msg.attachmentType} name={msg.attachmentName} isMine={isMine} />
                        <p className={`font-body text-xs mt-2 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{new Date(msg.sentAt).toLocaleString("vi-VN")}</p>
                      </div>
                    </motion.div>
                  );
                })}
                {messages.length === 0 && !contextLoading && (
                  <p className="font-body text-sm text-muted-foreground">Chưa có tin nhắn nào. Hãy gửi lời chào tới khách hàng.</p>
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-4 bg-surface-low flex gap-3">
                <input
                  ref={chatFileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                  onChange={handleSendAttachment}
                />
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleSendMessage(); }}
                  placeholder={attaching ? "Đang gửi tệp..." : "Nhập tin nhắn..."}
                  className="flex-1 rounded-xl bg-surface-lowest font-body border-none"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => chatFileInputRef.current?.click()}
                  disabled={attaching}
                  title="Gửi hình ảnh / tệp"
                >
                  <Paperclip size={18} />
                </Button>
                <Button variant="hero" size="icon" onClick={handleSendMessage} disabled={sending || !newMessage.trim()}><Send size={18} /></Button>
              </div>
            </motion.div>
          )}

          {selectedProjectId && tab === "documents" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex justify-end">
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
                <Button variant="hero" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload size={14} /> {uploading ? "Đang tải lên..." : "Tải lên tài liệu"}
                </Button>
              </div>

              {documents.map((doc) => {
                const canDelete = doc.uploadedById === user?.userId;
                const name = doc.name || "Tài liệu";
                return (
                  <div key={doc.id} className="flex items-center justify-between bg-background rounded-xl p-5 border border-border">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-surface-low flex items-center justify-center shrink-0"><FileText size={18} className="text-primary" /></div>
                      <div className="min-w-0">
                        <p className="font-body text-sm font-semibold text-foreground truncate">{name}</p>
                        <p className="font-body text-xs text-muted-foreground">{doc.fileType || "Tệp"} - {new Date(doc.createdAt).toLocaleDateString("vi-VN")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {doc.contractId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => navigate(`/ban-to-chuc/hop-dong/${doc.contractId}`)}
                          title="Xem hợp đồng"
                        >
                          <Eye size={14} />
                        </Button>
                      )}
                      {doc.contractId && (
                        <ContractPdfButton
                          detailPath={`/organizer/contracts/${doc.contractId}`}
                          variant="ghost"
                          size="icon"
                          label=""
                          className="h-8 w-8"
                          title="Lưu hợp đồng PDF"
                        />
                      )}
                      {!doc.contractId && doc.fileUrl && (
                        <a href={doc.fileUrl} target="_blank" rel="noreferrer">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Tải xuống"><Download size={14} /></Button>
                        </a>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteDocument(doc)}
                          title="Xóa tài liệu"
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              {documents.length === 0 && !contextLoading && (
                <p className="font-body text-sm text-muted-foreground">Chưa có tài liệu cho dự án này.</p>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrganizerCommunication;
