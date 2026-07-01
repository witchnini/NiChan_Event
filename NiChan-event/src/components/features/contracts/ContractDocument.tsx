import { forwardRef, type ReactNode } from "react";
import { getEventDisplayName } from "@/lib/eventDisplay";

// Thông tin Bên A (đơn vị cung cấp dịch vụ). Khi có bảng cấu hình công ty,
// các giá trị này có thể chuyển sang cấu hình hệ thống.
export const PROVIDER = {
  name: "CÔNG TY TNHH NICHAN EVENTS",
  address: "Hà Đông - Hà Nội",
  taxCode: "0312345678",
  phone: "1900 1234",
  email: "hopdong@nichan.vn",
  representative: "Bà Phạm Thùy Ni Ni",
  position: "Giám đốc",
};

type ContractLineItem = {
  id?: string;
  category: string;
  description?: string | null;
  unit?: string | null;
  quantity: string | number;
  unitPrice: string | number;
  amount?: string | number | null;
  note?: string | null;
};

type ContractVersion = {
  versionLabel?: string;
  scopeText?: string;
  paymentTerms?: string;
  generalTerms?: string;
  lineItems?: ContractLineItem[];
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
  transactions?: {
    id: string;
    amount: string | number;
    status: string;
    paymentMethod?: string | null;
  }[];
};

const money = (value: string | number | null | undefined) =>
  Number(value || 0).toLocaleString("vi-VN") + " đ";

const numberValue = (value: string | number | null | undefined) => Number(value || 0);

const formatQuantity = (value: string | number) => {
  const quantity = numberValue(value);
  return Number.isInteger(quantity)
    ? quantity.toLocaleString("vi-VN")
    : quantity.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : ".../.../....";

const formatDateParts = (value?: string | null) => {
  if (!value) return { day: "....", month: "....", year: "...." };
  const d = new Date(value);
  return {
    day: String(d.getDate()),
    month: String(d.getMonth() + 1),
    year: String(d.getFullYear()),
  };
};

const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

const readBlock = (n: number): string => {
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor((n % 100) / 10);
  const units = n % 10;
  let value = "";

  if (hundreds > 0) {
    value += DIGITS[hundreds] + " trăm";
    if (tens === 0 && units > 0) value += " lẻ";
  }

  if (tens > 0) {
    value += tens === 1 ? " mười" : " " + DIGITS[tens] + " mươi";
  }

  if (units > 0) {
    if (tens > 1 && units === 1) value += " mốt";
    else if (tens >= 1 && units === 5) value += " lăm";
    else value += " " + DIGITS[units];
  }

  return value.trim();
};

export const numberToVietnameseWords = (value: number): string => {
  const amount = Math.floor(Number(value) || 0);
  if (amount <= 0) return "Không đồng";

  const units = ["", " nghìn", " triệu", " tỷ"];
  const blocks: number[] = [];
  let rest = amount;

  while (rest > 0) {
    blocks.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }

  const parts: string[] = [];
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    if (blocks[index] === 0) continue;
    parts.push(readBlock(blocks[index]) + units[index]);
  }

  const result = parts.join(" ").trim() + " đồng";
  return result.charAt(0).toUpperCase() + result.slice(1);
};

const getLineAmount = (item: ContractLineItem) => {
  const storedAmount = numberValue(item.amount);
  if (storedAmount > 0) return storedAmount;
  return numberValue(item.quantity) * numberValue(item.unitPrice);
};

const Clause = ({ index, title, children }: { index: number; title: string; children: ReactNode }) => (
  <div className="mb-5">
    <h3 className="mb-1 font-serif font-bold text-foreground">Điều {index}: {title}</h3>
    <div className="whitespace-pre-wrap text-justify leading-relaxed text-foreground">{children}</div>
  </div>
);

