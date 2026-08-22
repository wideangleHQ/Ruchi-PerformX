-- CreateTable
CREATE TABLE "assistant_exchanges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "tools_used" TEXT[],
    "declined" BOOLEAN NOT NULL DEFAULT false,
    "feedback" SMALLINT,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cached_tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_exchanges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assistant_exchanges_user_id_created_at_idx" ON "assistant_exchanges"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "assistant_exchanges_declined_created_at_idx" ON "assistant_exchanges"("declined", "created_at");

-- CreateIndex
CREATE INDEX "assistant_exchanges_conversation_id_idx" ON "assistant_exchanges"("conversation_id");
