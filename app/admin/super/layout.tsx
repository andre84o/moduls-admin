import { requireSuperAdmin } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";
import { AdminSidebarContent } from "../_components/admin-sidebar";

/**
 * Chrome for the platform (SUPER_ADMIN) area. Renders the same admin header +
 * sidebar as the dashboard so the super pages aren't orphaned. Protected
 * server-side: requireSuperAdmin gates the whole /admin/super segment, not just
 * individual pages. The sidebar's section links point back to /admin?tab=<id>;
 * the business switcher is intentionally hidden here (this area is cross-business).
 */
export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdmin();
  // Nav gating mirrors the dashboard — the active business's enabled modules.
  const enabledModules = Array.from(await getEnabledModules());

  return (
    <div className="flex h-screen flex-col bg-muted/30">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
        <span className="text-lg font-semibold tracking-tight">
          Moduls<span className="text-amber-500">Admin</span>
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 border-r bg-sidebar text-sidebar-foreground md:block">
          <AdminSidebarContent
            businesses={[]}
            activeBusinessId={null}
            enabledModules={enabledModules}
            isSuperAdmin
            activeSection={null}
            moduleSettingsActive
          />
        </aside>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
