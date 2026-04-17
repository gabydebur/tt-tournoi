import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { tablesApi } from '../api/tables';
import { tournamentsApi } from '../api/tournaments';
import { matchesApi } from '../api/matches';
import { useWebSocket } from '../hooks/useWebSocket';
import TableCard from '../components/TableCard';
import StandingsTable from '../components/StandingsTable';
import BracketView from '../components/BracketView';
import type { WsEvent, SeriesStandings, Match } from '../types';
import { Wifi, WifiOff, Trophy } from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_BASE = BASE_URL.replace(/^http/, 'ws');

type DisplayTab = 'standings' | 'bracket';

export default function LiveDisplay() {
  const { id } = useParams<{ id: string }>();
  const tournamentId = Number(id);
  const queryClient = useQueryClient();
  const [displayTab, setDisplayTab] = useState<DisplayTab>('standings');
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null);
  const [clock, setClock] = useState(new Date());

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Tournament info
  const { data: tournament } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => tournamentsApi.get(tournamentId),
    refetchInterval: 60000,
  });

  // Tables
  const { data: tables } = useQuery({
    queryKey: ['tables', tournamentId],
    queryFn: () => tablesApi.list(tournamentId),
    refetchInterval: 10000,
  });

  // Standings
  const { data: standings } = useQuery({
    queryKey: ['standings', tournamentId],
    queryFn: () => tournamentsApi.standings(tournamentId),
    refetchInterval: 30000,
  });

  // Elimination matches for bracket
  const { data: allMatches } = useQuery({
    queryKey: ['matches', tournamentId, 'elimination'],
    queryFn: () => matchesApi.list(tournamentId),
    refetchInterval: 15000,
  });

  const eliminationMatches = (allMatches ?? []).filter(
    (m: Match) => m.phase === 'ELIMINATION'
  );

  const standingsList = (standings ?? []) as SeriesStandings[];
  const activeSeries = standingsList.find((s) => s.series_id === selectedSeriesId)
    ?? standingsList[0]
    ?? null;

  // WebSocket
  const wsUrl = `${WS_BASE}/ws/display/${tournamentId}`;
  const { isConnected } = useWebSocket(wsUrl, {
    onMessage: useCallback(
      (_event: WsEvent) => {
        queryClient.invalidateQueries({ queryKey: ['tables', tournamentId] });
        queryClient.invalidateQueries({ queryKey: ['standings', tournamentId] });
        queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] });
      },
      [queryClient, tournamentId]
    ),
    reconnectDelay: 2000,
    maxRetries: 999,
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
      {/* Header bar */}
      <header className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Trophy size={22} className="text-yellow-400" />
          <div>
            <div className="font-bold text-lg leading-tight">
              {tournament?.name ?? 'Tournoi'}
            </div>
            {tournament?.location && (
              <div className="text-xs text-gray-400">{tournament.location}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Status indicator */}
          <div className={`flex items-center gap-1.5 text-xs ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
            {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
            {isConnected ? 'En direct' : 'Reconnexion...'}
          </div>

          {/* Clock */}
          <div className="text-2xl font-mono font-bold text-yellow-400 tabular-nums">
            {clock.toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </div>
        </div>
      </header>

      {/* Tables section */}
      <section className="px-4 py-4 border-b border-gray-800 flex-shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
          Tables
        </h2>
        {(tables ?? []).length === 0 ? (
          <p className="text-gray-600 text-sm">Aucune table configurée</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {(tables ?? []).map((table) => (
              <TableCard key={table.id} table={table} dark />
            ))}
          </div>
        )}
      </section>

      {/* Bottom section: standings / bracket */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center gap-1 px-4 pt-3 pb-2 border-b border-gray-800 flex-shrink-0">
          {(['standings', 'bracket'] as DisplayTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setDisplayTab(tab)}
              className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                displayTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              {tab === 'standings' ? 'Classements poules' : 'Tableau final'}
            </button>
          ))}

          {/* Series selector for standings */}
          {displayTab === 'standings' && standingsList.length > 1 && (
            <select
              value={selectedSeriesId ?? ''}
              onChange={(e) => setSelectedSeriesId(Number(e.target.value) || null)}
              className="ml-3 text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {standingsList.map((s) => (
                <option key={s.series_id} value={s.series_id}>
                  Série {s.series_id}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {displayTab === 'standings' && (
            <>
              {!activeSeries ? (
                <p className="text-gray-600 text-center py-8">
                  Aucun classement disponible
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {activeSeries.pools.map((pool) => (
                    <StandingsTable key={pool.name} pool={pool} dark />
                  ))}
                </div>
              )}
            </>
          )}

          {displayTab === 'bracket' && (
            <>
              {eliminationMatches.length === 0 ? (
                <p className="text-gray-600 text-center py-8">
                  Aucun match d'élimination
                </p>
              ) : (
                <BracketView matches={eliminationMatches} dark />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
