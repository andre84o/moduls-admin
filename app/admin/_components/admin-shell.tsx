"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Home,
  CalendarDays,
  Users,
  Settings,
  Menu,
  ArrowLeft,
  LogOut,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { logout, switchBusiness } from "@/lib/auth-actions";
import type {
  AdminProperty,
  AdminBooking,
  AdminCustomer,
  DashboardStats,
  BusinessOption,
} from "../types";
import { OverviewSection } from "./sections/overview";
import { PropertiesSection } from "./sections/properties";
import { BookingsSection } from "./sections/bookings";
import { CustomersSection } from "./sections/customers";

const sections = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "properties", label: "Properties", icon: Home },
  { id: "bookings", label: "Bookings", icon: CalendarDays },
  { id: "customers", label: "CRM", icon: Users },
] as const;

type SectionId = (typeof sections)[number]["id"];

// Sections that require an enabled module. Overview is core (always shown).
const SECTION_MODULE: Partial<Record<SectionId, string>> = {
  properties: "RENTAL",
  bookings: "BOOKING",
  customers: "CRM",
};

export function AdminShell({
  stats,
  properties,
  bookings,
  customers,
  businesses,
  activeBusinessId,
  enabledModules,
}: {
  stats: DashboardStats;
  properties: AdminProperty[];
  bookings: AdminBooking[];
  customers: AdminCustomer[];
  businesses: BusinessOption[];
  activeBusinessId: string | null;
  enabledModules: string[];
}) {
  const [active, setActive] = useState<SectionId>("overview");

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

  const visibleSections = sections.filter((s) => {
    const mod = SECTION_MODULE[s.id];
    return !mod || enabledModules.includes(mod);
  });

  const effectiveActive: SectionId = visibleSections.some((s) => s.id === active)
    ? active
    : "overview";

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
          <div className="flex h-full w-60 flex-col overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {businesses.length > 1 && (
              <div className="px-3 pt-3 pb-2">
                <Select
                  items={businesses.map((b) => ({ label: b.name, value: b.id }))}
                  value={activeBusinessId ?? businesses[0]?.id}
                  onValueChange={(value) => {
                    if (value) switchBusiness(value);
                  }}
                >
                  <SelectTrigger className="w-full" aria-label="Active business">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {businesses.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Separator className="mt-2" />
              </div>
            )}

            <nav className="flex-1 space-y-1 p-3">
              {visibleSections.map((item) => {
                const Icon = item.icon;
                const isActive = effectiveActive === item.id;
                return (
                  <Button
                    key={item.id}
                    variant={isActive ? "secondary" : "ghost"}
                    className="w-full justify-start gap-3"
                    onClick={() => setActive(item.id)}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Button>
                );
              })}
            </nav>

            <Separator />
            <div className="space-y-1 p-3">
              {isSuperAdmin && (
                <Link
                  href="/admin/super/modules"
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "w-full justify-start gap-3",
                  )}
                >
                  <Settings className="size-4" />
                  Module Settings
                </Link>
              )}
              <Link
                href="/"
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "w-full justify-start gap-3",
                )}
              >
                <ArrowLeft className="size-4" />
                Back to site
              </Link>
              <form action={logout}>
                <Button
                  type="submit"
                  variant="ghost"
                  className="w-full justify-start gap-3 text-destructive hover:text-destructive"
                >
                  <LogOut className="size-4" />
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-8 py-10">
            {effectiveActive === "overview" && (
              <OverviewSection stats={stats} enabledModules={enabledModules} />
            )}
            {effectiveActive === "properties" && (
              <PropertiesSection properties={properties} />
            )}
            {effectiveActive === "bookings" && (
              <BookingsSection bookings={bookings} properties={properties} />
            )}
            {effectiveActive === "customers" && (
              <CustomersSection customers={customers} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
