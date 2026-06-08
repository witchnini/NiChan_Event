import { forwardRef } from "react";
import { getEventDisplayName } from "@/lib/eventDisplay";

// Thông tin Bên A (đơn vị cung cấp dịch vụ). Hệ thống chưa có bảng cấu hình công ty
// nên để hằng số ở đây — cập nhật khi có thông tin pháp lý chính thức.
export const PROVIDER = {
  name: "CÔNG TY TNHH NICHAN EVENTS",
  address: "Hà Đông - Hà Nội",  
  taxCode: "0312345678",
  phone: "1900 1234",
  email: "hopdong@nichan.vn",
  representative: "Bà Phạm Thủy Ni Ni",
  position: "Giám đốc",
};

type ContractVersion = {
  versionLabel?: string;
  scopeText?: string;
  paymentTerms?: string;
  generalTerms?: string;
};

export type FullContract = {
  id: string;
  contractCode: string;
  status: string;
  totalValue: string | number;
  currentVersion: string;
  sentAt?: string | null;
  signedAt?: string | null;
  createdAt?: string | null;
  event?: {
    id: string;
    name: string;
    type?: string | null;
    eventDate?: string | null;
    locationText?: string | null;
    customerUser?: { displayName?: string | null } | null;
    consultationRequest?: { customerName?: string | null; eventType?: string | null; note?: string | null } | null;
  } | null;
  customerUser?: { displayName?: string | null; phone?: string | null; email?: string | null } | null;
  createdBy?: { displayName?: string | null } | null;
  versions?: ContractVersion[];
};

const money = (value: string | number) => Number(value || 0).toLocaleString("vi-VN") + " ₫";

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("vi-VN") : "…/…/……");

const formatDateParts = (value?: string | null) => {
  if (!value) return { day: "….", month: "….", year: "……" };
  const d = new Date(value);
  return { day: String(d.getDate()), month: String(d.getMonth() + 1), year: String(d.getFullYear()) };
};

// Đọc một khối 0..999 thành chữ tiếng Việt
const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
const readBlock = (n: number): string => {
  const tram = Math.floor(n / 100);
  const chuc = Math.floor((n % 100) / 10);
  const donvi = n % 10;
  let s = "";
  if (tram > 0) {
    s += DIGITS[tram] + " trăm";
    if (chuc === 0 && donvi > 0) s += " lẻ";
  }
  if (chuc > 0) {
    s += chuc === 1 ? " mười" : " " + DIGITS[chuc] + " mươi";
  }
  if (donvi > 0) {
    if (chuc > 1 && donvi === 1) s += " mốt";
    else if (chuc >= 1 && donvi === 5) s += " lăm";
    else s += " " + DIGITS[donvi];
  }
  return s.trim();
};

// Chuyển số tiền thành chữ (đủ dùng cho giá trị hợp đồng thông thường)
export const numberToVietnameseWords = (value: number): string => {
  const n = Math.floor(Number(value) || 0);
  if (n <= 0) return "Không đồng";
  const units = ["", " nghìn", " triệu", " tỷ"];
  const blocks: number[] = [];
  let rest = n;
  while (rest > 0) {
    blocks.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }
  const parts: string[] = [];
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i] === 0) continue;
    parts.push(readBlock(blocks[i]) + units[i]);
  }
  const result = parts.join(" ").trim() + " đồng";
  return result.charAt(0).toUpperCase() + result.slice(1);
};

const Clause = ({ index, title, children }: { index: number; title: string; children: React.ReactNode }) => (
  <div className="mb-5">
    <h3 className="font-serif font-bold text-foreground mb-1">Điều {index}: {title}</h3>
    <div className="text-foreground text-justify leading-relaxed whitespace-pre-wrap">{children}</div>
  </div>
);

/**
 * Bản hợp đồng đầy đủ, định dạng A4, in / lưu PDF được (qua window.print()).
 */
