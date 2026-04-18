import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { matchesApi } from '../api/matches';
import { poolsApi } from '../api/pools';
import { tournamentsApi } from '../api/tournaments';
import Layout from '../components/Layout';
import ResultModal from '../components/ResultModal';
import type {
  MatchSuggestions,
  SuggestionPoolBrief,
  SuggestionEliminationBrief,
  ActiveTableBrief,
  AvailableTableBrief,
  Match,
  Series,
} from '../types';
import {
  Play,
  RefreshCw,
  Users,
  Zap,
  Trophy,
  Target,
  ClipboardList,
} from 'lucide-react';

// ── Pool suggestion card ─────────────────────────────────────────────────────

function PoolSuggestionCard({
  pool,
  tables,
  onStart,
  isStarting,
}: {
  pool: SuggestionPoolBrief;
  tables: AvailableTableBrief[];
  onStart: (poolId: string, tableId: string) => void;
  isStarting: boolean;
}) {
  const [tableId, setTableId] = useState<string>('');

  return (
    <div className="glass-card-light rounded-xl p-3 transition-all hover:shadow-md hover:shadow-violet-500/10">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-violet-600 mb-1">
        {pool.series_name}
      </div>
      <div className="flex items-center gap-1.5 mb-2">
        <Users size={13} className="text-slate-500" />
        <div className="font-semibold text-slate-800 text-sm">{pool.name}</div>
      </div>
      <ul className="text-xs text-slate-600 space-y-0.5 mb-3">
        {pool.players.map((pl) => (
          <li key={pl.id} className="flex items-center justify-between">
            <span>{pl.first_name} {pl.last_name}</span>
            <span className="text-slate-400 tabular-nums">{pl.points} pts</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <select
          value={tableId}
          onChange={(e) => setTableId(e.target.value)}
          className="flex-1 text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white/80 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        >
          <option value="">Table...</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              Table {t.number}
            </option>
          ))}
        </select>
        <button
          disabled={!tableId || isStarting}
          onClick={() => tableId && onStart(pool.id, tableId)}
          className="btn-gradient flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isStarting ? (
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Play size={11} />
          )}
          Lancer
        </button>
      </div>
    </div>
  );
}

// ── Elimination suggestion card ──────────────────────────────────────────────

function EliminationSuggestionCard({
  match,
  tables,
  onStart,
  isStarting,
}: {
  match: SuggestionEliminationBrief;
  tables: AvailableTableBrief[];
  onStart: (matchId: string, tableId: string) => void;
  isStarting: boolean;
}) {
  const [tableId, setTableId] = useState<string>('');

  return (
    <div className="glass-card-light rounded-xl p-3 transition-all hover:shadow-md hover:shadow-fuchsia-500/10">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-fuchsia-600 mb-1">
        {match.series_name} · {match.round.replace(/_/g, ' ')}
      </div>
      <div className="text-sm text-slate-800 font-medium">
        {match.player1.first_name} {match.player1.last_name}
      </div>
      <div className="text-xs text-slate-400 my-0.5">vs</div>
      <div className="text-sm text-slate-800 font-medium mb-2">
        {match.player2.first_name} {match.player2.last_name}
      </div>
      <div className="flex items-center gap-2">
        <select
          value={tableId}
          onChange={(e) => setTableId(e.target.value)}
          className="flex-1 text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white/80 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        >
          <option value="">Table...</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              Table {t.number}
            </option>
          ))}
        </select>
        <button
          disabled={!tableId || isStarting}
          onClick={() => tableId && onStart(match.id, tableId)}
          className="btn-gradient flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isStarting ? (
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Play size={11} />
          )}
          Lancer
        </button>
      </div>
    </div>
  );
}

// ── Active table card ────────────────────────────────────────────────────────

