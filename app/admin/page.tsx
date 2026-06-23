import {
  getDashboardStats,
  getProperties,
  getBookings,
  getCustomers,
} from "@/lib/queries";
import { listUserBusinesses, getActiveBusinessId } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules";
import { AdminShell } from "./_components/admin-shell";

export default async function AdminPage() {
  // Each query verifies the session and scopes by the active businessId.
  const [
    stats,
    properties,
    bookings,
    customers,
    businesses,
    activeId,
    enabledModules,
  ] = await Promise.all([
    getDashboardStats(),
    getProperties(),
    getBookings(),
    getCustomers(),
    listUserBusinesses(),
    getActiveBusinessId(),
    getEnabledModules(),
  ]);

  return (
    <AdminShell
      stats={stats}
      properties={properties}
      bookings={bookings}
      customers={customers}
      businesses={businesses.map((b) => ({ id: b.id, name: b.name, role: b.role }))}
      activeBusinessId={activeId}
      enabledModules={Array.from(enabledModules)}
    />
  );
}
