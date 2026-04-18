import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStytch } from '@stytch/react';
import { authApi } from '../api/auth';
import { useAuth } from '../hooks/useAuth';
import type { Role } from '../types';
import { Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

const DESTINATIONS: Record<Role, string> = {
  PLAYER: '/player',
  REFEREE: '/referee',
  ADMIN: '/admin',
};

type TokenType =
  | 'magic_links'
  | 'oauth'
  | 'reset_password'
  | 'signup'
  | 'login'
  | 'discovery'
  | string;

export default function Authenticate() {
  const stytch = useStytch();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setBackendToken } = useAuth();
  const [status, setStatus] = useState<'authenticating' | 'exchanging' | 'done' | 'error'>(
    'authenticating'
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const token = searchParams.get('token');
    const tokenType = (searchParams.get('stytch_token_type') ?? '') as TokenType;

    const run = async () => {
      if (!token) {
        setStatus('error');
        setErrorMsg('Aucun token Stytch dans l’URL.');
        return;
      }

      try {
        setStatus('authenticating');

        // Authenticate the token against Stytch — branching by type.
        let sessionJwt: string | undefined;

        if (tokenType === 'oauth') {
          const res = await stytch.oauth.authenticate(token, {
            session_duration_minutes: 60 * 24,
          });
          sessionJwt = res.session_jwt;
        } else if (tokenType === 'magic_links' || tokenType === 'login' || tokenType === 'signup') {
          const res = await stytch.magicLinks.authenticate(token, {
            session_duration_minutes: 60 * 24,
          });
          sessionJwt = res.session_jwt;
        } else {
          // Best-effort fallback — try magic links.
          const res = await stytch.magicLinks.authenticate(token, {
            session_duration_minutes: 60 * 24,
          });
          sessionJwt = res.session_jwt;
        }

        if (!sessionJwt) {
          // Maybe the SDK stored the session — try reading its tokens.
          const tokens = stytch.session.getTokens();
          sessionJwt = (tokens as { session_jwt?: string } | null)?.session_jwt ?? undefined;
        }

        if (!sessionJwt) {
          throw new Error('Session Stytch introuvable après authentification.');
        }

        setStatus('exchanging');

        const { access_token } = await authApi.stytchExchange(sessionJwt);
        await setBackendToken(access_token);

        // Decode role from backend JWT to choose destination.
        let role: Role | null = null;
        try {
          const payload = JSON.parse(atob(access_token.split('.')[1]));
          role = payload.role as Role;
        } catch {
          role = null;
        }

        setStatus('done');
        navigate(role ? DESTINATIONS[role] : '/player', { replace: true });
      } catch (e) {
        setStatus('error');
        const msg = e instanceof Error ? e.message : 'Erreur inconnue';
        setErrorMsg(msg);
      }
    };

    run();
  }, [searchParams, stytch, setBackendToken, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0f] text-slate-100 flex items-center justify-center p-4">
      {/* blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full opacity-60 animate-blob-slow"
          style={{
            background: 'radial-gradient(circle, rgba(99,102,241,0.7) 0%, rgba(99,102,241,0) 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute -bottom-40 -right-20 w-[520px] h-[520px] rounded-full opacity-50 animate-blob-slower"
          style={{
            background: 'radial-gradient(circle, rgba(217,70,239,0.65) 0%, rgba(217,70,239,0) 70%)',
            filter: 'blur(90px)',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        <div className="glass-card rounded-3xl p-10 text-center">
          {status === 'error' ? (
            <>
              <div className="mx-auto w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-5">
                <AlertCircle size={28} className="text-red-300" />
              </div>
              <h1 className="font-display text-2xl font-semibold text-gradient-violet mb-2">
                Authentification échouée
              </h1>
              <p className="text-sm text-slate-400 mb-6">{errorMsg}</p>
              <button
                onClick={() => navigate('/login', { replace: true })}
                className="btn-gradient w-full py-2.5 rounded-xl text-sm"
              >
                Retour à la connexion
              </button>
            </>
          ) : status === 'done' ? (
            <>
              <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-5">
                <CheckCircle2 size={28} className="text-emerald-300" />
              </div>
              <h1 className="font-display text-2xl font-semibold text-gradient-violet mb-2">
                Bienvenue
              </h1>
              <p className="text-sm text-slate-400">Redirection en cours…</p>
            </>
          ) : (
            <>
              <div className="mx-auto w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center mb-5">
                <Sparkles size={28} className="text-violet-300 animate-pulse" />
              </div>
              <h1 className="font-display text-2xl font-semibold text-gradient-violet mb-2">
                {status === 'authenticating' ? 'Authentification…' : 'Finalisation…'}
              </h1>
              <p className="text-sm text-slate-400">
                {status === 'authenticating'
                  ? 'Vérification du lien magique auprès de Stytch'
                  : 'Création de votre session TT Tournoi'}
              </p>
              <div className="mt-6 flex justify-center">
                <div className="w-8 h-8 border-2 border-violet-400/40 border-t-violet-400 rounded-full animate-spin" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
