-- Restaurant Booking floor plan is a visual layer on top of existing tables.
-- Layout rows are tenant-owned and use a composite businessId + tableId foreign
-- key so another tenant's table can never be attached accidentally.

CREATE TYPE "RestaurantTableShape" AS ENUM ('RECTANGLE', 'ROUND');

CREATE UNIQUE INDEX "restaurant_tables_businessId_id_key"
ON "restaurant_tables"("businessId", "id");

CREATE TABLE "restaurant_table_layouts" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 140,
    "height" INTEGER NOT NULL DEFAULT 90,
    "shape" "RestaurantTableShape" NOT NULL DEFAULT 'RECTANGLE',
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_table_layouts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "restaurant_table_layouts_businessId_tableId_key"
ON "restaurant_table_layouts"("businessId", "tableId");

CREATE INDEX "restaurant_table_layouts_businessId_idx"
ON "restaurant_table_layouts"("businessId");

ALTER TABLE "restaurant_table_layouts"
ADD CONSTRAINT "restaurant_table_layouts_businessId_tableId_fkey"
FOREIGN KEY ("businessId", "tableId")
REFERENCES "restaurant_tables"("businessId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;
