import "server-only";
import { getPrisma } from "./prisma";

/**
 * Resolve the SAFE public businessId for sessionless public routes/actions.
 * Never accepts a businessId from the client (CLAUDE.md tenant isolation):
 *   1. An explicit PUBLIC_BUSINESS_ID always wins (the configured public tenant).
 *   2. Otherwise fall back to the only business when EXACTLY one exists.
 *   3. Otherwise return null — we never guess between multiple businesses.
 *
 * Core helper (no module dependency) so any public surface can reuse it.
 * Server-only: never import into a client component.
 */
export async function resolvePublicBusinessId(): Promise<string | null> {
  const explicit = process.env.PUBLIC_BUSINESS_ID?.trim();
  if (explicit) return explicit;

  const businesses = await getPrisma().business.findMany({
    select: { id: true },
    take: 2,
  });
  return businesses.length === 1 ? businesses[0].id : null;
}
