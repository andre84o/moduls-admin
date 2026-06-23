import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

/**
 * Prisma 7 använder en driver-adapter mot Supabase (DATABASE_URL).
 *
 * Klienten skapas lat (getPrisma) så att appen kan startas och besökas
 * UTAN att en riktig databas är konfigurerad — då används demodata istället
 * (se app/lib/queries.ts). Byt ut platshållarna i .env för att gå live.
 */

export function isDbConfigured(): boolean {
  const url = process.env.DATABASE_URL;
  // Giltig postgres-URL och inte den platshållare som innehåller "[...]".
  return Boolean(url && /^postgres(ql)?:\/\//i.test(url) && !url.includes("["));
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.prisma;
}
