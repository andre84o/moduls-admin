"use client";

import { useState, useTransition } from "react";
import PublicDateRangeCalendar, {
  type DateRangeValue,
} from "@/components/PublicDateRangeCalendar";
import GuestSelector, {
  type GuestCounts,
  type GuestLimits,
} from "@/components/GuestSelector";
import PriceSummary from "@/components/PriceSummary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBookingCheckout } from "@/lib/booking-checkout";

type Props = {
  propertyId: string;
  pricePerNight: number;
  cleaningFee: number;
  currency: string;
  minNights: number;
  limits: GuestLimits;
  reservedRanges: { start: string; end: string }[];
};

// Nights between two "yyyy-mm-dd" strings (UTC-midnight diff). Display only.
const nightsBetween = (a: string | null, b: string | null) => {
  if (!a || !b) return 0;
  const d = (s: string) => {
    const [y, m, dd] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, dd);
  };
  return Math.max(0, Math.round((d(b) - d(a)) / 86_400_000));
};

export function RentalBookingWidget({
  propertyId,
  pricePerNight,
  cleaningFee,
  currency,
  minNights,
  limits,
  reservedRanges,
}: Props) {
  const [range, setRange] = useState<DateRangeValue>({
    checkIn: null,
    checkOut: null,
  });
  const [guests, setGuests] = useState<GuestCounts>({
    adults: 1,
    children: 0,
    infants: 0,
    pets: 0,
  });
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nights = nightsBetween(range.checkIn, range.checkOut);
  // DISPLAY ONLY — the server action is the source of truth for price.
  const total = nights * pricePerNight + cleaningFee;

  const canSubmit =
    !!range.checkIn &&
    !!range.checkOut &&
    nights >= minNights &&
    guestName.trim().length > 0 &&
    !isPending;

  const handleSubmit = () => {
    startTransition(async () => {
      setError(null);
      const res = await createBookingCheckout({
        propertyId,
        checkIn: range.checkIn!,
        checkOut: range.checkOut!,
        adults: guests.adults,
        children: guests.children,
        infants: guests.infants,
        pets: guests.pets,
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim() || null,
      });
      if (res.ok) {
        window.location.href = res.url;
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Choose your dates</CardTitle>
          </CardHeader>
          <CardContent>
            <PublicDateRangeCalendar
              value={range}
              onChange={setRange}
              reservedRanges={reservedRanges}
              minNights={minNights}
            />
            {nights > 0 && nights < minNights ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Minimum stay is {minNights} nights.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Guests</CardTitle>
          </CardHeader>
          <CardContent>
            <GuestSelector value={guests} onChange={setGuests} limits={limits} />
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Your booking</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="guestName">Full name</Label>
            <Input
              id="guestName"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="guestEmail">Email</Label>
            <Input
              id="guestEmail"
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
            />
          </div>

          {nights > 0 ? (
            <PriceSummary
              nights={nights}
              pricePerNight={pricePerNight}
              cleaningFee={cleaningFee}
              total={total}
              currency={currency}
            />
          ) : null}

          {error ? (
            <p className="text-sm font-medium text-red-600">{error}</p>
          ) : null}

          <Button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {isPending ? "Redirecting…" : "Reserve & pay"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
