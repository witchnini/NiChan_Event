import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Briefcase,
  Calendar,
  Clock,
  Edit2,
  FolderKanban,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiException, apiClient } from "@/services/apiClient";
import { toast } from "sonner";

type Staff = {
  id: string;
  displayName: string;
  email: string;
  phone?: string | null;
  status: string;
  staffProfile?: {
    jobTitle?: string | null;
    employmentStatus?: string | null;
    fullName?: string | null;
    address?: string | null;
  } | null;
  shifts?: {
    id: string;
    workDate: string;
    startTime: string;
    endTime: string;
    event?: { name: string } | null;
  }[];
};

type Project = {
  id: string;
  name: string;
  type: string;
  status: string;
  eventDate?: string | null;
  customerUser: { displayName: string };
  organizerUser?: { displayName: string } | null;
  consultationRequest?: {
    customerName?: string | null;
    eventType?: string | null;
    note?: string | null;
  } | null;
  _count?: { staffAssignments?: number };
};

type ProjectStaffAssignment = {
  id: string;
  roleText: string;
  status: "invited" | "confirmed" | "declined";
  assignedAt: string;
  staffUser: {
    id: string;
    displayName: string;
    email?: string | null;
    phone?: string | null;
    staffProfile?: { jobTitle?: string | null } | null;
  };
};

type ProjectStaffResponse = {
  event: { id: string; name: string };
  assignments: ProjectStaffAssignment[];
};

type ScheduleItem = {
  id: string;
  workDate: string;
  startTime: string;
  endTime: string;
  staffUser: { displayName: string };
  event?: { name: string } | null;
};

type StaffProjectTag = {
  assignmentId: string;
  staffUserId: string;
  projectId: string;
  projectName: string;
  projectStatus: string;
  assignmentStatus: ProjectStaffAssignment["status"];
  roleText: string;
  assignedAt: string;
  eventDate?: string | null;
};

type StaffFormState = {
  name: string;
  jobTitle: string;
  phone: string;
  email: string;
  status: string;
};

type AssignmentFormState = {
  projectId: string;
  staffUserId: string;
  roleText: string;
};

const roles = [
  "Event Manager",
  "Điều phối viên",
  "Thiết kế",
  "Lễ tân",
  "Âm thanh & ánh sáng",
  "MC",
];

const emptyStaff: StaffFormState = {
  name: "",
  jobTitle: "",
  phone: "",
  email: "",
  status: "active",
};

const emptyAssignment: AssignmentFormState = {
  projectId: "",
  staffUserId: "",
  roleText: "",
};

const activeProjectStatuses = new Set(["planning", "quoted", "contracted", "in_progress"]);

const projectStatusLabels: Record<string, string> = {
  draft: "Nháp",
  planning: "Lập kế hoạch",
  quoted: "Đã báo giá",
  contracted: "Đã xác nhận",
  in_progress: "Đang triển khai",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

const assignmentStatusLabels: Record<ProjectStaffAssignment["status"], string> = {
  invited: "Đã mời",
  confirmed: "Đã xác nhận",
  declined: "Từ chối",
};

const assignmentStatusColors: Record<ProjectStaffAssignment["status"], string> = {
  invited: "bg-primary/10 text-primary",
  confirmed: "bg-secondary/10 text-secondary",
  declined: "bg-destructive/10 text-destructive",
};

const staffStatusLabel = (status?: string | null) =>
  status === "inactive" ? "Tạm nghỉ" : "Sẵn sàng";

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof ApiException) {
    return error.details?.[0]?.message || error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
};

const isValidPhone = (value: string) => !value || /^0[3-9]\d{8}$/.test(value);

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa cập nhật";

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

const isCurrentProjectTag = (tag: StaffProjectTag) =>
  activeProjectStatuses.has(tag.projectStatus) && tag.assignmentStatus !== "declined";

