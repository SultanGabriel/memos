import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

export default function WhiteboardSidebarToggle({ desktop, inDrawer = false }: { desktop: boolean; inDrawer?: boolean }) {
  const { desktopCollapsed, setDesktopCollapsed, mobileOpen, setMobileOpen } = useAppSidebar();
  const t = useTranslate();
  const open = desktop ? !desktopCollapsed : mobileOpen;
  if (!desktop && !inDrawer && mobileOpen) return null;
  const Arrow = open ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <div
      className={cn(
        "top-1/2 z-40 -translate-y-1/2",
        inDrawer ? "absolute end-0 translate-x-full rtl:-translate-x-full" : "fixed",
      )}
      style={inDrawer ? undefined : { insetInlineStart: desktop && open ? "var(--app-sidebar-width)" : "env(safe-area-inset-left, 0px)" }}
    >
      <Button
        variant="outline"
        size="icon-compact"
        aria-label={t(open ? "whiteboards.sidebar-collapse" : "whiteboards.sidebar-expand")}
        aria-expanded={open}
        onClick={() => desktop ? setDesktopCollapsed(open) : setMobileOpen(!open)}
      >
        <Arrow className="size-4 rtl:rotate-180" />
      </Button>
    </div>
  );
}
