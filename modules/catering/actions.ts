"use server";

import { getPrisma, isDbConfigured } from "@/lib/prisma";
import { resolvePublicBusinessId } from "@/lib/public-tenant";
import { hasBusinessFeatureAccess, CATERING_FEATURE_KEY } from "@/lib/feature-access";
import { CATERING_MENUS } from "./config";

/**
 * Public catering enquiry submission.
 *
 * Security (CLAUDE.md + form hardening):
 *  - Every field is validated and length-capped SERVER-SIDE; client checks are
 *    only for UX.
 *  - The selected menu is validated against a server-side whitelist so a tampered
 *    request can't inject an arbitrary value.
 *  - businessId is resolved on the server (PUBLIC_BUSINESS_ID, else the sole
 *    business) — never taken from the client.
 *  - The insert goes through Prisma (parameterised — no SQL injection). We only
 *    ever store plain text; nothing here is rendered as HTML, and React escapes
 *    output anyway, so stored values can't execute as script (no XSS).
 *  - A hidden honeypot field ("company") traps bots: if filled we drop the
 *    submission but report success so the bot learns nothing.
 */

export type CateringFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\-\s]{5,30}$/;

const ALLOWED_MENUS: readonly string[] = CATERING_MENUS;

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function submitCateringRequest(
  _prev: CateringFormState,
  formData: FormData,
): Promise<CateringFormState> {
  // Honeypot: real users never see or fill this field.
  if (str(formData, "company") !== "") {
    return { ok: true };
  }

  const name = str(formData, "name");
  const email = str(formData, "email");
  const phone = str(formData, "phone");
  const guestsRaw = str(formData, "guests");
  const menu = str(formData, "menu");
  const message = str(formData, "message");

  const guests = Number.parseInt(guestsRaw, 10);

  const fieldErrors: Record<string, string> = {};
  if (name.length < 2 || name.length > 100)
    fieldErrors.name = "Ange ditt namn.";
  if (!EMAIL_RE.test(email) || email.length > 200)
    fieldErrors.email = "Ange en giltig e-postadress.";
  if (!PHONE_RE.test(phone)) fieldErrors.phone = "Ange ett giltigt telefonnummer.";
  if (!Number.isInteger(guests) || guests < 1 || guests > 1000)
    fieldErrors.guests = "Ange antal gäster.";
  if (!ALLOWED_MENUS.includes(menu)) fieldErrors.menu = "Välj en meny.";
  if (message.length > 2000)
    fieldErrors.message = "Meddelandet är för långt (max 2000 tecken).";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, error: "Kontrollera fälten och försök igen." };
  }

  if (!isDbConfigured()) {
    return { error: "Kunde inte skicka just nu. Försök igen senare." };
  }

  const businessId = await resolvePublicBusinessId();
  if (!businessId) {
    return { error: "Kunde inte skicka just nu. Försök igen senare." };
  }

  // Feature gate: catering is a per-business add-on (BusinessFeatureAccess).
  // A business without the CATERING add-on cannot receive enquiries — the
  // action refuses even if the form was somehow reached.
  if (!(await hasBusinessFeatureAccess(businessId, CATERING_FEATURE_KEY))) {
    return { error: "Catering är inte tillgänglig just nu." };
  }

  try {
    await getPrisma().cateringRequest.create({
      data: { businessId, name, email, phone, guests, menu, message },
    });
  } catch {
    return { error: "Något gick fel. Försök igen om en stund." };
  }

  return { ok: true };
}
