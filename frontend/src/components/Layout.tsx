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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-blue-600 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 font-bold text-xl">
              <Trophy size={24} className="text-yellow-400" />
              <span>TT Tournoi</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-4">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    location.pathname.startsWith(item.to)
                      ? 'bg-blue-700 text-white'
                      : 'text-blue-100 hover:bg-blue-500'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* User info & logout */}
            <div className="hidden md:flex items-center gap-3">
              {user && (
                <span className="text-sm text-blue-100">
                  {user.player?.first_name} {user.player?.last_name}
                  <span className="ml-1 text-xs bg-blue-500 px-1.5 py-0.5 rounded">{role}</span>
                </span>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-sm text-blue-100 hover:text-white transition-colors"
              >
                <LogOut size={16} />
                Déconnexion
              </button>
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-blue-500 px-4 pb-4 pt-2 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-blue-100 hover:bg-blue-500"
                onClick={() => setMobileOpen(false)}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-blue-100 hover:bg-blue-500 w-full text-left"
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

      <footer className="bg-white border-t border-gray-200 py-3 text-center text-xs text-gray-400">
        TT Tournoi &copy; {new Date().getFullYear()} — Gestion de tournois de tennis de table
      </footer>
    </div>
  );
}
