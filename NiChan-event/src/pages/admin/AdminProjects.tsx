import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  CheckCircle,
  ChevronRight,
  Edit2,
  Plus,
  Search,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";
import { eventStatusLabels, eventStatusColors, eventStatusFilters, getEventStatusLabel } from "@/lib/eventDisplay";

type Project = {
  id: string;
  name: string;
  type: string;
  status: string;
  eventDate?: string | null;
  guestCount?: number | null;
  progressPercent: number;
  customerUser: { id: string; displayName: string; email?: string | null };
  organizerUser?: { id: string; displayName: string; email?: string | null } | null;
  consultationRequest?: {
    requestCode: string;
    status: string;
    customerName?: string | null;
    eventType?: string | null;
    note?: string | null;
  } | null;
  _count: { tasks: number; milestones: number; vendors?: number; staffAssignments?: number };
};

type Manager = { id: string; displayName: string; email: string };

type KanbanTask = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: "low" | "medium" | "high";
  dueAt?: string | null;
  assignee?: { displayName: string } | null;
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
    progressPercent: number;
    customerUser?: { displayName: string };
    organizerUser?: { displayName: string } | null;
  };
  columns: KanbanColumn[];
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
    staffProfile?: { jobTitle?: string | null; employmentStatus?: string | null } | null;
  };
};

type ProjectDetail = {
  id: string;
  staffAssignments?: ProjectStaffAssignment[];
};

const statuses = eventStatusFilters;
const statusLabel = eventStatusLabels;
const statusColors = eventStatusColors;

const priorityLabel: Record<KanbanTask["priority"], string> = {
  high: "Cao",
  medium: "Trung bình",
  low: "Thấp",
};

const allowedTaskMoves: Record<string, string[]> = {
  todo: ["in_progress"],
  in_progress: ["review", "todo"],
  review: ["done", "in_progress"],
  done: [],
};

type TaskFormState = { title: string; description: string; dueAt: string; priority: "low" | "medium" | "high" };
const emptyForm: TaskFormState = { title: "", description: "", dueAt: "", priority: "medium" };

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa cập nhật";

const toApiDateTime = (value: string) =>
  value ? new Date(`${value}T00:00:00`).toISOString() : undefined;

const parseEventNameFromNote = (note?: string | null): string | null => {
  if (!note) return null;

  const eventNameLine = note
    .split(/\r?\n/)
    .find((line) => line.trim().toLowerCase().startsWith("ten su kien:"));

  if (!eventNameLine) return null;

  const eventName = eventNameLine.split(":").slice(1).join(":").trim();
  return eventName || null;
};

const normalizeName = (value?: string | null) => value?.trim().toLowerCase() ?? "";

const getRequestProjectName = (project: Project) =>
  parseEventNameFromNote(project.consultationRequest?.note) ||
  project.consultationRequest?.eventType ||
  project.type;

