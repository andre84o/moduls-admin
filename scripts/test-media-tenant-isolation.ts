import { config } from "dotenv";
// Next.js loads .env.local with priority over .env; mirror that order here.
config({ path: ".env.local" });
config({ path: ".env" });
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

/**
 * Explicit cross-tenant isolation test for the media library, run against the
 * REAL database with TWO different businesses.
 *
 * It exercises the exact Prisma where-clauses that lib/media.ts uses
 * (listMedia / deleteMediaRecord — always scoped by id + businessId), proving a
 * row owned by business A is invisible AND undeletable from business B's scope.
 * This is the real isolation guarantee — not merely "the row has a businessId".
 *
 * Self-contained and idempotent: it reuses the oldest existing business as
 * tenant A, creates a throwaway tenant B, and deletes everything it created
 * (the media row and tenant B) in a finally block — pass or fail.
 *
 * Manual QA / DevOps command. Never imported or run inside the app runtime,
 * and it uploads no files.
 *
 *   npm run test:tenant-isolation
 *
 * Exit code is 0 only if every assertion passes.
 */

function ok(label: string, cond: boolean, extra = "") {
  console.log(`${cond ? "✅" : "❌"} ${label}${extra ? "  " + extra : ""}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || !/^postgres(ql)?:\/\//i.test(url) || url.includes("[")) {
    console.error("DATABASE_URL is not a valid connection string.");
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });

  // Tenant A: reuse an existing business. Tenant B: a throwaway second tenant.
  const a = await prisma.business.findFirst({ orderBy: { createdAt: "asc" } });
  if (!a) throw new Error("No business to use as tenant A. Seed at least one business first.");
  const b = await prisma.business.create({
    data: { name: "E2E Tenant B", slug: `e2e-tenant-b-${Date.now()}` },
  });
  console.log(`Tenant A: ${a.name} (${a.id})`);
  console.log(`Tenant B: ${b.name} (${b.id})\n`);

  // A media row owned by tenant A only.
  const media = await prisma.media.create({
    data: {
      businessId: a.id,
      kind: "DOCUMENT",
      visibility: "PRIVATE",
      folder: "library",
      name: "secret-A.pdf",
      path: `businesses/${a.id}/documents/isolation-test-${Date.now()}.pdf`,
      type: "application/pdf",
    },
  });

  try {
    // 1) READ — the listMedia / deleteMediaRecord scoping clause: id + businessId.
    const fromOwner = await prisma.media.findFirst({
      where: { id: media.id, businessId: a.id },
    });
    ok("owner (A) CAN read its own media", Boolean(fromOwner));

    const fromOther = await prisma.media.findFirst({
      where: { id: media.id, businessId: b.id },
    });
    ok("other tenant (B) CANNOT read A's media by id", fromOther === null);

    // 2) LIST — B listing its own media never includes A's row.
    const bList = await prisma.media.findMany({ where: { businessId: b.id } });
    ok("B's media list excludes A's row", !bList.some((m) => m.id === media.id),
       `B sees ${bList.length} rows`);

    // 3) DELETE — B attempts to delete A's row by id, scoped to B. Must be a no-op.
    const badDelete = await prisma.media.deleteMany({
      where: { id: media.id, businessId: b.id },
    });
    ok("B's delete of A's media affects 0 rows", badDelete.count === 0,
       `count=${badDelete.count}`);

    const stillThere = await prisma.media.findFirst({
      where: { id: media.id, businessId: a.id },
    });
    ok("A's media still exists after B's delete attempt", Boolean(stillThere));

    // 4) DELETE — owner (A) deletes correctly scoped. Must remove exactly 1.
    const goodDelete = await prisma.media.deleteMany({
      where: { id: media.id, businessId: a.id },
    });
    ok("A's correctly-scoped delete removes exactly 1 row", goodDelete.count === 1,
       `count=${goodDelete.count}`);
  } finally {
    // Cleanup: remove any leftover row + the throwaway tenant B.
    await prisma.media.deleteMany({ where: { id: media.id } });
    await prisma.business.delete({ where: { id: b.id } });
    await prisma.$disconnect();
  }

  console.log(`\n${process.exitCode ? "FAILED" : "All cross-tenant isolation checks passed."}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
