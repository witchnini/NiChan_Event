import { z } from "zod";

export const assignManagerSchema = z.object({
  managerUserId: z.string().uuid("Invalid manager user ID"),
});

export const updateRequestStatusSchema = z.object({
  status: z.enum(["new", "reviewing", "quoted", "confirmed", "completed", "cancelled", "rejected"]),
});

export const resendRequestAssignmentSchema = z.object({
  managerUserId: z.string().uuid("Invalid manager user ID").optional(),
});

export type AssignManagerInput = z.infer<typeof assignManagerSchema>;
export type UpdateRequestStatusInput = z.infer<typeof updateRequestStatusSchema>;
export type ResendRequestAssignmentInput = z.infer<typeof resendRequestAssignmentSchema>;