const isGeneratedProjectName = (project: Project) => {
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

const getProjectDisplayName = (project: Project) => {
  const requestName = getRequestProjectName(project);
  return isGeneratedProjectName(project) ? requestName : project.name;
};

const getProjectCustomerName = (project: Project) =>
  project.consultationRequest?.customerName || project.customerUser.displayName;

const AdminProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [kanban, setKanban] = useState<KanbanResponse | null>(null);
  const [projectStaff, setProjectStaff] = useState<ProjectStaffAssignment[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [targetStatus, setTargetStatus] = useState("todo");
  const [form, setForm] = useState(emptyForm);
  const [projectNameForm, setProjectNameForm] = useState("");
  const [loading, setLoading] = useState(true);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const selectedProjectDisplayName = selectedProject ? getProjectDisplayName(selectedProject) : "";

  const loadProjectContext = async (projectId: string) => {
    const [kanbanData, detailData] = await Promise.all([
      apiClient.get<KanbanResponse>(`/admin/projects/${projectId}/kanban`),
      apiClient.get<ProjectDetail>(`/admin/projects/${projectId}`),
    ]);
    setKanban(kanbanData);
    setProjectStaff(detailData.staffAssignments ?? []);
  };

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<Project[]>("/admin/projects", {
        search,
        status: filterStatus === "all" ? undefined : filterStatus,
        pageSize: 100,
      });
      setProjects(data);
      const nextSelected = data.find((project) => project.id === selectedProjectId)?.id ?? data[0]?.id ?? "";
      setSelectedProjectId(nextSelected);
      if (nextSelected) await loadProjectContext(nextSelected);
      else {
        setKanban(null);
        setProjectStaff([]);
      }
    } catch (error) {
      toast.error("Không tải được danh sách dự án");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiClient.get<Manager[]>("/admin/users", { role: "organizer", status: "active", pageSize: 100 })
      .then(setManagers)
      .catch(() => toast.error("Không tải được danh sách người tổ chức"));
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [search, filterStatus]);

  useEffect(() => {
    if (!selectedProjectId) return;
    void loadProjectContext(selectedProjectId);
  }, [selectedProjectId]);

  const refresh = async () => {
    await loadProjects();
    if (selectedProjectId) await loadProjectContext(selectedProjectId);
  };

  const updateProjectStatus = async (projectId: string, status: string) => {
    try {
      await apiClient.patch(`/admin/projects/${projectId}/status`, { status });
      toast.success("Đã cập nhật trạng thái dự án");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cập nhật trạng thái thất bại");
    }
  };

  const updateProjectOrganizer = async (projectId: string, organizerUserId: string) => {
    try {
      await apiClient.patch(`/admin/projects/${projectId}/organizer`, {
        organizerUserId: organizerUserId === "__none" ? null : organizerUserId,
      });
      toast.success("Đã cập nhật người tổ chức");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cập nhật người tổ chức thất bại");
    }
  };

  const openProjectNameEdit = (project: Project) => {
    setEditingProject(project);
    setProjectNameForm(getProjectDisplayName(project));
    setNameDialogOpen(true);
  };

  const saveProjectName = async () => {
    if (!editingProject) return;

    const nextName = projectNameForm.trim();
    if (!nextName) {
      toast.error("Vui lòng nhập tên dự án");
      return;
    }

    try {
      await apiClient.patch(`/admin/projects/${editingProject.id}/name`, { name: nextName });
      toast.success("Đã cập nhật tên dự án");
      setNameDialogOpen(false);
      setEditingProject(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật tên dự án");
    }
  };

  const openAdd = (columnId: string) => {
    setTargetStatus(columnId);
    setEditingTask(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (task: KanbanTask) => {
    setTargetStatus(task.status);
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description || "",
      dueAt: task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : "",
      priority: task.priority,
    });
    setDialogOpen(true);
  };

  const saveTask = async () => {
    if (!selectedProjectId || !form.title.trim()) return;

    try {
      if (editingTask) {
        await apiClient.put(`/admin/projects/tasks/${editingTask.id}`, {
          title: form.title.trim(),
          description: form.description || undefined,
          dueAt: toApiDateTime(form.dueAt),
          priority: form.priority,
        });
        toast.success("Đã cập nhật công việc");
      } else {
        await apiClient.post("/admin/projects/tasks", {
          eventId: selectedProjectId,
          title: form.title.trim(),
          description: form.description || undefined,
          status: targetStatus,
          priority: form.priority,
          dueAt: toApiDateTime(form.dueAt),
          sortOrder: 0,
        });
        toast.success("Đã thêm công việc");
      }
      setDialogOpen(false);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể lưu công việc");
    }
  };

  const moveTask = async (task: KanbanTask, toStatus: string) => {
    try {
      await apiClient.patch(`/admin/projects/tasks/${task.id}/status`, { status: toStatus });
      toast.success("Đã chuyển công việc");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể chuyển công việc");
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await apiClient.del(`/admin/projects/tasks/${taskId}`);
      toast.success("Đã xóa công việc");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xóa công việc");
    }
  };

  const allColumns = kanban?.columns ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-headline-lg text-foreground">Quản lý dự án</h1>
          <p className="font-body text-sm text-muted-foreground">
            {loading ? "Đang tải..." : `${projects.length} dự án`}
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên dự án, khách hàng, mã yêu cầu..."
            className="pl-10 rounded-xl bg-surface-lowest font-body border-none"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statuses.map((status) => (
            <button
              key={status.value}
              onClick={() => setFilterStatus(status.value)}
              className={`px-3 py-2 rounded-xl font-body text-sm transition-all ${
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

      <div className="grid grid-cols-1 xl:grid-cols-[360px,1fr] gap-5">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {projects.map((project) => {
            const projectName = getProjectDisplayName(project);

            return (
              <div
                key={project.id}
                className={`w-full text-left bg-surface-lowest rounded-xl p-4 shadow-ambient transition-all ${
                  selectedProjectId === project.id ? "ring-2 ring-primary" : "hover:bg-surface-low"
                }`}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p
                      className="font-body text-sm font-semibold text-foreground leading-snug line-clamp-2 break-words"
                      title={projectName}
                    >
                      {projectName}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => openProjectNameEdit(project)}
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-low hover:text-foreground"
                    title="Sửa tên dự án"
                    aria-label={`Sửa tên dự án ${projectName}`}
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProjectId(project.id)}
                  className="mt-2 w-full text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 font-body text-xs text-muted-foreground truncate">
                      {getProjectCustomerName(project)} - {formatDate(project.eventDate)}
                    </p>
                    <span className={`shrink-0 whitespace-nowrap px-2 py-1 rounded-full text-[11px] font-body font-semibold ${statusColors[project.status] ?? "bg-muted text-muted-foreground"}`}>
                      {statusLabel[project.status] ?? project.status}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs font-body text-muted-foreground">
                    <span>{project._count.tasks} công việc</span>
                    <span>{project._count.staffAssignments ?? 0} nhân sự</span>
                    <span>{project.progressPercent}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-surface-high overflow-hidden">
                    <div className="h-full gradient-primary" style={{ width: `${project.progressPercent}%` }} />
                  </div>
                </button>
              </div>
            );
          })}

          {!loading && projects.length === 0 && (
            <div className="bg-surface-lowest rounded-xl p-6 shadow-ambient text-sm font-body text-muted-foreground">
              Chưa có dự án phù hợp.
            </div>
          )}
        </motion.div>

        <div className="space-y-5 min-w-0">
          {selectedProject && kanban?.project && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-surface-lowest rounded-xl p-5 shadow-ambient">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-start gap-2">
                    <h2 className="font-serif text-headline-md text-foreground break-words">{selectedProjectDisplayName}</h2>
                    <button
                      type="button"
                      onClick={() => openProjectNameEdit(selectedProject)}
                      className="mt-1 shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-low hover:text-foreground"
                      title="Sửa tên dự án"
                      aria-label={`Sửa tên dự án ${selectedProjectDisplayName}`}
                    >
                      <Edit2 size={15} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2 font-body text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Calendar size={14} /> {formatDate(selectedProject.eventDate)}</span>
                    <span className="inline-flex items-center gap-1"><Users size={14} /> {selectedProject.guestCount ?? 0} khách</span>
                    <span>{selectedProject.type}</span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={selectedProject.organizerUser?.id ?? "__none"}
                    onChange={(event) => updateProjectOrganizer(selectedProject.id, event.target.value)}
                    className="rounded-xl bg-surface-low px-3 py-2 font-body text-sm text-foreground"
                  >
                    <option value="__none">Chưa phân công</option>
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>{manager.displayName}</option>
                    ))}
                  </select>
                  <select
                    value={selectedProject.status}
                    onChange={(event) => updateProjectStatus(selectedProject.id, event.target.value)}
                    className="rounded-xl bg-surface-low px-3 py-2 font-body text-sm text-foreground"
                  >
                    {statuses.filter((status) => status.value !== "all").map((status) => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                  {selectedProject.status !== "completed" && selectedProject.status !== "cancelled" && (
                    <Button variant="outline" size="sm" onClick={() => updateProjectStatus(selectedProject.id, "cancelled")}>
                      <XCircle size={14} /> Hủy
                    </Button>
                  )}
                  {selectedProject.status === "in_progress" && (
                    <Button variant="hero" size="sm" onClick={() => updateProjectStatus(selectedProject.id, "completed")}>
                      <CheckCircle size={14} /> Hoàn thành
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {selectedProject && (
            <div className="bg-surface-lowest rounded-xl p-5 shadow-ambient">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-serif text-headline-md text-foreground">Nhân sự dự án</h3>
                  <p className="font-body text-sm text-muted-foreground">
                    Người tổ chức cập nhật {projectStaff.length} nhân sự cho dự án này
                  </p>
                </div>
                <Users size={18} className="text-primary" />
              </div>

              {projectStaff.length > 0 ? (
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
                        <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[11px] font-body font-semibold text-secondary">
                          {assignment.status}
                        </span>
                      </div>
                      <div className="mt-3 space-y-1 font-body text-xs text-muted-foreground">
                        <p>Vai trò: <span className="text-foreground font-semibold">{assignment.roleText}</span></p>
                        <p>Liên hệ: {assignment.staffUser.phone || assignment.staffUser.email || "-"}</p>
                        <p>Cập nhật: {new Date(assignment.assignedAt).toLocaleString("vi-VN")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-surface-low p-5 font-body text-sm text-muted-foreground">
                  Chưa có nhân sự dự án. Khi người tổ chức thêm nhân sự, danh sách sẽ hiển thị tại đây để admin theo dõi.
                </div>
              )}
            </div>
          )}

          {kanban && (
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
                    <button onClick={() => openAdd(column.id)} className="text-muted-foreground hover:text-foreground" title="Thêm công việc">
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
                              <div className="flex flex-wrap gap-2 mt-2 text-xs font-body text-muted-foreground">
                                <span>{priorityLabel[task.priority]}</span>
                                <span>{task.dueAt ? formatDate(task.dueAt) : "Chưa có hạn"}</span>
                                <span>{task.assignee?.displayName || "Chưa phân công"}</span>
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
          )}
        </div>
      </div>

      <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Sửa tên dự án</DialogTitle>
          </DialogHeader>
          <div>
            <label className="font-body text-sm text-foreground mb-1 block">Tên dự án</label>
            <Input
              value={projectNameForm}
              onChange={(event) => setProjectNameForm(event.target.value)}
              className="rounded-xl border-none bg-surface-low"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNameDialogOpen(false)}>Hủy</Button>
            <Button variant="hero" onClick={saveProjectName}>Cập nhật</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">{editingTask ? "Sửa công việc" : "Thêm công việc"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="font-body text-sm text-foreground mb-1 block">Tên công việc</label>
              <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="rounded-xl border-none bg-surface-low" />
            </div>
            <div>
              <label className="font-body text-sm text-foreground mb-1 block">Mô tả</label>
              <Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="rounded-xl border-none bg-surface-low" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-body text-sm text-foreground mb-1 block">Hạn chót</label>
                <Input type="date" value={form.dueAt} onChange={(event) => setForm({ ...form, dueAt: event.target.value })} className="rounded-xl border-none bg-surface-low" />
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
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button variant="hero" onClick={saveTask}>{editingTask ? "Cập nhật" : "Thêm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProjects;
