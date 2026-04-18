import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { displayApi } from '../api/display';
import type { DisplayState, DisplayActiveMatch, DisplayActiveSeries } from '../types';
import { Trophy, Users, Target } from 'lucide-react';

function MatchCard({ match }: { match: DisplayActiveMatch }) {
  const p1Sets = match.sets.filter((s) => s.score_player1 > s.score_player2).length;
  const p2Sets = match.sets.filter((s) => s.score_player2 > s.score_player1).length;
  const hasLiveSet = match.current_set_score.p1 > 0 || match.current_set_score.p2 > 0;

  return (
    <div
      className={`relative rounded-3xl p-6 bg-white/[0.03] backdrop-blur-2xl border ${
        hasLiveSet
          ? 'border-cyan-400/40 shadow-[0_0_60px_-15px_rgba(34,211,238,0.5)]'
          : 'border-white/10 shadow-[0_0_60px_-20px_rgba(99,102,241,0.3)]'
      } transition-all`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-fuchsia-500 rounded-xl blur-md opacity-60" />
            <div className="relative bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white w-12 h-12 rounded-xl font-display font-bold text-2xl flex items-center justify-center">
              T{match.table_number}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-gradient-bright">
              {match.series_name}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{match.pool_name}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-cyan-300 uppercase tracking-widest px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
          Live
        </div>
      </div>

      {/* Players and score */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="font-display text-3xl font-semibold truncate text-slate-50">
              {match.player1.first_name} {match.player1.last_name}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 tabular-nums">{match.player1.points} pts</div>
          </div>
          <div className="text-6xl font-display font-bold tabular-nums text-gradient-bright">
            {p1Sets}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="font-display text-3xl font-semibold truncate text-slate-50">
              {match.player2.first_name} {match.player2.last_name}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 tabular-nums">{match.player2.points} pts</div>
          </div>
          <div className="text-6xl font-display font-bold tabular-nums text-gradient-bright">
            {p2Sets}
          </div>
        </div>
      </div>

      {/* Sets breakdown */}
      {match.sets.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-white/5">
          {match.sets.map((s, i) => (
            <span
              key={i}
              className="text-sm font-mono font-medium px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-slate-300 tabular-nums"
            >
              {s.score_player1}–{s.score_player2}
            </span>
          ))}
        </div>
      )}

      {/* Current live set */}
      <div className="mt-5 pt-5 border-t border-white/5">
        <div className="text-[10px] text-slate-500 uppercase tracking-[0.25em] mb-2">
          Set en cours
        </div>
        <div className="text-7xl font-display font-bold tabular-nums text-gradient-bright leading-none">
          {match.current_set_score.p1}
          <span className="mx-4 text-slate-700">–</span>
          {match.current_set_score.p2}
        </div>
      </div>
    </div>
  );
}

function ActiveSeriesRow({ series }: { series: DisplayActiveSeries }) {
  const pct =
    series.pools_total > 0
      ? Math.round((series.pools_in_progress / series.pools_total) * 100)
      : 0;

  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-xl p-3.5 transition-all hover:border-white/20">
      <div className="flex items-center justify-between mb-2">
        <div className="font-display font-semibold text-base text-slate-100">{series.name}</div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider border ${
            series.phase === 'POOLS'
              ? 'bg-indigo-500/10 text-indigo-300 border-indigo-400/30'
              : 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-400/30'
          }`}
        >
          {series.phase === 'POOLS' ? (
            <span className="flex items-center gap-1">
              <Users size={10} /> Poules
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Target size={10} /> Élim.
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
        <span>Poules en cours</span>
        <span className="tabular-nums">
          {series.pools_in_progress} / {series.pools_total}
        </span>
      </div>
      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-400 via-violet-500 to-fuchsia-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function LiveDisplay() {
  const { id, tournamentId: idFromRoute } = useParams<{
    id?: string;
    tournamentId?: string;
  }>();
  const tournamentId = idFromRoute ?? id ?? '';
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data } = useQuery({
    queryKey: ['display-state', tournamentId],
    queryFn: () => displayApi.getState(tournamentId),
    enabled: !!tournamentId,
    refetchInterval: 2000,
  });

  const state = data as DisplayState | undefined;

  return (
    <div className="min-h-screen bg-black text-slate-50 flex flex-col relative overflow-hidden">
      {/* Aurora backdrop */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-[40vh] opacity-60 animate-aurora"
        style={{
          background:
            'linear-gradient(90deg, rgba(99,102,241,0.25) 0%, rgba(34,211,238,0.2) 25%, rgba(217,70,239,0.25) 50%, rgba(99,102,241,0.25) 75%, rgba(34,211,238,0.2) 100%)',
          backgroundSize: '200% 100%',
          filter: 'blur(100px)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/5 backdrop-blur-xl bg-black/40">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-fuchsia-500 rounded-xl blur-lg opacity-50" />
            <div className="relative bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 rounded-xl p-2.5">
              <Trophy size={28} className="text-white" strokeWidth={2.25} />
            </div>
          </div>
          <div>
            <div className="font-display font-semibold text-3xl leading-tight text-gradient-violet">
              {state?.tournament.name ?? 'Tournoi'}
            </div>
            <div className="text-xs text-slate-500 uppercase tracking-widest mt-0.5">
              TT Tournoi — écran public
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* EN DIRECT pill */}
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-400/30">
            <span className="relative flex items-center justify-center w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75" />
              <span className="relative rounded-full bg-red-400 w-2 h-2" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-red-200">
              En direct
            </span>
          </div>
          <div className="font-mono text-5xl font-bold tabular-nums text-gradient-bright leading-none">
            {clock.toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="relative z-10 flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto dark-scroll p-6">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-500 mb-5">
            Matchs en cours
          </h2>
          {!state || state.active_matches.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-600 text-xl font-display">
              Aucun match en cours
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-5">
              {state.active_matches.map((m, idx) => (
                <MatchCard key={`${m.table_number}-${idx}`} match={m} />
              ))}
            </div>
          )}
        </main>

        <aside className="w-80 flex-shrink-0 border-l border-white/5 bg-black/40 backdrop-blur-xl overflow-y-auto dark-scroll p-6">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-500 mb-5">
            Séries actives
          </h2>
          {!state || state.active_series.length === 0 ? (
            <p className="text-slate-600 text-sm">Aucune série active</p>
          ) : (
            <div className="space-y-3">
              {state.active_series.map((s) => (
                <ActiveSeriesRow key={s.id} series={s} />
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
