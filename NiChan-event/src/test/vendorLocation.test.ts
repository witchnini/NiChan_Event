import { describe, expect, it } from "vitest";
import { getLocationMatchScore, normalizeLocation } from "@/lib/vendorLocation";

describe("vendor location matching", () => {
  it("normalizes Vietnamese accents and common HCM aliases", () => {
    expect(normalizeLocation("TP.HCM")).toBe("ho chi minh");
    expect(normalizeLocation("Thành phố Hồ Chí Minh")).toBe("ho chi minh");
  });

  it("ranks a vendor in the same city above an unrelated address", () => {
    const projectLocation = "Quận 1, TP.HCM";
    expect(getLocationMatchScore(projectLocation, "Bình Thạnh, Hồ Chí Minh"))
      .toBeGreaterThan(getLocationMatchScore(projectLocation, "Cầu Giấy, Hà Nội"));
  });

  it("gives a more specific shared area a higher score", () => {
    const projectLocation = "Phường Bến Nghé, Quận 1, TP.HCM";
    expect(getLocationMatchScore(projectLocation, "Quận 1, TP.HCM"))
      .toBeGreaterThan(getLocationMatchScore(projectLocation, "Thủ Đức, TP.HCM"));
  });

  it("does not treat missing addresses as matches", () => {
    expect(getLocationMatchScore("Hà Nội", null)).toBe(0);
  });
});
