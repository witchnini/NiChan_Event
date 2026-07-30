import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pdfMocks = vi.hoisted(() => {
  const pdfDocument = {
    internal: {
      pageSize: {
        getWidth: vi.fn(() => 210),
        getHeight: vi.fn(() => 297),
      },
    },
    addPage: vi.fn(),
    addImage: vi.fn(),
    output: vi.fn(),
  };

  return {
    renderCanvas: vi.fn(),
    createPdf: vi.fn(() => pdfDocument),
    pdfDocument,
  };
});

vi.mock("html2canvas-pro", () => ({
  default: pdfMocks.renderCanvas,
}));

vi.mock("jspdf", () => ({
  jsPDF: pdfMocks.createPdf,
}));

import { exportContractPdf, getContractPdfErrorMessage } from "@/lib/contractPdf";

describe("exportContractPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    pdfMocks.renderCanvas.mockResolvedValue({ width: 1_600, height: 3_200 });
    pdfMocks.pdfDocument.output.mockReturnValue(
      new Blob(["pdf-content"], { type: "application/pdf" }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillStyle: "",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/jpeg;base64,cGRm",
    );
  });

  afterEach(() => {
    document.body.innerHTML = "";
    Reflect.deleteProperty(URL, "createObjectURL");
    Reflect.deleteProperty(URL, "revokeObjectURL");
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("tạo Blob PDF và kích hoạt tải file hợp lệ", async () => {
    const element = document.createElement("div");
    element.className = "contract-print-area";
    Object.defineProperties(element, {
      scrollHeight: { value: 4_000 },
      offsetHeight: { value: 4_000 },
    });
    document.body.appendChild(element);

    const createObjectUrl = vi.fn(() => "blob:contract");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    await exportContractPdf(element, 'HD/2026:"01"');

    expect(pdfMocks.renderCanvas).toHaveBeenCalledWith(
      element,
      expect.objectContaining({
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      }),
    );
    expect(pdfMocks.pdfDocument.output).toHaveBeenCalledWith("blob");
    expect(pdfMocks.pdfDocument.addImage).toHaveBeenCalledTimes(2);
    expect(pdfMocks.pdfDocument.addPage).toHaveBeenCalledOnce();
    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    expect(click.mock.instances[0].download).toBe("HD-2026--01-.pdf");
  });

  it("không báo tải thành công khi Blob PDF rỗng", async () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    pdfMocks.pdfDocument.output.mockReturnValue(new Blob([]));

    await expect(exportContractPdf(element, "HD-EMPTY")).rejects.toThrow(
      "PDF được tạo nhưng không có dữ liệu",
    );
  });
});

describe("getContractPdfErrorMessage", () => {
  it("hiển thị nguyên nhân gốc để chẩn đoán lỗi runtime", () => {
    expect(getContractPdfErrorMessage(new Error("Unsupported color function"))).toBe(
      "Không tạo được file PDF: Unsupported color function",
    );
  });
});
