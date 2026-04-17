import type { Pool } from '../types';

interface StandingsTableProps {
  pool: Pool;
  dark?: boolean;
}

export default function StandingsTable({ pool, dark = false }: StandingsTableProps) {
  const sorted = [...pool.players].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const aSetDiff = a.sets_won - a.sets_lost;
    const bSetDiff = b.sets_won - b.sets_lost;
    return bSetDiff - aSetDiff;
  });

  const headerCls = dark
    ? 'bg-gray-700 text-gray-300 text-xs'
    : 'bg-gray-50 text-gray-500 text-xs';
  const rowCls = dark
    ? 'border-gray-700 text-gray-200 hover:bg-gray-700'
    : 'border-gray-100 text-gray-700 hover:bg-gray-50';
  const containerCls = dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

  return (
    <div className={`rounded-lg border overflow-hidden ${containerCls}`}>
      <div className={`px-4 py-2 font-semibold text-sm ${dark ? 'text-white border-b border-gray-700' : 'text-gray-800 border-b border-gray-200'}`}>
        Poule {pool.name}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className={headerCls}>
            <th className="text-left px-4 py-2 font-medium">Joueur</th>
            <th className="text-center px-2 py-2 font-medium">V</th>
            <th className="text-center px-2 py-2 font-medium">D</th>
            <th className="text-center px-2 py-2 font-medium">Sets +</th>
            <th className="text-center px-2 py-2 font-medium">Sets -</th>
            <th className="text-center px-2 py-2 font-medium">Pts</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((pp, idx) => (
            <tr key={pp.player.id} className={`border-t ${rowCls} transition-colors`}>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0
                        ? 'bg-yellow-400 text-yellow-900'
                        : idx === 1
                        ? 'bg-gray-300 text-gray-700'
                        : idx === 2
                        ? 'bg-amber-600 text-white'
                        : dark
                        ? 'bg-gray-600 text-gray-300'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <div className="font-medium">
                      {pp.player.first_name} {pp.player.last_name}
                    </div>
                    {pp.player.club && (
                      <div className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-400'}`}>
                        {pp.player.club}
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td className={`text-center px-2 py-2.5 font-semibold ${dark ? 'text-green-400' : 'text-green-600'}`}>
                {pp.wins}
              </td>
              <td className={`text-center px-2 py-2.5 ${dark ? 'text-red-400' : 'text-red-500'}`}>
                {pp.losses}
              </td>
              <td className="text-center px-2 py-2.5">{pp.sets_won}</td>
              <td className="text-center px-2 py-2.5">{pp.sets_lost}</td>
              <td className={`text-center px-2 py-2.5 font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
                {pp.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
