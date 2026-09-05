import Link from "next/link";
import { getAllBusinessesWithModules } from "@/lib/super-admin";
import {
  setModuleEnabled,
  setBusinessFeatureAccess,
  setRestaurantBookingTimezone,
} from "@/lib/super-admin-actions";
import {
  GOOGLE_REVIEWS_FEATURE_KEY,
  CATERING_FEATURE_KEY,
  RENTAL_BOOKING_FEATURE_KEY,
  RESTAURANT_BOOKING_FEATURE_KEY,
} from "@/lib/feature-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const MODULES = ["WEBSITE", "RESTAURANT", "RENTAL", "CRM"] as const;

export default async function SuperModulesPage() {
  const businesses = await getAllBusinessesWithModules();

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Modules</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enable or disable products and add-ons per business.
          </p>
        </div>
        <Link
          href="/admin/super/restaurant-booking-demo"
          className={buttonVariants({ variant: "outline" })}
        >
          Preview Restaurant Booking
        </Link>
      </header>

      <div className="space-y-4">
        {businesses.map((b) => (
          <Card key={b.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {b.name}
                <Badge variant="outline">{b.slug}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Modules
                </p>
                <div className="flex flex-wrap gap-3">
                  {MODULES.map((m) => {
                    const on = b.modules[m];
                    return (
                      <form key={m} action={setModuleEnabled}>
                        <input type="hidden" name="businessId" value={b.id} />
                        <input type="hidden" name="type" value={m} />
                        <input type="hidden" name="enabled" value={String(!on)} />
                        <Button
                          type="submit"
                          size="sm"
                          variant={on ? "default" : "outline"}
                          className={
                            on
                              ? "bg-green-600 hover:bg-green-700 border-green-600 text-white"
                              : ""
                          }
                        >
                          {m} · {on ? "Enabled" : "Disabled"}
                        </Button>
                      </form>
                    );
                  })}
                </div>
              </div>

              <Separator />

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Add-ons (paid)
                </p>
                <div className="flex flex-wrap gap-3">
                  <form
                    action={setBusinessFeatureAccess.bind(null, {
                      businessId: b.id,
                      key: GOOGLE_REVIEWS_FEATURE_KEY,
                      enabled: !b.addOns.GOOGLE_REVIEWS,
                    })}
                  >
                    <Button
                      type="submit"
                      size="sm"
                      variant={b.addOns.GOOGLE_REVIEWS ? "default" : "outline"}
                      className={
                        b.addOns.GOOGLE_REVIEWS
                          ? "bg-green-600 hover:bg-green-700 border-green-600 text-white"
                          : ""
                      }
                    >
                      Google Reviews · {b.addOns.GOOGLE_REVIEWS ? "Enabled" : "Disabled"}
                    </Button>
                  </form>

                  <form
                    action={setBusinessFeatureAccess.bind(null, {
                      businessId: b.id,
                      key: CATERING_FEATURE_KEY,
                      enabled: !b.addOns.CATERING,
                    })}
                  >
                    <Button
                      type="submit"
                      size="sm"
                      variant={b.addOns.CATERING ? "default" : "outline"}
                      disabled={!b.modules.RESTAURANT && !b.addOns.CATERING}
                      className={
                        b.addOns.CATERING
                          ? "bg-green-600 hover:bg-green-700 border-green-600 text-white"
                          : ""
                      }
                    >
                      Catering · {b.addOns.CATERING ? "Enabled" : "Disabled"}
                    </Button>
                  </form>

                  <form
                    action={setBusinessFeatureAccess.bind(null, {
                      businessId: b.id,
                      key: RENTAL_BOOKING_FEATURE_KEY,
                      enabled: !b.addOns.RENTAL_BOOKING,
                    })}
                  >
                    <Button
                      type="submit"
                      size="sm"
                      variant={b.addOns.RENTAL_BOOKING ? "default" : "outline"}
                      disabled={!b.modules.RENTAL && !b.addOns.RENTAL_BOOKING}
                      className={
                        b.addOns.RENTAL_BOOKING
                          ? "bg-green-600 hover:bg-green-700 border-green-600 text-white"
                          : ""
                      }
                    >
                      Rental Booking · {b.addOns.RENTAL_BOOKING ? "Enabled" : "Disabled"}
                    </Button>
                  </form>

                  <form
                    action={setBusinessFeatureAccess.bind(null, {
                      businessId: b.id,
                      key: RESTAURANT_BOOKING_FEATURE_KEY,
                      enabled: !b.addOns.RESTAURANT_BOOKING,
                    })}
                  >
                    <Button
                      type="submit"
                      size="sm"
                      variant={b.addOns.RESTAURANT_BOOKING ? "default" : "outline"}
                      disabled={!b.modules.RESTAURANT && !b.addOns.RESTAURANT_BOOKING}
                      className={
                        b.addOns.RESTAURANT_BOOKING
                          ? "bg-green-600 hover:bg-green-700 border-green-600 text-white"
                          : ""
                      }
                    >
                      Restaurant Booking · {b.addOns.RESTAURANT_BOOKING ? "Enabled" : "Disabled"}
                    </Button>
                  </form>
                </div>

                {b.addOns.RESTAURANT_BOOKING && (
                  <div className="mt-4 max-w-md rounded-lg border p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Restaurant timezone
                    </p>
                    <form action={setRestaurantBookingTimezone} className="flex flex-col gap-2 sm:flex-row">
                      <input type="hidden" name="businessId" value={b.id} />
                      <select
                        name="timezone"
                        defaultValue={b.restaurantBookingTimezone}
                        aria-label={`Restaurant timezone for ${b.name}`}
                        className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                      >
                        <option value="Europe/Stockholm">Stockholm</option>
                        <option value="Europe/Madrid">Madrid</option>
                      </select>
                      <Button type="submit" size="sm" variant="outline">
                        Save timezone
                      </Button>
                    </form>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Used for restaurant booking times and daylight saving time.
                    </p>
                  </div>
                )}

                {!b.modules.RENTAL && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Rental Booking requires the RENTAL module.
                  </p>
                )}
                {!b.modules.RESTAURANT && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Restaurant add-ons require the RESTAURANT module.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
