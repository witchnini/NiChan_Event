CREATE TABLE "organizer_request_assignment_history" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "organizerUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "organizer_request_assignment_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "organizer_request_assignment_history_requestId_assignedAt_idx"
ON "organizer_request_assignment_history"("requestId", "assignedAt");

CREATE INDEX "organizer_request_assignment_history_organizerUserId_status_idx"
ON "organizer_request_assignment_history"("organizerUserId", "status");

ALTER TABLE "organizer_request_assignment_history"
ADD CONSTRAINT "organizer_request_assignment_history_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "consultation_requests"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organizer_request_assignment_history"
ADD CONSTRAINT "organizer_request_assignment_history_organizerUserId_fkey"
FOREIGN KEY ("organizerUserId") REFERENCES "users"("id")
ON DELETE NO ACTION ON UPDATE NO ACTION;

INSERT INTO "organizer_request_assignment_history" (
    "id",
    "requestId",
    "organizerUserId",
    "status",
    "rejectionReason",
    "assignedAt",
    "respondedAt"
)
SELECT
    gen_random_uuid()::text,
    "id",
    "assignedManagerId",
    COALESCE("organizerRequestStatus", 'pending'),
    "organizerRequestRejectionReason",
    "createdAt",
    "organizerRequestRespondedAt"
FROM "consultation_requests"
WHERE "assignedManagerId" IS NOT NULL;
