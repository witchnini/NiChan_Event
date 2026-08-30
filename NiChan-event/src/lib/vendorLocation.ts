const LOCATION_ALIASES: Array<[RegExp, string]> = [
  [/\bthanh pho ho chi minh\b/g, " ho chi minh "],
  [/\b(?:tp|thanh pho)\s*\.?\s*hcm\b/g, " ho chi minh "],
  [/\b(?:tphcm|hcm|sai gon)\b/g, " ho chi minh "],
  [/\bthanh pho ha noi\b/g, " ha noi "],
  [/\b(?:tp|thanh pho)\s*\.?\s*hn\b/g, " ha noi "],
  [/\bhn\b/g, " ha noi "],
];

const GENERIC_ADDRESS_WORDS = new Set([
  "dia", "chi", "duong", "phuong", "quan", "huyen", "xa", "thi", "tran",
  "thanh", "pho", "tinh", "viet", "nam",
]);

export const normalizeLocation = (value?: string | null) => {
  let normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  for (const [pattern, replacement] of LOCATION_ALIASES) {
    normalized = normalized.replace(pattern, replacement).replace(/\s+/g, " ").trim();
  }

  return normalized;
};

export const getLocationMatchScore = (
  projectLocation?: string | null,
  vendorAddress?: string | null,
) => {
  const project = normalizeLocation(projectLocation);
  const vendor = normalizeLocation(vendorAddress);
  if (!project || !vendor) return 0;
  if (project === vendor) return 100;
  if (project.includes(vendor) || vendor.includes(project)) return 80;

  const projectTokens = new Set(
    project.split(" ").filter((token) => token.length > 1 && !GENERIC_ADDRESS_WORDS.has(token)),
  );
  const vendorTokens = new Set(
    vendor.split(" ").filter((token) => token.length > 1 && !GENERIC_ADDRESS_WORDS.has(token)),
  );
  const sharedTokens = [...projectTokens].filter((token) => vendorTokens.has(token));
  if (sharedTokens.length === 0) return 0;

  return Math.round((sharedTokens.length / Math.min(projectTokens.size, vendorTokens.size)) * 60);
};
