"use client";
import { Check } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useWorkspace } from "@/components/workspace-provider";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { document, saveState, error } = useWorkspace();
  const path = usePathname();
  const [open, setOpen] = useState(true);
  useEffect(() => {
    setOpen(
      !window.document.cookie.split("; ").includes("sidebar_state=false"),
    );
  }, []);
  const activeId = path.startsWith("/posts/")
    ? decodeURIComponent(path.split("/")[2])
    : "";
  if (path === "/onboarding") return children;
  return (
    <SidebarProvider
      open={open}
      onOpenChange={setOpen}
      className="app-shell routed-shell"
      style={
        {
          "--review-offset": open ? "13rem" : "0px",
          "--sidebar-width": "13rem",
        } as React.CSSProperties
      }
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <AppSidebar
        articles={document.articles.filter(
          (article) => article.mode !== "sample",
        )}
        activeId={activeId}
      />
      <div className="workspace">
        <header className="workspace-header compact-header">
          <div className="breadcrumb">
            <SidebarTrigger className="workspace-sidebar-trigger" />
            <span>
              {path.startsWith("/schedule")
                ? "Schedule"
                : path === "/settings"
                  ? "Settings"
                  : path === "/import"
                    ? "Import"
                    : "Notes"}
            </span>
          </div>
          <span className="save-state" role="status">
            {saveState === "saving" ? (
              "Saving…"
            ) : saveState === "unavailable" ? (
              "Save paused"
            ) : (
              <>
                <Check size={12} /> Saved
              </>
            )}
          </span>
        </header>
        {error && (
          <p className="inline-error save-error" role="alert">
            {error}
          </p>
        )}
        {children}
      </div>
    </SidebarProvider>
  );
}
