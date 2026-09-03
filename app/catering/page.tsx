import { resolvePublicBusinessId } from "@/lib/public-tenant";
import { isRestaurantEnabled } from "@/modules/restaurant/guards";
import { hasBusinessFeatureAccess, CATERING_FEATURE_KEY } from "@/lib/feature-access";
import { getPublicCateringMenus } from "@/modules/catering/queries";
import { CateringForm } from "@/components/CateringForm";

export default async function CateringPage() {
  const businessId = await resolvePublicBusinessId();

  if (!businessId) {
    return (
      <main className="min-h-screen bg-background py-16">
        <p className="text-center text-muted-foreground">
          Catering är inte tillgänglig just nu.
        </p>
      </main>
    );
  }

  const [restaurantEnabled, cateringEnabled, menus] = await Promise.all([
    isRestaurantEnabled(businessId),
    hasBusinessFeatureAccess(businessId, CATERING_FEATURE_KEY),
    getPublicCateringMenus(businessId),
  ]);

  if (!restaurantEnabled || !cateringEnabled) {
    return (
      <main className="min-h-screen bg-background py-16">
        <p className="text-center text-muted-foreground">
          Catering är inte tillgänglig just nu.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background py-16">
      <div className="mx-auto max-w-xl px-4">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Cateringförfrågan</h1>
          <p className="mt-3 text-muted-foreground">
            Fyll i dina uppgifter så återkommer vi så snart som möjligt.
          </p>
        </div>

        <CateringForm
          menus={menus}
          successText="Tack! Vi har tagit emot din förfrågan och återkommer så snart vi kan."
          consentLabel="Jag godkänner att mina kontaktuppgifter sparas i samband med denna förfrågan."
        />
      </div>
    </main>
  );
}
