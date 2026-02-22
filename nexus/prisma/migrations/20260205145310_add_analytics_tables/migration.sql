-- CreateTable
CREATE TABLE "board_analytics" (
    "id" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,
    "total_cards" INTEGER NOT NULL DEFAULT 0,
    "completed_cards" INTEGER NOT NULL DEFAULT 0,
    "overdue_cards" INTEGER NOT NULL DEFAULT 0,
    "active_members" INTEGER NOT NULL DEFAULT 0,
    "cards_created_today" INTEGER NOT NULL DEFAULT 0,
    "cards_completed_today" INTEGER NOT NULL DEFAULT 0,
    "avg_completion_time" INTEGER NOT NULL DEFAULT 0,
    "weekly_trends" JSONB,
    "priority_distribution" JSONB,
    "last_calculated" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "board_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_analytics" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "cards_created" INTEGER NOT NULL DEFAULT 0,
    "cards_completed" INTEGER NOT NULL DEFAULT 0,
    "comments_added" INTEGER NOT NULL DEFAULT 0,
    "active_minutes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_snapshots" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active_users" INTEGER NOT NULL DEFAULT 0,
    "total_boards" INTEGER NOT NULL DEFAULT 0,
    "total_cards" INTEGER NOT NULL DEFAULT 0,
    "actions_performed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "activity_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "board_analytics_board_id_key" ON "board_analytics"("board_id");

-- CreateIndex
CREATE INDEX "board_analytics_board_id_idx" ON "board_analytics"("board_id");

-- CreateIndex
CREATE INDEX "board_analytics_last_calculated_idx" ON "board_analytics"("last_calculated");

-- CreateIndex
CREATE INDEX "user_analytics_user_id_date_idx" ON "user_analytics"("user_id", "date");

-- CreateIndex
CREATE INDEX "user_analytics_org_id_date_idx" ON "user_analytics"("org_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "user_analytics_user_id_org_id_date_key" ON "user_analytics"("user_id", "org_id", "date");

-- CreateIndex
CREATE INDEX "activity_snapshots_org_id_timestamp_idx" ON "activity_snapshots"("org_id", "timestamp");

-- AddForeignKey
ALTER TABLE "board_analytics" ADD CONSTRAINT "board_analytics_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
