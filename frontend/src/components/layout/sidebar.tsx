import { NavLink } from "react-router-dom";
import {
  Activity,
  Box,
  CheckCircle2,
  Cpu,
  LayoutDashboard,
  Server,
} from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/queue", label: "Queue", icon: Box, end: false },
  { to: "/completed", label: "Completed", icon: CheckCircle2, end: false },
  { to: "/workers", label: "Workers", icon: Cpu, end: false },
  { to: "/system", label: "System", icon: Server, end: false },
];

export function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r bg-card md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2 border-b px-5">
        <Activity className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold">Render Server</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive && "bg-accent text-accent-foreground",
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
