import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { cx } from "./UI";
import Logo from "./Logo";

const ROLE_LABEL = {
  admin: "Administrator",
  manufacturer: "Manufacturer",
  distributor: "Distributor",
  pharmacist: "Pharmacist",
  customer: "Customer",
};

const ROLE_ACCENT = {
  admin: "from-ink-800 to-ink-900",
  manufacturer: "from-brand-700 to-brand-900",
  distributor: "from-blue-700 to-blue-900",
  pharmacist: "from-purple-700 to-purple-900",
  customer: "from-teal-600 to-teal-800",
};

export default function Layout({ nav, active, onNavigate, title, subtitle, headerAction, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const initials = (user?.name || "U").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const role = user?.role || "customer";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const NavList = () => (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
      {nav.map((item) => (
        <button
          key={item.id}
          onClick={() => {
            onNavigate(item.id);
            setOpen(false);
          }}
          className={cx(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
            active === item.id
              ? "bg-white/15 text-white shadow-inner"
              : "text-white/70 hover:bg-white/10 hover:text-white"
          )}
        >
          <span className="text-base">{item.icon}</span>
          <span className="flex-1 text-left">{item.label}</span>
          {item.count > 0 && (
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-ink-900">{item.count}</span>
          )}
        </button>
      ))}
    </nav>
  );

  const SidebarInner = () => (
    <div className={cx("flex h-full flex-col bg-gradient-to-b", ROLE_ACCENT[role])}>
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white shadow-sm">
          <Logo className="h-8 w-8" />
        </span>
        <div>
          <p className="text-base font-bold leading-tight text-white">MedSure</p>
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/60">{ROLE_LABEL[role]}</p>
        </div>
      </div>
      <NavList />
      <div className="mt-auto px-3 pb-4">
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-xs font-bold text-ink-900">{initials}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
            <p className="truncate text-[11px] text-white/60">{user?.org_name || user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
        >
          ↪ Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarInner />
      </aside>

      {/* Mobile drawer */}
      {open && <div className="fixed inset-0 z-40 bg-ink-900/50 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarInner />
      </aside>

      {/* Content */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-ink-100 bg-white/85 backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 py-3.5 sm:px-6">
            <button
              className="grid h-10 w-10 place-items-center rounded-xl bg-ink-100 text-lg lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              ☰
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold text-ink-900">{title}</h1>
              {subtitle && <p className="truncate text-xs text-ink-500">{subtitle}</p>}
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">{initials}</span>
              <div className="hidden text-right md:block">
                <p className="text-sm font-semibold leading-tight text-ink-800">{user?.name}</p>
                <p className="text-[11px] text-ink-400">{ROLE_LABEL[role]}</p>
              </div>
            </div>
            {headerAction}
          </div>
        </header>

        <main key={active} className="animate-fade-up px-4 py-5 sm:px-6 sm:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
