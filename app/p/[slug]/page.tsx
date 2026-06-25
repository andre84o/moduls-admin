import { notFound } from "next/navigation";
import { getPublicProperty } from "@/lib/public-property";
import { getReservedRanges } from "@/lib/booking-availability";
import { customerContent } from "@/config/customer-content";
import { RentalBookingWidget } from "./_components/RentalBookingWidget";

export default async function PropertyBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const property = await getPublicProperty(slug);
  if (!property) notFound();

  const reservedRanges = await getReservedRanges({
    businessId: property.businessId,
    propertyId: property.id,
    bufferDays: property.bufferDaysAfterCheckout,
  });

  const money = (x: number) =>
    `${(x / 100).toFixed(2)} ${property.currency.toUpperCase()}`;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{property.title}</h1>
        <p className="mt-1 text-muted-foreground">{property.location}</p>
        <p className="mt-2 text-lg">
          <span className="font-semibold">{money(property.pricePerNight)}</span>{" "}
          <span className="text-sm text-muted-foreground">
            {customerContent.property.perNightLabel}
          </span>
        </p>
        {property.description ? (
          <p className="mt-4 max-w-2xl text-zinc-600">{property.description}</p>
        ) : null}
      </header>

      <RentalBookingWidget
        propertyId={property.id}
        pricePerNight={property.pricePerNight}
        cleaningFee={property.cleaningFee}
        currency={property.currency}
        minNights={property.minNights}
        limits={{
          maxGuests: property.maxGuests,
          maxAdults: property.maxAdults,
          maxChildren: property.maxChildren,
          maxInfants: property.maxInfants,
          maxPets: property.maxPets,
          petsAllowed: property.petsAllowed,
        }}
        reservedRanges={reservedRanges}
      />
    </main>
  );
}
