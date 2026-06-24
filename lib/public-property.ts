import "server-only";
import { getPrisma } from "./prisma";
import { isModuleEnabledForBusiness } from "./modules";

export type PublicProperty = {
  id: string;
  businessId: string;
  title: string;
  slug: string;
  description: string | null;
  location: string;
  pricePerNight: number; // minor units (guaranteed non-null = bookable)
  cleaningFee: number;
  currency: string;
  minNights: number;
  maxGuests: number | null;
  maxAdults: number | null;
  maxChildren: number | null;
  maxInfants: number | null;
  maxPets: number | null;
  petsAllowed: boolean;
  bufferDaysAfterCheckout: number;
};

/**
 * Public, sessionless property loader for /p/[slug]. Returns null (treat as
 * not-found) unless the property is PUBLISHED, both RENTAL and BOOKING modules
 * are enabled for its business, and it is bookable (pricePerNight set). Only
 * public-safe fields are returned. slug is unique per business; if two
 * businesses share a slug this resolves to one arbitrarily (acceptable for now).
 */
export async function getPublicProperty(slug: string): Promise<PublicProperty | null> {
  if (!slug) return null;
  const prisma = getPrisma();
  const p = await prisma.property.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      id: true, businessId: true, title: true, slug: true, description: true,
      location: true, pricePerNight: true, cleaningFee: true, currency: true,
      minNights: true, maxGuests: true, maxAdults: true, maxChildren: true,
      maxInfants: true, maxPets: true, petsAllowed: true, bufferDaysAfterCheckout: true,
    },
  });
  if (!p || p.slug == null || p.pricePerNight == null) return null;

  const [rental, booking] = await Promise.all([
    isModuleEnabledForBusiness(p.businessId, "RENTAL"),
    isModuleEnabledForBusiness(p.businessId, "BOOKING"),
  ]);
  if (!rental || !booking) return null;

  return {
    id: p.id, businessId: p.businessId, title: p.title, slug: p.slug,
    description: p.description, location: p.location,
    pricePerNight: p.pricePerNight, cleaningFee: p.cleaningFee ?? 0,
    currency: p.currency, minNights: p.minNights,
    maxGuests: p.maxGuests, maxAdults: p.maxAdults, maxChildren: p.maxChildren,
    maxInfants: p.maxInfants, maxPets: p.maxPets, petsAllowed: p.petsAllowed,
    bufferDaysAfterCheckout: p.bufferDaysAfterCheckout,
  };
}
