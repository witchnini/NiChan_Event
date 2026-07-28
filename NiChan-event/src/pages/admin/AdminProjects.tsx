import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  eventStatusLabels,
  eventStatusColors,
  eventStatusFilters,
  getEventStatusLabel,
  organizerAssignmentColors,
  organizerAssignmentLabels,
  statusBadgeClassName,
} from "@/lib/eventDisplay";

type Project = {
  id: string;
  name: string;
  type: string;
  status: string;
  eventDate?: string | null;
  guestCount?: number | null;
  progressPercent: number;
  organizerAssignmentStatus?: "pending" | "accepted" | "rejected" | null;
  organizerRejectionReason?: string | null;
  organizerRespondedAt?: string | null;
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
  createdAt?: string | null;
  completedAt?: string | null;
  sortOrder?: number | null;
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
    eventDate?: string | null;
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

type ProjectStaffResponse = {
  event: { id: string; name: string };
  assignments: ProjectStaffAssignment[];
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

const taskStatusLabel: Record<string, string> = {
  todo: "Chờ xử lý",
  in_progress: "Đang thực hiện",
  review: "Đang kiểm tra",
  done: "Hoàn thành",
};

const ganttStatusColors: Record<string, string> = {
  todo: "bg-primary-container/70",
  in_progress: "bg-primary",
  review: "bg-secondary/70",
  done: "bg-secondary",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MIN_GANTT_WEEKS = 10;
const priorityDurationDays: Record<KanbanTask["priority"], number> = {
  high: 7,
  medium: 14,
  low: 21,
};
const getTime = (value?: string | null) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};
const startOfDay = (time: number) => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const isOverdue = (value?: string | null) => {
  const time = getTime(value);
  return time !== null && time < startOfDay(Date.now());
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
  const projectContextRequestRef = useRef(0);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const selectedProjectDisplayName = selectedProject ? getProjectDisplayName(selectedProject) : "";

  const loadProjectContext = async (projectId: string) => {
    const requestId = ++projectContextRequestRef.current;
    try {
      const [kanbanData, staffData] = await Promise.all([
        apiClient.get<KanbanResponse>(`/admin/projects/${projectId}/kanban`),
        apiClient.get<ProjectStaffResponse>(`/organizer/staff/events/${projectId}`),
      ]);
      if (requestId !== projectContextRequestRef.current) return;
      setKanban(kanbanData);
      setProjectStaff(staffData.assignments ?? []);
    } catch (error) {
      if (requestId !== projectContextRequestRef.current) return;
      setKanban(null);
      setProjectStaff([]);
      toast.error(error instanceof Error ? error.message : "Không tải được dữ liệu dự án");
    }
  };

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<Project[]>("/admin/projects", {
        search,
        status: filterStatus === "all" ? undefined : filterStatus,
        pageSize: 100,
      });
      const sortedProjects = [...data].sort(
        (left, right) => Number(left.status === "cancelled") - Number(right.status === "cancelled"),
      );
      setProjects(sortedProjects);
      const nextSelected =
        sortedProjects.find((project) => project.id === selectedProjectId)?.id ??
        sortedProjects[0]?.id ??
        "";
      setSelectedProjectId(nextSelected);
      if (!nextSelected) {
        projectContextRequestRef.current += 1;
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
  const allTasks = useMemo(
    () => allColumns.flatMap((column) => column.tasks),
    [kanban],
  );
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
      return { task, startTime, endTime: startOfDay(Math.max(endSource, startTime + DAY_MS)) };
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
    const chartSpan = Math.max(weekCount * WEEK_MS, WEEK_MS);
    const items = rawItems.map((item) => {
      const left = clamp(((item.startTime - chartStartTime) / chartSpan) * 100, 0, 100);
      const right = clamp(((item.endTime - chartStartTime) / chartSpan) * 100, 0, 100);
      const width = Math.min(100, Math.max(2.5, right - left));
      return { ...item, left: Math.min(left, 100 - width), width };
    });
    return {
      items,
      weekLabels: Array.from({ length: weekCount }, (_, index) => `Tuần ${index + 1}`),
      gridTemplateColumns: `repeat(${weekCount}, minmax(86px, 1fr))`,
      minWidth: 200 + weekCount * 86,
    };
  }, [allTasks, kanban?.project.eventDate]);

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
                  {project.status !== "cancelled" && (
                    <button
                      type="button"
                      onClick={() => openProjectNameEdit(project)}
                      className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-low hover:text-foreground"
                      title="Sửa tên dự án"
                      aria-label={`Sửa tên dự án ${projectName}`}
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
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
                    <span className={`${statusBadgeClassName} shrink-0 ${statusColors[project.status] ?? "bg-muted text-muted-foreground"}`}>
                      {statusLabel[project.status] ?? project.status}
                    </span>
                  </div>
                  {project.status !== "cancelled" && project.organizerAssignmentStatus && (
                    <div className="mt-2">
                      <span
                        className={`${statusBadgeClassName} ${
                          organizerAssignmentColors[project.organizerAssignmentStatus] ??
                          "border-border bg-muted text-muted-foreground"
                        }`}
                      >
                        {organizerAssignmentLabels[project.organizerAssignmentStatus] ??
                          project.organizerAssignmentStatus}
                      </span>
                    </div>
                  )}
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
              {selectedProject.organizerAssignmentStatus === "pending" && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 font-body text-sm text-amber-900">
                  Đang chờ {selectedProject.organizerUser?.displayName ?? "organizer"} chấp nhận yêu cầu
                  phân công. Organizer chưa có quyền quản lý dự án trong thời gian này.
                </div>
              )}
              {selectedProject.organizerAssignmentStatus === "rejected" && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 font-body text-sm text-red-900">
                  <p className="font-semibold">
                    {selectedProject.organizerUser?.displayName ?? "Organizer"} đã từ chối dự án
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">
                    Lý do: {selectedProject.organizerRejectionReason || "Không có lý do"}
                  </p>
                  {selectedProject.organizerUser?.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() =>
                        updateProjectOrganizer(
                          selectedProject.id,
                          selectedProject.organizerUser!.id,
                        )
                      }
                    >
                      Gửi lại yêu cầu
                    </Button>
                  )}
                </div>
              )}
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
            <div className="bg-surface-lowest rounded-xl p-5 shadow-ambient overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h3 className="font-serif text-headline-md text-foreground">Gantt Chart - Timeline dự án</h3>
                  <p className="font-body text-sm text-muted-foreground">
                    Đồng bộ công việc và tiến độ với timeline của organizer
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {overdueTasks > 0 && (
                    <span className="font-body text-xs font-semibold text-destructive bg-destructive/10 rounded-full px-3 py-1">
                      {overdueTasks} công việc trễ hạn
                    </span>
                  )}
                  <Button variant="outline" size="sm" onClick={() => openAdd("todo")}>
                    <Plus size={14} /> Thêm công việc
                  </Button>
                </div>
              </div>

              {ganttData.items.length > 0 ? (
                <div className="overflow-x-auto pb-1">
                  <div className="font-body" style={{ minWidth: `${ganttData.minWidth}px` }}>
                    <div className="grid grid-cols-[200px,1fr] border-b border-border pb-3">
                      <div className="text-xs font-semibold text-muted-foreground">Công việc</div>
                      <div className="grid text-center text-xs text-muted-foreground" style={{ gridTemplateColumns: ganttData.gridTemplateColumns }}>
                        {ganttData.weekLabels.map((label) => <div key={label}>{label}</div>)}
                      </div>
                    </div>
                    <div className="divide-y divide-border/70">
                      {ganttData.items.map((item) => {
                        const task = item.task;
                        const late = task.status !== "done" && isOverdue(task.dueAt);
                        const barColor = late ? "bg-destructive/80" : ganttStatusColors[task.status] ?? "bg-muted-foreground/60";
                        return (
                          <div key={task.id} className="grid grid-cols-[200px,1fr] items-center py-3">
                            <div className="min-w-0 pr-4">
                              <p className="truncate text-sm font-semibold text-foreground" title={task.title}>{task.title}</p>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">{selectedProjectDisplayName}</p>
                            </div>
                            <div className="relative h-8">
                              <div className="absolute inset-0 grid" style={{ gridTemplateColumns: ganttData.gridTemplateColumns }}>
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

          {kanban && (
            <div className="hidden grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4">
              {allColumns.map((column) => (
                <div key={column.id} className="bg-surface-low rounded-xl p-4 min-w-0">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif font-semibold text-foreground text-sm">{taskStatusLabel[column.id] ?? column.title}</h3>
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
                              const targetTitle = taskStatusLabel[target.id] ?? target.title;
                              return (
                                <button
                                  key={nextStatus}
                                  onClick={() => moveTask(task, nextStatus)}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-body text-muted-foreground hover:bg-surface-low"
                                >
                                  <ChevronRight size={10} /> {targetTitle}
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
