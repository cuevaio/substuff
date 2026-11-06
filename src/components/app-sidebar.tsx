"use client";

import { CalendarDays, FileText, Plus, Settings2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/brand";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Article } from "@/lib/content";

export function AppSidebar({
  articles,
  activeId,
}: {
  articles: Article[];
  activeId: string;
}) {
  const { setOpenMobile } = useSidebar();
  const pathname = usePathname();
  return (
    <Sidebar collapsible="offcanvas" aria-label="Posts">
      <SidebarHeader className="app-sidebar-header h-14 flex-row items-center justify-between px-4 py-0">
        <Brand />
        <SidebarTrigger />
      </SidebarHeader>
      <SidebarContent className="app-sidebar-content gap-4 px-3 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="import-post-button" asChild>
              <Link href="/import" onClick={() => setOpenMobile(false)}>
                <Plus />
                <span>Import post</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/schedule"}>
              <Link href="/schedule" onClick={() => setOpenMobile(false)}>
                <CalendarDays />
                <span>Schedule</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu aria-label="Imported posts">
          {articles.map((article) => (
            <SidebarMenuItem key={article.id}>
              <SidebarMenuButton
                isActive={article.id === activeId}
                aria-current={article.id === activeId ? "page" : undefined}
                asChild
                title={article.title}
              >
                <Link
                  href={`/posts/${encodeURIComponent(article.id)}`}
                  onClick={() => setOpenMobile(false)}
                >
                  <FileText />
                  <span>{article.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="app-sidebar-footer p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/settings"}>
              <Link href="/settings" onClick={() => setOpenMobile(false)}>
                <Settings2 />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
