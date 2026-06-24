import "server-only";
import { getPrisma } from "./prisma";
import { isModuleEnabledForBusiness } from "./modules";

/**
 * Create or update a CRM Customer from a CONFIRMED (paid) booking.
 *
 * - Runs only post-payment (the webhook confirm path calls this). businessId is
 *   the SERVER-RESOLVED booking.businessId — never client/Stripe metadata.
 * - No-op (returns { customerId: null }) when the CRM module is disabled for the
 *   business, so booking confirmation never depends on CRM being enabled.
 * - Dedup by (businessId, email) when an email is present (email is not unique);
 *   otherwise create. New customers get stage CUSTOMER (they have a paid booking).
 * - Every query is scoped by businessId.
 */
export async function upsertCustomerFromConfirmedBooking(input: {
  businessId: string;
  email: string | null;
  name: string;
  phone?: string | null;
}): Promise<{ customerId: string | null }> {
  if (!(await isModuleEnabledForBusiness(input.businessId, "CRM"))) {
    return { customerId: null };
  }

  const prisma = getPrisma();

  // Dedup by email within the business (email is nullable + NOT unique).
  if (input.email) {
    const existing = await prisma.customer.findFirst({
      where: { businessId: input.businessId, email: input.email },
      select: { id: true, phone: true },
    });
    if (existing) {
      // Light enrichment only: fill phone if we have one and it was missing.
      if (input.phone && !existing.phone) {
        await prisma.customer.updateMany({
          where: { id: existing.id, businessId: input.businessId },
          data: { phone: input.phone },
        });
      }
      return { customerId: existing.id };
    }
  }

  // Create with the same per-business number assignment as upsertCustomer.
  const created = await prisma.$transaction(async (tx) => {
    const max = await tx.customer.aggregate({
      where: { businessId: input.businessId },
      _max: { number: true },
    });
    return tx.customer.create({
      data: {
        businessId: input.businessId,
        number: (max._max.number ?? 0) + 1,
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        stage: "CUSTOMER",
      },
      select: { id: true },
    });
  });

  return { customerId: created.id };
}
