import dotenv from "dotenv";
import path from "path";

// Load .env từ root project (bất kể chạy từ thư mục nào)
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parsePort = (value: string | undefined): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 3000;
};

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`❌ Missing required environment variable: ${key}`);
  }
  return value;
};

const optionalEnv = (key: string, defaultValue = ""): string =>
  process.env[key] ?? defaultValue;

// ─── Environment Config ───────────────────────────────────────────────────────

export const env = {
  // Server
  nodeEnv: optionalEnv("NODE_ENV", "development"),
  port: parsePort(process.env.PORT),
  corsOrigin: optionalEnv("CORS_ORIGIN", "http://localhost:5173"),

  // Auth (bắt buộc trong production)
  jwtSecret: optionalEnv("JWT_SECRET", "nichan-dev-secret-change-in-production"),
  jwtExpiresIn: optionalEnv("JWT_EXPIRES_IN", "7d"),

  // Database (bắt buộc)
  databaseUrl: optionalEnv("DATABASE_URL"),

  // Cloudinary (optional — upload sẽ fail nếu không điền)
  cloudinaryCloudName: optionalEnv("CLOUDINARY_CLOUD_NAME"),
  cloudinaryApiKey: optionalEnv("CLOUDINARY_API_KEY"),
  cloudinaryApiSecret: optionalEnv("CLOUDINARY_API_SECRET"),

  // Email / SMTP (optional trong dev — dùng Ethereal)
  smtpHost: optionalEnv("SMTP_HOST"),
  smtpPort: Number(optionalEnv("SMTP_PORT", "587")),
  smtpUser: optionalEnv("SMTP_USER"),
  smtpPass: optionalEnv("SMTP_PASS"),
  emailFrom: optionalEnv("EMAIL_FROM", "NiChan Events <noreply@nichan.vn>"),

  // App URL (dùng cho email links)
  appUrl: optionalEnv("APP_URL", "http://localhost:8080"),

  // SePay Payment Gateway
  sepayApiKey: optionalEnv("SEPAY_API_KEY"),
  sepayWebhookApiKey: optionalEnv("SEPAY_WEBHOOK_API_KEY"),
  sepayBankAccount: optionalEnv("SEPAY_BANK_ACCOUNT"),
  sepayBankCode: optionalEnv("SEPAY_BANK_CODE", "MBBank"),
  sepayAccountHolder: optionalEnv("SEPAY_ACCOUNT_HOLDER"),

  // Computed
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV !== "production",
};

// ─── Startup Validation ───────────────────────────────────────────────────────
// Chỉ validate production để dev không bị crash khi chưa điền Cloudinary

if (env.isProduction) {
  const required = [
    "JWT_SECRET",
    "DATABASE_URL",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASS",
  ];
  for (const key of required) requireEnv(key);
  console.log("✅ All required environment variables are set");
}
