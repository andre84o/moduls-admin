import { NextResponse } from "next/server";
import { getPublicRestaurantAvailability } from "@/modules/restaurant-booking/public";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date")?.trim() ?? "";
  const partySize = Number(url.searchParams.get("partySize"));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(partySize) || partySize < 1) {
    return NextResponse.json({ error: "Invalid date or party size." }, { status: 400 });
  }

  const result = await getPublicRestaurantAvailability({ date, partySize });
  if (!result) {
    return NextResponse.json({ error: "Restaurant booking is not configured." }, { status: 404 });
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
