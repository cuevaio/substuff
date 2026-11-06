"use client";

import { FileText, Plus, Settings2 } from "lucide-react";
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
  onSelect,
  onImport,
  onSettings,
}: {
  articles: Article[];
  activeId: string;
  onSelect: (id: string) => void;
  onImport: () => void;
  onSettings: () => void;
}) {
  const { setOpenMobile } = useSidebar();
  function action(callback: () => void) {
    setOpenMobile(false);
    callback();
  }
  return (
    <Sidebar collapsible="offcanvas" aria-label="Posts">
      <SidebarHeader className="app-sidebar-header h-20 flex-row items-center justify-between px-6 py-0">
        <Brand />
        <SidebarTrigger />
      </SidebarHeader>
      <SidebarContent className="app-sidebar-content gap-6 px-4 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="import-post-button"
              onClick={() => action(onImport)}
            >
              <Plus />
              <span>Import post</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu aria-label="Imported posts">
          {articles.map((article) => (
            <SidebarMenuItem key={article.id}>
              <SidebarMenuButton
                isActive={article.id === activeId}
                aria-current={article.id === activeId ? "page" : undefined}
                onClick={() => action(() => onSelect(article.id))}
                title={article.title}
              >
                <FileText />
                <span>{article.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="app-sidebar-footer p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => action(onSettings)}>
              <Settings2 />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
