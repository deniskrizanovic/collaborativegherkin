-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "model" TEXT,
ADD COLUMN     "prompt" TEXT;

-- DropTable
DROP TABLE "AppSetting";
