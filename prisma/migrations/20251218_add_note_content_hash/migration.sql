-- Enable pgcrypto for SHA256 hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add contentHash as a generated column (automatically computed from content)
ALTER TABLE "Note" ADD COLUMN "contentHash" CHAR(64)
  GENERATED ALWAYS AS (encode(digest(content, 'sha256'), 'hex')) STORED;

-- Create index for efficient lookups
CREATE INDEX "Note_contentHash_idx" ON "Note"("contentHash");