const ContractDocument = forwardRef<HTMLDivElement, { contract: FullContract }>(({ contract }, ref) => {
  const version = contract.versions?.[0];
  const customerName = contract.customerUser?.displayName ?? contract.event?.consultationRequest?.customerName ?? "…";
  const eventName = contract.event ? getEventDisplayName(contract.event) : "…";
  const signDate = formatDateParts(contract.signedAt ?? contract.sentAt ?? contract.createdAt);

  return (
    <div ref={ref} className="contract-print-area bg-white text-black mx-auto p-10 font-body text-sm" style={{ maxWidth: "820px" }}>
      {/* Quốc hiệu */}
      <div className="text-center mb-6">
        <p className="font-bold uppercase">Cộng hòa xã hội chủ nghĩa Việt Nam</p>
        <p className="font-semibold">Độc lập - Tự do - Hạnh phúc</p>
        <p className="tracking-widest">———oOo———</p>
      </div>

      {/* Tiêu đề */}
      <div className="text-center mb-6">
        <h1 className="font-serif text-2xl font-bold uppercase">Hợp đồng dịch vụ tổ chức sự kiện</h1>
        <p className="mt-1">Số: {contract.contractCode} &nbsp;·&nbsp; Phiên bản {contract.currentVersion}</p>
      </div>

      <div className="mb-5 text-justify leading-relaxed">
        <p>- Căn cứ Bộ luật Dân sự số 91/2015/QH13 và các quy định pháp luật hiện hành;</p>
        <p>- Căn cứ nhu cầu và khả năng của hai bên;</p>
        <p className="mt-2">
          Hôm nay, ngày {signDate.day} tháng {signDate.month} năm {signDate.year}, chúng tôi gồm:
        </p>
      </div>

      {/* Bên A */}
      <div className="mb-4">
        <p className="font-bold">BÊN A (BÊN CUNG CẤP DỊCH VỤ):</p>
        <p>Tên đơn vị: <span className="font-semibold">{PROVIDER.name}</span></p>
        <p>Địa chỉ: {PROVIDER.address}</p>
        <p>Mã số thuế: {PROVIDER.taxCode} &nbsp;·&nbsp; Điện thoại: {PROVIDER.phone} &nbsp;·&nbsp; Email: {PROVIDER.email}</p>
        <p>Đại diện: <span className="font-semibold">{PROVIDER.representative}</span> &nbsp;·&nbsp; Chức vụ: {PROVIDER.position}</p>
      </div>

      {/* Bên B */}
      <div className="mb-5">
        <p className="font-bold">BÊN B (KHÁCH HÀNG):</p>
        <p>Họ và tên: <span className="font-semibold">{customerName}</span></p>
        {contract.customerUser?.phone && <p>Điện thoại: {contract.customerUser.phone}</p>}
        {contract.customerUser?.email && <p>Email: {contract.customerUser.email}</p>}
      </div>

      <p className="mb-5">Hai bên thống nhất ký kết hợp đồng với các điều khoản sau:</p>

      <Clause index={1} title="Nội dung và phạm vi dịch vụ">
        <p className="mb-2">
          Bên A cung cấp cho Bên B dịch vụ tổ chức sự kiện: <span className="font-semibold">{eventName}</span>
          {contract.event?.type ? ` (loại hình: ${contract.event.type})` : ""}.
        </p>
        {contract.event?.eventDate && <p>Thời gian tổ chức (dự kiến): {formatDate(contract.event.eventDate)}.</p>}
        {contract.event?.locationText && <p>Địa điểm: {contract.event.locationText}.</p>}
        <p className="mt-2 font-semibold">Phạm vi công việc:</p>
        <p>{version?.scopeText || "Theo thỏa thuận chi tiết giữa hai bên."}</p>
      </Clause>

      <Clause index={2} title="Giá trị hợp đồng và phương thức thanh toán">
        <p>
          Tổng giá trị hợp đồng: <span className="font-bold">{money(contract.totalValue)}</span>
        </p>
        <p className="italic">(Bằng chữ: {numberToVietnameseWords(Number(contract.totalValue))})</p>
        <p className="mt-2 font-semibold">Điều khoản thanh toán:</p>
        <p>{version?.paymentTerms || "Theo thỏa thuận giữa hai bên."}</p>
      </Clause>

      <Clause index={3} title="Điều khoản chung">
        {version?.generalTerms || "Hai bên cam kết thực hiện đúng các điều khoản đã thỏa thuận."}
      </Clause>

      <Clause index={4} title="Hiệu lực hợp đồng">
        Hợp đồng có hiệu lực kể từ ngày ký và được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.
      </Clause>

      {/* Chữ ký */}
      <div className="grid grid-cols-2 gap-6 mt-10 text-center">
        <div>
          <p className="font-bold uppercase">Đại diện Bên A</p>
          <p className="italic text-xs">(Ký, ghi rõ họ tên)</p>
          <p className="mt-16 font-semibold">{PROVIDER.representative}</p>
        </div>
        <div>
          <p className="font-bold uppercase">Đại diện Bên B</p>
          <p className="italic text-xs">(Ký, ghi rõ họ tên)</p>
          <p className="mt-16 font-semibold">{customerName}</p>
        </div>
      </div>
    </div>
  );
});

ContractDocument.displayName = "ContractDocument";

export default ContractDocument;
