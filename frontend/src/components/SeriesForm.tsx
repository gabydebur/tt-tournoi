import { useState } from 'react';
import type { Series, SeriesPayload, PhaseFormat } from '../types';
import { Save, X } from 'lucide-react';

interface SeriesFormProps {
  initial?: Series;
  onSubmit: (payload: SeriesPayload) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const phaseFormatOptions: { value: PhaseFormat; label: string }[] = [
  { value: 'POOLS_ONLY', label: 'Poules uniquement' },
  { value: 'POOLS_THEN_ELIMINATION', label: 'Poules puis élimination' },
  { value: 'ELIMINATION_ONLY', label: 'Élimination directe' },
];

export default function SeriesForm({
  initial,
  onSubmit,
  onCancel,
  isLoading = false,
}: SeriesFormProps) {
  const [form, setForm] = useState<SeriesPayload>({
    name: initial?.name ?? '',
    max_points: initial?.max_points ?? 1000,
    min_points: initial?.min_points ?? undefined,
    phase_format: initial?.phase_format ?? 'POOLS_THEN_ELIMINATION',
    sets_to_win_match: initial?.sets_to_win_match ?? 3,
    sets_to_win_final: initial?.sets_to_win_final ?? 3,
    players_per_pool: initial?.players_per_pool ?? 4,
  });
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setForm({
      ...form,
      [name]:
        type === 'number'
          ? value === ''
            ? undefined
            : parseInt(value)
          : value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError('Le nom est requis'); return; }
    if (!form.max_points || form.max_points <= 0) { setError('Le classement max est requis'); return; }
    try {
      await onSubmit(form);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const inputCls =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelCls}>Nom de la série *</label>
        <input name="name" value={form.name} onChange={handleChange} className={inputCls} placeholder="Ex: Série D" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Classement max *</label>
          <input type="number" name="max_points" value={form.max_points} onChange={handleChange} className={inputCls} min={0} />
        </div>
        <div>
          <label className={labelCls}>Classement min</label>
          <input type="number" name="min_points" value={form.min_points ?? ''} onChange={handleChange} className={inputCls} min={0} placeholder="Optionnel" />
        </div>
      </div>

      <div>
        <label className={labelCls}>Format de phase</label>
        <select name="phase_format" value={form.phase_format} onChange={handleChange} className={inputCls}>
          {phaseFormatOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Sets pour gagner</label>
          <input type="number" name="sets_to_win_match" value={form.sets_to_win_match} onChange={handleChange} className={inputCls} min={1} max={5} />
        </div>
        <div>
          <label className={labelCls}>Sets finale</label>
          <input type="number" name="sets_to_win_final" value={form.sets_to_win_final} onChange={handleChange} className={inputCls} min={1} max={5} />
        </div>
        <div>
          <label className={labelCls}>Joueurs/poule</label>
          <input type="number" name="players_per_pool" value={form.players_per_pool} onChange={handleChange} className={inputCls} min={2} max={8} />
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:text-gray-800 transition-colors">
          <X size={14} /> Annuler
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save size={14} />
          )}
          {initial ? 'Mettre à jour' : 'Créer'}
        </button>
      </div>
    </form>
  );
}
