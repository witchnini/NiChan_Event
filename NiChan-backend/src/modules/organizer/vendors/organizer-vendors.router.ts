import { Request, Response, Router } from "express";
import { authenticate, requireRole } from "../../../middleware/auth";
import { validate } from "../../../middleware/validate";
import { buildMeta, parsePagination } from "../../../utils/pagination";
import { p, q } from "../../../utils/request";
import { sendSuccess } from "../../../utils/response";
import {
  vendorSchema,
  vendorStatusSchema,
  eventVendorSchema,
  eventVendorUpdateSchema,
  listVendorCategories,
  listVendors,
  getVendorById,
  createVendor,
  updateVendor,
  updateVendorStatus,
  deleteVendor,
  getEventVendors,
  addEventVendor,
  updateEventVendor,
  removeEventVendor,
} from "./organizer-vendors.service";

export const organizerVendorsRouter = Router();
organizerVendorsRouter.use(authenticate, requireRole("organizer", "admin"));

// GET /api/organizer/vendor-categories
organizerVendorsRouter.get("/vendor-categories", async (_req: Request, res: Response) => {
  const data = await listVendorCategories();
  sendSuccess(res, { data });
});

// GET /api/organizer/vendors
organizerVendorsRouter.get("/vendors", async (req: Request, res: Response) => {
  const pg = parsePagination(req, "name");
  const { items, total } = await listVendors({
    categoryId: q(req, "category"),
    status: q(req, "status"),
    search: q(req, "search"),
    skip: pg.skip,
    take: pg.take,
  });
  sendSuccess(res, { data: items, meta: buildMeta(pg, total) });
});

// GET /api/organizer/vendors/:id
organizerVendorsRouter.get("/vendors/:id", async (req: Request, res: Response) => {
  const data = await getVendorById(p(req, "id"));
  sendSuccess(res, { data });
});

// POST /api/organizer/vendors
organizerVendorsRouter.post(
  "/vendors",
  validate(vendorSchema),
  async (req: Request, res: Response) => {
    const data = await createVendor(req.body);
    sendSuccess(res, { data, status: 201 });
  },
);

// PUT /api/organizer/vendors/:id
organizerVendorsRouter.put(
  "/vendors/:id",
  validate(vendorSchema.partial()),
  async (req: Request, res: Response) => {
    const data = await updateVendor(p(req, "id"), req.body);
    sendSuccess(res, { data });
  },
);

// PATCH /api/organizer/vendors/:id/status
organizerVendorsRouter.patch(
  "/vendors/:id/status",
  validate(vendorStatusSchema),
  async (req: Request, res: Response) => {
    const data = await updateVendorStatus(p(req, "id"), req.body.status);
    sendSuccess(res, { data });
  },
);

// DELETE /api/organizer/vendors/:id
organizerVendorsRouter.delete("/vendors/:id", async (req: Request, res: Response) => {
  const data = await deleteVendor(p(req, "id"));
  sendSuccess(res, { data });
});

// GET /api/organizer/projects/:projectId/vendors
organizerVendorsRouter.get(
  "/projects/:projectId/vendors",
  async (req: Request, res: Response) => {
    const data = await getEventVendors(p(req, "projectId"), req.user!.userId, req.user!.role);
    sendSuccess(res, { data });
  },
);

// POST /api/organizer/projects/:projectId/vendors
organizerVendorsRouter.post(
  "/projects/:projectId/vendors",
  validate(eventVendorSchema),
  async (req: Request, res: Response) => {
    const data = await addEventVendor(
      p(req, "projectId"),
      req.body,
      req.user!.userId,
      req.user!.role,
    );
    sendSuccess(res, { data, status: 201 });
  },
);

// PUT /api/organizer/projects/:projectId/vendors/:eventVendorId
organizerVendorsRouter.put(
  "/projects/:projectId/vendors/:eventVendorId",
  validate(eventVendorUpdateSchema),
  async (req: Request, res: Response) => {
    const data = await updateEventVendor(
      p(req, "projectId"),
      p(req, "eventVendorId"),
      req.body,
      req.user!.userId,
      req.user!.role,
    );
    sendSuccess(res, { data });
  },
);

// DELETE /api/organizer/projects/:projectId/vendors/:eventVendorId
organizerVendorsRouter.delete(
  "/projects/:projectId/vendors/:eventVendorId",
  async (req: Request, res: Response) => {
    await removeEventVendor(p(req, "eventVendorId"), req.user!.userId, req.user!.role);
    sendSuccess(res, { data: { deleted: true } });
  },
);
