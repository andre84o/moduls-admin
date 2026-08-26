"use client";

import Link from "next/link";
import { Settings, ArrowLeft, LogOut, Users } from "lucide-react";
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
import {
  visibleAdminSections,
  type AdminSectionId,
} from "./admin-sections";
import type { BusinessOption } from "../types";

/**
 * Shared admin sidebar contents (business switcher + section nav + footer),
 * rendered inside the collapsible chrome by AdminShell and inside the static
 * chrome of the /admin/super layout.
 *
 * Section nav can be either client buttons (pass `onSelectSection` — used by
 * AdminShell for instant, refetch-free tab switching) or links to
 * `/admin?tab=<id>` (the default — used from other routes such as the super
 * area, where there is no client tab state to drive).
 */

export function AdminSidebarContent({
  businesses,
  activeBusinessId,
  enabledModules,
  googleReviewsAddOnEnabled = false,
  isSuperAdmin,
  activeSection,
  onSelectSection,
  moduleSettingsActive = false,
  usersActive = false,
}: {
  businesses: BusinessOption[];
  activeBusinessId: string | null;
  enabledModules: string[];
  googleReviewsAddOnEnabled?: boolean;
  isSuperAdmin: boolean;
  /** Highlighted section, or null when none (e.g. on the super pages). */
  activeSection: AdminSectionId | null;
  /** When provided, nav items are client buttons; otherwise they are links. */
  onSelectSection?: (id: AdminSectionId) => void;
  moduleSettingsActive?: boolean;
  usersActive?: boolean;
}) {
  const visible = visibleAdminSections(enabledModules).filter(
    (s) => s.id !== "googleReviews" || googleReviewsAddOnEnabled,
  );

  return (
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
        {visible.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          if (onSelectSection) {
            return (
              <Button
                key={item.id}
                variant={active ? "secondary" : "ghost"}
                className="w-full justify-start gap-3"
                onClick={() => onSelectSection(item.id)}
              >
                <Icon className="size-4" />
                {item.label}
              </Button>
            );
          }
          return (
            <Link
              key={item.id}
              href={`/admin?tab=${item.id}`}
              className={cn(
                buttonVariants({ variant: active ? "secondary" : "ghost" }),
                "w-full justify-start gap-3",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Separator />
      <div className="space-y-1 p-3">
        {isSuperAdmin && (
          <Link
            href="/admin/super/modules"
            className={cn(
              buttonVariants({
                variant: moduleSettingsActive ? "secondary" : "ghost",
              }),
              "w-full justify-start gap-3",
            )}
          >
            <Settings className="size-4" />
            Module Settings
          </Link>
        )}
        {isSuperAdmin && (
          <Link
            href="/admin/super/users"
            className={cn(
              buttonVariants({
                variant: usersActive ? "secondary" : "ghost",
              }),
              "w-full justify-start gap-3",
            )}
          >
            <Users className="size-4" />
            Användare
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
  );
}