const QuotationTable = ({ items, totalValue }: { items: ContractLineItem[]; totalValue: string | number }) => {
  if (items.length === 0) {
    return (
      <p>
        Tổng giá trị hợp đồng: <span className="font-bold">{money(totalValue)}</span>
      </p>
    );
  }

  return (
    <div className="mt-3 overflow-hidden border border-gray-400">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 px-2 py-2 text-center font-bold">STT</th>
            <th className="border border-gray-400 px-2 py-2 text-left font-bold">Hạng mục dịch vụ</th>
            <th className="border border-gray-400 px-2 py-2 text-center font-bold">SL</th>
            <th className="border border-gray-400 px-2 py-2 text-center font-bold">Đơn vị</th>
            <th className="border border-gray-400 px-2 py-2 text-right font-bold">Đơn giá</th>
            <th className="border border-gray-400 px-2 py-2 text-right font-bold">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id ?? `${item.category}-${index}`}>
              <td className="border border-gray-400 px-2 py-2 text-center">{index + 1}</td>
              <td className="border border-gray-400 px-2 py-2">
                <p className="font-semibold">{item.category}</p>
                {item.description && <p className="mt-0.5 text-[11px] leading-relaxed">{item.description}</p>}
                {item.note && <p className="mt-0.5 text-[11px] italic">Ghi chú: {item.note}</p>}
              </td>
              <td className="border border-gray-400 px-2 py-2 text-center">{formatQuantity(item.quantity)}</td>
              <td className="border border-gray-400 px-2 py-2 text-center">{item.unit || "-"}</td>
              <td className="border border-gray-400 px-2 py-2 text-right">{money(item.unitPrice)}</td>
              <td className="border border-gray-400 px-2 py-2 text-right font-semibold">{money(getLineAmount(item))}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={5} className="border border-gray-400 px-2 py-2 text-right font-bold">
              Tổng cộng
            </td>
            <td className="border border-gray-400 px-2 py-2 text-right font-bold">{money(totalValue)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

const ContractDocument = forwardRef<HTMLDivElement, { contract: FullContract }>(({ contract }, ref) => {
  const version = contract.versions?.[0];
  const lineItems = version?.lineItems ?? [];
  const customerName = contract.customerUser?.displayName ?? contract.event?.consultationRequest?.customerName ?? "...";
  const eventName = contract.event ? getEventDisplayName(contract.event) : "...";
  const signDate = formatDateParts(contract.signedAt ?? contract.sentAt ?? contract.createdAt);

  return (
    <div
      ref={ref}
      className="contract-print-area mx-auto bg-white p-10 font-body text-sm text-black"
      style={{ maxWidth: "820px" }}
    >
      <div className="mb-6 text-center">
        <p className="font-bold uppercase">Cộng hòa xã hội chủ nghĩa Việt Nam</p>
        <p className="font-semibold">Độc lập - Tự do - Hạnh phúc</p>
        <p>----------oOo----------</p>
      </div>

      <div className="mb-6 text-center">
        <h1 className="font-serif text-2xl font-bold uppercase">Hợp đồng dịch vụ tổ chức sự kiện</h1>
        <p className="mt-1">Số: {contract.contractCode} · Phiên bản {contract.currentVersion}</p>
      </div>

      <div className="mb-5 text-justify leading-relaxed">
        <p>- Căn cứ Bộ luật Dân sự số 91/2015/QH13 và các quy định pháp luật hiện hành;</p>
        <p>- Căn cứ nhu cầu và khả năng của hai bên;</p>
        <p className="mt-2">
          Hôm nay, ngày {signDate.day} tháng {signDate.month} năm {signDate.year}, chúng tôi gồm:
        </p>
      </div>

      <div className="mb-4">
        <p className="font-bold">BÊN A (BÊN CUNG CẤP DỊCH VỤ):</p>
        <p>Tên đơn vị: <span className="font-semibold">{PROVIDER.name}</span></p>
        <p>Địa chỉ: {PROVIDER.address}</p>
        <p>Mã số thuế: {PROVIDER.taxCode} · Điện thoại: {PROVIDER.phone} · Email: {PROVIDER.email}</p>
        <p>Đại diện: <span className="font-semibold">{PROVIDER.representative}</span> · Chức vụ: {PROVIDER.position}</p>
      </div>

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
        {contract.event?.eventDate && <p>Thời gian tổ chức dự kiến: {formatDate(contract.event.eventDate)}.</p>}
        {contract.event?.locationText && <p>Địa điểm: {contract.event.locationText}.</p>}
        <p className="mt-2 font-semibold">Phạm vi công việc:</p>
        <p>{version?.scopeText || "Theo thỏa thuận chi tiết giữa hai bên."}</p>
      </Clause>

      <Clause index={2} title="Báo giá dịch vụ và phương thức thanh toán">
        <p>
          Tổng giá trị hợp đồng: <span className="font-bold">{money(contract.totalValue)}</span>
        </p>
        <p className="italic">(Bằng chữ: {numberToVietnameseWords(Number(contract.totalValue))})</p>
        <p className="mt-3 font-semibold">Phụ lục báo giá chi tiết:</p>
        <QuotationTable items={lineItems} totalValue={contract.totalValue} />
        <p className="mt-3 font-semibold">Điều khoản thanh toán:</p>
        <p>{version?.paymentTerms || "Theo thỏa thuận giữa hai bên."}</p>
      </Clause>

      <Clause index={3} title="Điều khoản chung">
        {version?.generalTerms || "Hai bên cam kết thực hiện đúng các điều khoản đã thỏa thuận."}
      </Clause>

      <Clause index={4} title="Hiệu lực hợp đồng">
        Hợp đồng có hiệu lực kể từ ngày ký và được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.
      </Clause>

      <div className="mt-10 grid grid-cols-2 gap-6 text-center">
        <div>
          <p className="font-bold uppercase">Đại diện Bên A</p>
          <p className="text-xs italic">(Ký, ghi rõ họ tên)</p>
          <p className="mt-16 font-semibold">{PROVIDER.representative}</p>
        </div>
        <div>
          <p className="font-bold uppercase">Đại diện Bên B</p>
          <p className="text-xs italic">(Ký, ghi rõ họ tên)</p>
          <p className="mt-16 font-semibold">{customerName}</p>
        </div>
      </div>
    </div>
  );
});

ContractDocument.displayName = "ContractDocument";

export default ContractDocument;
