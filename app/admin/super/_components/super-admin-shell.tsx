"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Settings, Users, ArrowLeft, Globe, LogOut } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/auth-actions";

const NAV = [
  { href: "/admin/super/modules", label: "Module Settings", icon: Settings },
  { href: "/admin/super/users", label: "Users", icon: Users },
];

export function SuperAdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebarRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);

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

  return (
    <div className="flex h-screen flex-col bg-muted/30">
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

      <div className="flex min-h-0 flex-1">
        <aside
          ref={sidebarRef}
          aria-hidden={!sidebarOpen}
          className={cn(
            "shrink-0 overflow-hidden bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-in-out motion-reduce:transition-none",
            sidebarOpen ? "w-60 border-r" : "w-0",
          )}
        >
          <div className="flex h-full w-60 flex-col overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <nav className="flex-1 space-y-1 p-3">
              {NAV.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    buttonVariants({
                      variant: pathname === href ? "secondary" : "ghost",
                    }),
                    "w-full justify-start gap-3",
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              ))}
            </nav>

            <Separator />
            <div className="space-y-1 p-3">
              <Link
                href="/admin"
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "w-full justify-start gap-3",
                )}
              >
                <ArrowLeft className="size-4" />
                Dashboard
              </Link>
              <Link
                href="/"
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "w-full justify-start gap-3",
                )}
              >
                <Globe className="size-4" />
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

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
