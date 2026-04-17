import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { useAuth } from '../hooks/useAuth';
import { Trophy, AlertCircle, CheckCircle } from 'lucide-react';
import type { RegisterPayload } from '../types';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<RegisterPayload & { password_confirm: string }>({
    email: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: '',
    fft_license: '',
    points: 0,
    club: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setForm({ ...form, [name]: type === 'number' ? parseInt(value) || 0 : value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.password_confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (form.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    setIsLoading(true);
    try {
      const { password_confirm: _, ...payload } = form;
      await register({
        ...payload,
        fft_license: payload.fft_license || undefined,
        club: payload.club || undefined,
      });
      setSuccess(true);
      setTimeout(() => navigate('/player'), 1500);
    } catch (err: unknown) {
      let message = "Erreur lors de l'inscription.";
      if (err instanceof AxiosError) {
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string') {
          // Traduire les messages connus
          const translations: Record<string, string> = {
            'Email already registered': 'Cet email est déjà utilisé.',
          };
          message = translations[detail] ?? detail;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const inputCls =
    'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-blue-100 rounded-full p-3 mb-3">
            <Trophy size={28} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Créer un compte</h1>
          <p className="text-gray-500 text-sm mt-1">Rejoignez TT Tournoi</p>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle size={48} className="text-green-500" />
            <p className="text-green-700 font-semibold">Compte créé ! Redirection...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Prénom *</label>
                <input name="first_name" required value={form.first_name} onChange={handleChange} className={inputCls} placeholder="Jean" />
              </div>
              <div>
                <label className={labelCls}>Nom *</label>
                <input name="last_name" required value={form.last_name} onChange={handleChange} className={inputCls} placeholder="Dupont" />
              </div>
            </div>

            <div>
              <label className={labelCls}>Email *</label>
              <input type="email" name="email" required value={form.email} onChange={handleChange} className={inputCls} placeholder="jean.dupont@exemple.fr" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Mot de passe *</label>
                <input type="password" name="password" required value={form.password} onChange={handleChange} className={inputCls} placeholder="Min. 8 caractères" />
              </div>
              <div>
                <label className={labelCls}>Confirmer *</label>
                <input type="password" name="password_confirm" required value={form.password_confirm} onChange={handleChange} className={inputCls} placeholder="Répéter" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Licence FFT</label>
                <input name="fft_license" value={form.fft_license} onChange={handleChange} className={inputCls} placeholder="Optionnel" />
              </div>
              <div>
                <label className={labelCls}>Classement (points)</label>
                <input type="number" name="points" value={form.points} onChange={handleChange} className={inputCls} min={0} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Club</label>
              <input name="club" value={form.club} onChange={handleChange} className={inputCls} placeholder="Nom du club (optionnel)" />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Créer mon compte
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-blue-600 font-medium hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
