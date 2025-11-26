-- CreateTable
CREATE TABLE "Note" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Note_postId_idx" ON "Note"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "Note_postId_name_key" ON "Note"("postId", "name");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
