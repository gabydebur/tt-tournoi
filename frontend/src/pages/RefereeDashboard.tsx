import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { matchesApi } from '../api/matches';
import { tablesApi } from '../api/tables';
import { tournamentsApi } from '../api/tournaments';
import { useWebSocket } from '../hooks/useWebSocket';
import Layout from '../components/Layout';
import TableCard from '../components/TableCard';
import ResultModal from '../components/ResultModal';
import type { Match, TournamentTable, WsEvent } from '../types';
import { Play, Clock, RefreshCw, Wifi, WifiOff } from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_BASE = BASE_URL.replace(/^http/, 'ws');

function SuggestionCard({
  match,
  tables,
  onStart,
  isStarting,
}: {
  match: Match;
  tables: TournamentTable[];
  onStart: (matchId: number, tableId: number) => void;
  isStarting: boolean;
}) {
  const [selectedTable, setSelectedTable] = useState<number | ''>('');
  const availableTables = tables.filter((t) => t.status === 'AVAILABLE');

  const waitingMins = match.waiting_since
    ? Math.floor(
        (Date.now() - new Date(match.waiting_since).getTime()) / 60000
      )
    : null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
      <div className="text-xs font-semibold text-blue-600 uppercase mb-1">
        {match.series?.name}
        {match.pool_name ? ` · Poule ${match.pool_name}` : ''}
      </div>
      <div className="font-medium text-gray-800 text-sm">
        {match.player1.first_name} {match.player1.last_name}
      </div>
      <div className="text-gray-400 text-xs my-0.5">vs</div>
      <div className="font-medium text-gray-800 text-sm">
        {match.player2.first_name} {match.player2.last_name}
      </div>
      {waitingMins !== null && (
        <div className="flex items-center gap-1 text-xs text-amber-500 mt-1">
          <Clock size={11} /> {waitingMins} min d'attente
        </div>
      )}
      <div className="flex items-center gap-2 mt-2">
        <select
          value={selectedTable}
          onChange={(e) => setSelectedTable(Number(e.target.value))}
          className="flex-1 text-xs border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Table...</option>
          {availableTables.map((t) => (
            <option key={t.id} value={t.id}>
              Table {t.number}
            </option>
          ))}
        </select>
        <button
          disabled={!selectedTable || isStarting}
          onClick={() => selectedTable && onStart(match.id, Number(selectedTable))}
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

export default function RefereeDashboard() {
  const queryClient = useQueryClient();
  const [activeTournamentId, setActiveTournamentId] = useState<number | null>(null);
  const [resultMatchId, setResultMatchId] = useState<number | null>(null);
  const [startingMatchId, setStartingMatchId] = useState<number | null>(null);

  // Load tournaments to pick one
  const { data: tournaments } = useQuery({
    queryKey: ['tournaments'],
    queryFn: tournamentsApi.list,
  });
  const activeTournaments = (tournaments ?? []).filter(
    (t) => t.status === 'IN_PROGRESS'
  );

  // Auto-select first active tournament
  const tournamentId =
    activeTournamentId ?? activeTournaments[0]?.id ?? null;

  // Suggestions
  const { data: suggestions, isLoading: loadingSuggestions } = useQuery({
    queryKey: ['suggestions', tournamentId],
    queryFn: () => matchesApi.suggestions(tournamentId!),
    enabled: !!tournamentId,
    refetchInterval: 30000,
  });

  // Tables
  const { data: tables, isLoading: loadingTables } = useQuery({
    queryKey: ['tables', tournamentId],
    queryFn: () => tablesApi.list(tournamentId!),
    enabled: !!tournamentId,
    refetchInterval: 10000,
  });

  // Scheduled matches queue
  const { data: scheduledMatches } = useQuery({
    queryKey: ['matches', tournamentId, 'SCHEDULED'],
    queryFn: () => matchesApi.list(tournamentId!, { status: 'SCHEDULED' }),
    enabled: !!tournamentId,
    refetchInterval: 30000,
  });

  // WebSocket for live updates
  const wsUrl = tournamentId
    ? `${WS_BASE}/ws/display/${tournamentId}`
    : null;

  const { isConnected } = useWebSocket(wsUrl, {
    onMessage: useCallback(
      (_event: WsEvent) => {
        queryClient.invalidateQueries({ queryKey: ['tables', tournamentId] });
        queryClient.invalidateQueries({ queryKey: ['suggestions', tournamentId] });
        queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] });
      },
      [queryClient, tournamentId]
    ),
  });

  // Start match mutation
  const startMutation = useMutation({
    mutationFn: ({ matchId, tableId }: { matchId: number; tableId: number }) =>
      matchesApi.start(matchId, tableId),
    onMutate: ({ matchId }) => setStartingMatchId(matchId),
    onSettled: () => {
      setStartingMatchId(null);
      queryClient.invalidateQueries({ queryKey: ['suggestions', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['tables', tournamentId] });
    },
  });

  const resultMatch = resultMatchId
    ? (tables ?? [])
        .flatMap((t) => (t.current_match ? [t.current_match] : []))
        .find((m) => m.id === resultMatchId) ?? null
    : null;

  return (
    <Layout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* LEFT: Suggestions */}
        <aside className="w-64 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-700 text-sm">Matchs suggérés</h2>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['suggestions'] })}
              className="text-gray-400 hover:text-gray-600"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Tournament selector */}
          {activeTournaments.length > 1 && (
            <div className="px-3 py-2 border-b border-gray-200">
              <select
                value={tournamentId ?? ''}
                onChange={(e) => setActiveTournamentId(Number(e.target.value))}
                className="w-full text-xs border border-gray-300 rounded px-2 py-1"
              >
                {activeTournaments.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {!tournamentId ? (
              <p className="text-xs text-gray-400 text-center py-4">
                Aucun tournoi en cours
              </p>
            ) : loadingSuggestions ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
              </div>
            ) : (suggestions ?? []).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
                Aucun match à lancer
              </p>
            ) : (
              (suggestions as Match[]).map((match) => (
                <SuggestionCard
                  key={match.id}
                  match={match}
                  tables={tables ?? []}
                  onStart={(matchId, tableId) =>
                    startMutation.mutate({ matchId, tableId })
                  }
                  isStarting={startingMatchId === match.id}
                />
              ))
            )}
          </div>
        </aside>

        {/* CENTER: Active tables */}
        <main className="flex-1 overflow-y-auto bg-white p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Tables actives</h2>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {isConnected ? (
                <span className="flex items-center gap-1 text-green-600">
                  <Wifi size={12} /> Connecté
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-500">
                  <WifiOff size={12} /> Déconnecté
                </span>
              )}
            </div>
          </div>

          {loadingTables ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : !tournamentId ? (
            <div className="text-center py-12 text-gray-400">
              Sélectionnez un tournoi en cours
            </div>
          ) : (tables ?? []).length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              Aucune table configurée
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {(tables as TournamentTable[]).map((table) => (
                <TableCard
                  key={table.id}
                  table={table}
                  onEnterResult={(matchId) => setResultMatchId(matchId)}
                />
              ))}
            </div>
          )}
        </main>

        {/* RIGHT: Scheduled queue */}
        <aside className="w-56 flex-shrink-0 bg-gray-50 border-l border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-700 text-sm">File d'attente</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {(scheduledMatches ?? []).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Aucun match planifié</p>
            ) : (
              (scheduledMatches as Match[]).map((match) => (
                <div key={match.id} className="bg-white rounded-lg border border-gray-200 p-2.5">
                  <div className="text-xs font-medium text-blue-600">{match.series?.name}</div>
                  <div className="text-xs text-gray-700 mt-0.5">
                    {match.player1.first_name} {match.player1.last_name}
                  </div>
                  <div className="text-xs text-gray-400">vs</div>
                  <div className="text-xs text-gray-700">
                    {match.player2.first_name} {match.player2.last_name}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      {/* Result Modal */}
      {resultMatch && (
        <ResultModal
          match={resultMatch}
          onClose={() => setResultMatchId(null)}
        />
      )}
    </Layout>
  );
}
