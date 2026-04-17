import type { Match } from '../types';
import { Clock, CheckCircle, Play, Circle } from 'lucide-react';

interface MatchCardProps {
  match: Match;
  compact?: boolean;
  className?: string;
}

const statusConfig = {
  PENDING: { label: 'En attente', color: 'text-gray-500', bg: 'bg-gray-100', icon: Circle },
  SCHEDULED: { label: 'Planifié', color: 'text-blue-600', bg: 'bg-blue-50', icon: Clock },
  IN_PROGRESS: { label: 'En cours', color: 'text-green-600', bg: 'bg-green-50', icon: Play },
  FINISHED: { label: 'Terminé', color: 'text-gray-400', bg: 'bg-gray-50', icon: CheckCircle },
};

function SetScores({ match }: { match: Match }) {
  if (!match.sets?.length) return null;
  return (
    <div className="flex gap-1 mt-1">
      {match.sets.map((set, i) => (
        <span
          key={i}
          className="text-xs bg-gray-100 rounded px-1.5 py-0.5 font-mono"
        >
          {set.score_player1}-{set.score_player2}
        </span>
      ))}
    </div>
  );
}

export default function MatchCard({ match, compact = false, className = '' }: MatchCardProps) {
  const cfg = statusConfig[match.status];
  const StatusIcon = cfg.icon;

  const p1Name = `${match.player1.first_name} ${match.player1.last_name}`;
  const p2Name = `${match.player2.first_name} ${match.player2.last_name}`;
  const isP1Winner = match.winner?.id === match.player1.id;
  const isP2Winner = match.winner?.id === match.player2.id;

  if (compact) {
    return (
      <div className={`flex items-center justify-between gap-2 text-sm ${className}`}>
        <span className={isP1Winner ? 'font-semibold text-green-700' : ''}>{p1Name}</span>
        <span className="text-gray-400">vs</span>
        <span className={isP2Winner ? 'font-semibold text-green-700' : ''}>{p2Name}</span>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 shadow-sm ${className}`}>
      {/* Header: series + status */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">
            {match.series?.name}
          </span>
          {match.pool_name && (
            <span className="ml-2 text-xs text-gray-400">Poule {match.pool_name}</span>
          )}
        </div>
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
          <StatusIcon size={12} />
          {cfg.label}
        </span>
      </div>

      {/* Players */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className={`font-medium ${isP1Winner ? 'text-green-700' : 'text-gray-800'}`}>
            {p1Name}
            {isP1Winner && <span className="ml-1 text-xs">🏆</span>}
          </span>
          <span className="text-xs text-gray-400">{match.player1.points} pts</span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`font-medium ${isP2Winner ? 'text-green-700' : 'text-gray-800'}`}>
            {p2Name}
            {isP2Winner && <span className="ml-1 text-xs">🏆</span>}
          </span>
          <span className="text-xs text-gray-400">{match.player2.points} pts</span>
        </div>
      </div>

      {/* Sets */}
      <SetScores match={match} />

      {/* Footer info */}
      <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
        {match.table && (
          <span>Table {match.table.number}</span>
        )}
        {match.round && (
          <span className="capitalize">{match.round.replace(/_/g, ' ').toLowerCase()}</span>
        )}
      </div>
    </div>
  );
}
