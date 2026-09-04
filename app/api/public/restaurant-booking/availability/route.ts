import { NextResponse } from "next/server";
import { getRestaurantAvailabilityForBusiness } from "@/modules/restaurant-booking/availability";
import { getPublicRestaurantAvailability } from "@/modules/restaurant-booking/public";
import { resolveRestaurantBookingPreviewBusiness } from "@/modules/restaurant-booking/demo-preview";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date")?.trim() ?? "";
  const partySize = Number(url.searchParams.get("partySize"));
  const previewBusiness = url.searchParams.get("previewBusiness")?.trim() ?? "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(partySize) || partySize < 1) {
    return NextResponse.json({ error: "Invalid date or party size." }, { status: 400 });
  }

  const result = previewBusiness
    ? await (async () => {
        const business = await resolveRestaurantBookingPreviewBusiness(previewBusiness);
        if (!business) return null;
        return getRestaurantAvailabilityForBusiness({ businessId: business.id, date, partySize });
      })()
    : await getPublicRestaurantAvailability({ date, partySize });

  if (!result) {
    return NextResponse.json({ error: "Restaurant booking is not configured." }, { status: 404 });
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
