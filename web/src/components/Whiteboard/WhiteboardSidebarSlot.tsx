import { useEffect, useRef } from "react";
import { useAppSidebar } from "@/contexts/AppSidebarContext";

/** The route portals its controls here; the canvas remains owned by the route. */
export default function WhiteboardSidebarSlot() {
  const target = useRef<HTMLDivElement>(null);
  const { registerWhiteboardSidebarTarget } = useAppSidebar();
  useEffect(() => {
    if (target.current) return registerWhiteboardSidebarTarget(target.current);
  }, [registerWhiteboardSidebarTarget]);
  return <div ref={target} />;
}
