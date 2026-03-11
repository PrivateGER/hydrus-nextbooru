-- CreateTable
CREATE TABLE "PhashEntry" (
    "hash" CHAR(64) NOT NULL,
    "phash" BIGINT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhashEntry_pkey" PRIMARY KEY ("hash")
);

-- AddForeignKey
ALTER TABLE "PhashEntry" ADD CONSTRAINT "PhashEntry_hash_fkey" FOREIGN KEY ("hash") REFERENCES "Post"("hash") ON DELETE CASCADE ON UPDATE CASCADE;
