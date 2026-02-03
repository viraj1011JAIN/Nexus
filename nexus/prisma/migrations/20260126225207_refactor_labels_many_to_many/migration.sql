/*
  Warnings:

  - You are about to drop the `card_labels` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "card_labels" DROP CONSTRAINT "card_labels_card_id_fkey";

-- DropTable
DROP TABLE "card_labels";

-- CreateTable
CREATE TABLE "labels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "org_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_label_assignments" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "label_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_label_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "labels_org_id_idx" ON "labels"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "labels_org_id_name_key" ON "labels"("org_id", "name");

-- CreateIndex
CREATE INDEX "card_label_assignments_card_id_idx" ON "card_label_assignments"("card_id");

-- CreateIndex
CREATE INDEX "card_label_assignments_label_id_idx" ON "card_label_assignments"("label_id");

-- CreateIndex
CREATE UNIQUE INDEX "card_label_assignments_card_id_label_id_key" ON "card_label_assignments"("card_id", "label_id");

-- AddForeignKey
ALTER TABLE "card_label_assignments" ADD CONSTRAINT "card_label_assignments_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_label_assignments" ADD CONSTRAINT "card_label_assignments_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
