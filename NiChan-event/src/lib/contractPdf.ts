const sanitizePdfFilename = (contractCode: string) => {
  const safeName = (contractCode || "hop-dong")
    .trim()
    .split("")
    .map((character) => (character.charCodeAt(0) < 32 ? "-" : character))
    .join("")
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, "_");

  return `${safeName || "hop-dong"}.pdf`;
};

const downloadPdfBlob = (blob: Blob, filename: string) => {
  if (blob.size === 0) {
    throw new Error("PDF được tạo nhưng không có dữ liệu");
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Không thu hồi URL ngay trong cùng event loop vì Safari/Edge có thể
  // chưa kịp bắt đầu tải file.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

// Tạo và tải file PDF từ một phần tử DOM của bản hợp đồng.
// Dùng bản bundle tự chứa (đã gộp jspdf/html2canvas/dompurify) để tránh
// lỗi Vite pre-bundle dompurify trong môi trường monorepo. Nạp động để
// không làm nặng bundle chính.
export const exportContractPdf = async (element: HTMLElement, contractCode: string) => {
  if (!element.isConnected) {
    throw new Error("Nội dung hợp đồng chưa sẵn sàng");
  }

  await document.fonts?.ready;

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  // Canvas của trình duyệt có giới hạn chiều cao. Scale thích ứng giữ bản
  // hợp đồng dài dưới ngưỡng an toàn, nhưng vẫn ưu tiên độ nét scale 2.
  const contentHeight = Math.max(element.scrollHeight, element.offsetHeight, 1);
  const canvasScale = Math.max(1, Math.min(2, 28_000 / contentHeight));
  const filename = sanitizePdfFilename(contractCode);

  const sourceCanvas = await html2canvas(element, {
    scale: canvasScale,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  if (!sourceCanvas.width || !sourceCanvas.height) {
    throw new Error("Không chụp được nội dung hợp đồng");
  }

  const pdf = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: "portrait",
    compress: true,
  });
  const margin = 10;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const printableWidth = pageWidth - margin * 2;
  const printableHeight = pageHeight - margin * 2;
  const sourcePageHeight = Math.max(
    1,
    Math.floor((sourceCanvas.width * printableHeight) / printableWidth),
  );

  let sourceY = 0;
  let pageIndex = 0;

  while (sourceY < sourceCanvas.height) {
    const sliceHeight = Math.min(sourcePageHeight, sourceCanvas.height - sourceY);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = sourceCanvas.width;
    pageCanvas.height = sliceHeight;

    const context = pageCanvas.getContext("2d");
    if (!context) {
      throw new Error("Trình duyệt không hỗ trợ tạo trang PDF");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    context.drawImage(
      sourceCanvas,
      0,
      sourceY,
      sourceCanvas.width,
      sliceHeight,
      0,
      0,
      sourceCanvas.width,
      sliceHeight,
    );

    if (pageIndex > 0) {
      pdf.addPage();
    }

    const renderedHeight = (sliceHeight * printableWidth) / sourceCanvas.width;
    pdf.addImage(
      pageCanvas.toDataURL("image/jpeg", 0.95),
      "JPEG",
      margin,
      margin,
      printableWidth,
      renderedHeight,
      undefined,
      "FAST",
    );

    sourceY += sliceHeight;
    pageIndex += 1;
  }

  const blob = pdf.output("blob");

  if (!(blob instanceof Blob)) {
    throw new Error("Bộ tạo PDF không trả về dữ liệu hợp lệ");
  }

  downloadPdfBlob(blob, filename);
};

export const getContractPdfErrorMessage = (error: unknown) => {
  if (!(error instanceof Error) || !error.message.trim()) {
    return "Không tạo được file PDF";
  }

  return `Không tạo được file PDF: ${error.message}`;
};
