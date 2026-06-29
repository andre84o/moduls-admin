import { getAllBusinessesWithModules } from "@/lib/super-admin";
import { setModuleEnabled } from "@/lib/super-admin-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const MODULES = ["WEBSITE", "RENTAL", "BOOKING", "CRM"] as const;

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
            <CardContent className="flex flex-wrap gap-3">
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
                    >
                      {m} · {on ? "Enabled" : "Disabled"}
                    </Button>
                  </form>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
