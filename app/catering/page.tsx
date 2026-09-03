import { CateringForm } from "@/components/CateringForm";
import { CATERING_MENUS } from "@/modules/catering/config";

export default function CateringPage() {
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
          menus={CATERING_MENUS}
          successText="Tack! Vi har tagit emot din förfrågan och återkommer så snart vi kan."
          consentLabel="Jag godkänner att mina kontaktuppgifter sparas i samband med denna förfrågan."
        />
      </div>
    </main>
  );
}
