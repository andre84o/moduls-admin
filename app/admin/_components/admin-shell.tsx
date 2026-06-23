"use client";

import { useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Home,
  CalendarDays,
  Users,
  Images,
  Settings,
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
import type { MediaItem } from "@/lib/media";
import { OverviewSection } from "./sections/overview";
import { PropertiesSection } from "./sections/properties";
import { BookingsSection } from "./sections/bookings";
import { CustomersSection } from "./sections/customers";
import { MediaSection } from "./sections/media";

const sections = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "properties", label: "Properties", icon: Home },
  { id: "bookings", label: "Bookings", icon: CalendarDays },
  { id: "customers", label: "CRM", icon: Users },
  { id: "media", label: "Media", icon: Images },
] as const;

type SectionId = (typeof sections)[number]["id"];

// Sections that require an enabled module. Overview + Media are core (always shown).
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
  media,
  businesses,
  activeBusinessId,
  enabledModules,
}: {
  stats: DashboardStats;
  properties: AdminProperty[];
  bookings: AdminBooking[];
  customers: AdminCustomer[];
  media: MediaItem[];
  businesses: BusinessOption[];
  activeBusinessId: string | null;
  enabledModules: string[];
}) {
  const [active, setActive] = useState<SectionId>("overview");

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
    <div className="flex min-h-screen bg-muted/30">
      <aside className="flex w-60 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="px-6 py-5">
          <span className="text-lg font-semibold tracking-tight">
            Moduls<span className="text-amber-500">Admin</span>
          </span>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Admin
          </p>
        </div>

        {businesses.length > 1 && (
          <div className="px-3 pb-2">
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
          </div>
        )}
        <Separator />

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
          {effectiveActive === "media" && <MediaSection media={media} />}
        </div>
      </main>
    </div>
  );
}
