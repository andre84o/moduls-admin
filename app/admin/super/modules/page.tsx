import { getAllBusinessesWithModules } from "@/lib/super-admin";
import {
  setModuleEnabled,
  setBusinessFeatureAccess,
} from "@/lib/super-admin-actions";
import {
  GOOGLE_REVIEWS_FEATURE_KEY,
  CATERING_FEATURE_KEY,
  RESTAURANT_BOOKING_FEATURE_KEY,
} from "@/lib/feature-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const MODULES = ["WEBSITE", "RESTAURANT", "RENTAL", "BOOKING", "CRM"] as const;

export default async function SuperModulesPage() {
  const businesses = await getAllBusinessesWithModules();

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Modules</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enable or disable optional modules per business.
        </p>
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
