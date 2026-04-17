import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { matchesApi } from '../api/matches';
import type { Match, SetScore } from '../types';
import { X, CheckCircle, AlertCircle } from 'lucide-react';

interface ResultModalProps {
  match: Match;
  onClose: () => void;
}

function SetRow({
  index,
  value,
  onChange,
}: {
  index: number;
  value: SetScore;
  onChange: (v: SetScore) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-500 w-14">Set {index + 1}</span>
      <input
        type="number"
        min={0}
        max={30}
        value={value.score_player1}
        onChange={(e) => onChange({ ...value, score_player1: parseInt(e.target.value) || 0 })}
        className="w-16 border border-gray-300 rounded-md px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <span className="text-gray-400 font-bold">–</span>
      <input
        type="number"
        min={0}
        max={30}
        value={value.score_player2}
        onChange={(e) => onChange({ ...value, score_player2: parseInt(e.target.value) || 0 })}
        className="w-16 border border-gray-300 rounded-md px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

export default function ResultModal({ match, onClose }: ResultModalProps) {
  const setsToWin = match.series?.sets_to_win_match ?? 3;
  const maxSets = setsToWin * 2 - 1; // best of X
  const queryClient = useQueryClient();

  const emptySet = (): SetScore => ({ score_player1: 0, score_player2: 0 });
  const [sets, setSets] = useState<SetScore[]>([emptySet()]);
  const [error, setError] = useState<string | null>(null);

  const p1Name = `${match.player1.first_name} ${match.player1.last_name}`;
  const p2Name = `${match.player2.first_name} ${match.player2.last_name}`;

  // Derived: sets won per player
  const p1Sets = sets.filter((s) => s.score_player1 > s.score_player2).length;
  const p2Sets = sets.filter((s) => s.score_player2 > s.score_player1).length;

  const mutation = useMutation({
    mutationFn: () => matchesApi.submitResult(match.id, { sets }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "Erreur lors de l'enregistrement du résultat";
      setError(msg);
    },
  });

  const addSet = () => {
    if (sets.length < maxSets) {
      setSets([...sets, emptySet()]);
    }
  };

  const removeSet = (idx: number) => {
    setSets(sets.filter((_, i) => i !== idx));
  };

  const updateSet = (idx: number, val: SetScore) => {
    setSets(sets.map((s, i) => (i === idx ? val : s)));
  };

  const validate = (): string | null => {
    if (p1Sets !== setsToWin && p2Sets !== setsToWin) {
      return `Un joueur doit gagner ${setsToWin} sets.`;
    }
    // Check no set has equal score
    for (const s of sets) {
      if (s.score_player1 === s.score_player2) {
        return 'Aucun set ne peut se terminer à égalité.';
      }
    }
    return null;
  };

  const handleSubmit = () => {
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">Saisir le résultat</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Match info */}
        <div className="px-6 pt-4">
          <div className="bg-blue-50 rounded-lg p-3 mb-4">
            <div className="text-xs text-blue-600 font-medium uppercase mb-1">
              {match.series?.name} — {match.round?.replace(/_/g, ' ')}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-semibold text-gray-800">{p1Name}</div>
                <div className="text-sm text-gray-500">{match.player1.points} pts</div>
              </div>
              <div className="px-4 text-center">
                <div className="text-2xl font-bold text-gray-700">
                  {p1Sets} – {p2Sets}
                </div>
                <div className="text-xs text-gray-400">sets</div>
              </div>
              <div className="flex-1 text-right">
                <div className="font-semibold text-gray-800">{p2Name}</div>
                <div className="text-sm text-gray-500">{match.player2.points} pts</div>
              </div>
            </div>
          </div>

          {/* Column headers */}
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm text-gray-500 w-14" />
            <span className="w-16 text-center text-xs font-medium text-gray-500 truncate">
              {match.player1.first_name}
            </span>
            <span className="w-4" />
            <span className="w-16 text-center text-xs font-medium text-gray-500 truncate">
              {match.player2.first_name}
            </span>
          </div>

          {/* Sets */}
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {sets.map((set, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <SetRow index={idx} value={set} onChange={(v) => updateSet(idx, v)} />
                {sets.length > 1 && (
                  <button
                    onClick={() => removeSet(idx)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add set button */}
          {sets.length < maxSets && p1Sets < setsToWin && p2Sets < setsToWin && (
            <button
              onClick={addSet}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              + Ajouter un set
            </button>
          )}

          {/* Error */}
          {error && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle size={16} />
            )}
            Valider le résultat
          </button>
        </div>
      </div>
    </div>
  );
}
