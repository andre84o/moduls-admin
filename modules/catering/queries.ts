import "server-only";
import { getPrisma, isDbConfigured } from "@/lib/prisma";
import { CATERING_MENUS } from "./config";

/**
 * Returns the published catering menu strings for a business, derived from
 * the published cateringMenus section in the DB. Falls back to CATERING_MENUS
 * config if no published content exists. Used by both the public page and the
 * server action whitelist. The businessId MUST be server-resolved.
 */
export async function getPublicCateringMenus(
  businessId: string,
): Promise<readonly string[]> {
  if (!isDbConfigured()) return CATERING_MENUS;

  try {
    const section = await getPrisma().websiteSection.findFirst({
      where: { page: { businessId }, type: "cateringMenus" },
      select: { publishedContent: true },
      orderBy: { sortOrder: "asc" },
    });

    const content = section?.publishedContent as Record<string, unknown> | null;
    const menus = Array.isArray(content?.menus) ? content!.menus : [];

    const strings = (menus as unknown[])
      .filter(
        (m): m is Record<string, unknown> => m !== null && typeof m === "object",
      )
      .map((m) => {
        const title = typeof m.title === "string" ? m.title.trim() : "";
        const price = typeof m.price === "string" ? m.price.trim() : "";
        return `${title} – ${price}`;
      })
      .filter((s) => s.length > 3 && s !== " – ");

    return strings.length > 0 ? strings : CATERING_MENUS;
  } catch {
    return CATERING_MENUS;
  }
}
