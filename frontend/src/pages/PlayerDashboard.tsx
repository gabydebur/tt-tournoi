import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tournamentsApi } from '../api/tournaments';
import { registrationsApi } from '../api/registrations';
import { matchesApi } from '../api/matches';
import { seriesApi } from '../api/series';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';
import type { Tournament, Registration, Series } from '../types';
import {
  Calendar,
  Trophy,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  Plus,
} from 'lucide-react';

const statusBadge: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'En attente', cls: 'bg-yellow-100 text-yellow-700' },
  CONFIRMED: { label: 'Confirmé', cls: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Refusé', cls: 'bg-red-100 text-red-700' },
};


function RegistrationBadge({ status }: { status: string }) {
  const cfg = statusBadge[status] ?? statusBadge['PENDING'];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

interface RegisterModalProps {
  tournament: Tournament;
  onClose: () => void;
}

function RegisterModal({ tournament, onClose }: RegisterModalProps) {
  const queryClient = useQueryClient();
  const { data: seriesList, isLoading } = useQuery({
    queryKey: ['series', tournament.id],
    queryFn: () => seriesApi.list(tournament.id),
  });
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => registrationsApi.register(tournament.id, selectedSeries!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myRegistrations'] });
      onClose();
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Erreur lors de l'inscription");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">S'inscrire au tournoi</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle size={20} />
          </button>
        </div>
        <div className="px-6 py-4">
          <p className="text-sm text-gray-600 mb-4">
            Sélectionnez la série dans laquelle vous souhaitez participer :
          </p>
          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-2">
              {(seriesList ?? []).map((series: Series) => (
                <button
                  key={series.id}
                  onClick={() => setSelectedSeries(series.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                    selectedSeries === series.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-800">{series.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Jusqu'à {series.max_points} pts
                    {series.min_points ? ` · Depuis ${series.min_points} pts` : ''}
                    {' · '}{series.players_per_pool} joueurs/poule
                  </div>
                </button>
              ))}
              {(seriesList ?? []).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  Aucune série disponible pour ce tournoi.
                </p>
              )}
            </div>
          )}
          {error && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Annuler
          </button>
          <button
            disabled={!selectedSeries || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
          >
            {mutation.isPending && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Confirmer l'inscription
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlayerDashboard() {
  const { user } = useAuth();
  const [registerTournament, setRegisterTournament] = useState<Tournament | null>(null);

  const { data: myRegistrations, isLoading: loadingRegs } = useQuery({
    queryKey: ['myRegistrations'],
    queryFn: registrationsApi.myRegistrations,
  });

  const { data: tournaments, isLoading: loadingTournaments } = useQuery({
    queryKey: ['tournaments'],
    queryFn: tournamentsApi.list,
  });

  // Get today's matches for the player from IN_PROGRESS tournaments
  const inProgressTournaments = (tournaments ?? []).filter(
    (t) => t.status === 'IN_PROGRESS'
  );

  const { data: todayMatches } = useQuery({
    queryKey: ['todayMatches', inProgressTournaments[0]?.id],
    queryFn: () =>
      inProgressTournaments[0]
        ? matchesApi.list(inProgressTournaments[0].id, { day: 1 })
        : Promise.resolve([]),
    enabled: inProgressTournaments.length > 0,
  });

  const openTournaments = (tournaments ?? []).filter(
    (t) => t.status === 'REGISTRATION_OPEN'
  );

  const myTournamentIds = new Set(
    (myRegistrations ?? []).map((r: Registration) => r.tournament_id)
  );

  const availableTournaments = openTournaments.filter(
    (t) => !myTournamentIds.has(t.id)
  );

  // Today's matches involving the current user
  const myTodayMatches = (todayMatches ?? []).filter(
    (m) =>
      m.player1.id === user?.player?.id ||
      m.player2.id === user?.player?.id
  );

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Welcome */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
          <h1 className="text-2xl font-bold">
            Bonjour, {user?.player?.first_name} !
          </h1>
          <p className="text-blue-100 mt-1">
            Classement : {user?.player?.points} pts
            {user?.player?.club ? ` · ${user?.player?.club}` : ''}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Today's matches */}
            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Clock size={18} className="text-blue-600" />
                Mes matchs du jour
              </h2>
              {myTodayMatches.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400">
                  Aucun match prévu aujourd'hui
                </div>
              ) : (
                <div className="space-y-3">
                  {myTodayMatches.map((match) => {
                    const isP1 = match.player1.id === user?.player?.id;
                    const opponent = isP1 ? match.player2 : match.player1;
                    return (
                      <div
                        key={match.id}
                        className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-medium text-gray-800">
                            vs {opponent.first_name} {opponent.last_name}
                          </div>
                          <div className="text-sm text-gray-500 mt-0.5">
                            {match.series?.name}
                            {match.table ? ` · Table ${match.table.number}` : ''}
                          </div>
                        </div>
                        <div>
                          {match.status === 'IN_PROGRESS' && (
                            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2.5 py-1 rounded-full font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                              En cours
                            </span>
                          )}
                          {match.status === 'PENDING' && (
                            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                              En attente
                            </span>
                          )}
                          {match.status === 'FINISHED' && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <CheckCircle size={14} /> Terminé
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* My registrations */}
            <section>
              <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Trophy size={18} className="text-blue-600" />
                Mes inscriptions
              </h2>
              {loadingRegs ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
                </div>
              ) : (myRegistrations ?? []).length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400">
                  Vous n'êtes inscrit à aucun tournoi.
                </div>
              ) : (
                <div className="space-y-3">
                  {(myRegistrations as Registration[]).map((reg) => {
                    return (
                      <div
                        key={reg.id}
                        className="bg-white rounded-xl border border-gray-200 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-gray-800">
                              {reg.series?.name}
                            </div>
                            <div className="text-sm text-gray-500 mt-0.5">
                              Inscrit le{' '}
                              {new Date(reg.registered_at).toLocaleDateString('fr-FR')}
                            </div>
                          </div>
                          <RegistrationBadge status={reg.status} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Right column: available tournaments */}
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Calendar size={18} className="text-blue-600" />
              Tournois ouverts
            </h2>
            {loadingTournaments ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
              </div>
            ) : availableTournaments.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-400 text-center">
                Aucun tournoi disponible
              </div>
            ) : (
              <div className="space-y-3">
                {availableTournaments.map((t) => (
                  <div
                    key={t.id}
                    className="bg-white rounded-xl border border-gray-200 p-4"
                  >
                    <div className="font-semibold text-gray-800 text-sm">{t.name}</div>
                    {t.location && (
                      <div className="text-xs text-gray-500 mt-0.5">{t.location}</div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(t.start_date).toLocaleDateString('fr-FR')} –{' '}
                      {new Date(t.end_date).toLocaleDateString('fr-FR')}
                    </div>
                    <button
                      onClick={() => setRegisterTournament(t)}
                      className="mt-3 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <Plus size={14} /> S'inscrire
                      <ChevronRight size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {registerTournament && (
        <RegisterModal
          tournament={registerTournament}
          onClose={() => setRegisterTournament(null)}
        />
      )}
    </Layout>
  );
}
