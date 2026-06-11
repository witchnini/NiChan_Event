import { Request, Response, Router } from "express";
import { authenticate, requireRole } from "../../../middleware/auth";
import { validate } from "../../../middleware/validate";
import { buildMeta, parsePagination } from "../../../utils/pagination";
import { p, q } from "../../../utils/request";
import { sendSuccess } from "../../../utils/response";
import {
  transactionSchema,
  getProjectSummary,
  getMonthlyPL,
  getExpenses,
  listFinanceContracts,
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from "./admin-finance.service";

export const adminFinanceRouter = Router();
adminFinanceRouter.use(authenticate, requireRole("admin"));

// GET /api/admin/finance/project-summary
adminFinanceRouter.get("/finance/project-summary", async (_req: Request, res: Response) => {
  const data = await getProjectSummary();
  sendSuccess(res, { data });
});

// GET /api/admin/finance/monthly-pl
adminFinanceRouter.get("/finance/monthly-pl", async (_req: Request, res: Response) => {
  const data = await getMonthlyPL();
  sendSuccess(res, { data });
});

// GET /api/admin/finance/expenses
adminFinanceRouter.get("/finance/expenses", async (_req: Request, res: Response) => {
  const data = await getExpenses();
  sendSuccess(res, { data });
});

// GET /api/admin/finance/contracts
adminFinanceRouter.get("/finance/contracts", async (_req: Request, res: Response) => {
  const data = await listFinanceContracts();
  sendSuccess(res, { data });
});

// GET /api/admin/transactions
adminFinanceRouter.get("/transactions", async (req: Request, res: Response) => {
  const pg = parsePagination(req, "transactionDate");
  const { items, total } = await listTransactions({
    eventId: q(req, "eventId"),
    contractId: q(req, "contractId"),
    status: q(req, "status"),
    search: q(req, "search"),
    skip: pg.skip,
    take: pg.take,
  });
  sendSuccess(res, { data: items, meta: buildMeta(pg, total) });
});

// POST /api/admin/transactions
adminFinanceRouter.post(
  "/transactions",
  validate(transactionSchema),
  async (req: Request, res: Response) => {
    const data = await createTransaction(req.body);
    sendSuccess(res, { data, status: 201 });
  },
);

// PUT /api/admin/transactions/:id
adminFinanceRouter.put(
  "/transactions/:id",
  validate(transactionSchema.partial()),
  async (req: Request, res: Response) => {
    const data = await updateTransaction(p(req, "id"), req.body);
    sendSuccess(res, { data });
  },
);

// DELETE /api/admin/transactions/:id
adminFinanceRouter.delete("/transactions/:id", async (req: Request, res: Response) => {
  await deleteTransaction(p(req, "id"));
  sendSuccess(res, { data: { deleted: true } });
});
