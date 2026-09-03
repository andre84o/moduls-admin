"use client";

import { useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdminSidebarContent } from "../../_components/admin-sidebar";

export function SuperAdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
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
          <AdminSidebarContent
            businesses={[]}
            activeBusinessId={null}
            enabledModules={[]}
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
