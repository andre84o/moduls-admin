import { createHash, randomBytes } from "node:crypto";

const MANAGEMENT_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const MANAGEMENT_TENANT_PATTERN = /^[A-Za-z0-9_-]{1,1024}$/;

function encodeBusinessSlug(slug: string) {
  if (!slug) throw new Error("BUSINESS_SLUG_REQUIRED");
  return Buffer.from(slug, "utf8").toString("base64url");
}

export function createRestaurantBookingManagementToken(businessSlug: string) {
  const tenant = encodeBusinessSlug(businessSlug);
  const secret = randomBytes(32).toString("base64url");
  return `${tenant}.${secret}`;
}

export function parseRestaurantBookingManagementToken(value: string) {
  const separator = value.indexOf(".");
  if (separator <= 0 || separator !== value.lastIndexOf(".")) return null;

  const tenant = value.slice(0, separator);
  const secret = value.slice(separator + 1);
  if (!MANAGEMENT_TENANT_PATTERN.test(tenant) || !MANAGEMENT_SECRET_PATTERN.test(secret)) {
    return null;
  }

  try {
    const businessSlug = Buffer.from(tenant, "base64url").toString("utf8");
    if (!businessSlug || encodeBusinessSlug(businessSlug) !== tenant) return null;
    return { businessSlug };
  } catch {
    return null;
  }
}

export function isValidRestaurantBookingManagementToken(value: string) {
  return parseRestaurantBookingManagementToken(value) !== null;
}

export function hashRestaurantBookingManagementToken(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
