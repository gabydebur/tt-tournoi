import type { Match, Player } from '../types';

interface BracketViewProps {
  matches: Match[];
  dark?: boolean;
}

const ROUND_ORDER: Match['round'][] = [
  'ROUND_OF_16',
  'QUARTER_FINAL',
  'SEMI_FINAL',
  'FINAL',
];

const ROUND_LABELS: Record<string, string> = {
  ROUND_OF_16: '1/8 de finale',
  QUARTER_FINAL: 'Quart de finale',
  SEMI_FINAL: 'Demi-finale',
  FINAL: 'Finale',
  THIRD_PLACE: 'Petite finale',
};

interface BracketMatchCardProps {
  match: Match | null;
  dark?: boolean;
}

function PlayerRow({
  player,
  isWinner,
  sets,
  dark,
}: {
  player?: Player;
  isWinner: boolean;
  sets: number;
  dark?: boolean;
}) {
  if (!player) {
    return (
      <div className={`px-3 py-2 text-sm ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
        TBD
      </div>
    );
  }
  return (
    <div
      className={`px-3 py-2 flex items-center justify-between text-sm transition-colors ${
        isWinner
          ? dark
            ? 'bg-yellow-400/20 text-yellow-300 font-semibold'
            : 'bg-green-50 text-green-800 font-semibold'
          : dark
          ? 'text-gray-300'
          : 'text-gray-700'
      }`}
    >
      <span className="truncate max-w-[110px]">
        {player.first_name} {player.last_name}
      </span>
      <span className={`ml-2 font-bold tabular-nums text-base ${dark ? 'text-white' : 'text-gray-900'}`}>
        {sets}
      </span>
    </div>
  );
}

function BracketMatchCard({ match, dark }: BracketMatchCardProps) {
  const borderCls = dark ? 'border-gray-600' : 'border-gray-300';
  const bgCls = dark ? 'bg-gray-800' : 'bg-white';

  if (!match) {
    return (
      <div
        className={`rounded-lg border ${borderCls} ${bgCls} overflow-hidden opacity-40 shadow-sm`}
        style={{ minWidth: 200 }}
      >
        <div className={`px-3 py-2 text-sm ${dark ? 'text-gray-500' : 'text-gray-400'}`}>TBD</div>
        <div className={`border-t ${borderCls} px-3 py-2 text-sm ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
          TBD
        </div>
      </div>
    );
  }

  const sets1 = (match.sets ?? []).filter((s) => s.score_player1 > s.score_player2).length;
  const sets2 = (match.sets ?? []).filter((s) => s.score_player2 > s.score_player1).length;
  const isP1Winner = match.winner?.id === match.player1?.id;
  const isP2Winner = match.winner?.id === match.player2?.id;

  return (
    <div
      className={`rounded-lg border-2 ${
        match.status === 'IN_PROGRESS'
          ? 'border-green-500 shadow-green-200 shadow-md'
          : match.status === 'FINISHED'
          ? dark
            ? 'border-gray-600'
            : 'border-gray-200'
          : dark
          ? 'border-gray-700'
          : 'border-gray-200'
      } ${bgCls} overflow-hidden shadow-sm`}
      style={{ minWidth: 200 }}
    >
      <PlayerRow player={match.player1} isWinner={isP1Winner} sets={sets1} dark={dark} />
      <div className={`border-t ${borderCls}`} />
      <PlayerRow player={match.player2} isWinner={isP2Winner} sets={sets2} dark={dark} />
      {match.status === 'IN_PROGRESS' && (
        <div className="bg-green-500 text-white text-xs text-center py-0.5 font-medium">
          En cours
        </div>
      )}
    </div>
  );
}

export default function BracketView({ matches, dark = false }: BracketViewProps) {
  // Group matches by round
  const byRound = new Map<string, Match[]>();
  for (const m of matches) {
    if (!byRound.has(m.round)) byRound.set(m.round, []);
    byRound.get(m.round)!.push(m);
  }

  // Determine which rounds are present
  const presentRounds = ROUND_ORDER.filter((r) => byRound.has(r));
  const hasThirdPlace = byRound.has('THIRD_PLACE');

  if (presentRounds.length === 0 && !hasThirdPlace) {
    return (
      <div className={`text-center py-10 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
        Aucun match d'élimination disponible
      </div>
    );
  }

  const headerCls = dark ? 'text-gray-400' : 'text-gray-500';
  const connectorCls = dark ? 'border-gray-600' : 'border-gray-300';

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-8 p-4 items-start">
        {presentRounds.map((round, colIdx) => {
          const roundMatches = byRound.get(round) ?? [];
          const nextRound = presentRounds[colIdx + 1];
          const nextCount = nextRound ? (byRound.get(nextRound) ?? []).length : 0;
          const currentCount = roundMatches.length;

          // Vertical spacing grows as bracket progresses
          const gapMultiplier = Math.pow(2, colIdx);
          const cardGap = 16 * gapMultiplier;

          return (
            <div key={round} className="flex flex-col items-center">
              {/* Round label */}
              <div className={`text-xs font-semibold uppercase tracking-wider mb-4 ${headerCls}`}>
                {ROUND_LABELS[round]}
              </div>

              {/* Matches in this round */}
              <div className="flex flex-col relative" style={{ gap: cardGap }}>
                {roundMatches.map((match) => (
                  <div key={match.id} className="relative flex items-center">
                    <BracketMatchCard match={match} dark={dark} />
                    {/* Connector line to next round */}
                    {nextCount > 0 && currentCount > nextCount && (
                      <div
                        className={`absolute right-0 w-6 border-t-2 ${connectorCls}`}
                        style={{ right: -24, top: '50%' }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Third place */}
        {hasThirdPlace && (
          <div className="flex flex-col items-center">
            <div className={`text-xs font-semibold uppercase tracking-wider mb-4 ${headerCls}`}>
              {ROUND_LABELS['THIRD_PLACE']}
            </div>
            <div className="flex flex-col gap-4">
              {(byRound.get('THIRD_PLACE') ?? []).map((match) => (
                <BracketMatchCard key={match.id} match={match} dark={dark} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
