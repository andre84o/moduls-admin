import { NextResponse } from "next/server";
import {
  createPublicRestaurantBooking,
  createRestaurantBookingForBusiness,
} from "@/modules/restaurant-booking/public";
import { resolveRestaurantBookingPreviewBusiness } from "@/modules/restaurant-booking/demo-preview";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const previewBusiness =
    typeof input.previewBusiness === "string" ? input.previewBusiness.trim() : "";

  const bookingInput = {
    guestName: typeof input.guestName === "string" ? input.guestName : "",
    guestEmail: typeof input.guestEmail === "string" ? input.guestEmail : null,
    guestPhone: typeof input.guestPhone === "string" ? input.guestPhone : null,
    partySize: Number(input.partySize),
    startAt: typeof input.startAt === "string" ? input.startAt : "",
    notes: typeof input.notes === "string" ? input.notes : null,
  };

  const result = previewBusiness
    ? await (async () => {
        const business = await resolveRestaurantBookingPreviewBusiness(previewBusiness);
        if (!business) {
          return { ok: false as const, error: "Restaurant booking preview is not available." };
        }
        return createRestaurantBookingForBusiness({ businessId: business.id, ...bookingInput });
      })()
    : await createPublicRestaurantBooking(bookingInput);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json(result, { status: 201 });
}
