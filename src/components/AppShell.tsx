import { Link, useMatchRoute } from "@tanstack/react-router";
import { Home, Users, FolderOpen, FileText, LogOut, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { logout } from "../lib/api";
import { useMe } from "../lib/client";

const TABS: { to: string; icon: LucideIcon; label: string; color: string }[] = [
  { to: "/", icon: Home, label: "Home", color: "text-indigo-600 bg-indigo-100" },
  { to: "/applicants", icon: Users, label: "People", color: "text-emerald-600 bg-emerald-100" },
  { to: "/library", icon: FolderOpen, label: "Library", color: "text-amber-600 bg-amber-100" },
  { to: "/form", icon: FileText, label: "Form", color: "text-rose-600 bg-rose-100" },
];

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const match = useMatchRoute();
  const meQuery = useMe();
  const role = meQuery.data?.role;

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
        <img src="/favicon.ico" alt="" className="h-9 w-9 rounded-lg" />
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-slate-900">{title}</h1>
        {role && (
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                role === "admin" ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-600"
              }`}
            >
              {role === "admin" ? "Admin" : "Agent"}
            </span>
            <button
              onClick={() => logout().then(() => window.location.assign("/login"))}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-stretch justify-around px-2 py-2">
          {TABS.map(({ to, icon: Icon, label, color }) => {
            const active = !!match({ to, fuzzy: to === "/" ? false : true });
            return (
              <Link
                key={to}
                to={to}
                className={`flex min-w-16 flex-col items-center gap-1 rounded-2xl px-4 py-2 transition-colors ${
                  active ? color : "text-slate-400"
                }`}
              >
                <Icon className="h-6 w-6" strokeWidth={2.4} />
                <span className="text-[11px] font-semibold">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
