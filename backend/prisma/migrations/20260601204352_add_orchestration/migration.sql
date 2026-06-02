-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "flowDefinition" JSONB;

-- CreateTable
CREATE TABLE "ConversationStage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "stageName" TEXT NOT NULL,
    "stageIndex" INTEGER NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt" TIMESTAMP(3),
    "triggerReason" TEXT,
    "triggerDetail" TEXT,
    "promptSnapshot" TEXT,

    CONSTRAINT "ConversationStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrchestrationSnapshot" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "currentStage" TEXT NOT NULL,
    "stageIndex" INTEGER NOT NULL,
    "collectedData" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrchestrationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrchestrationSnapshot_conversationId_key" ON "OrchestrationSnapshot"("conversationId");

-- AddForeignKey
ALTER TABLE "ConversationStage" ADD CONSTRAINT "ConversationStage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrchestrationSnapshot" ADD CONSTRAINT "OrchestrationSnapshot_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
