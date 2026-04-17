import { useState } from 'react';
import type { Tournament, TournamentPayload } from '../types';
import { Save, X } from 'lucide-react';

interface TournamentFormProps {
  initial?: Tournament;
  onSubmit: (payload: TournamentPayload) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function TournamentForm({
  initial,
  onSubmit,
  onCancel,
  isLoading = false,
}: TournamentFormProps) {
  const [form, setForm] = useState<TournamentPayload>({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    location: initial?.location ?? '',
    start_date: initial?.start_date?.slice(0, 10) ?? '',
    end_date: initial?.end_date?.slice(0, 10) ?? '',
  });
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError('Le nom est requis'); return; }
    if (!form.start_date) { setError('La date de début est requise'); return; }
    if (!form.end_date) { setError('La date de fin est requise'); return; }
    if (form.end_date < form.start_date) { setError('La date de fin doit être après la date de début'); return; }
    try {
      await onSubmit(form);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    }
  };

  const inputCls =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelCls}>Nom du tournoi *</label>
        <input name="name" value={form.name} onChange={handleChange} className={inputCls} placeholder="Championnat régional 2026" />
      </div>
      <div>
        <label className={labelCls}>Description</label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          rows={3}
          className={inputCls + ' resize-none'}
          placeholder="Description du tournoi..."
        />
      </div>
      <div>
        <label className={labelCls}>Lieu</label>
        <input name="location" value={form.location} onChange={handleChange} className={inputCls} placeholder="Salle omnisports, Paris" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Date de début *</label>
          <input type="date" name="start_date" value={form.start_date} onChange={handleChange} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Date de fin *</label>
          <input type="date" name="end_date" value={form.end_date} onChange={handleChange} className={inputCls} />
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg transition-colors">
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
