import { NextResponse } from "next/server";
import { createPublicRestaurantBooking } from "@/modules/restaurant-booking/public";

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
  const result = await createPublicRestaurantBooking({
    guestName: typeof input.guestName === "string" ? input.guestName : "",
    guestEmail: typeof input.guestEmail === "string" ? input.guestEmail : null,
    guestPhone: typeof input.guestPhone === "string" ? input.guestPhone : null,
    partySize: Number(input.partySize),
    startAt: typeof input.startAt === "string" ? input.startAt : "",
    notes: typeof input.notes === "string" ? input.notes : null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json(result, { status: 201 });
}
