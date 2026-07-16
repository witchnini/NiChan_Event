import { Request, Response, Router } from "express";
import { authenticate, optionalAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { sendSuccess } from "../../utils/response";
import {
  consultationSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "./auth.schema";
import {
  createConsultationRequest,
  forgotPassword,
  getCurrentUser,
  login,
  logout,
  register,
  resendVerification,
  resetPassword,
  verifyEmail,
} from "./auth.service";

export const authRouter = Router();

// POST /api/auth/register
authRouter.post(
  "/register",
  validate(registerSchema),
  async (req: Request, res: Response) => {
    const data = await register(req.body);
    sendSuccess(res, { data, status: 201 });
  },
);

// POST /api/auth/login
authRouter.post(
  "/login",
  validate(loginSchema),
  async (req: Request, res: Response) => {
    const data = await login(req.body);
    sendSuccess(res, { data });
  },
);

authRouter.get("/me", authenticate, async (req: Request, res: Response) => {
  const data = await getCurrentUser(req.user!.userId);
  sendSuccess(res, { data });
});

authRouter.post("/logout", authenticate, async (_req: Request, res: Response) => {
  const data = await logout();
  sendSuccess(res, { data });
});

// ─── Email Verification ───────────────────────────────────────────────────────

// POST /api/auth/verify-email
authRouter.post(
  "/verify-email",
  validate(verifyEmailSchema),
  async (req: Request, res: Response) => {
    const data = await verifyEmail(req.body);
    sendSuccess(res, { data });
  },
);

// POST /api/auth/resend-verification
authRouter.post(
  "/resend-verification",
  validate(resendVerificationSchema),
  async (req: Request, res: Response) => {
    const data = await resendVerification(req.body);
    sendSuccess(res, { data });
  },
);

// ─── Password Reset ──────────────────────────────────────────────────────────

// POST /api/auth/forgot-password
authRouter.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  async (req: Request, res: Response) => {
    const data = await forgotPassword(req.body);
    sendSuccess(res, { data });
  },
);

// POST /api/auth/reset-password
authRouter.post(
  "/reset-password",
  validate(resetPasswordSchema),
  async (req: Request, res: Response) => {
    const data = await resetPassword(req.body);
    sendSuccess(res, { data });
  },
);

// ─── Consultation Request ─────────────────────────────────────────────────────
// POST /api/public/consultation-requests  (mounted under publicRouter)

export const consultationRouter = Router();

consultationRouter.post(
  "/consultation-requests",
  optionalAuth,
  validate(consultationSchema),
  async (req: Request, res: Response) => {
    const data = await createConsultationRequest(
      req.body,
      req.user?.userId,
    );
    sendSuccess(res, { data, status: 201 });
  },
);
