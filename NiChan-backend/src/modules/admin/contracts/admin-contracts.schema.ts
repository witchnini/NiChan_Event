import { z } from "zod";

export const contractLineItemSchema = z.object({
  category: z.string().min(1, "Category is required").max(150),
  description: z.string().max(1000).optional().nullable(),
  unit: z.string().max(50).optional().nullable(),
  quantity: z.number().positive("Quantity must be positive"),
  unitPrice: z.number().nonnegative("Unit price must be non-negative"),
  note: z.string().max(500).optional().nullable(),
});

export const createContractSchema = z.object({
  eventId: z.string().uuid("Invalid event ID"),
  customerUserId: z.string().uuid("Invalid customer user ID"),
  totalValue: z.number().positive("Total value must be positive").optional(),
  versionLabel: z.string().min(1).max(10).default("1.0"),
  scopeText: z.string().min(1, "Scope is required"),
  paymentTerms: z.string().min(1, "Payment terms are required"),
  generalTerms: z.string().min(1, "General terms are required"),
  lineItems: z.array(contractLineItemSchema).min(1).optional(),
}).superRefine((data, ctx) => {
  if (!data.totalValue && !data.lineItems?.length) {
    ctx.addIssue({
      code: "custom",
      path: ["lineItems"],
      message: "Line items or total value are required",
    });
  }
});

export const updateContractSchema = z.object({
  totalValue: z.number().positive().optional(),
  versionLabel: z.string().min(1).max(10).optional(),
  scopeText: z.string().min(1).optional(),
  paymentTerms: z.string().min(1).optional(),
  generalTerms: z.string().min(1).optional(),
  lineItems: z.array(contractLineItemSchema).min(1).optional(),
});

export const createSettlementSchema = z.object({
  lineItems: z.array(contractLineItemSchema).min(1).optional(),
  scopeText: z.string().min(1).optional(),
  generalTerms: z.string().min(1).optional(),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;
