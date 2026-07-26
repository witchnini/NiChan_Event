import { ArrowRight, Calendar, MapPin, UserRound, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

type CustomerEventCardProps = {
  to: string;
  title: string;
  statusLabel: string;
  statusClassName: string;
  eventDate?: string | null;
  locationText?: string | null;
  guestCount?: number | null;
  managerName?: string | null;
  progressPercent?: number | null;
  budget?: string;
};

const CustomerEventCard = ({
  to,
  title,
  statusLabel,
  statusClassName,
  eventDate,
  locationText,
  guestCount,
  managerName,
  progressPercent = 0,
  budget,
}: CustomerEventCardProps) => (
  <Link
    to={to}
    aria-label={`Xem chi tiết sự kiện ${title}`}
    className="group block h-full rounded-xl bg-surface-lowest p-6 shadow-ambient transition-shadow hover:shadow-ambient-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
  >
    <div className="flex h-full flex-col gap-6 md:flex-row md:items-center">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h3 className="font-serif text-headline-md text-foreground">{title}</h3>
          <span className={`shrink-0 rounded-full px-3 py-1 font-body text-xs font-semibold ${statusClassName}`}>
            {statusLabel}
          </span>
        </div>
        <div className="flex flex-wrap gap-4 font-body text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar size={14} />
            {eventDate ? new Date(eventDate).toLocaleDateString("vi-VN") : "Chưa cập nhật"}
          </span>
          {locationText !== undefined && (
            <span className="flex items-center gap-1"><MapPin size={14} /> {locationText || "Chưa cập nhật"}</span>
          )}
          {guestCount !== undefined && (
            <span className="flex items-center gap-1"><Users size={14} /> {guestCount ?? 0} khách</span>
          )}
          <span className="flex items-center gap-1">
            <UserRound size={14} /> Quản lý dự án: {managerName || "Chưa phân công"}
          </span>
        </div>
      </div>
      <div className="w-full space-y-2 md:w-48">
        <div className="flex items-center justify-between font-body text-sm">
          <span className="text-muted-foreground">Tiến độ</span>
          <span className="font-semibold text-foreground">{progressPercent}%</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
        {budget && <p className="font-body text-sm text-muted-foreground">Ngân sách: {budget}</p>}
      </div>
      <ArrowRight size={20} className="hidden shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 md:block" />
    </div>
  </Link>
);

export default CustomerEventCard;
