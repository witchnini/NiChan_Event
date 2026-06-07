import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Hash,
  Image,
  LayoutGrid,
  Loader2,
  MessageSquare,
  Plus,
  Save,
  Search,
  Send,
  Sparkles,
  Star,
  Tag,
  Trash2,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { hasMeaningfulRichText, normalizeRichTextInput } from "@/lib/richText";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

type ContentKind = "service" | "portfolio" | "blog";
type ContentTab = ContentKind | "reviews";
type EditorTab = "basic" | "content";

type ServiceCategory = {
  id: string;
  name: string;
  slug: string;
};

type ServiceItem = {
  id: string;
  title: string;
  slug: string;
  shortDescription?: string;
  description?: string;
  priceFrom?: number | string | null;
  priceTo?: number | string | null;
  guestFrom?: number | null;
  guestTo?: number | null;
  locationText?: string | null;
  coverImageUrl?: string | null;
  isActive?: boolean;
  isFeatured?: boolean;
  category?: ServiceCategory;
  viewCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

type PortfolioItem = {
  id: string;
  title: string;
  slug?: string;
  category: string;
  content?: string | null;
  status: string;
  viewCount?: number;
  guestCount?: number | null;
  coverImageUrl?: string;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type BlogPost = {
  id: string;
  title: string;
  slug?: string;
  category: string;
  excerpt?: string | null;
  content?: string | null;
  coverImageUrl?: string | null;
  status: string;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  viewCount?: number;
};

type Review = {
  id: string;
  ratingOverall: number;
  comment: string;
  status: string;
  customerUser?: { displayName: string };
  event?: { name: string };
};

type UploadResponse = {
  url: string;
};

type ApiUploadResponse =
  | { success: true; data: UploadResponse }
  | { success: false; error?: { message?: string } };

type EditorForm = {
  kind: ContentKind;
  title: string;
  slug: string;
  category: string;
  categorySlug: string;
  coverImageUrl: string;
  tags: string[];
  tagDraft: string;
  summary: string;
  content: string;
  priceFrom: string;
  priceTo: string;
  guestFrom: string;
  guestTo: string;
  guestCount: string;
  locationText: string;
  isPublished: boolean;
  isFeatured: boolean;
};

const labels: Record<ContentKind, { singular: string; plural: string; create: string; icon: LucideIcon }> = {
  service: { singular: "Dịch vụ", plural: "Dịch vụ", create: "Tạo dịch vụ", icon: Sparkles },
  portfolio: { singular: "Portfolio", plural: "Portfolio", create: "Tạo portfolio", icon: LayoutGrid },
  blog: { singular: "Blog", plural: "Blog", create: "Tạo bài viết", icon: BookOpen },
};

const editorTabs: { value: EditorTab; label: string; icon: LucideIcon }[] = [
  { value: "basic", label: "Thông tin cơ bản", icon: FileText },
  { value: "content", label: "Nội dung chính", icon: Edit3 },
];

const blogStatusMap: Record<string, { label: string; color: string }> = {
  published: { label: "Đã đăng", color: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
  scheduled: { label: "Đã lên lịch", color: "bg-sky-500/10 text-sky-700 border-sky-200" },
  draft: { label: "Bản nháp", color: "bg-amber-500/10 text-amber-700 border-amber-200" },
  hidden: { label: "Đã ẩn", color: "bg-muted text-muted-foreground border-border" },
};

const portfolioStatusMap: Record<string, { label: string; color: string }> = {
  visible: { label: "Đang hiển thị", color: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
  hidden: { label: "Đã ẩn", color: "bg-muted text-muted-foreground border-border" },
};

const reviewStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: "Chờ duyệt", color: "bg-amber-500/10 text-amber-700 border-amber-200" },
  approved: { label: "Đã duyệt", color: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
  hidden: { label: "Đã ẩn", color: "bg-muted text-muted-foreground border-border" },
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const numberOrNull = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatMoney = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") return "Chưa đặt giá";
  return `${Number(value).toLocaleString("vi-VN")}đ`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const buildEmptyForm = (kind: ContentKind, categories: ServiceCategory[] = []): EditorForm => ({
  kind,
  title: "",
  slug: "",
  category: kind === "portfolio" ? "Sự kiện nổi bật" : "Cẩm nang",
  categorySlug: kind === "service" ? categories[0]?.slug ?? "" : "",
  coverImageUrl: "",
  tags: [],
  tagDraft: "",
  summary: "",
  content: "",
  priceFrom: "",
  priceTo: "",
  guestFrom: "",
  guestTo: "",
  guestCount: "",
  locationText: "",
  isPublished: true,
  isFeatured: false,
});

const StatusChip = ({ label, color }: { label: string; color: string }) => (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${color}`}>
    {label}
  </span>
);

const EmptyState = ({ icon: Icon, message }: { icon: LucideIcon; message: string }) => (
  <div className="flex min-h-[260px] flex-col items-center justify-center rounded-md border border-dashed border-border bg-surface-lowest text-center">
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-surface-low">
      <Icon size={22} className="text-muted-foreground" />
    </div>
    <p className="font-body text-sm text-muted-foreground">{message}</p>
  </div>
);

const FieldLabel = ({ children, required = false }: { children: React.ReactNode; required?: boolean }) => (
  <Label className="font-body text-sm font-semibold text-foreground">
    {children}
    {required && <span className="ml-1 text-destructive">(*)</span>}
  </Label>
);

const SwitchRow = ({
  label,
  checked,
  onCheckedChange,
  icon: Icon,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  icon: LucideIcon;
}) => (
  <label className="flex min-h-10 items-center gap-3 text-sm text-foreground">
    <Switch checked={checked} onCheckedChange={onCheckedChange} />
    <Icon size={15} className="text-muted-foreground" />
    <span>{label}</span>
  </label>
);

const AdminContent = () => {
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<ContentTab>("service");
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorTab>("basic");
  const [form, setForm] = useState<EditorForm>(() => buildEmptyForm("service"));
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(null);
  const [editingBlogId, setEditingBlogId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [coverImagePreviewUrl, setCoverImagePreviewUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [serviceList, cats, portfolio, blog, reviewData] = await Promise.all([
        apiClient.get<ServiceItem[]>("/admin/content/services", { pageSize: 100 }),
        apiClient.get<ServiceCategory[]>("/admin/content/service-categories"),
        apiClient.get<PortfolioItem[]>("/admin/content/portfolio", { pageSize: 100 }),
        apiClient.get<BlogPost[]>("/admin/content/blog-posts", { pageSize: 100 }),
        apiClient.get<Review[]>("/admin/content/reviews", { pageSize: 100 }),
      ]);
      setServices(serviceList);
      setCategories(cats);
      setPortfolioItems(portfolio);
      setBlogPosts(blog);
      setReviews(reviewData);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải dữ liệu nội dung"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    return () => {
      if (coverImagePreviewUrl) URL.revokeObjectURL(coverImagePreviewUrl);
    };
  }, [coverImagePreviewUrl]);

  const filteredServices = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword || activeTab !== "service") return services;
    return services.filter((item) =>
      [item.title, item.shortDescription, item.category?.name].some((value) =>
        value?.toLowerCase().includes(keyword),
      ),
    );
  }, [activeTab, search, services]);

  const filteredPortfolio = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword || activeTab !== "portfolio") return portfolioItems;
    return portfolioItems.filter((item) =>
      [item.title, item.category].some((value) => value?.toLowerCase().includes(keyword)),
    );
  }, [activeTab, portfolioItems, search]);

  const filteredBlogs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword || activeTab !== "blog") return blogPosts;
    return blogPosts.filter((post) =>
      [post.title, post.category, post.excerpt].some((value) => value?.toLowerCase().includes(keyword)),
    );
  }, [activeTab, blogPosts, search]);

  const pendingReviews = reviews.filter((review) => review.status === "pending").length;

  const openCreate = (kind: ContentKind) => {
    setCoverImagePreviewUrl(null);
    setEditingServiceId(null);
    setEditingPortfolioId(null);
    setEditingBlogId(null);
    setForm(buildEmptyForm(kind, categories));
    setEditorTab("basic");
    setEditorOpen(true);
  };

  const openEditService = (service: ServiceItem) => {
    setCoverImagePreviewUrl(null);
    setEditingServiceId(service.id);
    setEditingPortfolioId(null);
    setEditingBlogId(null);
    setForm({
      ...buildEmptyForm("service", categories),
      title: service.title,
      slug: service.slug,
      categorySlug: service.category?.slug ?? categories[0]?.slug ?? "",
      coverImageUrl: service.coverImageUrl ?? "",
      summary: service.shortDescription ?? "",
      content: service.description ?? "",
      priceFrom: service.priceFrom != null ? String(service.priceFrom) : "",
      priceTo: service.priceTo != null ? String(service.priceTo) : "",
      guestFrom: service.guestFrom != null ? String(service.guestFrom) : "",
      guestTo: service.guestTo != null ? String(service.guestTo) : "",
      locationText: service.locationText ?? "",
      isPublished: service.isActive ?? true,
      isFeatured: service.isFeatured ?? false,
    });
    setEditorTab("basic");
    setEditorOpen(true);
  };

  const openEditPortfolio = (item: PortfolioItem) => {
    setCoverImagePreviewUrl(null);
    setEditingServiceId(null);
    setEditingPortfolioId(item.id);
    setEditingBlogId(null);
    setForm({
      ...buildEmptyForm("portfolio", categories),
      title: item.title,
      slug: item.slug ?? "",
      category: item.category,
      content: item.content ?? "",
      coverImageUrl: item.coverImageUrl ?? "",
      guestCount: item.guestCount != null ? String(item.guestCount) : "",
      isPublished: item.status === "visible",
    });
    setEditorTab("basic");
    setEditorOpen(true);
  };

  const openEditBlog = (post: BlogPost) => {
    setCoverImagePreviewUrl(null);
    setEditingServiceId(null);
    setEditingPortfolioId(null);
    setEditingBlogId(post.id);
    setForm({
      ...buildEmptyForm("blog", categories),
      title: post.title,
      slug: post.slug ?? "",
      category: post.category,
      coverImageUrl: post.coverImageUrl ?? "",
      summary: post.excerpt ?? "",
      content: post.content ?? "",
      isPublished: post.status === "published",
    });
    setEditorTab("basic");
    setEditorOpen(true);
  };

  const addTag = () => {
    const tag = form.tagDraft.trim().replace(/^#/, "");
    if (!tag) return;
    if (form.tags.includes(tag)) {
      setForm((current) => ({ ...current, tagDraft: "" }));
      return;
    }
    setForm((current) => ({ ...current, tags: [...current.tags, tag], tagDraft: "" }));
  };

  const removeTag = (tag: string) => {
    setForm((current) => ({ ...current, tags: current.tags.filter((item) => item !== tag) }));
  };

  const uploadCoverImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn file ảnh");
      input.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Ảnh không được vượt quá 10MB");
      input.value = "";
      return;
    }

    const token = localStorage.getItem("nichan_token");
    if (!token) {
      toast.error("Phiên đăng nhập đã hết hạn");
      input.value = "";
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setCoverImagePreviewUrl(previewUrl);

    const body = new FormData();
    body.append("file", file);
    body.append("folder", `content/${form.kind}`);

    setUploadingImage(true);
    try {
      const response = await fetch("/api/upload/image", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const json = (await response.json()) as ApiUploadResponse;

      if (!json.success) {
        throw new Error(json.error?.message ?? "Upload ảnh thất bại");
      }

      setForm((current) => ({ ...current, coverImageUrl: json.data.url }));
      setCoverImagePreviewUrl(null);
      toast.success("Đã tải ảnh lên");
    } catch (error) {
      setCoverImagePreviewUrl(null);
      toast.error(getErrorMessage(error, "Không thể tải ảnh lên"));
    } finally {
      setUploadingImage(false);
      input.value = "";
    }
  };

  const deleteService = async (id: string) => {
    try {
      await apiClient.del(`/admin/content/services/${id}`);
      toast.success("Đã xoá dịch vụ");
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể xoá dịch vụ"));
    }
  };

  const deletePortfolio = async (id: string) => {
    try {
      await apiClient.del(`/admin/content/portfolio/${id}`);
      toast.success("Đã xoá portfolio");
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể xoá portfolio"));
    }
  };

  const deleteBlog = async (id: string) => {
    try {
      await apiClient.del(`/admin/content/blog-posts/${id}`);
      toast.success("Đã xoá bài viết");
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể xoá bài viết"));
    }
  };

  const approveReview = async (id: string) => {
    try {
      await apiClient.patch(`/admin/content/reviews/${id}/approve`);
      toast.success("Đã duyệt đánh giá");
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể duyệt đánh giá"));
    }
  };

  const hideReview = async (id: string) => {
    try {
      await apiClient.patch(`/admin/content/reviews/${id}/hide`);
      toast.success("Đã ẩn đánh giá");
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể ẩn đánh giá"));
    }
  };

  const validateForm = () => {
    if (!form.title.trim()) return "Vui lòng nhập tiêu đề";
    if (!form.slug.trim() && !slugify(form.title)) return "URL cục bộ chưa hợp lệ";

    if (form.kind === "service") {
      if (!form.categorySlug) return "Vui lòng chọn chuyên mục dịch vụ";
      if (!form.summary.trim()) return "Vui lòng nhập mô tả ngắn dịch vụ";
      if (!hasMeaningfulRichText(form.content)) return "Vui lòng nhập nội dung chi tiết dịch vụ";
    }

    if (form.kind === "portfolio") {
      if (!form.category.trim()) return "Vui lòng nhập chuyên mục portfolio";
      if (!form.coverImageUrl.trim()) return "Vui lòng nhập ảnh minh họa portfolio";
    }

    if (form.kind === "blog") {
      if (!form.category.trim()) return "Vui lòng nhập chuyên mục bài viết";
      if (!form.coverImageUrl.trim()) return "Vui lòng chọn ảnh minh họa bài viết";
      if (!hasMeaningfulRichText(form.content)) return "Vui lòng nhập nội dung bài viết";
    }

    return "";
  };

  const submitContent = async () => {
    const error = validateForm();
    if (error) {
      toast.error(error);
      return;
    }

    const slug = slugify(form.slug || form.title);
    const wasEditingService = Boolean(editingServiceId);
    const wasEditingPortfolio = Boolean(editingPortfolioId);
    const wasEditingBlog = Boolean(editingBlogId);
    setSubmitting(true);
    try {
      if (form.kind === "service") {
        const payload = {
          title: form.title.trim(),
          slug,
          categorySlug: form.categorySlug,
          shortDescription: form.summary.trim(),
          description: normalizeRichTextInput(form.content),
          priceFrom: numberOrNull(form.priceFrom),
          priceTo: numberOrNull(form.priceTo),
          guestFrom: numberOrNull(form.guestFrom),
          guestTo: numberOrNull(form.guestTo),
          locationText: form.locationText.trim() || null,
          coverImageUrl: form.coverImageUrl.trim() || null,
          isFeatured: form.isFeatured,
          isActive: form.isPublished,
        };

        if (editingServiceId) {
          await apiClient.put(`/admin/content/services/${editingServiceId}`, payload);
        } else {
          await apiClient.post("/admin/content/services", payload);
        }
      }

      if (form.kind === "portfolio") {
        const payload = {
          title: form.title.trim(),
          slug,
          category: form.category.trim(),
          content: normalizeRichTextInput(form.content) || null,
          guestCount: numberOrNull(form.guestCount),
          coverImageUrl: form.coverImageUrl.trim(),
          status: form.isPublished ? "visible" : "hidden",
          publishedAt: form.isPublished ? new Date().toISOString() : null,
        };

        if (editingPortfolioId) {
          await apiClient.put(`/admin/content/portfolio/${editingPortfolioId}`, payload);
        } else {
          await apiClient.post("/admin/content/portfolio", payload);
        }
      }

      if (form.kind === "blog") {
        const payload = {
          title: form.title.trim(),
          slug,
          category: form.category.trim(),
          excerpt: form.summary.trim() || null,
          content: normalizeRichTextInput(form.content),
          coverImageUrl: form.coverImageUrl.trim() || null,
          status: form.isPublished ? "published" : "draft",
          publishedAt: form.isPublished ? new Date().toISOString() : null,
        };

        if (editingBlogId) {
          await apiClient.put(`/admin/content/blog-posts/${editingBlogId}`, payload);
        } else {
          await apiClient.post("/admin/content/blog-posts", payload);
        }
      }

      const updatedLabel =
        wasEditingService ? "Đã cập nhật dịch vụ"
          : wasEditingPortfolio ? "Đã cập nhật portfolio"
            : wasEditingBlog ? "Đã cập nhật bài viết"
              : `Đã lưu ${labels[form.kind].singular.toLowerCase()}`;
      toast.success(updatedLabel);
      setEditorOpen(false);
      setEditingServiceId(null);
      setEditingPortfolioId(null);
      setEditingBlogId(null);
      setActiveTab(form.kind);
      await load();
    } catch (submitError) {
      toast.error(getErrorMessage(submitError, "Không thể lưu dữ liệu"));
    } finally {
      setSubmitting(false);
    }
  };

  const activeCount =
    activeTab === "service"
      ? services.length
      : activeTab === "portfolio"
        ? portfolioItems.length
        : activeTab === "blog"
          ? blogPosts.length
          : reviews.length;

  if (editorOpen) {
    const Icon = labels[form.kind].icon;
    const displayCoverImageUrl = coverImagePreviewUrl || form.coverImageUrl;
    const editorTitle =
      editingServiceId ? "Chỉnh sửa dịch vụ"
        : editingPortfolioId ? "Chỉnh sửa portfolio"
          : editingBlogId ? "Chỉnh sửa bài viết"
            : `Thông tin ${labels[form.kind].singular.toLowerCase()}`;

    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-3 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <Button variant="outline" size="icon" onClick={() => setEditorOpen(false)} title="Danh sách">
              <ArrowLeft size={16} />
            </Button>
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Globe size={14} />
                <span>Admin</span>
                <span>/</span>
                <span>Nội dung</span>
                <span>/</span>
                <span>Tạo mới</span>
              </div>
              <h1 className="mt-2 flex items-center gap-2 font-serif text-headline-lg text-foreground">
                <Icon size={22} className="text-primary" />
                {editorTitle}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Hủy tác vụ
            </Button>
            <Button onClick={submitContent} disabled={submitting} className="gap-2">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Lưu dữ liệu
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-border bg-surface-lowest shadow-ambient">
          <Tabs value={editorTab} onValueChange={(value) => setEditorTab(value as EditorTab)}>
            <div className="border-b border-border px-4 pt-4">
              <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-none bg-transparent p-0">
                {editorTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="gap-2 rounded-none border-b-2 border-transparent px-4 py-3 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  >
                    <tab.icon size={16} />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="basic" className="m-0 p-5">
              <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="space-y-3">
                  <FieldLabel required={form.kind !== "service"}>Ảnh minh họa</FieldLabel>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-border bg-surface-low">
                    {displayCoverImageUrl ? (
                      <img src={displayCoverImageUrl} alt="Ảnh minh họa" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Image size={30} />
                        <span className="text-sm">Chưa có ảnh</span>
                      </div>
                    )}
                    {uploadingImage && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 text-sm font-semibold text-foreground">
                        <Loader2 size={22} className="animate-spin text-primary" />
                        Đang tải ảnh lên...
                      </div>
                    )}
                  </div>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={uploadCoverImage}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      disabled={uploadingImage}
                      onClick={() => imageInputRef.current?.click()}
                    >
                      {uploadingImage ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      {form.coverImageUrl ? "Chọn ảnh khác" : "Chọn ảnh từ máy"}
                    </Button>
                    {form.coverImageUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={uploadingImage}
                        onClick={() => {
                          setCoverImagePreviewUrl(null);
                          setForm((current) => ({ ...current, coverImageUrl: "" }));
                        }}
                      >
                        <X size={16} />
                        Xóa ảnh
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Hỗ trợ JPG, PNG, WebP, GIF. Dung lượng tối đa 10MB.
                  </p>
                </div>

                <div className="space-y-5">
                  {form.kind === "service" ? (
                    <div className="space-y-2">
                      <FieldLabel required>Chuyên mục</FieldLabel>
                      <Select
                        value={form.categorySlug}
                        onValueChange={(value) => setForm((current) => ({ ...current, categorySlug: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn chuyên mục dịch vụ" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.slug}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <FieldLabel required>Chuyên mục</FieldLabel>
                      <Input
                        value={form.category}
                        onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                        placeholder={form.kind === "portfolio" ? "Sự kiện nổi bật" : "Cẩm nang"}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <FieldLabel required>Tiêu đề</FieldLabel>
                    <Input
                      value={form.title}
                      onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder={
                        form.kind === "service"
                          ? "Gói tiệc cưới trọn gói 300 khách"
                          : form.kind === "portfolio"
                            ? "Gala Dinner Công ty An Khang"
                            : "Xu hướng tổ chức sự kiện 2026"
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <FieldLabel required>URL cục bộ</FieldLabel>
                    <div className="flex overflow-hidden rounded-md border border-input bg-background">
                      <button
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, slug: slugify(current.title) }))}
                        className="border-r border-input px-4 text-sm font-semibold text-foreground hover:bg-surface-low"
                      >
                        Đề xuất
                      </button>
                      <input
                        value={form.slug}
                        onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                        className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
                        placeholder="duong-dan-than-thien"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <FieldLabel>Nhãn chủ đề</FieldLabel>
                    <div className="flex gap-2">
                      <Input
                        value={form.tagDraft}
                        onChange={(event) => setForm((current) => ({ ...current, tagDraft: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addTag();
                          }
                        }}
                        placeholder="Nhập hashtag"
                      />
                      <Button type="button" variant="outline" onClick={addTag} title="Thêm hashtag">
                        <Hash size={16} />
                      </Button>
                    </div>
                    {form.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {form.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="gap-1 rounded-md bg-surface-low px-2 py-1">
                            #{tag}
                            <button type="button" onClick={() => removeTag(tag)} title="Xoá hashtag">
                              <X size={12} />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {form.kind === "service" && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <FieldLabel>Giá từ</FieldLabel>
                        <Input
                          type="number"
                          value={form.priceFrom}
                          onChange={(event) => setForm((current) => ({ ...current, priceFrom: event.target.value }))}
                          placeholder="50000000"
                        />
                      </div>
                      <div className="space-y-2">
                        <FieldLabel>Giá đến</FieldLabel>
                        <Input
                          type="number"
                          value={form.priceTo}
                          onChange={(event) => setForm((current) => ({ ...current, priceTo: event.target.value }))}
                          placeholder="150000000"
                        />
                      </div>
                      <div className="space-y-2">
                        <FieldLabel>Khách từ</FieldLabel>
                        <Input
                          type="number"
                          value={form.guestFrom}
                          onChange={(event) => setForm((current) => ({ ...current, guestFrom: event.target.value }))}
                          placeholder="100"
                        />
                      </div>
                      <div className="space-y-2">
                        <FieldLabel>Khách đến</FieldLabel>
                        <Input
                          type="number"
                          value={form.guestTo}
                          onChange={(event) => setForm((current) => ({ ...current, guestTo: event.target.value }))}
                          placeholder="500"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <FieldLabel>Khu vực phục vụ</FieldLabel>
                        <Input
                          value={form.locationText}
                          onChange={(event) => setForm((current) => ({ ...current, locationText: event.target.value }))}
                          placeholder="TP.HCM, Hà Nội, Đà Nẵng"
                        />
                      </div>
                    </div>
                  )}

                  {form.kind === "portfolio" && (
                    <div className="space-y-2">
                      <FieldLabel>Số khách</FieldLabel>
                      <Input
                        type="number"
                        value={form.guestCount}
                        onChange={(event) => setForm((current) => ({ ...current, guestCount: event.target.value }))}
                        placeholder="300"
                      />
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <SwitchRow
                      icon={Eye}
                      label={form.kind === "service" ? "Hiển thị dịch vụ" : "Xuất bản nội dung"}
                      checked={form.isPublished}
                      onCheckedChange={(checked) => setForm((current) => ({ ...current, isPublished: checked }))}
                    />
                    <SwitchRow
                      icon={Star}
                      label="Đánh dấu nổi bật"
                      checked={form.isFeatured}
                      onCheckedChange={(checked) => setForm((current) => ({ ...current, isFeatured: checked }))}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="content" className="m-0 space-y-5 p-5">
              <div className="space-y-2">
                <FieldLabel required={form.kind === "service"}>Tóm lược</FieldLabel>
                <Textarea
                  rows={4}
                  value={form.summary}
                  onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                  placeholder={
                    form.kind === "service"
                      ? "Mô tả ngắn hiển thị tại danh sách dịch vụ"
                      : "Nội dung tóm lược hiển thị tại danh sách"
                  }
                />
              </div>

              <div className="space-y-2">
                <FieldLabel required={form.kind !== "portfolio"}>Nội dung chính</FieldLabel>
                <RichTextEditor
                  value={form.content}
                  onChange={(content) => setForm((current) => ({ ...current, content }))}
                  placeholder={
                    form.kind === "blog"
                      ? "Soạn nội dung bài viết..."
                      : form.kind === "portfolio"
                        ? "Soạn nội dung portfolio..."
                        : "Soạn nội dung dịch vụ..."
                  }
                  uploadFolder={`content/${form.kind}/body`}
                />
              </div>
            </TabsContent>

          </Tabs>

          <div className="flex justify-end gap-2 border-t border-border p-4">
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Hủy tác vụ
            </Button>
            <Button onClick={submitContent} disabled={submitting} className="gap-2">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Lưu dữ liệu
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe size={14} />
            <span>Admin</span>
            <span>/</span>
            <span>Nội dung</span>
          </div>
          <h1 className="mt-2 font-serif text-headline-lg text-foreground">Quản lý nội dung</h1>
          <p className="mt-1 font-body text-sm text-muted-foreground">
            {loading ? "Đang tải dữ liệu..." : `Quản lý ${activeCount} mục trong khu vực đang chọn`}
          </p>
        </div>
        {activeTab !== "reviews" && (
          <Button onClick={() => openCreate(activeTab)} className="gap-2">
            <Plus size={16} />
            Tạo mới
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ContentTab)} className="space-y-4">
        <div className="flex flex-col gap-3 rounded-md border border-border bg-surface-lowest p-3 md:flex-row md:items-center md:justify-between">
          <TabsList className="h-auto justify-start gap-1 overflow-x-auto bg-surface-low p-1">
            <TabsTrigger value="service" className="gap-2">
              <Sparkles size={15} />
              Dịch vụ
              <span className="rounded-full bg-background px-2 py-0.5 text-xs">{services.length}</span>
            </TabsTrigger>
            <TabsTrigger value="portfolio" className="gap-2">
              <LayoutGrid size={15} />
              Portfolio
              <span className="rounded-full bg-background px-2 py-0.5 text-xs">{portfolioItems.length}</span>
            </TabsTrigger>
            <TabsTrigger value="blog" className="gap-2">
              <BookOpen size={15} />
              Blog
              <span className="rounded-full bg-background px-2 py-0.5 text-xs">{blogPosts.length}</span>
            </TabsTrigger>
            <TabsTrigger value="reviews" className="gap-2">
              <MessageSquare size={15} />
              Đánh giá
              <span className="rounded-full bg-background px-2 py-0.5 text-xs">{pendingReviews}</span>
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full md:w-72">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
              placeholder="Nhập từ khóa..."
            />
          </div>
        </div>

        <TabsContent value="service" className="m-0 space-y-3">
          {loading && <LoaderBlock />}
          {!loading && filteredServices.length === 0 && <EmptyState icon={Sparkles} message="Chưa có dịch vụ nào." />}
          {!loading &&
            filteredServices.map((service, index) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="grid gap-4 rounded-md border border-border bg-surface-lowest p-4 shadow-ambient lg:grid-cols-[minmax(0,1fr)_110px_210px_auto]"
              >
                <div className="flex min-w-0 gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Sparkles size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-body font-semibold text-foreground">{service.title}</h3>
                      <StatusChip
                        label={service.isActive ? "Đang hiển thị" : "Tạm ẩn"}
                        color={
                          service.isActive
                            ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                            : "bg-muted text-muted-foreground border-border"
                        }
                      />
                      {service.isFeatured && <StatusChip label="Nổi bật" color="bg-primary/10 text-primary border-primary/20" />}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{service.shortDescription || "Chưa có mô tả ngắn"}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Tag size={12} />{service.category?.name ?? "Chưa phân loại"}</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-md bg-surface-low p-3 text-xs text-muted-foreground">
                  <p className="font-semibold uppercase">Lượt xem</p>
                  <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-foreground">
                    <TrendingUp size={13} />
                    {service.viewCount ?? 0}
                  </p>
                </div>
                <div className="rounded-md bg-surface-low p-3 text-xs text-muted-foreground">
                  <p className="font-semibold uppercase">Cập nhật lúc</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {formatDateTime(service.updatedAt ?? service.createdAt)}
                  </p>
                </div>
                <RowActions onEdit={() => openEditService(service)} onDelete={() => void deleteService(service.id)} />
              </motion.div>
            ))}
        </TabsContent>

        <TabsContent value="portfolio" className="m-0 space-y-3">
          {loading && <LoaderBlock />}
          {!loading && filteredPortfolio.length === 0 && <EmptyState icon={LayoutGrid} message="Chưa có portfolio nào." />}
          {!loading &&
            filteredPortfolio.map((item, index) => {
              const status = portfolioStatusMap[item.status] ?? {
                label: item.status,
                color: "bg-muted text-muted-foreground border-border",
              };
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="grid gap-4 rounded-md border border-border bg-surface-lowest p-4 shadow-ambient lg:grid-cols-[minmax(0,1fr)_110px_210px_auto]"
                >
                  <div className="flex min-w-0 gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-secondary/10 text-secondary">
                      <Image size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-body font-semibold text-foreground">{item.title}</h3>
                        <StatusChip label={status.label} color={status.color} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Tag size={12} />{item.category}</span>
                        {item.guestCount && <span>{item.guestCount} khách</span>}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-md bg-surface-low p-3 text-xs text-muted-foreground">
                    <p className="font-semibold uppercase">Lượt xem</p>
                    <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-foreground">
                      <TrendingUp size={13} />
                      {item.viewCount ?? 0}
                    </p>
                  </div>
                  <div className="rounded-md bg-surface-low p-3 text-xs text-muted-foreground">
                    <p className="font-semibold uppercase">Cập nhật lúc</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatDateTime(item.updatedAt ?? item.createdAt ?? item.publishedAt)}
                    </p>
                  </div>
                  <RowActions onEdit={() => openEditPortfolio(item)} onDelete={() => void deletePortfolio(item.id)} />
                </motion.div>
              );
            })}
        </TabsContent>

        <TabsContent value="blog" className="m-0 space-y-3">
          {loading && <LoaderBlock />}
          {!loading && filteredBlogs.length === 0 && <EmptyState icon={BookOpen} message="Chưa có bài viết nào." />}
          {!loading &&
            filteredBlogs.map((post, index) => {
              const status = blogStatusMap[post.status] ?? {
                label: post.status,
                color: "bg-muted text-muted-foreground border-border",
              };
              return (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="grid gap-4 rounded-md border border-border bg-surface-lowest p-4 shadow-ambient lg:grid-cols-[minmax(0,1fr)_110px_210px_auto]"
                >
                  <div className="flex min-w-0 gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <BookOpen size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-body font-semibold text-foreground">{post.title}</h3>
                        <StatusChip label={status.label} color={status.color} />
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.excerpt || "Chưa có tóm lược"}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Tag size={12} />{post.category}</span>
                        {post.publishedAt && (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {new Date(post.publishedAt).toLocaleDateString("vi-VN")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-md bg-surface-low p-3 text-xs text-muted-foreground">
                    <p className="font-semibold uppercase">Lượt xem</p>
                    <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-foreground">
                      <TrendingUp size={13} />
                      {post.viewCount ?? 0}
                    </p>
                  </div>
                  <div className="rounded-md bg-surface-low p-3 text-xs text-muted-foreground">
                    <p className="font-semibold uppercase">Cập nhật lúc</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatDateTime(post.updatedAt ?? post.createdAt ?? post.publishedAt)}
                    </p>
                  </div>
                  <RowActions onEdit={() => openEditBlog(post)} onDelete={() => void deleteBlog(post.id)} />
                </motion.div>
              );
            })}
        </TabsContent>

        <TabsContent value="reviews" className="m-0 space-y-3">
          {loading && <LoaderBlock />}
          {!loading && reviews.length === 0 && <EmptyState icon={MessageSquare} message="Chưa có đánh giá nào." />}
          {!loading &&
            reviews.map((review, index) => {
              const status = reviewStatusMap[review.status] ?? {
                label: review.status,
                color: "bg-muted text-muted-foreground border-border",
              };
              return (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="rounded-md border border-border bg-surface-lowest p-4 shadow-ambient"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-body font-semibold text-foreground">
                          {review.customerUser?.displayName ?? "Khách hàng"}
                        </h3>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }, (_, starIndex) => (
                            <Star
                              key={starIndex}
                              size={14}
                              className={starIndex < review.ratingOverall ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30"}
                            />
                          ))}
                        </div>
                        <StatusChip label={status.label} color={status.color} />
                      </div>
                      {review.event?.name && (
                        <p className="mt-1 text-xs text-muted-foreground">{review.event.name}</p>
                      )}
                      <p className="mt-3 text-sm leading-relaxed text-foreground">{review.comment}</p>
                    </div>
                    <div className="flex flex-shrink-0 gap-1">
                      {review.status !== "approved" && (
                        <Button variant="ghost" size="icon" title="Duyệt đánh giá" onClick={() => void approveReview(review.id)}>
                          <CheckCircle2 size={16} />
                        </Button>
                      )}
                      {review.status !== "hidden" && (
                        <Button variant="ghost" size="icon" title="Ẩn đánh giá" onClick={() => void hideReview(review.id)}>
                          <EyeOff size={16} />
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const LoaderBlock = () => (
  <div className="flex min-h-[260px] items-center justify-center rounded-md border border-border bg-surface-lowest">
    <Loader2 size={22} className="animate-spin text-muted-foreground" />
  </div>
);

const RowActions = ({ onDelete, onEdit }: { onDelete: () => void; onEdit?: () => void }) => (
  <div className="flex items-center justify-end gap-1">
    {onEdit && (
      <Button variant="ghost" size="icon" title="Chỉnh sửa" onClick={onEdit}>
        <Edit3 size={16} />
      </Button>
    )}
    <Button variant="ghost" size="icon" title="Xoá" className="text-destructive hover:text-destructive" onClick={onDelete}>
      <Trash2 size={16} />
    </Button>
  </div>
);

export default AdminContent;
