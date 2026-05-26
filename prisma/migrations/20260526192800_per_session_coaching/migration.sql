-- AlterTable
ALTER TABLE "Session" ADD COLUMN "prompt" TEXT;
ALTER TABLE "Session" ADD COLUMN "model" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AppSetting";
PRAGMA foreign_keys=on;
