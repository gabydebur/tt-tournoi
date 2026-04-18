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
  onStart: (poolId: number, tableId: number) => void;
  isStarting: boolean;
}) {
  const [tableId, setTableId] = useState<number | ''>('');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
      <div className="text-xs font-semibold text-blue-600 uppercase mb-1">
        {pool.series_name}
      </div>
      <div className="flex items-center gap-1.5 mb-2">
        <Users size={13} className="text-gray-500" />
        <div className="font-semibold text-gray-800 text-sm">{pool.name}</div>
      </div>
      <ul className="text-xs text-gray-600 space-y-0.5 mb-3">
        {pool.players.map((pl) => (
          <li key={pl.id} className="flex items-center justify-between">
            <span>{pl.first_name} {pl.last_name}</span>
            <span className="text-gray-400">{pl.points} pts</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <select
          value={tableId}
          onChange={(e) => setTableId(e.target.value ? Number(e.target.value) : '')}
          className="flex-1 text-xs border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          onClick={() => tableId && onStart(pool.id, Number(tableId))}
          className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded-md transition-colors disabled:opacity-40"
        >
          {isStarting ? (
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Play size={11} />
          )}
          Lancer la poule
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
  onStart: (matchId: number, tableId: number) => void;
  isStarting: boolean;
}) {
  const [tableId, setTableId] = useState<number | ''>('');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
      <div className="text-xs font-semibold text-purple-600 uppercase mb-1">
        {match.series_name} · {match.round.replace(/_/g, ' ')}
      </div>
      <div className="text-sm text-gray-800 font-medium">
        {match.player1.first_name} {match.player1.last_name}
      </div>
      <div className="text-xs text-gray-400 my-0.5">vs</div>
      <div className="text-sm text-gray-800 font-medium mb-2">
        {match.player2.first_name} {match.player2.last_name}
      </div>
      <div className="flex items-center gap-2">
        <select
          value={tableId}
          onChange={(e) => setTableId(e.target.value ? Number(e.target.value) : '')}
          className="flex-1 text-xs border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          onClick={() => tableId && onStart(match.id, Number(tableId))}
          className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded-md transition-colors disabled:opacity-40"
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
          <span className="font-bold text-lg">Table {table.number}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 ml-auto">
            Libre
          </span>
        </div>
        <p className="text-sm text-gray-400 text-center py-4">Aucun match en cours</p>
      </div>
    );
  }

  const p1Sets = match.sets.filter((s) => s.score_player1 > s.score_player2).length;
  const p2Sets = match.sets.filter((s) => s.score_player2 > s.score_player1).length;

  return (
    <div className="bg-white rounded-xl shadow-sm border-2 border-green-400 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <span className="font-bold text-lg">Table {table.number}</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 ml-auto flex items-center gap-1">
          <Zap size={11} /> En cours
        </span>
      </div>

      {pool && (
        <div className="text-xs text-blue-600 font-medium uppercase mb-2">
          {pool.series_name} · {pool.name}
        </div>
      )}

      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm text-gray-800">
            {match.player1.first_name} {match.player1.last_name}
          </span>
          <span className="text-xl font-bold tabular-nums">{p1Sets}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm text-gray-800">
            {match.player2.first_name} {match.player2.last_name}
          </span>
          <span className="text-xl font-bold tabular-nums">{p2Sets}</span>
        </div>
      </div>

      {match.sets.length > 0 && (
        <div className="flex gap-1 flex-wrap mb-3">
          {match.sets.map((s, i) => (
            <span
              key={i}
              className="text-xs rounded px-1.5 py-0.5 font-mono bg-gray-100 text-gray-600"
            >
              {s.score_player1}-{s.score_player2}
            </span>
          ))}
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Progression poule</span>
          <span>
            {progress.played} / {progress.total}
          </span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <button
        onClick={() => onEnterResult(table)}
        className="w-full text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition-colors"
      >
        Saisir résultat
      </button>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function RefereeDashboard() {
  const queryClient = useQueryClient();
  const [activeTournamentId, setActiveTournamentId] = useState<number | null>(null);
  const [resultTable, setResultTable] = useState<ActiveTableBrief | null>(null);
  const [startingPoolId, setStartingPoolId] = useState<number | null>(null);
  const [startingMatchId, setStartingMatchId] = useState<number | null>(null);

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
    mutationFn: ({ poolId, tableId }: { poolId: number; tableId: number }) =>
      poolsApi.start(poolId, tableId),
    onMutate: ({ poolId }) => setStartingPoolId(poolId),
    onSettled: () => {
      setStartingPoolId(null);
      queryClient.invalidateQueries({ queryKey: ['suggestions', tournamentId] });
    },
  });

  const startMatchMutation = useMutation({
    mutationFn: ({ matchId, tableId }: { matchId: number; tableId: number }) =>
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
        tournament_id: tournamentId ?? 0,
        series: {
          id: 0,
          tournament_id: tournamentId ?? 0,
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
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* LEFT: suggestions */}
        <aside className="w-72 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-700 text-sm flex items-center gap-1.5">
              <ClipboardList size={15} /> À lancer
            </h2>
            <button
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ['suggestions', tournamentId] })
              }
              className="text-gray-400 hover:text-gray-600"
              title="Rafraîchir"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {!tournamentId ? (
              <p className="text-xs text-gray-400 text-center py-4">
                Aucun tournoi en cours
              </p>
            ) : isLoading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
              </div>
            ) : (
              <>
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase mb-2">
                    <Users size={12} /> Poules à lancer ({sug.pools_to_start.length})
                  </div>
                  <div className="space-y-2">
                    {sug.pools_to_start.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">
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
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase mb-2">
                    <Target size={12} /> Éliminations ({sug.eliminations_to_start.length})
                  </div>
                  <div className="space-y-2">
                    {sug.eliminations_to_start.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">
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
        <main className="flex-1 overflow-y-auto bg-white p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Zap size={17} className="text-green-500" /> Tables en cours
            </h2>
            <div className="text-xs text-gray-500">
              Actualisation auto toutes les 3s
            </div>
          </div>

          {!tournamentId ? (
            <div className="text-center py-12 text-gray-400">
              Sélectionnez un tournoi en cours
            </div>
          ) : sug.active_tables.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
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
        <aside className="w-60 flex-shrink-0 bg-gray-50 border-l border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-700 text-sm flex items-center gap-1.5">
              <Trophy size={15} /> Tournoi
            </h2>
          </div>
          <div className="p-3 space-y-3">
            {activeTournaments.length === 0 ? (
              <p className="text-xs text-gray-400">Aucun tournoi en cours</p>
            ) : (
              <select
                value={tournamentId ?? ''}
                onChange={(e) => setActiveTournamentId(Number(e.target.value))}
                className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5"
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
              className="w-full flex items-center justify-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition-colors"
            >
              <RefreshCw size={12} /> Rafraîchir
            </button>

            {tournamentId && (
              <a
                href={`/display/${tournamentId}`}
                target="_blank"
                rel="noreferrer"
                className="block w-full text-center text-xs bg-gray-800 hover:bg-black text-white px-3 py-1.5 rounded-md transition-colors"
              >
                Afficher l'écran public
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
