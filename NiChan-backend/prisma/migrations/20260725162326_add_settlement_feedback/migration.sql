-- CreateTable
CREATE TABLE "settlement_feedbacks" (
    "id" TEXT NOT NULL,
    "contractLineItemId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "feedbackNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settlement_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "settlement_feedbacks_contractLineItemId_customerId_key" ON "settlement_feedbacks"("contractLineItemId", "customerId");

-- AddForeignKey
ALTER TABLE "settlement_feedbacks" ADD CONSTRAINT "settlement_feedbacks_contractLineItemId_fkey" FOREIGN KEY ("contractLineItemId") REFERENCES "contract_line_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "settlement_feedbacks" ADD CONSTRAINT "settlement_feedbacks_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "settlement_feedbacks" ADD CONSTRAINT "settlement_feedbacks_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
