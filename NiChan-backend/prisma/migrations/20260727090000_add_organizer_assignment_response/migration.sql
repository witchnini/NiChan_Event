ALTER TABLE "events"
ADD COLUMN "organizerAssignmentStatus" TEXT,
ADD COLUMN "organizerRejectionReason" TEXT,
ADD COLUMN "organizerRespondedAt" TIMESTAMP(3);

UPDATE "events"
SET "organizerAssignmentStatus" = 'accepted',
    "organizerRespondedAt" = COALESCE("updatedAt", "createdAt")
WHERE "organizerUserId" IS NOT NULL;
