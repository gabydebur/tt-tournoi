import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  Trophy,
  LogOut,
  User,
  Shield,
  Clipboard,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems: NavItem[] = [];
  if (role === 'PLAYER') {
    navItems.push({ to: '/player', label: 'Mon espace', icon: <User size={16} /> });
  }
  if (role === 'REFEREE') {
    navItems.push({ to: '/referee', label: 'Arbitrage', icon: <Clipboard size={16} /> });
  }
  if (role === 'ADMIN') {
    navItems.push({ to: '/admin', label: 'Administration', icon: <Shield size={16} /> });
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col">
      {/* Header — sleek dark pill sitting on a light app shell */}
      <header className="sticky top-0 z-30 bg-[#0b0d17]/95 backdrop-blur-xl text-slate-100 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 font-semibold">
              <span className="relative">
                <span className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-fuchsia-500 rounded-lg blur-md opacity-50" />
                <span className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500">
                  <Trophy size={16} className="text-white" strokeWidth={2.5} />
                </span>
              </span>
              <span className="font-display text-lg tracking-tight">
                <span className="text-gradient-violet">TT Tournoi</span>
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const active = location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                      active
                        ? 'bg-white/10 text-white shadow-inner shadow-violet-500/20'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* User info & logout */}
            <div className="hidden md:flex items-center gap-3">
              {user && (
                <span className="text-xs text-slate-300 flex items-center gap-2">
                  <span className="text-slate-400">
                    {user.player?.first_name} {user.player?.last_name}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-violet-200">
                    {role}
                  </span>
                </span>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-sm text-slate-300 hover:text-white transition-colors"
              >
                <LogOut size={16} />
                <span className="sr-only md:not-sr-only">Déconnexion</span>
              </button>
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 text-slate-200"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/5 px-4 pb-4 pt-2 space-y-1 bg-[#0b0d17]">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-200 hover:bg-white/5"
                onClick={() => setMobileOpen(false)}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-200 hover:bg-white/5 w-full text-left"
            >
              <LogOut size={16} />
              Déconnexion
            </button>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-white/60 backdrop-blur-sm border-t border-slate-200 py-3 text-center text-xs text-slate-400">
        TT Tournoi &copy; {new Date().getFullYear()} — Gestion de tournois de tennis de table
      </footer>
    </div>
  );
}
