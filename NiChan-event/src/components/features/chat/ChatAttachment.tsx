// ============================================================
// ChatAttachment — hiển thị ảnh/file đính kèm trong bong bóng chat
// Ảnh: xem trực tiếp (bấm mở tab mới). File khác: thẻ tải xuống.
// ============================================================
import { Download, FileText } from "lucide-react";

type Props = {
  url?: string | null;
  type?: string | null;
  name?: string | null;
  isMine?: boolean;
};

const ChatAttachment = ({ url, type, name, isMine }: Props) => {
  if (!url) return null;

  const isImage = (type ?? "").startsWith("image/");
  const label = name || "Tệp đính kèm";

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block mt-2">
        <img
          src={url}
          alt={label}
          className="max-h-60 w-auto max-w-full rounded-lg object-cover"
          loading="lazy"
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
        isMine ? "bg-primary-foreground/15 hover:bg-primary-foreground/25" : "bg-background hover:bg-surface-high"
      }`}
    >
      <FileText size={16} className="shrink-0" />
      <span className="font-body text-xs truncate flex-1">{label}</span>
      <Download size={14} className="shrink-0" />
    </a>
  );
};

export default ChatAttachment;
