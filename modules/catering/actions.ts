"use server";

import { getPrisma, isDbConfigured } from "@/lib/prisma";
import { resolvePublicBusinessId } from "@/lib/public-tenant";
import { hasBusinessFeatureAccess, CATERING_FEATURE_KEY } from "@/lib/feature-access";
import { isRestaurantEnabled } from "@/modules/restaurant/guards";
import { notifyCateringRequest } from "@/lib/email";
import { CATERING_MENUS } from "./config";

/**
 * Public catering enquiry submission.
 *
 * Security (CLAUDE.md + form hardening):
 *  - Every field is validated and length-capped SERVER-SIDE; client checks are
 *    only for UX.
 *  - The selected menu is validated against a server-side whitelist derived from
 *    the published cateringMenus section (falls back to CATERING_MENUS config).
 *  - businessId is resolved on the server — never taken from the client.
 *  - The insert goes through Prisma (parameterised — no SQL injection).
 *  - A hidden honeypot field ("company") traps bots silently.
 */

export type CateringFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\-\s]{5,30}$/;

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Derives allowed menu strings from the published cateringMenus section so
 * admin changes to menu titles/prices are reflected automatically. Falls back
 * to the static CATERING_MENUS config if no published content exists.
 */
async function getPublishedMenuStrings(
  businessId: string,
): Promise<readonly string[]> {
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
        (m): m is Record<string, unknown> =>
          m !== null && typeof m === "object",
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
  const consent = str(formData, "consent");

  const guests = Number.parseInt(guestsRaw, 10);

  if (!isDbConfigured()) {
    return { error: "Could not send right now. Please try again later." };
  }

  const businessId = await resolvePublicBusinessId();
  if (!businessId) {
    return { error: "Could not send right now. Please try again later." };
  }

  const allowedMenus = await getPublishedMenuStrings(businessId);

  const fieldErrors: Record<string, string> = {};
  if (name.length < 2 || name.length > 100)
    fieldErrors.name = "Please enter your name.";
  if (!EMAIL_RE.test(email) || email.length > 200)
    fieldErrors.email = "Please enter a valid email address.";
  if (!PHONE_RE.test(phone))
    fieldErrors.phone = "Please enter a valid phone number.";
  if (!Number.isInteger(guests) || guests < 1 || guests > 1000)
    fieldErrors.guests = "Please enter number of guests.";
  if (!allowedMenus.includes(menu)) fieldErrors.menu = "Please select a menu.";
  if (message.length > 2000)
    fieldErrors.message = "Message is too long (max 2000 characters).";
  if (consent !== "on" && consent !== "true")
    fieldErrors.consent = "You must agree before submitting.";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, error: "Please check the fields and try again." };
  }

  // Module gate: RESTAURANT must be enabled.
  if (!(await isRestaurantEnabled(businessId))) {
    return { error: "Catering is not available right now." };
  }

  // Feature gate: CATERING is a paid add-on on top of RESTAURANT.
  if (!(await hasBusinessFeatureAccess(businessId, CATERING_FEATURE_KEY))) {
    return { error: "Catering is not available right now." };
  }

  try {
    await getPrisma().cateringRequest.create({
      data: { businessId, name, email, phone, guests, menu, message },
    });
  } catch {
    return { error: "Something went wrong. Please try again in a moment." };
  }

  // Notify the business admin. Must never break a saved submission.
  try {
    const business = await getPrisma().business.findUnique({
      where: { id: businessId },
      select: { name: true, email: true },
    });
    await notifyCateringRequest({
      businessId,
      businessName: business?.name ?? "",
      adminEmail: process.env.CONTACT_TO ?? business?.email ?? process.env.ADMIN_EMAIL ?? null,
      name,
      email,
      phone,
      guests,
      menu,
      message,
      consentText: consent,
    });
  } catch {
    /* notification failure must not affect the visitor's success response */
  }

  return { ok: true };
}
