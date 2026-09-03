import { requireSuperAdmin } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";
import { SuperAdminShell } from "./_components/super-admin-shell";

/**
 * Chrome for the platform (SUPER_ADMIN) area. Auth + data resolved server-side;
 * the collapsible sidebar is handled by SuperAdminShell (client component).
 * Protected by requireSuperAdmin — gates the whole /admin/super segment.
 */
export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdmin();
  const enabledModules = Array.from(await getEnabledModules());

  return (
    <SuperAdminShell enabledModules={enabledModules}>
      {children}
    </SuperAdminShell>
  );
}
