import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Receipt,
  Tags,
  Wallet,
  LogOut,
  Users,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/split", label: "SpendWise Split", icon: Users },
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/budgets", label: "Budgets", icon: Wallet },
  { to: "/categories", label: "Categories", icon: Tags },
];

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="flex min-h-screen flex-col bg-paper md:flex-row">
      {/* Mobile Top Navigation Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink/10 bg-ink px-4 py-3 text-paper md:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-md text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-ledger"
            aria-label="Open navigation menu"
          >
            <Menu size={22} />
          </button>
          <div>
            <span className="font-display text-lg font-semibold tracking-tight text-white">
              Spendwise
            </span>
            <span className="ml-2 rounded bg-ledger/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ledger-light">
              Ledger
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ledger font-display text-xs font-bold text-white shadow-sm">
            {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
          </div>
        </div>
      </header>

      {/* Mobile Drawer Backdrop & Slide-out Sidebar */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity md:hidden"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[82vw] flex-col justify-between bg-ink text-paper shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <p className="font-display text-xl font-semibold tracking-tight text-white">
                Spendwise
              </p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                money dashboard
              </p>
            </div>
            <button
              onClick={closeMobileMenu}
              className="flex h-9 w-9 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Close navigation menu"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="mt-3 flex flex-col gap-1 px-3">
            {navItems.map(({ to, label, icon: Icon, end }) => {
              const isActive = end
                ? location.pathname === to
                : location.pathname.startsWith(to);

              return (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={closeMobileMenu}
                  className={`flex items-center gap-3 rounded-md px-3.5 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-ledger text-white shadow-sm"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={19} strokeWidth={1.8} />
                  {label}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="px-2">
            <p className="truncate text-sm font-medium text-white/90">
              {user?.name}
            </p>
            <p className="truncate text-xs text-white/40">{user?.email}</p>
          </div>
          <button
            onClick={() => {
              closeMobileMenu();
              handleLogout();
            }}
            className="mt-3 flex w-full items-center gap-2.5 rounded-md px-2 py-2.5 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-rust-light"
          >
            <LogOut size={17} strokeWidth={1.8} />
            Log out
          </button>
        </div>
      </aside>

      {/* Desktop Sidebar (Preserved exactly as before for >= md screens) */}
      <aside className="hidden w-60 shrink-0 flex-col justify-between bg-ink text-paper md:flex">
        <div>
          <div className="border-b border-white/10 px-6 py-6">
            <p className="font-display text-2xl font-semibold tracking-tight">
              Spendwise
            </p>
            <p className="mt-0.5 text-xs uppercase tracking-[0.2em] text-white/40">
              money dashboard
            </p>
          </div>
          <nav className="mt-4 flex flex-col gap-1 px-3">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "bg-ledger/90 text-white"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                <Icon size={17} strokeWidth={1.75} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="border-t border-white/10 p-4">
          <p className="truncate px-2 text-sm font-medium text-white/90">
            {user?.name}
          </p>
          <p className="truncate px-2 text-xs text-white/40">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="mt-3 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-rust-light"
          >
            <LogOut size={16} strokeWidth={1.75} />
            Log out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
