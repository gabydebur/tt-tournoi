import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { displayApi } from '../api/display';
import type { DisplayState, DisplayActiveMatch, DisplayActiveSeries } from '../types';
import { Trophy, Radio, Users, Target } from 'lucide-react';

function MatchCard({ match }: { match: DisplayActiveMatch }) {
  const p1Sets = match.sets.filter((s) => s.score_player1 > s.score_player2).length;
  const p2Sets = match.sets.filter((s) => s.score_player2 > s.score_player1).length;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-400 text-black px-3 py-1 rounded-lg font-extrabold text-xl">
            T{match.table_number}
          </div>
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-yellow-400">
              {match.series_name}
            </div>
            <div className="text-xs text-gray-400">{match.pool_name}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs font-medium text-red-400">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          LIVE
        </div>
      </div>

      {/* Players and score */}
      <div className="space-y-3">
        {/* Player 1 */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-3xl font-bold truncate">
              {match.player1.first_name} {match.player1.last_name}
            </div>
            <div className="text-sm text-gray-400">{match.player1.points} pts</div>
          </div>
          <div className="text-5xl font-bold tabular-nums text-yellow-400">
            {p1Sets}
          </div>
        </div>

        {/* Player 2 */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-3xl font-bold truncate">
              {match.player2.first_name} {match.player2.last_name}
            </div>
            <div className="text-sm text-gray-400">{match.player2.points} pts</div>
          </div>
          <div className="text-5xl font-bold tabular-nums text-yellow-400">
            {p2Sets}
          </div>
        </div>
      </div>

      {/* Sets breakdown */}
      {match.sets.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-800">
          {match.sets.map((s, i) => (
            <span
              key={i}
              className="text-lg font-mono font-semibold px-3 py-1 rounded bg-gray-800 text-gray-200"
            >
              {s.score_player1}-{s.score_player2}
            </span>
          ))}
        </div>
      )}

      {/* Current live set */}
      <div className="mt-4 pt-4 border-t border-gray-800">
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">
          Set en cours
        </div>
        <div className="text-4xl font-bold tabular-nums text-yellow-400">
          {match.current_set_score.p1}
          <span className="mx-3 text-gray-500">–</span>
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
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-lg">{series.name}</div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            series.phase === 'POOLS'
              ? 'bg-blue-500/20 text-blue-300'
              : 'bg-purple-500/20 text-purple-300'
          }`}
        >
          {series.phase === 'POOLS' ? (
            <span className="flex items-center gap-1">
              <Users size={11} /> Poules
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Target size={11} /> Élimination
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
        <span>Poules en cours</span>
        <span className="tabular-nums">
          {series.pools_in_progress} / {series.pools_total}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-yellow-400 transition-all"
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
  const tournamentId = Number(idFromRoute ?? id);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data } = useQuery({
    queryKey: ['display-state', tournamentId],
    queryFn: () => displayApi.getState(tournamentId),
    enabled: !!tournamentId && !Number.isNaN(tournamentId),
    refetchInterval: 2000,
  });

  const state = data as DisplayState | undefined;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 bg-black border-b border-gray-800">
        <div className="flex items-center gap-4">
          <Trophy size={36} className="text-yellow-400" />
          <div>
            <div className="font-extrabold text-3xl leading-tight">
              {state?.tournament.name ?? 'Tournoi'}
            </div>
            <div className="text-sm text-gray-400">Écran public — TT Tournoi</div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-red-400 text-sm font-semibold">
            <Radio size={16} className="animate-pulse" />
            <span className="bg-red-500 text-white px-3 py-1 rounded-lg uppercase tracking-widest">
              En direct
            </span>
          </div>
          <div className="text-5xl font-mono font-bold text-yellow-400 tabular-nums">
            {clock.toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Matches grid */}
        <main className="flex-1 overflow-y-auto p-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 mb-4">
            Matchs en cours
          </h2>
          {!state || state.active_matches.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-600 text-xl">
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

        {/* Active series sidebar */}
        <aside className="w-80 flex-shrink-0 border-l border-gray-800 bg-black overflow-y-auto p-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 mb-4">
            Séries actives
          </h2>
          {!state || state.active_series.length === 0 ? (
            <p className="text-gray-600 text-sm">Aucune série active</p>
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
