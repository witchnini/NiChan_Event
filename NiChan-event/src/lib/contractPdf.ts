// Tạo và tải file PDF từ một phần tử DOM của bản hợp đồng.
// Dùng bản bundle tự chứa (đã gộp jspdf/html2canvas/dompurify) để tránh
// lỗi Vite pre-bundle dompurify trong môi trường monorepo. Nạp động để
// không làm nặng bundle chính.
export const exportContractPdf = async (element: HTMLElement, contractCode: string) => {
  const html2pdf = (await import("html2pdf.js/dist/html2pdf.bundle.min.js")).default;
  await html2pdf()
    .set({
      margin: [10, 10, 10, 10],
      filename: `${contractCode || "hop-dong"}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    })
    .from(element)
    .save();
};
