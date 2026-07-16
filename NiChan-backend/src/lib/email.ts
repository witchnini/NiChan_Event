import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "../config/env";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmailOptions = {
  to: string;
  subject: string;
  html: string;
};

// ─── Transporter Singleton ────────────────────────────────────────────────────

let transporter: Transporter | null = null;

const createDevTransporter = async (): Promise<Transporter> => {
  try {
    const testAccount = await nodemailer.createTestAccount();
    console.log("📧 Ethereal test account created:");
    console.log(`   Email: ${testAccount.user}`);
    console.log(`   Pass:  ${testAccount.pass}`);

    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  } catch (error) {
    console.error("❌ Failed to create Ethereal test account:", error);
    console.warn("📧 Email sending will be disabled (dry-run mode)");
    // Return a stub transport that logs instead of sending
    return createDryRunTransporter();
  }
};

const createDryRunTransporter = (): Transporter => {
  return {
    sendMail: async (mailOptions: { to?: string; subject?: string }) => {
      console.log("📧 [DRY-RUN] Email would be sent:");
      console.log(`   To:      ${mailOptions.to}`);
      console.log(`   Subject: ${mailOptions.subject}`);
      return { messageId: `dry-run-${Date.now()}` };
    },
    verify: async () => true,
  } as unknown as Transporter;
};

const createProdTransporter = (): Transporter => {
  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) {
    throw new Error("❌ SMTP configuration is incomplete for production");
  }

  const transport = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
    // Timeouts to prevent hanging
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  return transport;
};

const getTransporter = async (): Promise<Transporter> => {
  if (transporter) return transporter;

  transporter = env.isDevelopment
    ? await createDevTransporter()
    : createProdTransporter();

  return transporter;
};

/**
 * Reset the transporter singleton (useful if Ethereal connection drops).
 * Next call to sendEmail will create a fresh transporter.
 */
export const resetTransporter = (): void => {
  transporter = null;
};

// ─── Send Email ───────────────────────────────────────────────────────────────

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const transport = await getTransporter();

      const info = await transport.sendMail({
        from: env.emailFrom,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      if (env.isDevelopment) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        console.log(`📧 Email sent to: ${options.to}`);
        console.log(`   Subject: ${options.subject}`);
        if (previewUrl) {
          console.log(`   Preview: ${previewUrl}`);
        }
      }

      return; // Success — exit
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `[EMAIL_ATTEMPT_${attempt}/${MAX_RETRIES}] Failed to send email to ${options.to}:`,
        lastError.message,
      );

      // If transporter is broken, reset it for next attempt
      resetTransporter();

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  // All retries exhausted
  console.error(
    `[EMAIL_FAILED] Could not send email to ${options.to} after ${MAX_RETRIES} attempts`,
  );
  throw lastError ?? new Error("Failed to send email");
};
