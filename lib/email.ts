import "server-only";
import { Resend } from "resend";
import { getPrisma } from "./prisma";
import { isEmailConfigured, isDemoMode } from "./config";
import type { NotificationAudience } from "@/app/generated/prisma/enums";

/**
 * Outbound email via Resend. Every attempt is recorded as a Notification row
 * (scoped by businessId) unless we're in demo mode. When no RESEND_API_KEY is
 * set the send is skipped (logged), so the app works without email configured.
 */

const FROM = process.env.EMAIL_FROM ?? "Admin <onboarding@resend.dev>";

type SendArgs = {
  businessId: string;
  to: string;
  audience: NotificationAudience;
  subject: string;
  html: string;
};

export async function sendNotification({
  businessId,
  to,
  audience,
  subject,
  html,
}: SendArgs): Promise<{ status: "SENT" | "FAILED" | "SKIPPED"; error: string | null }> {
  let status: "SENT" | "FAILED" | "SKIPPED" = "SENT";
  let error: string | null = null;

  if (!to) {
    status = "SKIPPED";
  } else if (!isEmailConfigured()) {
    status = "SKIPPED";
    console.info(`[email skipped] ${audience} -> ${to}: ${subject}`);
  } else {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const res = await resend.emails.send({ from: FROM, to, subject, html });
      if (res.error) {
        status = "FAILED";
        error = res.error.message;
      }
    } catch (e) {
      status = "FAILED";
      error = e instanceof Error ? e.message : String(e);
    }
  }

  if (!isDemoMode() && to) {
    try {
      await getPrisma().notification.create({
        data: { businessId, recipient: to, audience, subject, status, error },
      });
    } catch {
      /* logging the notification must not break the action */
    }
  }

  return { status, error };
}

/** Notify both the customer and the business admin about a booking. */
export async function notifyBooking(opts: {
  businessId: string;
  businessName: string;
  adminEmail: string | null;
  guestName: string;
  guestEmail: string | null;
  what: string;
  when: string;
}): Promise<void> {
  const { businessId, businessName, adminEmail, guestName, guestEmail, what, when } = opts;

  if (guestEmail) {
    await sendNotification({
      businessId,
      to: guestEmail,
      audience: "CUSTOMER",
      subject: `Your booking with ${businessName}`,
      html: `<p>Hi ${guestName},</p>
<p>We have received your booking:</p>
<p><strong>${what}</strong><br/>${when}</p>
<p>We will be in touch to confirm. Thank you!</p>
<p>— ${businessName}</p>`,
    });
  }

  if (adminEmail) {
    await sendNotification({
      businessId,
      to: adminEmail,
      audience: "ADMIN",
      subject: `New booking: ${what}`,
      html: `<p>A new booking was created.</p>
<p><strong>${what}</strong><br/>${when}</p>
<p>Guest: ${guestName}${guestEmail ? ` (${guestEmail})` : ""}</p>`,
    });
  }
}
