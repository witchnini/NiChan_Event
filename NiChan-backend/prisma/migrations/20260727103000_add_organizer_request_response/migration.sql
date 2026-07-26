ALTER TABLE "consultation_requests"
ADD COLUMN "organizerRequestStatus" TEXT,
ADD COLUMN "organizerRequestRejectionReason" TEXT,
ADD COLUMN "organizerRequestRespondedAt" TIMESTAMP(3);

UPDATE "consultation_requests"
SET "organizerRequestStatus" = CASE
  WHEN "assignedManagerId" IS NULL THEN NULL
  WHEN "status" = 'confirmed' THEN 'accepted'
  WHEN "status" IN ('reviewing', 'quoted') THEN 'pending'
  ELSE NULL
END;