function ActiveTableCard({
  table,
  onEnterResult,
}: {
  table: ActiveTableBrief;
  onEnterResult: (table: ActiveTableBrief) => void;
}) {
  const match = table.current_match;
  const pool = table.current_pool;
  const progress = table.pool_progress;
  const progressPct =
    progress.total > 0 ? Math.round((progress.played / progress.total) * 100) : 0;

  if (!match) {
    return (
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-slate-200/70 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
          <span className="font-display font-semibold text-lg text-slate-800">Table {table.number}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 ml-auto uppercase tracking-wider">
            Libre
          </span>
        </div>
        <p className="text-sm text-slate-400 text-center py-4">Aucun match en cours</p>
      </div>
    );
  }

  const p1Sets = match.sets.filter((s) => s.score_player1 > s.score_player2).length;
  const p2Sets = match.sets.filter((s) => s.score_player2 > s.score_player1).length;

  return (
    <div
      className="relative bg-white/80 backdrop-blur-xl rounded-2xl border border-cyan-300/60 p-4 shadow-lg shadow-cyan-400/10 transition-all hover:shadow-cyan-400/20"
    >
      <div className="absolute inset-0 pointer-events-none rounded-2xl ring-1 ring-inset ring-cyan-300/30" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] animate-pulse" />
          <span className="font-display font-semibold text-lg text-slate-800">Table {table.number}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 ml-auto flex items-center gap-1 uppercase tracking-wider">
            <Zap size={10} /> En cours
          </span>
        </div>

        {pool && (
          <div className="text-[10px] text-violet-600 font-semibold uppercase tracking-widest mb-2">
            {pool.series_name} · {pool.name}
          </div>
        )}

        <div className="space-y-1.5 mb-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm text-slate-800">
              {match.player1.first_name} {match.player1.last_name}
            </span>
            <span className="text-xl font-display font-semibold tabular-nums text-slate-900">{p1Sets}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm text-slate-800">
              {match.player2.first_name} {match.player2.last_name}
            </span>
            <span className="text-xl font-display font-semibold tabular-nums text-slate-900">{p2Sets}</span>
          </div>
        </div>

        {match.sets.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-3">
            {match.sets.map((s, i) => (
              <span
                key={i}
                className="text-xs rounded-md px-1.5 py-0.5 font-mono bg-slate-100 text-slate-600"
              >
                {s.score_player1}-{s.score_player2}
              </span>
            ))}
          </div>
        )}

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span>Progression poule</span>
            <span className="tabular-nums">
              {progress.played} / {progress.total}
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 via-violet-500 to-fuchsia-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <button
          onClick={() => onEnterResult(table)}
          className="btn-gradient w-full text-sm px-3 py-2 rounded-lg"
        >
          Saisir résultat
        </button>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function RefereeDashboard() {
  const queryClient = useQueryClient();
  const [activeTournamentId, setActiveTournamentId] = useState<string | null>(null);
  const [resultTable, setResultTable] = useState<ActiveTableBrief | null>(null);
  const [startingPoolId, setStartingPoolId] = useState<string | null>(null);
  const [startingMatchId, setStartingMatchId] = useState<string | null>(null);

  const { data: tournaments } = useQuery({
    queryKey: ['tournaments'],
    queryFn: tournamentsApi.list,
  });
  const activeTournaments = (tournaments ?? []).filter(
    (t) => t.status === 'IN_PROGRESS'
  );
  const tournamentId = activeTournamentId ?? activeTournaments[0]?.id ?? null;

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['suggestions', tournamentId],
    queryFn: () => matchesApi.suggestions(tournamentId!),
    enabled: !!tournamentId,
    refetchInterval: 3000,
  });

  const sug = (suggestions as MatchSuggestions | undefined) ?? {
    pools_to_start: [],
    eliminations_to_start: [],
    available_tables: [],
    active_tables: [],
  };

  const startPoolMutation = useMutation({
    mutationFn: ({ poolId, tableId }: { poolId: string; tableId: string }) =>
      poolsApi.start(poolId, tableId),
    onMutate: ({ poolId }) => setStartingPoolId(poolId),
    onSettled: () => {
      setStartingPoolId(null);
      queryClient.invalidateQueries({ queryKey: ['suggestions', tournamentId] });
    },
  });

  const startMatchMutation = useMutation({
    mutationFn: ({ matchId, tableId }: { matchId: string; tableId: string }) =>
      matchesApi.start(matchId, tableId),
    onMutate: ({ matchId }) => setStartingMatchId(matchId),
    onSettled: () => {
      setStartingMatchId(null);
      queryClient.invalidateQueries({ queryKey: ['suggestions', tournamentId] });
    },
  });

  // Build a minimal Match object for ResultModal from ActiveTableBrief
  const resultMatch: Match | null = resultTable?.current_match
    ? ({
        id: resultTable.current_match.id,
        tournament_id: tournamentId ?? '',
        series: {
          id: '',
          tournament_id: tournamentId ?? '',
          name: resultTable.current_pool?.series_name ?? '',
          max_points: 0,
          phase_format: 'POOLS_ONLY',
          sets_to_win_match: 3,
          sets_to_win_final: 3,
          players_per_pool: 4,
        } as Series,
        player1: {
          id: resultTable.current_match.player1.id,
          first_name: resultTable.current_match.player1.first_name,
          last_name: resultTable.current_match.player1.last_name,
          points: resultTable.current_match.player1.points,
          email: '',
        },
        player2: {
          id: resultTable.current_match.player2.id,
          first_name: resultTable.current_match.player2.first_name,
          last_name: resultTable.current_match.player2.last_name,
          points: resultTable.current_match.player2.points,
          email: '',
        },
        status: 'IN_PROGRESS',
        phase: 'POOL',
        round: 'POOL',
        sets: resultTable.current_match.sets,
        pool_name: resultTable.current_pool?.name,
      } as Match)
    : null;

  return (
    <Layout>
      <div className="flex h-[calc(100vh-4rem-2.5rem)] overflow-hidden bg-[#fafafa]">
        {/* LEFT: suggestions */}
        <aside className="w-72 flex-shrink-0 bg-white/60 backdrop-blur-sm border-r border-slate-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-display font-semibold text-slate-800 text-sm flex items-center gap-1.5">
              <ClipboardList size={15} /> À lancer
            </h2>
            <button
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ['suggestions', tournamentId] })
              }
              className="text-slate-400 hover:text-violet-500 transition-colors"
              title="Rafraîchir"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {!tournamentId ? (
              <p className="text-xs text-slate-400 text-center py-4">
                Aucun tournoi en cours
              </p>
            ) : isLoading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-violet-500 border-t-transparent" />
              </div>
            ) : (
              <>
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">
                    <Users size={11} /> Poules à lancer ({sug.pools_to_start.length})
                  </div>
                  <div className="space-y-2">
                    {sug.pools_to_start.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-2">
                        Aucune poule à lancer
                      </p>
                    ) : (
                      sug.pools_to_start.map((pool) => (
                        <PoolSuggestionCard
                          key={pool.id}
                          pool={pool}
                          tables={sug.available_tables}
                          onStart={(poolId, tableId) =>
                            startPoolMutation.mutate({ poolId, tableId })
                          }
                          isStarting={startingPoolId === pool.id}
                        />
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">
                    <Target size={11} /> Éliminations ({sug.eliminations_to_start.length})
                  </div>
                  <div className="space-y-2">
                    {sug.eliminations_to_start.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-2">
                        Aucun match d'élimination
                      </p>
                    ) : (
                      sug.eliminations_to_start.map((m) => (
                        <EliminationSuggestionCard
                          key={m.id}
                          match={m}
                          tables={sug.available_tables}
                          onStart={(matchId, tableId) =>
                            startMatchMutation.mutate({ matchId, tableId })
                          }
                          isStarting={startingMatchId === m.id}
                        />
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>

        {/* CENTER: active tables */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-2xl font-semibold text-slate-900 flex items-center gap-2">
              <Zap size={20} className="text-cyan-500" /> Tables en cours
            </h2>
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              Actualisation auto toutes les 3s
            </div>
          </div>

          {!tournamentId ? (
            <div className="text-center py-12 text-slate-400">
              Sélectionnez un tournoi en cours
            </div>
          ) : sug.active_tables.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              Aucune table active
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {sug.active_tables.map((t) => (
                <ActiveTableCard
                  key={t.id}
                  table={t}
                  onEnterResult={setResultTable}
                />
              ))}
            </div>
          )}
        </main>

        {/* RIGHT: tournament selector */}
        <aside className="w-60 flex-shrink-0 bg-white/60 backdrop-blur-sm border-l border-slate-200 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200">
            <h2 className="font-display font-semibold text-slate-800 text-sm flex items-center gap-1.5">
              <Trophy size={15} /> Tournoi
            </h2>
          </div>
          <div className="p-3 space-y-3">
            {activeTournaments.length === 0 ? (
              <p className="text-xs text-slate-400">Aucun tournoi en cours</p>
            ) : (
              <select
                value={tournamentId ?? ''}
                onChange={(e) => setActiveTournamentId(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5 bg-white/80 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              >
                {activeTournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: ['suggestions', tournamentId],
                })
              }
              className="btn-gradient w-full flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
            >
              <RefreshCw size={12} /> Rafraîchir
            </button>

            {tournamentId && (
              <a
                href={`/display/${tournamentId}`}
                target="_blank"
                rel="noreferrer"
                className="block w-full text-center text-xs bg-slate-900 hover:bg-black text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Écran public
              </a>
            )}
          </div>
        </aside>
      </div>

      {resultMatch && (
        <ResultModal
          match={resultMatch}
          onClose={() => setResultTable(null)}
        />
      )}
    </Layout>
  );
}
