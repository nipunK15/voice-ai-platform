-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "conversationPrompt" TEXT,
ADD COLUMN     "memoryInstructions" TEXT,
ADD COLUMN     "systemPrompt" TEXT,
ADD COLUMN     "taskPrompt" TEXT,
ADD COLUMN     "toolInstructions" TEXT;
