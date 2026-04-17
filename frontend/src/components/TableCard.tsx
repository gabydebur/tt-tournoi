import type { TournamentTable } from '../types';
import { CheckCircle, XCircle, Zap } from 'lucide-react';

interface TableCardProps {
  table: TournamentTable;
  onEnterResult?: (matchId: number) => void;
  dark?: boolean;
}

export default function TableCard({ table, onEnterResult, dark = false }: TableCardProps) {
  const match = table.current_match;

  const base = dark
    ? 'bg-gray-800 border-gray-700 text-white'
    : 'bg-white border-gray-200 text-gray-900';

  const statusDot =
    table.status === 'OCCUPIED'
      ? 'bg-green-400'
      : table.status === 'MAINTENANCE'
      ? 'bg-red-400'
      : 'bg-gray-300';

  return (
    <div className={`rounded-xl border-2 shadow-sm p-4 ${base} ${
      table.status === 'OCCUPIED' ? (dark ? 'border-green-500' : 'border-green-400') : 'border-gray-200'
    }`}>
      {/* Table header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${statusDot}`} />
          <span className={`font-bold text-lg ${dark ? 'text-white' : 'text-gray-800'}`}>
            Table {table.number}
          </span>
        </div>
        {table.status === 'AVAILABLE' && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${dark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'}`}>
            Libre
          </span>
        )}
        {table.status === 'MAINTENANCE' && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 flex items-center gap-1">
            <XCircle size={12} /> Maintenance
          </span>
        )}
      </div>

      {match ? (
        <div className="space-y-2">
          {/* Series label */}
          <div className={`text-xs font-medium uppercase tracking-wide ${dark ? 'text-blue-400' : 'text-blue-600'}`}>
            {match.series?.name}
          </div>

          {/* Players */}
          <div className="space-y-1">
            {[
              { player: match.player1, isWinner: match.winner?.id === match.player1.id },
              { player: match.player2, isWinner: match.winner?.id === match.player2.id },
            ].map(({ player, isWinner }, idx) => {
              const sets = match.sets ?? [];
              const setsWon = sets.filter((s) =>
                idx === 0
                  ? s.score_player1 > s.score_player2
                  : s.score_player2 > s.score_player1
              ).length;

              return (
                <div key={player.id} className="flex items-center justify-between">
                  <span
                    className={`font-medium text-sm truncate ${
                      isWinner
                        ? dark
                          ? 'text-yellow-400'
                          : 'text-green-700 font-semibold'
                        : dark
                        ? 'text-gray-200'
                        : 'text-gray-700'
                    }`}
                  >
                    {player.first_name} {player.last_name}
                  </span>
                  <span
                    className={`text-xl font-bold ml-3 tabular-nums ${
                      dark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {setsWon}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Set-by-set scores */}
          {match.sets?.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {match.sets.map((set, i) => (
                <span
                  key={i}
                  className={`text-xs rounded px-1.5 py-0.5 font-mono ${
                    dark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {set.score_player1}-{set.score_player2}
                </span>
              ))}
            </div>
          )}

          {/* Status + action */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
            <span className="flex items-center gap-1 text-xs text-green-500 font-medium">
              <Zap size={12} /> En cours
            </span>
            {onEnterResult && match.status === 'IN_PROGRESS' && (
              <button
                onClick={() => onEnterResult(match.id)}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-md transition-colors"
              >
                Saisir résultat
              </button>
            )}
            {match.status === 'FINISHED' && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <CheckCircle size={12} /> Terminé
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className={`text-sm text-center py-4 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
          Aucun match en cours
        </div>
      )}
    </div>
  );
}
