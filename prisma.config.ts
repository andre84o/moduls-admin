import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Körs av `prisma migrate dev` / `prisma db seed`.
    seed: "tsx scripts/seed/seed.ts",
  },
  datasource: {
    // CLI (migrate/introspect) använder direktanslutningen.
    // Supabase: "Direct connection" (port 5432). Faller tillbaka på DATABASE_URL.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
