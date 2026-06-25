-- CreateEnum
CREATE TYPE "WebsitePageStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "website_pages" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "slug" TEXT,
    "title" TEXT NOT NULL,
    "status" "WebsitePageStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "draftContent" JSONB,
    "publishedContent" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_sections" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "draftContent" JSONB,
    "publishedContent" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "website_pages_businessId_idx" ON "website_pages"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "website_pages_businessId_key_key" ON "website_pages"("businessId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "website_pages_businessId_slug_key" ON "website_pages"("businessId", "slug");

-- CreateIndex
CREATE INDEX "website_sections_businessId_idx" ON "website_sections"("businessId");

-- CreateIndex
CREATE INDEX "website_sections_businessId_pageId_idx" ON "website_sections"("businessId", "pageId");

-- AddForeignKey
ALTER TABLE "website_pages" ADD CONSTRAINT "website_pages_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_sections" ADD CONSTRAINT "website_sections_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_sections" ADD CONSTRAINT "website_sections_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "website_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
