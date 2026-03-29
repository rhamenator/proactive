-- CreateEnum
CREATE TYPE "MfaChallengePurpose" AS ENUM ('setup', 'verify');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mfa_secret" TEXT,
ADD COLUMN     "mfa_temp_secret" TEXT;

-- CreateTable
CREATE TABLE "mfa_challenge_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "purpose" "MfaChallengePurpose" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_challenge_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mfa_challenge_tokens_token_hash_key" ON "mfa_challenge_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "mfa_challenge_tokens_user_id_idx" ON "mfa_challenge_tokens"("user_id");

-- CreateIndex
CREATE INDEX "mfa_challenge_tokens_purpose_idx" ON "mfa_challenge_tokens"("purpose");

-- AddForeignKey
ALTER TABLE "mfa_challenge_tokens" ADD CONSTRAINT "mfa_challenge_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
