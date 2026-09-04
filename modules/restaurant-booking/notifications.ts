import "server-only";

import { getPrisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/email";
import { DEFAULT_RESTAURANT_BOOKING_SETTINGS } from "./types";
import { safeTimezone } from "./time";

export type RestaurantBookingNotificationEvent =
  | "CREATED"
  | "CONFIRMED"
  | "DECLINED"
  | "CANCELLED"
  | "RESCHEDULED"
  | "REACTIVATED";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] as string,
  );
}

function formatWhen(startAt: Date, endAt: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `${formatter.format(startAt)} – ${formatter.format(endAt)}`;
}

function guestCopy(input: {
  event: RestaurantBookingNotificationEvent;
  businessName: string;
  status: string;
  when: string;
  partySize: number;
}) {
  const businessName = escapeHtml(input.businessName);
  const when = escapeHtml(input.when);

  switch (input.event) {
    case "CREATED":
      if (input.status === "CONFIRMED") {
        return {
          subject: `Your reservation at ${input.businessName} is confirmed`,
          html: `<p>Your reservation at <strong>${businessName}</strong> is confirmed.</p><p>${when}<br/>Guests: ${input.partySize}</p>`,
        };
      }
      return {
        subject: `We received your reservation request at ${input.businessName}`,
        html: `<p>We have received your reservation request for <strong>${businessName}</strong>.</p><p>${when}<br/>Guests: ${input.partySize}</p><p>The restaurant will confirm your request shortly.</p>`,
      };
    case "CONFIRMED":
      return {
        subject: `Your reservation at ${input.businessName} is confirmed`,
        html: `<p>Your reservation at <strong>${businessName}</strong> is confirmed.</p><p>${when}<br/>Guests: ${input.partySize}</p>`,
      };
    case "DECLINED":
      return {
        subject: `Update to your reservation at ${input.businessName}`,
        html: `<p>Your reservation request at <strong>${businessName}</strong> could not be confirmed.</p><p>${when}<br/>Guests: ${input.partySize}</p>`,
      };
    case "CANCELLED":
      return {
        subject: `Your reservation at ${input.businessName} was cancelled`,
        html: `<p>Your reservation at <strong>${businessName}</strong> has been cancelled.</p><p>${when}<br/>Guests: ${input.partySize}</p>`,
      };
    case "RESCHEDULED":
      return {
        subject: `Your reservation at ${input.businessName} was rescheduled`,
        html: `<p>Your reservation at <strong>${businessName}</strong> has a new time.</p><p>${when}<br/>Guests: ${input.partySize}</p>`,
      };
    case "REACTIVATED":
      return {
        subject: `Your reservation at ${input.businessName} is active again`,
        html: `<p>Your reservation at <strong>${businessName}</strong> is active again.</p><p>${when}<br/>Guests: ${input.partySize}</p>`,
      };
  }
}

function adminCopy(input: {
  event: RestaurantBookingNotificationEvent;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  status: string;
  when: string;
  partySize: number;
}) {
  const guestName = escapeHtml(input.guestName);
  const guestEmail = input.guestEmail ? escapeHtml(input.guestEmail) : null;
  const guestPhone = input.guestPhone ? escapeHtml(input.guestPhone) : null;
  const when = escapeHtml(input.when);
  const eventLabel: Record<RestaurantBookingNotificationEvent, string> = {
    CREATED: input.status === "CONFIRMED" ? "New confirmed reservation" : "New reservation request",
    CONFIRMED: "Reservation confirmed",
    DECLINED: "Reservation declined",
    CANCELLED: "Reservation cancelled",
    RESCHEDULED: "Reservation rescheduled",
    REACTIVATED: "Reservation reactivated",
  };

  return {
    subject: `${eventLabel[input.event]}: ${input.guestName}`,
    html: `<p><strong>${eventLabel[input.event]}</strong></p><p>Guest: ${guestName}<br/>${
      guestEmail ? `Email: ${guestEmail}<br/>` : ""
    }${guestPhone ? `Phone: ${guestPhone}<br/>` : ""}Guests: ${input.partySize}<br/>${when}</p>`,
  };
}

/**
 * Best-effort lifecycle notification. Email/notification logging must never
 * roll back or fail an already successful booking transaction.
 */
export async function notifyRestaurantBookingEvent(input: {
  businessId: string;
  bookingId: string;
  event: RestaurantBookingNotificationEvent;
}) {
  try {
    const prisma = getPrisma();
    const [business, booking, detail, settings] = await Promise.all([
      prisma.business.findUnique({
        where: { id: input.businessId },
        select: { name: true, email: true },
      }),
      prisma.booking.findFirst({
        where: { id: input.bookingId, businessId: input.businessId },
        select: {
          guestName: true,
          guestEmail: true,
          startAt: true,
          endAt: true,
          status: true,
        },
      }),
      prisma.restaurantBookingDetail.findFirst({
        where: { bookingId: input.bookingId, businessId: input.businessId },
        select: { guestPhone: true, partySize: true },
      }),
      prisma.restaurantBookingSettings.findUnique({
        where: { businessId: input.businessId },
        select: { timezone: true },
      }),
    ]);

    if (!business || !booking || !detail) return;
    const timezone = safeTimezone(
      settings?.timezone ?? DEFAULT_RESTAURANT_BOOKING_SETTINGS.timezone,
    );
    const when = formatWhen(booking.startAt, booking.endAt, timezone);

    if (booking.guestEmail) {
      const copy = guestCopy({
        event: input.event,
        businessName: business.name,
        status: booking.status,
        when,
        partySize: detail.partySize,
      });
      await sendNotification({
        businessId: input.businessId,
        to: booking.guestEmail,
        audience: "CUSTOMER",
        subject: copy.subject,
        html: copy.html,
      });
    }

    if (business.email) {
      const copy = adminCopy({
        event: input.event,
        guestName: booking.guestName,
        guestEmail: booking.guestEmail,
        guestPhone: detail.guestPhone,
        status: booking.status,
        when,
        partySize: detail.partySize,
      });
      await sendNotification({
        businessId: input.businessId,
        to: business.email,
        audience: "ADMIN",
        subject: copy.subject,
        html: copy.html,
      });
    }
  } catch (error) {
    console.error("[restaurant-booking notification failed]", error);
  }
}
