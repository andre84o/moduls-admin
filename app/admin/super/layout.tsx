import { requireSuperAdmin } from "@/lib/auth";
import { SuperAdminShell } from "./_components/super-admin-shell";

/**
 * Chrome for the platform (SUPER_ADMIN) area. Auth resolved server-side;
 * the collapsible sidebar is handled by SuperAdminShell (client component).
 * Protected by requireSuperAdmin — gates the whole /admin/super segment.
 */
export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdmin();

  return <SuperAdminShell>{children}</SuperAdminShell>;
}
