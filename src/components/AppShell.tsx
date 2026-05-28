import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { LayoutDashboard, Package, MapPin, Warehouse, ArrowLeftRight, FileText, BookOpen, Download, Settings, LogOut } from "lucide-react";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/items", label: "Items", icon: Package },
  { to: "/locations", label: "Locations", icon: MapPin },
  { to: "/stock", label: "Stock on hand", icon: Warehouse },
  { to: "/movements", label: "Movements", icon: ArrowLeftRight },
  { to: "/purchase-orders", label: "Purchase orders", icon: FileText },
  { to: "/journals", label: "Journals", icon: BookOpen },
  { to: "/exports", label: "Exports", icon: Download },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const { user, signOut, roles } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="text-base font-semibold tracking-tight">Inventory Control</div>
          <div className="text-xs text-sidebar-foreground/60 mt-0.5">Xero · Precoro · Syft</div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = path.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3 text-xs">
          <div className="px-2 py-1 truncate" title={user?.email ?? ""}>{user?.email}</div>
          <div className="px-2 pb-2 text-sidebar-foreground/60">
            {roles.length ? roles.join(", ") : "no role"}
          </div>
          <button
            onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-sidebar-accent/60"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}