import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Eraser,
  Image as ImageIcon,
  ImagePlus,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Subscript,
  Superscript,
  Table2,
  Underline,
  Undo2,
  Unlink2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  escapeHtml,
  hasMeaningfulRichText,
  normalizeRichTextInput,
  plainTextToRichTextHtml,
  sanitizeRichTextHtml,
} from "@/lib/richText";
import { toast } from "sonner";

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  uploadFolder?: string;
};

type ToolButtonProps = {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
};

const safeUrlPattern = /^(?:(?:https?|mailto|tel):|\/(?!\/)|#|data:image\/(?:png|gif|jpe?g|webp);base64,)/i;
const mediaUploadLimitBytes = 10 * 1024 * 1024;

const escapeAttribute = (value: string) => escapeHtml(value).replace(/`/g, "&#96;");

type UploadedMedia = {
  url: string;
  name: string;
  size: number;
  alt: string;
};

type UploadResponse = {
  url: string;
};

type ApiUploadResponse =
  | { success: true; data: UploadResponse }
  | { success: false; error?: { message?: string } };

const formatBytes = (size: number) => {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
};

const stripFileExtension = (name: string) => name.replace(/\.[^/.]+$/, "");

const ToolButton = ({ disabled = false, icon: Icon, label, onClick }: ToolButtonProps) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    disabled={disabled}
    onMouseDown={(event) => {
      event.preventDefault();
      if (!disabled) onClick();
    }}
    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-surface-low disabled:cursor-not-allowed disabled:opacity-40"
  >
    <Icon size={15} />
  </button>
);

const ToolbarSelect = ({
  label,
  options,
  onValueChange,
}: {
  label: string;
  options: { label: string; value: string }[];
  onValueChange: (value: string) => void;
}) => (
  <select
    aria-label={label}
    title={label}
    value=""
    onChange={(event) => {
      if (event.target.value) onValueChange(event.target.value);
    }}
    className="h-8 min-w-[122px] rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none transition-colors focus:ring-2 focus:ring-ring"
  >
    <option value="">{label}</option>
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

const ColorControl = ({
  label,
  icon: Icon,
  onChange,
}: {
  label: string;
  icon: LucideIcon;
  onChange: (value: string) => void;
}) => (
  <label
    title={label}
    className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-surface-low"
  >
    <Icon size={15} />
    <input
      aria-label={label}
      type="color"
      className="absolute inset-0 cursor-pointer opacity-0"
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);

const formatOptions = [
  { label: "Đoạn", value: "p" },
  { label: "Tiêu đề 1", value: "h1" },
  { label: "Tiêu đề 2", value: "h2" },
  { label: "Tiêu đề 3", value: "h3" },
  { label: "Trích dẫn", value: "blockquote" },
  { label: "Mã nguồn", value: "pre" },
];

const fontSizeOptions = [
  { label: "13px", value: "2" },
  { label: "16px", value: "3" },
  { label: "18px", value: "4" },
  { label: "24px", value: "5" },
  { label: "32px", value: "6" },
];

const fontFamilyOptions = [
  { label: "Plus Jakarta Sans", value: "Plus Jakarta Sans" },
  { label: "Noto Serif", value: "Noto Serif" },
  { label: "Arial", value: "Arial" },
  { label: "Georgia", value: "Georgia" },
  { label: "Times New Roman", value: "Times New Roman" },
];

const insertTableMarkup = () => {
  const cells = Array.from({ length: 3 }, () =>
    `<tr>${Array.from({ length: 3 }, () => "<td>&nbsp;</td>").join("")}</tr>`,
  ).join("");
  return `<table><tbody>${cells}</tbody></table>`;
};

export const RichTextEditor = ({
  className,
  onChange,
  placeholder = "Soạn nội dung chi tiết...",
  uploadFolder = "content/body",
  value,
}: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const selectionRef = useRef<Range | null>(null);
  const [sourceMode, setSourceMode] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaTab, setMediaTab] = useState<"upload" | "library">("upload");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaAlt, setMediaAlt] = useState("");

  const saveSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      selectionRef.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    const selection = window.getSelection();
    if (!selection) return;

    selection.removeAllRanges();

    try {
      const range = selectionRef.current;
      if (range && editor.contains(range.commonAncestorContainer)) {
        selection.addRange(range);
        return;
      }
    } catch {
      selectionRef.current = null;
    }

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.addRange(range);
  };

  const updateFromEditor = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const next = normalizeRichTextInput(editor.innerHTML);
    onChange(hasMeaningfulRichText(next) ? next : "");
    saveSelection();
  };

  const runCommand = (command: string, commandValue?: string) => {
    restoreSelection();
    document.execCommand(command, false, commandValue);
    updateFromEditor();
  };

  const insertHtml = (html: string) => {
    restoreSelection();
    document.execCommand("insertHTML", false, sanitizeRichTextHtml(html));
    updateFromEditor();
  };

  const createLink = () => {
    restoreSelection();
    const rawUrl = window.prompt("Nhập URL liên kết", "https://");
    const href = rawUrl?.trim();
    if (!href || !safeUrlPattern.test(href)) return;

    const selection = window.getSelection();
    const selectedText = selection?.toString();
    if (selectedText) {
      document.execCommand("createLink", false, href);
    } else {
      insertHtml(`<a href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(href)}</a>`);
      return;
    }

    editorRef.current?.querySelectorAll<HTMLAnchorElement>(`a[href="${CSS.escape(href)}"]`).forEach((link) => {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });
    updateFromEditor();
  };

  const openMediaDialog = () => {
    saveSelection();
    setMediaOpen(true);
  };

  const uploadMediaFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn file ảnh");
      return;
    }

    if (file.size > mediaUploadLimitBytes) {
      toast.error(`Ảnh không được vượt quá ${formatBytes(mediaUploadLimitBytes)}`);
      return;
    }

    const token = localStorage.getItem("nichan_token");
    if (!token) {
      toast.error("Phiên đăng nhập đã hết hạn");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setMediaPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return previewUrl;
    });
    setUploadedMedia(null);
    setMediaAlt(stripFileExtension(file.name));
    setUploadingMedia(true);

    const body = new FormData();
    body.append("file", file);
    body.append("folder", uploadFolder);

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

      setUploadedMedia({
        url: json.data.url,
        name: file.name,
        size: file.size,
        alt: stripFileExtension(file.name),
      });
      setMediaTab("library");
      toast.success("Đã tải ảnh lên");
    } catch (error) {
      setUploadedMedia(null);
      toast.error(error instanceof Error ? error.message : "Không thể tải ảnh lên");
    } finally {
      setUploadingMedia(false);
      if (mediaInputRef.current) mediaInputRef.current.value = "";
    }
  };

  const handleMediaFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file) void uploadMediaFile(file);
  };

  const handleMediaDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadMediaFile(file);
  };

  const insertUploadedMedia = () => {
    if (!uploadedMedia) return;

    const alt = mediaAlt.trim() || uploadedMedia.alt;
    const html = `<p><img src="${escapeAttribute(uploadedMedia.url)}" alt="${escapeAttribute(alt)}" /></p>`;

    if (sourceMode) {
      onChange(`${normalizeRichTextInput(value)}${sanitizeRichTextHtml(html)}`);
    } else {
      insertHtml(html);
    }

    setMediaOpen(false);
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");

    if (html) {
      insertHtml(html);
      return;
    }

    insertHtml(plainTextToRichTextHtml(text));
  };

  const showVisualMode = () => {
    onChange(normalizeRichTextInput(value));
    setSourceMode(false);
  };

  useEffect(() => {
    if (sourceMode) return;

    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;

    const nextHtml = normalizeRichTextInput(value);
    if (editor.innerHTML !== nextHtml) {
      editor.innerHTML = nextHtml;
    }
  }, [sourceMode, value]);

  useEffect(() => {
    return () => {
      if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    };
  }, [mediaPreviewUrl]);

  return (
    <div
      className={cn(
        "rich-text-editor overflow-hidden rounded-md border border-border bg-background",
        expanded && "fixed inset-4 z-[90] flex flex-col shadow-2xl",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-low px-3 py-2">
        <button
          type="button"
          onClick={openMediaDialog}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-primary bg-background px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          <ImagePlus size={16} />
          Thêm Media
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={showVisualMode}
            className={cn(
              "h-8 rounded-md border px-3 text-sm transition-colors",
              !sourceMode ? "border-border bg-background text-foreground" : "border-transparent text-muted-foreground hover:bg-background",
            )}
          >
            Trực quan
          </button>
          <button
            type="button"
            onClick={() => setSourceMode(true)}
            className={cn(
              "h-8 rounded-md border px-3 text-sm transition-colors",
              sourceMode ? "border-border bg-background text-foreground" : "border-transparent text-muted-foreground hover:bg-background",
            )}
          >
            Văn bản
          </button>
        </div>
      </div>

      {!sourceMode && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-lowest p-3">
          <ToolButton label="In đậm" icon={Bold} onClick={() => runCommand("bold")} />
          <ToolButton label="In nghiêng" icon={Italic} onClick={() => runCommand("italic")} />
          <ToolButton label="Gạch chân" icon={Underline} onClick={() => runCommand("underline")} />
          <ToolButton label="Gạch ngang" icon={Strikethrough} onClick={() => runCommand("strikeThrough")} />
          <ToolButton label="Trích dẫn" icon={Quote} onClick={() => runCommand("formatBlock", "blockquote")} />
          <ToolButton label="Danh sách chấm" icon={List} onClick={() => runCommand("insertUnorderedList")} />
          <ToolButton label="Danh sách số" icon={ListOrdered} onClick={() => runCommand("insertOrderedList")} />
          <ToolbarSelect label="Định dạng" options={formatOptions} onValueChange={(nextValue) => runCommand("formatBlock", nextValue)} />
          <ToolbarSelect label="Cỡ chữ" options={fontSizeOptions} onValueChange={(nextValue) => runCommand("fontSize", nextValue)} />
          <ToolButton label="Giảm thụt lề" icon={IndentDecrease} onClick={() => runCommand("outdent")} />
          <ToolButton label="Tăng thụt lề" icon={IndentIncrease} onClick={() => runCommand("indent")} />
          <ToolButton label="Căn trái" icon={AlignLeft} onClick={() => runCommand("justifyLeft")} />
          <ToolButton label="Căn giữa" icon={AlignCenter} onClick={() => runCommand("justifyCenter")} />
          <ToolButton label="Căn phải" icon={AlignRight} onClick={() => runCommand("justifyRight")} />
          <ToolButton label="Căn đều" icon={AlignJustify} onClick={() => runCommand("justifyFull")} />
          <ToolButton label="Chèn liên kết" icon={Link2} onClick={createLink} />
          <ToolButton label="Bỏ liên kết" icon={Unlink2} onClick={() => runCommand("unlink")} />
          <ToolButton label="Hoàn tác" icon={Undo2} onClick={() => runCommand("undo")} />
          <ToolButton label="Làm lại" icon={Redo2} onClick={() => runCommand("redo")} />
          <ToolbarSelect label="Font chữ" options={fontFamilyOptions} onValueChange={(nextValue) => runCommand("fontName", nextValue)} />
          <ToolButton label="Chỉ số dưới" icon={Subscript} onClick={() => runCommand("subscript")} />
          <ToolButton label="Chỉ số trên" icon={Superscript} onClick={() => runCommand("superscript")} />
          <ColorControl label="Màu chữ" icon={Code2} onChange={(nextValue) => runCommand("foreColor", nextValue)} />
          <ColorControl label="Màu nền" icon={Eraser} onChange={(nextValue) => runCommand("hiliteColor", nextValue)} />
          <ToolButton label="Kẻ ngang" icon={Minus} onClick={() => runCommand("insertHorizontalRule")} />
          <ToolButton label="Chèn bảng" icon={Table2} onClick={() => insertHtml(insertTableMarkup())} />
          <ToolButton label="Xóa định dạng" icon={Eraser} onClick={() => runCommand("removeFormat")} />
          <ToolButton
            label={expanded ? "Thu nhỏ" : "Toàn màn hình"}
            icon={expanded ? Minimize2 : Maximize2}
            onClick={() => setExpanded((current) => !current)}
          />
        </div>
      )}

      {sourceMode ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => onChange(normalizeRichTextInput(value))}
          className={cn(
            "min-h-[360px] w-full resize-y border-0 bg-background p-4 font-mono text-sm leading-6 text-foreground outline-none",
            expanded && "flex-1 resize-none",
          )}
          placeholder="<p>Soạn nội dung HTML...</p>"
        />
      ) : (
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-label="Nội dung chính"
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={updateFromEditor}
          onPaste={handlePaste}
          onFocus={saveSelection}
          onBlur={saveSelection}
          onKeyUp={saveSelection}
          onMouseUp={saveSelection}
          className={cn(
            "rich-text-content min-h-[360px] w-full overflow-y-auto bg-background p-4 text-base leading-7 outline-none",
            expanded && "flex-1",
          )}
        />
      )}

      <Dialog
        open={mediaOpen}
        onOpenChange={(open) => {
          setMediaOpen(open);
          if (open) saveSelection();
        }}
      >
        <DialogContent className="max-w-[720px] gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-4 py-3">
            <DialogTitle className="font-body text-base">Thêm media</DialogTitle>
            <DialogDescription className="sr-only">
              Tải ảnh lên và chèn ảnh vào nội dung bài viết.
            </DialogDescription>
          </DialogHeader>

          <div className="border-b border-border px-4">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setMediaTab("upload")}
                className={cn(
                  "border-b-2 px-3 py-2 text-sm transition-colors",
                  mediaTab === "upload"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                Tải file
              </button>
              <button
                type="button"
                onClick={() => setMediaTab("library")}
                className={cn(
                  "border-b-2 px-3 py-2 text-sm transition-colors",
                  mediaTab === "library"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                Media
              </button>
            </div>
          </div>

          <div className="min-h-[300px] bg-background p-5">
            {mediaTab === "upload" ? (
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleMediaDrop}
                className={cn(
                  "flex min-h-[250px] flex-col items-center justify-center rounded-md border border-dashed border-border bg-surface-lowest px-6 text-center transition-colors",
                  uploadingMedia && "pointer-events-none opacity-70",
                )}
              >
                <UploadCloud size={32} className="mb-4 text-muted-foreground" />
                <p className="font-body text-base text-foreground">Thả các tập tin để tải lên</p>
                <p className="my-2 text-xs text-muted-foreground">hoặc</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => mediaInputRef.current?.click()}
                  disabled={uploadingMedia}
                >
                  {uploadingMedia ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
                  Chọn tập tin
                </Button>
                <p className="mt-4 text-xs text-muted-foreground">
                  Kích thước tập tin tải lên tối đa: {formatBytes(mediaUploadLimitBytes)}
                </p>
                <input
                  ref={mediaInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleMediaFileChange}
                />
              </div>
            ) : uploadedMedia ? (
              <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-md border border-border bg-surface-low">
                  <img
                    src={mediaPreviewUrl ?? uploadedMedia.url}
                    alt={mediaAlt || uploadedMedia.alt}
                    className="aspect-square w-full object-cover"
                  />
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="font-body text-sm font-semibold text-foreground">{uploadedMedia.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatBytes(uploadedMedia.size)}</p>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="rich-text-media-alt" className="text-sm font-semibold text-foreground">
                      Văn bản thay thế
                    </label>
                    <input
                      id="rich-text-media-alt"
                      value={mediaAlt}
                      onChange={(event) => setMediaAlt(event.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Mô tả ngắn cho ảnh"
                    />
                  </div>
                  <div className="rounded-md border border-border bg-surface-low p-3 text-xs text-muted-foreground">
                    Ảnh sẽ được chèn tại vị trí con trỏ trong nội dung chính.
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[250px] flex-col items-center justify-center rounded-md border border-dashed border-border bg-surface-lowest text-center">
                <ImageIcon size={30} className="mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Chưa có ảnh nào được tải lên trong phiên soạn thảo này.</p>
                <Button type="button" variant="outline" className="mt-4" onClick={() => setMediaTab("upload")}>
                  Tải ảnh mới
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border p-4">
            <Button type="button" variant="outline" onClick={() => setMediaOpen(false)}>
              Hủy
            </Button>
            <Button type="button" onClick={insertUploadedMedia} disabled={!uploadedMedia || uploadingMedia}>
              Chèn vào bài viết
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
