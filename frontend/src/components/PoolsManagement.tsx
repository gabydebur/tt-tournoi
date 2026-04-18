import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { poolsApi } from '../api/pools';
import { tablesApi } from '../api/tables';
import type { PoolData, PoolStatus } from '../types';
import {
  Shuffle,
  RefreshCw,
  CheckCircle2,
  ArrowLeftRight,
  Play,
  AlertCircle,
  Users,
} from 'lucide-react';

interface PoolsManagementProps {
  tournamentId: string;
}

const statusCfg: Record<PoolStatus, { label: string; cls: string }> = {
  DRAFT: { label: 'Brouillon', cls: 'bg-yellow-100 text-yellow-700' },
  CONFIRMED: { label: 'Validée', cls: 'bg-blue-100 text-blue-700' },
  IN_PROGRESS: { label: 'En cours', cls: 'bg-green-100 text-green-700' },
  FINISHED: { label: 'Terminée', cls: 'bg-gray-100 text-gray-500' },
};

function PoolStatusBadge({ status }: { status: PoolStatus }) {
  const cfg = statusCfg[status];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

interface SelectedPlayer {
  poolId: string;
  playerId: string;
  seriesId: string;
}

export default function PoolsManagement({ tournamentId }: PoolsManagementProps) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<SelectedPlayer[]>([]);
  const [tableChoices, setTableChoices] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const { data: pools, isLoading } = useQuery({
    queryKey: ['pools', tournamentId],
    queryFn: () => poolsApi.list(tournamentId),
  });

  const { data: tables } = useQuery({
    queryKey: ['tables', tournamentId],
    queryFn: () => tablesApi.list(tournamentId),
  });

  const poolList = (pools ?? []) as PoolData[];

  const generateMutation = useMutation({
    mutationFn: () => poolsApi.generate(tournamentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pools', tournamentId] });
      setError(null);
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : 'Erreur génération'),
  });

  const regenerateMutation = useMutation({
    mutationFn: () => poolsApi.regenerate(tournamentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pools', tournamentId] });
      setSelected([]);
      setError(null);
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : 'Erreur régénération'),
  });

  const swapMutation = useMutation({
    mutationFn: poolsApi.swap,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pools', tournamentId] });
      setSelected([]);
      setError(null);
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : 'Erreur échange'),
  });

  const confirmMutation = useMutation({
    mutationFn: () => poolsApi.confirm(tournamentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pools', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setSelected([]);
      setError(null);
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : 'Erreur validation'),
  });

  const startMutation = useMutation({
    mutationFn: ({ poolId, tableId }: { poolId: string; tableId: string }) =>
      poolsApi.start(poolId, tableId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pools', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['tables', tournamentId] });
      setError(null);
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : 'Erreur lancement'),
  });

  // Group pools by series
  const poolsBySeries = useMemo(() => {
    const map = new Map<string, { seriesName: string; pools: PoolData[] }>();
    for (const p of poolList) {
      if (!map.has(p.series_id)) {
        map.set(p.series_id, { seriesName: p.series_name, pools: [] });
      }
      map.get(p.series_id)!.pools.push(p);
    }
    return map;
  }, [poolList]);

  const hasDraft = poolList.some((p) => p.status === 'DRAFT');
  const allDraft = poolList.length > 0 && poolList.every((p) => p.status === 'DRAFT');

  const isSelected = (poolId: string, playerId: string) =>
    selected.some((s) => s.poolId === poolId && s.playerId === playerId);

  const togglePlayer = (pool: PoolData, playerId: string) => {
    if (pool.status !== 'DRAFT') return;
    setError(null);
    const already = isSelected(pool.id, playerId);
    if (already) {
      setSelected(selected.filter((s) => !(s.poolId === pool.id && s.playerId === playerId)));
      return;
    }
    // Only allow selection within same series
    if (selected.length > 0 && selected[0].seriesId !== pool.series_id) {
      setError('Les deux joueurs à échanger doivent appartenir à la même série.');
      return;
    }
    // Cap at 2 selected
    if (selected.length >= 2) {
      setError('Désélectionnez un joueur pour en choisir un autre.');
      return;
    }
    // Don't allow 2 players from the same pool
    if (selected.length === 1 && selected[0].poolId === pool.id) {
      setError('Choisissez un joueur d\'une autre poule.');
      return;
    }
    setSelected([
      ...selected,
      { poolId: pool.id, playerId, seriesId: pool.series_id },
    ]);
  };

  const doSwap = () => {
    if (selected.length !== 2) return;
    const [a, b] = selected;
    swapMutation.mutate({
      pool_a_id: a.poolId,
      player_a_id: a.playerId,
      pool_b_id: b.poolId,
      player_b_id: b.playerId,
    });
  };

  const availableTables = (tables ?? []).filter((t) => t.status === 'AVAILABLE');

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-blue-600" />
          <h3 className="font-semibold text-gray-800">Gestion des poules</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {poolList.length === 0 && (
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {generateMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Shuffle size={14} />
              )}
              Générer les poules
            </button>
          )}
          {allDraft && (
            <button
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
              className="flex items-center gap-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {regenerateMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              Regénérer au hasard
            </button>
          )}
          {selected.length === 2 && (
            <button
              onClick={doSwap}
              disabled={swapMutation.isPending}
              className="flex items-center gap-1.5 text-sm bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {swapMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowLeftRight size={14} />
              )}
              Échanger
            </button>
          )}
          {hasDraft && (
            <button
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending}
              className="flex items-center gap-1.5 text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {confirmMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle2 size={14} />
              )}
              Valider les poules
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3 border border-red-100">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {poolList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400 shadow-sm">
          Aucune poule. Cliquez sur « Générer les poules » pour tirer au sort.
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(poolsBySeries.entries()).map(([seriesId, entry]) => (
            <div key={seriesId}>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                {entry.seriesName}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {entry.pools.map((pool) => (
                  <div
                    key={pool.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-semibold text-gray-800">{pool.name}</div>
                      <PoolStatusBadge status={pool.status} />
                    </div>

                    <ul className="space-y-1.5">
                      {pool.players.map((pl) => {
                        const sel = isSelected(pool.id, pl.id);
                        const clickable = pool.status === 'DRAFT';
                        return (
                          <li key={pl.id}>
                            <button
                              type="button"
                              disabled={!clickable}
                              onClick={() => togglePlayer(pool, pl.id)}
                              className={`w-full flex items-center justify-between text-sm rounded-md px-2 py-1.5 border transition-colors ${
                                sel
                                  ? 'bg-yellow-50 border-yellow-300 text-gray-800'
                                  : clickable
                                  ? 'border-transparent hover:bg-gray-50 text-gray-700'
                                  : 'border-transparent text-gray-700 cursor-default'
                              }`}
                            >
                              <span className="font-medium">
                                {pl.first_name} {pl.last_name}
                              </span>
                              <span className="text-xs text-gray-500">
                                {pl.points} pts
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>

                    {pool.status === 'CONFIRMED' && (
                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                        <select
                          value={tableChoices[pool.id] ?? ''}
                          onChange={(e) =>
                            setTableChoices({
                              ...tableChoices,
                              [pool.id]: e.target.value,
                            })
                          }
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
                          disabled={
                            !tableChoices[pool.id] || startMutation.isPending
                          }
                          onClick={() => {
                            const tid = tableChoices[pool.id];
                            if (tid) startMutation.mutate({ poolId: pool.id, tableId: tid });
                          }}
                          className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded-md transition-colors disabled:opacity-40"
                        >
                          <Play size={11} /> Lancer
                        </button>
                      </div>
                    )}

                    {pool.status === 'IN_PROGRESS' && pool.table_id != null && (
                      <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-green-600 flex items-center gap-1">
                        <Play size={11} /> En cours
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
