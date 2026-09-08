-- Gider kaydına fiş/fatura eki.
ALTER TABLE "Expense" ADD COLUMN "attachmentUrl" TEXT;
ALTER TABLE "Expense" ADD COLUMN "attachmentName" TEXT;