const sortProjectTags = (a: StaffProjectTag, b: StaffProjectTag) => {
  const currentDiff = Number(isCurrentProjectTag(b)) - Number(isCurrentProjectTag(a));
  if (currentDiff !== 0) return currentDiff;
  return new Date(b.eventDate || b.assignedAt).getTime() - new Date(a.eventDate || a.assignedAt).getTime();
};

const AdminStaff = () => {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignmentsByProject, setAssignmentsByProject] = useState<Record<string, ProjectStaffAssignment[]>>({});
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"list" | "schedule">("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editItem, setEditItem] = useState<Staff | null>(null);
  const [viewItem, setViewItem] = useState<Staff | null>(null);
  const [form, setForm] = useState<StaffFormState>(emptyStaff);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormState>(emptyAssignment);
  const [loading, setLoading] = useState(true);
  const [projectLoading, setProjectLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const getAvailableStaffForProject = useCallback((projectId: string) => {
    const assignedIds = new Set(
      (assignmentsByProject[projectId] ?? []).map((assignment) => assignment.staffUser.id),
    );
    return staffList.filter((person) => person.status === "active" && !assignedIds.has(person.id));
  }, [assignmentsByProject, staffList]);

  const allProjectTags = useMemo<StaffProjectTag[]>(
    () =>
      projects.flatMap((project) =>
        (assignmentsByProject[project.id] ?? []).map((assignment) => ({
          assignmentId: assignment.id,
          staffUserId: assignment.staffUser.id,
          projectId: project.id,
          projectName: getProjectDisplayName(project),
          projectStatus: project.status,
          assignmentStatus: assignment.status,
          roleText: assignment.roleText,
          assignedAt: assignment.assignedAt,
          eventDate: project.eventDate,
        })),
      ),
    [assignmentsByProject, projects],
  );

  const staffProjectMap = useMemo(() => {
    const next = new Map<string, StaffProjectTag[]>();

    allProjectTags.forEach((tag) => {
      const current = next.get(tag.staffUserId) ?? [];
      current.push(tag);
      next.set(tag.staffUserId, current);
    });

    next.forEach((tags) => tags.sort(sortProjectTags));
    return next;
  }, [allProjectTags]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === assignmentForm.projectId) ?? null,
    [assignmentForm.projectId, projects],
  );

  const assignmentStaffOptions = useMemo(
    () => getAvailableStaffForProject(assignmentForm.projectId),
    [assignmentForm.projectId, getAvailableStaffForProject],
  );

  const stats = useMemo(() => {
    const activeStaff = staffList.filter((person) => person.status === "active").length;
    const assignedStaff = staffList.filter((person) =>
      (staffProjectMap.get(person.id) ?? []).some(isCurrentProjectTag),
    ).length;
    const projectsWithStaff = projects.filter(
      (project) => (assignmentsByProject[project.id] ?? []).length > 0,
    ).length;

    return [
      { label: "Tổng nhân sự", value: staffList.length, icon: Users },
      { label: "Đang làm dự án", value: assignedStaff, icon: Briefcase },
      { label: "Sẵn sàng", value: activeStaff, icon: UserCheck },
      { label: "Dự án có nhân sự", value: projectsWithStaff, icon: FolderKanban },
    ];
  }, [assignmentsByProject, projects, staffList, staffProjectMap]);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<Staff[]>("/admin/staff", {
        search,
        pageSize: 100,
      });
      setStaffList(data);
    } catch {
      toast.error("Không tải được danh sách nhân sự");
    } finally {
      setLoading(false);
    }
  }, [search]);

  const loadSchedule = useCallback(async () => {
    try {
      const data = await apiClient.get<ScheduleItem[]>("/admin/staff/schedule");
      setSchedule(data);
    } catch {
      toast.error("Không tải được lịch làm việc");
    }
  }, []);

  const loadProjectContext = useCallback(async () => {
    setProjectLoading(true);
    try {
      const projectData = await apiClient.get<Project[]>("/admin/projects", { pageSize: 100 });
      const assignmentPairs = await Promise.all(
        projectData.map(async (project) => {
          const data = await apiClient.get<ProjectStaffResponse>(`/organizer/staff/events/${project.id}`);
          return [project.id, data.assignments] as const;
        }),
      );

      setProjects(projectData);
      setAssignmentsByProject(Object.fromEntries(assignmentPairs));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không tải được dữ liệu dự án của nhân sự"));
    } finally {
      setProjectLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  useEffect(() => {
    void loadSchedule();
    void loadProjectContext();
  }, [loadProjectContext, loadSchedule]);

  const openCreate = () => {
    setForm(emptyStaff);
    setCreateOpen(true);
  };

  const openAssign = (staffId?: string) => {
    const projectId = projects[0]?.id ?? "";
    const options = projectId ? getAvailableStaffForProject(projectId) : [];
    const staffStillAvailable = staffId ? options.some((person) => person.id === staffId) : false;

    setAssignmentForm({
      projectId,
      staffUserId: staffStillAvailable ? staffId! : options[0]?.id ?? "",
      roleText: "",
    });
    setAssignOpen(true);
  };

  const openEdit = (staff: Staff) => {
    setForm({
      name: staff.displayName,
      jobTitle: staff.staffProfile?.jobTitle ?? "",
      phone: staff.phone ?? "",
      email: staff.email,
      status: staff.staffProfile?.employmentStatus ?? staff.status ?? "active",
    });
    setEditItem(staff);
  };

  const handleProjectChange = (projectId: string) => {
    const options = getAvailableStaffForProject(projectId);
    setAssignmentForm((current) => ({
      ...current,
      projectId,
      staffUserId: options.some((person) => person.id === current.staffUserId)
        ? current.staffUserId
        : options[0]?.id ?? "",
    }));
  };

  const handleCreate = async () => {
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const jobTitle = form.jobTitle.trim();
    const phone = form.phone.trim();

    if (!name || !email || !jobTitle) {
      toast.error("Vui lòng nhập tên, email và vai trò");
      return;
    }
    if (!isValidPhone(phone)) {
      toast.error("Số điện thoại phải đúng định dạng Việt Nam, ví dụ 0901234567");
      return;
    }

    try {
      setSaving(true);
      await apiClient.post("/admin/staff", {
        name,
        email,
        phone: phone || undefined,
        jobTitle,
        employmentStatus: form.status,
      });
      toast.success(`Đã thêm nhân sự ${name}`);
      setCreateOpen(false);
      setForm(emptyStaff);
      await loadStaff();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Thêm nhân sự thất bại"));
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async () => {
    const roleText = assignmentForm.roleText.trim();

    if (!assignmentForm.projectId || !assignmentForm.staffUserId || !roleText) {
      toast.error("Vui lòng chọn dự án, nhân sự và nhập vai trò trong dự án");
      return;
    }

    try {
      setAssigning(true);
      await apiClient.post(`/organizer/staff/events/${assignmentForm.projectId}`, {
        staffUserId: assignmentForm.staffUserId,
        roleText,
      });
      toast.success("Đã thêm nhân sự vào dự án");
      setAssignOpen(false);
      setAssignmentForm(emptyAssignment);
      await loadProjectContext();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể phân công nhân sự vào dự án"));
    } finally {
      setAssigning(false);
    }
  };

  const handleEdit = async () => {
    if (!editItem) return;
    const name = form.name.trim();
    const phone = form.phone.trim();
    if (!name || !form.jobTitle.trim()) {
      toast.error("Vui lòng nhập tên và vai trò");
      return;
    }
    if (!isValidPhone(phone)) {
      toast.error("Số điện thoại phải đúng định dạng Việt Nam, ví dụ 0901234567");
      return;
    }

    try {
      setSaving(true);
      await apiClient.put(`/admin/staff/${editItem.id}`, {
        name,
        phone: phone || undefined,
        jobTitle: form.jobTitle.trim(),
        employmentStatus: form.status,
      });
      toast.success("Đã cập nhật thông tin nhân sự");
      setEditItem(null);
      await loadStaff();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Cập nhật nhân sự thất bại"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStaff = async (staff: Staff) => {
    const confirmed = window.confirm(
      `Xóa nhân sự ${staff.displayName}? Nhân sự này sẽ được gỡ khỏi các dự án, ca trực và task đang phụ trách.`,
    );
    if (!confirmed) return;

    try {
      setSaving(true);
      await apiClient.del(`/admin/staff/${staff.id}`);
      toast.success(`Đã xóa nhân sự ${staff.displayName}`);
      if (editItem?.id === staff.id) setEditItem(null);
      if (viewItem?.id === staff.id) setViewItem(null);
      await Promise.all([loadStaff(), loadSchedule(), loadProjectContext()]);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Xóa nhân sự thất bại"));
    } finally {
      setSaving(false);
    }
  };

  const renderStaffForm = (mode: "create" | "edit") => {
    const roleOptions =
      form.jobTitle && !roles.includes(form.jobTitle)
        ? [form.jobTitle, ...roles]
        : roles;

    return (
      <div className="space-y-4">
        <div>
          <label className="font-body text-sm text-foreground mb-2 block">
            Họ và tên *
          </label>
          <Input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Nguyễn Văn A"
            className="h-10 rounded-xl bg-surface-low px-4 font-body border-none"
          />
        </div>

        <div>
          <label className="font-body text-sm text-foreground mb-2 block">
            Vai trò *
          </label>
          <Select
            value={form.jobTitle}
            onValueChange={(value) => setForm((current) => ({ ...current, jobTitle: value }))}
          >
            <SelectTrigger className="h-10 rounded-xl bg-surface-low px-4 font-body border-none">
              <SelectValue placeholder="Chọn vai trò" />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-body text-sm text-foreground mb-2 block">
              Số điện thoại
            </label>
            <Input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder="0901234567"
              className="h-10 rounded-xl bg-surface-low px-4 font-body border-none"
            />
          </div>
          <div>
            <label className="font-body text-sm text-foreground mb-2 block">
              Email *
            </label>
            <Input
              type="email"
              value={form.email}
              disabled={mode === "edit"}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="email@nichan.vn"
              className="h-10 rounded-xl bg-surface-low px-4 font-body border-none"
            />
          </div>
        </div>

        <div>
          <label className="font-body text-sm text-foreground mb-2 block">
            Trạng thái
          </label>
          <Select
            value={form.status}
            onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}
          >
            <SelectTrigger className="h-10 rounded-xl bg-surface-low px-4 font-body border-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Sẵn sàng</SelectItem>
              <SelectItem value="inactive">Tạm nghỉ</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  };

  const renderProjectTags = (person: Staff, expanded = false) => {
    const tags = staffProjectMap.get(person.id) ?? [];
    const currentTags = tags.filter(isCurrentProjectTag);
    const visibleTags = expanded ? tags : currentTags.slice(0, 2);

    if (visibleTags.length === 0) {
      return (
        <div className="rounded-xl bg-surface-low px-3 py-2 font-body text-xs text-muted-foreground">
          Chưa gắn dự án đang chạy
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-2">
        {visibleTags.map((tag) => (
          <span
            key={tag.assignmentId}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-body font-semibold text-primary"
            title={`${tag.projectName} - ${tag.roleText}`}
          >
            <FolderKanban size={12} className="shrink-0" />
            <span className="truncate">{tag.projectName}</span>
          </span>
        ))}
        {!expanded && currentTags.length > visibleTags.length && (
          <span className="rounded-full bg-surface-high px-3 py-1 text-xs font-body font-semibold text-muted-foreground">
            +{currentTags.length - visibleTags.length} dự án
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="font-serif text-headline-lg text-foreground">
            Quản lý nhân sự
          </h1>
          <p className="font-body text-sm text-muted-foreground">
            {loading || projectLoading
              ? "Đang tải dữ liệu nhân sự và dự án..."
              : `${staffList.length} nhân sự, ${projects.length} dự án có thể phân công`}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => openAssign()}
            disabled={projectLoading || projects.length === 0 || staffList.length === 0}
          >
            <UserPlus size={15} /> Phân công vào dự án
          </Button>
          <Button variant="hero" size="sm" onClick={openCreate}>
            <Plus size={15} /> Thêm nhân sự mới
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="bg-surface-lowest rounded-xl p-4 shadow-ambient"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-body text-xs text-muted-foreground">{item.label}</p>
                <p className="font-serif text-headline-md text-foreground mt-1">{item.value}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <item.icon size={18} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên hoặc email nhân sự..."
            className="pl-10 rounded-xl bg-surface-lowest font-body border-none"
          />
        </div>

        <div className="flex w-full gap-1 rounded-xl bg-surface-lowest p-1 shadow-ambient sm:w-auto">
          <button
            onClick={() => setTab("list")}
            className={`flex-1 rounded-lg px-4 py-2 font-body text-sm transition-all sm:flex-none ${
              tab === "list" ? "bg-background text-foreground shadow-ambient" : "text-muted-foreground"
            }`}
          >
            Danh sách
          </button>
          <button
            onClick={() => setTab("schedule")}
            className={`flex-1 rounded-lg px-4 py-2 font-body text-sm transition-all sm:flex-none ${
              tab === "schedule" ? "bg-background text-foreground shadow-ambient" : "text-muted-foreground"
            }`}
          >
            Lịch làm việc
          </button>
        </div>
      </div>

      {tab === "list" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {staffList.map((person, index) => {
            const tags = staffProjectMap.get(person.id) ?? [];
            const currentTags = tags.filter(isCurrentProjectTag);
            const totalProjects = tags.length;

            return (
              <motion.div
                key={person.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="bg-surface-lowest rounded-xl p-5 shadow-ambient hover:shadow-ambient-lg transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground font-body font-bold text-base shrink-0">
                      {person.displayName?.trim().charAt(0).toUpperCase() ?? "N"}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-body text-sm font-semibold text-foreground truncate">
                        {person.displayName}
                      </h3>
                      <p className="font-body text-xs text-muted-foreground truncate">
                        {person.staffProfile?.jobTitle ?? "Chưa cập nhật vai trò"}
                      </p>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl shrink-0">
                        <MoreHorizontal size={15} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setViewItem(person)}>
                        <Users size={13} className="mr-2" /> Xem chi tiết
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEdit(person)}>
                        <Edit2 size={13} className="mr-2" /> Chỉnh sửa
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDeleteStaff(person)}
                      >
                        <Trash2 size={13} className="mr-2" /> Xóa nhân sự
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-body font-semibold text-primary">
                    <Briefcase size={11} className="shrink-0" />
                    {currentTags.length} đang làm
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-high px-2.5 py-1 text-[11px] font-body font-semibold text-muted-foreground">
                    <FolderKanban size={11} className="shrink-0" />
                    {totalProjects} dự án
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-body text-xs font-semibold text-foreground">Dự án đang làm</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-body font-semibold ${
                        person.status === "active"
                          ? "bg-secondary/10 text-secondary"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {staffStatusLabel(person.status)}
                    </span>
                  </div>
                  {renderProjectTags(person)}
                </div>

                <div className="mt-4 space-y-2 text-xs font-body text-muted-foreground">
                  <p className="flex min-w-0 items-center gap-2">
                    <Phone size={13} className="shrink-0" /> <span className="truncate">{person.phone || "-"}</span>
                  </p>
                  <p className="flex min-w-0 items-center gap-2">
                    <Mail size={13} className="shrink-0" /> <span className="truncate">{person.email}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Calendar size={13} /> {person.shifts?.length ?? 0} ca gần đây
                  </p>
                </div>

                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-xl"
                    onClick={() => setViewItem(person)}
                  >
                    Chi tiết
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => openAssign(person.id)}
                    disabled={projectLoading || person.status !== "active"}
                  >
                    <UserPlus size={14} /> Gắn dự án
                  </Button>
                </div>
              </motion.div>
            );
          })}

          {staffList.length === 0 && !loading && (
            <div className="col-span-full bg-surface-lowest rounded-xl p-8 shadow-ambient text-center">
              <p className="font-body text-sm text-muted-foreground">
                Chưa có nhân sự phù hợp với bộ lọc hiện tại.
              </p>
            </div>
          )}
        </div>
      )}

      {tab === "schedule" && (
        <div className="space-y-3">
          {schedule.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="bg-surface-lowest rounded-xl p-5 shadow-ambient"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-body font-semibold text-foreground flex items-center gap-2">
                    <Calendar size={16} className="text-primary" />{" "}
                    {new Date(item.workDate).toLocaleDateString("vi-VN")}
                  </h3>
                  <p className="font-body text-sm text-muted-foreground mt-1">
                    {item.staffUser.displayName} - {item.event?.name ?? "Không gắn sự kiện"}
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-xl bg-surface-low px-3 py-2 text-sm font-body text-foreground">
                  <Clock size={14} /> {item.startTime} - {item.endTime}
                </span>
              </div>
            </motion.div>
          ))}

          {schedule.length === 0 && (
            <div className="bg-surface-lowest rounded-xl p-8 shadow-ambient text-center">
              <p className="font-body text-sm text-muted-foreground">Chưa có lịch làm việc.</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!viewItem} onOpenChange={(open) => !open && setViewItem(null)}>
        <DialogContent className="sm:max-w-[560px] rounded-2xl border-foreground/30 bg-background p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              Thông tin nhân sự
            </DialogTitle>
            <DialogDescription className="sr-only">
              Thông tin chi tiết của nhân sự và các dự án đã tham gia.
            </DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground font-body font-bold text-2xl">
                  {viewItem.displayName?.trim().charAt(0).toUpperCase() ?? "N"}
                </div>
                <div className="min-w-0">
                  <h3 className="font-body text-lg font-semibold text-foreground truncate">
                    {viewItem.displayName}
                  </h3>
                  <p className="font-body text-sm text-muted-foreground">
                    {viewItem.staffProfile?.jobTitle ?? "Chưa cập nhật vai trò"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-surface-low p-3 text-sm font-body text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Phone size={14} /> {viewItem.phone || "-"}
                  </p>
                </div>
                <div className="rounded-xl bg-surface-low p-3 text-sm font-body text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Mail size={14} /> {viewItem.email}
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="font-body text-sm font-semibold text-foreground">Dự án đã tham gia</p>
                  <span className="rounded-full bg-surface-high px-3 py-1 text-xs font-body text-muted-foreground">
                    {(staffProjectMap.get(viewItem.id) ?? []).length} dự án
                  </span>
                </div>
                {renderProjectTags(viewItem, true)}
              </div>

              <div className="space-y-2">
                {(staffProjectMap.get(viewItem.id) ?? []).map((tag) => (
                  <div key={tag.assignmentId} className="rounded-xl border border-border bg-surface-lowest p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-body text-sm font-semibold text-foreground truncate">
                          {tag.projectName}
                        </p>
                        <p className="font-body text-xs text-muted-foreground">
                          {tag.roleText} - {formatDate(tag.eventDate)}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-body font-semibold ${assignmentStatusColors[tag.assignmentStatus]}`}>
                        {assignmentStatusLabels[tag.assignmentStatus]}
                      </span>
                    </div>
                    <p className="mt-2 font-body text-xs text-muted-foreground">
                      Trạng thái dự án: {projectStatusLabels[tag.projectStatus] ?? tag.projectStatus}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewItem(null)}>
              Đóng
            </Button>
            {viewItem && (
              <Button
                variant="destructive"
                onClick={() => handleDeleteStaff(viewItem)}
                disabled={saving}
              >
                <Trash2 size={14} /> Xóa
              </Button>
            )}
            <Button
              variant="hero"
              onClick={() => {
                if (viewItem) {
                  openEdit(viewItem);
                  setViewItem(null);
                }
              }}
            >
              <Edit2 size={14} /> Chỉnh sửa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl border-foreground/30 bg-background p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              Thêm nhân sự mới
            </DialogTitle>
            <DialogDescription className="sr-only">
              Biểu mẫu thêm nhân sự mới.
            </DialogDescription>
          </DialogHeader>
          {renderStaffForm("create")}
          <DialogFooter className="pt-1">
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => setCreateOpen(false)}
              disabled={saving}
            >
              Hủy
            </Button>
            <Button
              variant="hero"
              className="rounded-full px-5"
              onClick={handleCreate}
              disabled={saving}
            >
              {saving ? "Đang thêm..." : "Thêm nhân sự"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-[520px] rounded-2xl border-foreground/30 bg-background p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              Phân công nhân sự vào dự án
            </DialogTitle>
            <DialogDescription className="sr-only">
              Chọn nhân sự đã tạo và gắn vào dự án admin đang phân công.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="font-body text-sm text-foreground mb-2 block">
                Dự án *
              </label>
              <Select value={assignmentForm.projectId} onValueChange={handleProjectChange}>
                <SelectTrigger className="h-10 rounded-xl bg-surface-low px-4 font-body border-none">
                  <SelectValue placeholder="Chọn dự án" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {getProjectDisplayName(project)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="font-body text-sm text-foreground mb-2 block">
                Nhân sự đã tạo *
              </label>
              <Select
                value={assignmentForm.staffUserId}
                onValueChange={(value) => setAssignmentForm((current) => ({ ...current, staffUserId: value }))}
                disabled={!assignmentForm.projectId || assignmentStaffOptions.length === 0}
              >
                <SelectTrigger className="h-10 rounded-xl bg-surface-low px-4 font-body border-none">
                  <SelectValue placeholder="Chọn nhân sự" />
                </SelectTrigger>
                <SelectContent>
                  {assignmentStaffOptions.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.displayName} - {person.staffProfile?.jobTitle || person.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assignmentForm.projectId && assignmentStaffOptions.length === 0 && (
                <p className="mt-2 font-body text-xs text-muted-foreground">
                  Tất cả nhân sự đang hoạt động đã được gắn vào dự án này.
                </p>
              )}
            </div>

            <div>
              <label className="font-body text-sm text-foreground mb-2 block">
                Vai trò trong dự án *
              </label>
              <Input
                value={assignmentForm.roleText}
                onChange={(event) => setAssignmentForm((current) => ({ ...current, roleText: event.target.value }))}
                placeholder="VD: Điều phối sảnh, lễ tân, âm thanh..."
                className="h-10 rounded-xl bg-surface-low px-4 font-body border-none"
              />
            </div>

            {selectedProject && (
              <div className="rounded-xl bg-surface-low p-3 font-body text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">{getProjectDisplayName(selectedProject)}</p>
                <p>
                  {formatDate(selectedProject.eventDate)} - {projectStatusLabels[selectedProject.status] ?? selectedProject.status}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="pt-1">
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => setAssignOpen(false)}
              disabled={assigning}
            >
              Hủy
            </Button>
            <Button
              variant="hero"
              className="rounded-full px-5"
              onClick={handleAssign}
              disabled={assigning || !assignmentForm.projectId || !assignmentForm.staffUserId}
            >
              {assigning ? "Đang phân công..." : "Thêm vào dự án"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl border-foreground/30 bg-background p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              Chỉnh sửa nhân sự
            </DialogTitle>
            <DialogDescription className="sr-only">
              Biểu mẫu chỉnh sửa thông tin nhân sự.
            </DialogDescription>
          </DialogHeader>
          {renderStaffForm("edit")}
          <DialogFooter className="pt-1">
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => setEditItem(null)}
              disabled={saving}
            >
              Hủy
            </Button>
            <Button
              variant="hero"
              className="rounded-full px-5"
              onClick={handleEdit}
              disabled={saving}
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminStaff;
