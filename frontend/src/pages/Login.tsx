import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { StytchLogin, Products } from '@stytch/react';
import type { StytchLoginConfig } from '@stytch/react';
import { OTPMethods } from '@stytch/vanilla-js';
import { useAuth } from '../hooks/useAuth';
import { Trophy, Mail, Lock, AlertCircle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

const DESTINATIONS = { PLAYER: '/player', REFEREE: '/referee', ADMIN: '/admin' } as const;

const REDIRECT_URL = 'http://localhost:3000/authenticate';

// Stytch UI config — modern 2026 feel, aligned with our palette.
const stytchConfig: StytchLoginConfig = {
  products: [Products.emailMagicLinks, Products.passwords, Products.otp],
  emailMagicLinksOptions: {
    loginRedirectURL: REDIRECT_URL,
    signupRedirectURL: REDIRECT_URL,
    loginExpirationMinutes: 60,
    signupExpirationMinutes: 60,
  },
  otpOptions: {
    methods: [OTPMethods.Email],
    expirationMinutes: 5,
  },
  passwordOptions: {
    loginRedirectURL: REDIRECT_URL,
    resetPasswordRedirectURL: REDIRECT_URL,
    resetPasswordExpirationMinutes: 30,
  },
};

// Style overrides — blends Stytch UI into the dark glass card.
const stytchStyles = {
  container: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  colors: {
    primary: '#a78bfa',
    secondary: 'rgba(248, 250, 252, 0.7)',
    success: '#22d3ee',
    error: '#f87171',
  },
  buttons: {
    primary: {
      backgroundColor: '#7c3aed',
      textColor: '#ffffff',
      borderColor: 'transparent',
      borderRadius: '12px',
    },
    secondary: {
      backgroundColor: 'rgba(255,255,255,0.04)',
      textColor: '#f8fafc',
      borderColor: 'rgba(255,255,255,0.12)',
      borderRadius: '12px',
    },
  },
  inputs: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: '12px',
    placeholderColor: 'rgba(248, 250, 252, 0.4)',
    textColor: '#f8fafc',
  },
  fontFamily: '"Inter", system-ui, sans-serif',
  hideHeaderText: false,
};

export default function Login() {
  const { login, isAuthenticated, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

  const [showDemo, setShowDemo] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && role) {
      navigate(from || DESTINATIONS[role] || '/player', { replace: true });
    }
  }, [isAuthenticated, role, from, navigate]);

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(email, password);
    } catch {
      setError('Email ou mot de passe incorrect.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0f] text-slate-100 flex items-center justify-center p-4">
      {/* Animated gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full opacity-60 animate-blob-slow"
          style={{
            background: 'radial-gradient(circle, rgba(99,102,241,0.7) 0%, rgba(99,102,241,0) 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute -bottom-48 -right-32 w-[560px] h-[560px] rounded-full opacity-50 animate-blob-slower"
          style={{
            background: 'radial-gradient(circle, rgba(217,70,239,0.65) 0%, rgba(217,70,239,0) 70%)',
            filter: 'blur(90px)',
          }}
        />
        <div
          className="absolute top-1/3 left-1/2 w-[380px] h-[380px] rounded-full opacity-30 animate-blob-slow"
          style={{
            background: 'radial-gradient(circle, rgba(34,211,238,0.6) 0%, rgba(34,211,238,0) 70%)',
            filter: 'blur(70px)',
          }}
        />
      </div>

      {/* Grid overlay for texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        {/* Card */}
        <div className="glass-card rounded-3xl p-8 sm:p-10">
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-fuchsia-500 rounded-2xl blur-lg opacity-60" />
              <div className="relative bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 rounded-2xl p-3 shadow-lg">
                <Trophy size={28} className="text-white" strokeWidth={2.25} />
              </div>
            </div>
            <h1 className="font-display text-4xl font-semibold text-gradient-violet">
              TT Tournoi
            </h1>
            <p className="mt-2 text-sm text-slate-400 flex items-center gap-1.5">
              <Sparkles size={13} className="text-violet-300" />
              Le tournoi nouvelle génération
            </p>
          </div>

          {/* Stytch widget */}
          <div className="stytch-dark-theme rounded-2xl overflow-hidden">
            <StytchLogin config={stytchConfig} styles={stytchStyles} />
          </div>

          {/* Admin demo panel */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <button
              type="button"
              onClick={() => setShowDemo((s) => !s)}
              className="w-full flex items-center justify-between text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Lock size={12} />
                Connexion admin (demo)
              </span>
              {showDemo ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showDemo && (
              <form onSubmit={handleDemoSubmit} className="mt-4 space-y-3 animate-fade-in-up">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1 uppercase tracking-wider">
                    Email
                  </label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent"
                      placeholder="admin@admin.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1 uppercase tracking-wider">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                    <AlertCircle size={14} />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-gradient w-full py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading && (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  Se connecter en admin
                </button>
                <p className="text-[11px] text-slate-500 text-center">
                  Compte seedé : <code className="font-mono">admin@admin.com / admin</code>
                </p>
              </form>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            Pas encore de compte ?{' '}
            <Link to="/register" className="text-violet-300 hover:text-violet-200 font-medium">
              Créer un profil joueur
            </Link>
          </p>

          <div className="mt-4 pt-4 border-t border-white/5 text-center">
            <Link to="/display/1" className="text-[11px] text-slate-500 hover:text-cyan-300 transition-colors">
              Tournoi en direct — affichage public
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[11px] text-slate-500">
          powered by <span className="text-slate-400 font-medium">Stytch</span> · 2026
        </p>
      </div>
    </div>
  );
}
