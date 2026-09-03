"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdminSidebarContent } from "./admin-sidebar";
import { visibleAdminSections, type AdminSectionId } from "./admin-sections";
import type {
  AdminProperty,
  AdminBooking,
  AdminCustomer,
  BusinessOption,
} from "../types";
import type { AdminWebsitePageWithSections } from "@/modules/website/types";
import type {
  AdminGoogleReviewSettings,
  AdminCachedGoogleReviews,
} from "@/modules/website/google-reviews/queries";
import { PropertiesSection } from "./sections/properties";
import { BookingsSection } from "./sections/bookings";
import { CustomersSection } from "./sections/customers";
import { WebsiteSection } from "./sections/website";
import { GoogleReviewsSettings } from "./sections/google-reviews-settings";
import { RestaurantSection } from "./sections/restaurant";

export function AdminShell({
  properties,
  bookings,
  customers,
  websitePages,
  googleReviewSettings,
  googleReviewCache,
  googleReviewsConfigured,
  googleReviewsAddOnEnabled,
  businesses,
  activeBusinessId,
  enabledModules,
  initialSection = "website",
}: {
  properties: AdminProperty[];
  bookings: AdminBooking[];
  customers: AdminCustomer[];
  websitePages: AdminWebsitePageWithSections[];
  googleReviewSettings: AdminGoogleReviewSettings;
  googleReviewCache: AdminCachedGoogleReviews;
  googleReviewsConfigured: boolean;
  googleReviewsAddOnEnabled: boolean;
  businesses: BusinessOption[];
  activeBusinessId: string | null;
  enabledModules: string[];
  /** Initial section from the ?tab= query (deep links from other routes). */
  initialSection?: AdminSectionId;
}) {
  const router = useRouter();
  const [active, setActive] = useState<AdminSectionId>(initialSection);

  const selectSection = useCallback((id: AdminSectionId) => {
    setActive(id);
    router.replace(`/admin?tab=${id}`, { scroll: false });
  }, [router]);

  // Sidebar has two states: fully open or fully closed. Toggled from the header.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebarRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  // While open, a click anywhere outside the sidebar (and outside the header,
  // so the toggle button keeps working) closes it.
  useEffect(() => {
    if (!sidebarOpen) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(target) &&
        headerRef.current &&
        !headerRef.current.contains(target)
      ) {
        setSidebarOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [sidebarOpen]);

  const visibleSections = visibleAdminSections(enabledModules).filter(
    (s) => s.id !== "googleReviews" || googleReviewsAddOnEnabled,
  );

  const effectiveActive: AdminSectionId = visibleSections.some(
    (s) => s.id === active,
  )
    ? active
    : "website";

  // SUPER_ADMIN on any business grants access to platform tools. Cosmetic only —
  // the page + actions are guarded server-side by requireSuperAdmin.
  const isSuperAdmin = businesses.some((b) => b.role === "SUPER_ADMIN");

  return (
    <div className="flex h-screen flex-col bg-muted/30">
      {/* Header — full width, on top. Sidebar starts below it. */}
      <header
        ref={headerRef}
        className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4"
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen((open) => !open)}
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          <Menu className="size-5" />
        </Button>
        <span className="text-lg font-semibold tracking-tight">
          Moduls<span className="text-amber-500">Admin</span>
        </span>
      </header>

      {/* Below the header: collapsible sidebar + main content. */}
      <div className="flex min-h-0 flex-1">
        {/* The sidebar stays mounted and animates its width via CSS (compositor-
            friendly, no JS per frame, no extra bundle). The inner wrapper keeps a
            fixed width so content is clipped rather than reflowed while sliding. */}
        <aside
          ref={sidebarRef}
          aria-hidden={!sidebarOpen}
          className={cn(
            "shrink-0 overflow-hidden bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-in-out motion-reduce:transition-none",
            sidebarOpen ? "w-60 border-r" : "w-0",
          )}
        >
          <AdminSidebarContent
            businesses={businesses}
            activeBusinessId={activeBusinessId}
            enabledModules={enabledModules}
            googleReviewsAddOnEnabled={googleReviewsAddOnEnabled}
            isSuperAdmin={isSuperAdmin}
            activeSection={effectiveActive}
            onSelectSection={selectSection}
          />
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-8 py-10">
            {effectiveActive === "properties" && (
              <PropertiesSection properties={properties} />
            )}
            {effectiveActive === "bookings" && (
              <BookingsSection bookings={bookings} properties={properties} />
            )}
            {effectiveActive === "customers" && (
              <CustomersSection customers={customers} />
            )}
            {effectiveActive === "website" && (
              <WebsiteSection pages={websitePages} />
            )}
            {effectiveActive === "googleReviews" && googleReviewsAddOnEnabled && (
              <GoogleReviewsSettings
                settings={googleReviewSettings}
                cache={googleReviewCache}
                configured={googleReviewsConfigured}
              />
            )}
            {effectiveActive === "restaurant" && (
              <RestaurantSection pages={websitePages} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
