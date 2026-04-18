import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tournamentsApi } from '../api/tournaments';
import { seriesApi } from '../api/series';
import { registrationsApi } from '../api/registrations';
import { tablesApi } from '../api/tables';
import { demoApi } from '../api/demo';
import Layout from '../components/Layout';
import TournamentForm from '../components/TournamentForm';
import SeriesForm from '../components/SeriesForm';
import PoolsManagement from '../components/PoolsManagement';
import type {
  Tournament,
  TournamentPayload,
  Series,
  SeriesPayload,
  Registration,
  DemoSeedResponse,
} from '../types';
import {
  Trophy,
  Users,
  Tag,
  Plus,
  Edit2,
  Play,
  Lock,
  Unlock,
  CheckCircle,
  XCircle,
  Table2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles,
  Network,
} from 'lucide-react';

type Tab = 'tournaments' | 'series' | 'registrations' | 'pools';

// ── Status badge ────────────────────────────────────────────────────────────

const tournamentStatusCfg: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Brouillon', cls: 'bg-gray-100 text-gray-500' },
  REGISTRATION_OPEN: { label: 'Inscriptions ouvertes', cls: 'bg-blue-100 text-blue-600' },
  REGISTRATION_CLOSED: { label: 'Inscriptions fermées', cls: 'bg-orange-100 text-orange-600' },
  IN_PROGRESS: { label: 'En cours', cls: 'bg-green-100 text-green-700' },
  FINISHED: { label: 'Terminé', cls: 'bg-gray-100 text-gray-400' },
};

const regStatusCfg: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'En attente', cls: 'bg-yellow-100 text-yellow-700' },
  CONFIRMED: { label: 'Confirmé', cls: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Refusé', cls: 'bg-red-100 text-red-600' },
};

function TournamentStatusBadge({ status }: { status: string }) {
  const cfg = tournamentStatusCfg[status] ?? tournamentStatusCfg['DRAFT'];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ── Tournament row with actions ──────────────────────────────────────────────

function TournamentRow({
  tournament,
  onEdit,
  onOpenReg,
  onCloseReg,
  onStart,
  onManageSeries,
  onManageTables,
}: {
  tournament: Tournament;
  onEdit: (t: Tournament) => void;
  onOpenReg: (id: number) => void;
  onCloseReg: (id: number) => void;
  onStart: (id: number) => void;
  onManageSeries: (t: Tournament) => void;
  onManageTables: (t: Tournament) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const s = tournament.status;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-gray-600"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-800 text-sm">{tournament.name}</div>
          <div className="text-xs text-gray-400">
            {tournament.location && `${tournament.location} · `}
            {new Date(tournament.start_date).toLocaleDateString('fr-FR')} –{' '}
            {new Date(tournament.end_date).toLocaleDateString('fr-FR')}
          </div>
        </div>
        <TournamentStatusBadge status={s} />
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onEdit(tournament)}
            className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
            title="Modifier"
          >
            <Edit2 size={14} />
          </button>
          {s === 'DRAFT' && (
            <button
              onClick={() => onOpenReg(tournament.id)}
              className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-md transition-colors"
            >
              <Unlock size={12} /> Ouvrir inscriptions
            </button>
          )}
          {s === 'REGISTRATION_OPEN' && (
            <button
              onClick={() => onCloseReg(tournament.id)}
              className="flex items-center gap-1 text-xs bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1 rounded-md transition-colors"
            >
              <Lock size={12} /> Fermer inscriptions
            </button>
          )}
          {s === 'REGISTRATION_CLOSED' && (
            <button
              onClick={() => onStart(tournament.id)}
              className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded-md transition-colors"
            >
              <Play size={12} /> Démarrer
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 flex gap-3">
          <button
            onClick={() => onManageSeries(tournament)}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium border border-blue-200 rounded-md px-3 py-1.5 bg-white"
          >
            <Tag size={12} /> Gérer les séries
          </button>
          <button
            onClick={() => onManageTables(tournament)}
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-700 font-medium border border-gray-200 rounded-md px-3 py-1.5 bg-white"
          >
            <Table2 size={12} /> Gérer les tables
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tables management modal ───────────────────────────────────────────────────

function TablesModal({
  tournament,
  onClose,
}: {
  tournament: Tournament;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [count, setCount] = useState(4);
  const [error, setError] = useState<string | null>(null);

  const { data: tables } = useQuery({
    queryKey: ['tables', tournament.id],
    queryFn: () => tablesApi.list(tournament.id),
  });

  const mutation = useMutation({
    mutationFn: () => tablesApi.create(tournament.id, count),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables', tournament.id] });
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Erreur');
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">
            Tables — {tournament.name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle size={20} />
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">
              Tables actuelles : <strong>{(tables ?? []).length}</strong>
            </p>
            <div className="flex flex-wrap gap-2">
              {(tables ?? []).map((t) => (
                <span
                  key={t.id}
                  className="text-xs bg-gray-100 rounded-md px-2 py-1"
                >
                  Table {t.number}
                </span>
              ))}
            </div>
          </div>
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Créer / reconfigurer avec N tables
            </label>
            <div className="flex gap-3">
              <input
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                {mutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                Configurer
              </button>
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Series panel ──────────────────────────────────────────────────────────────

function SeriesPanel({ tournament }: { tournament: Tournament }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editSeries, setEditSeries] = useState<Series | null>(null);

  const { data: seriesList, isLoading } = useQuery({
    queryKey: ['series', tournament.id],
    queryFn: () => seriesApi.list(tournament.id),
  });

  const createMutation = useMutation({
    mutationFn: (payload: SeriesPayload) => seriesApi.create(tournament.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series', tournament.id] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: SeriesPayload }) =>
      seriesApi.update(tournament.id, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series', tournament.id] });
      setEditSeries(null);
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700">Séries de {tournament.name}</h3>
        <button
          onClick={() => { setShowForm(true); setEditSeries(null); }}
          className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg"
        >
          <Plus size={12} /> Nouvelle série
        </button>
      </div>

      {(showForm || editSeries) && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
          <h4 className="font-medium text-gray-700 mb-3 text-sm">
            {editSeries ? 'Modifier la série' : 'Nouvelle série'}
          </h4>
          <SeriesForm
            initial={editSeries ?? undefined}
            onSubmit={async (payload) => {
              if (editSeries) {
                await updateMutation.mutateAsync({ id: editSeries.id, payload });
              } else {
                await createMutation.mutateAsync(payload);
              }
            }}
            onCancel={() => { setShowForm(false); setEditSeries(null); }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        </div>
      )}

      {(seriesList ?? []).length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Aucune série créée</p>
      ) : (
        <div className="space-y-2">
          {(seriesList as Series[]).map((s) => (
            <div key={s.id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-800 text-sm">{s.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  ≤ {s.max_points} pts{s.min_points ? ` · ≥ ${s.min_points} pts` : ''} ·{' '}
                  {s.phase_format.replace(/_/g, ' ').toLowerCase()} ·{' '}
                  Best of {s.sets_to_win_match * 2 - 1} · {s.players_per_pool} j/poule
                </div>
              </div>
              <button
                onClick={() => { setEditSeries(s); setShowForm(false); }}
                className="text-gray-400 hover:text-blue-600 p-1"
              >
                <Edit2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Registrations panel ───────────────────────────────────────────────────────

function RegistrationsPanel({ tournamentId }: { tournamentId: number }) {
  const queryClient = useQueryClient();

  const { data: registrations, isLoading } = useQuery({
    queryKey: ['registrations', tournamentId],
    queryFn: () => registrationsApi.listForTournament(tournamentId),
  });

  const confirmMutation = useMutation({
    mutationFn: registrationsApi.confirm,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['registrations', tournamentId] }),
  });

  const rejectMutation = useMutation({
    mutationFn: registrationsApi.reject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['registrations', tournamentId] }),
  });

  if (isLoading) {
    return <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" /></div>;
  }

  const regs = (registrations as Registration[]) ?? [];
  const pending = regs.filter((r) => r.status === 'PENDING');
  const others = regs.filter((r) => r.status !== 'PENDING');

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-700">
        Inscriptions ({regs.length})
      </h3>
      {regs.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">Aucune inscription</p>
      )}
      {pending.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-yellow-700 uppercase mb-2">
            En attente ({pending.length})
          </div>
          <div className="space-y-2">
            {pending.map((reg) => (
              <div key={reg.id} className="bg-white border border-yellow-200 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-800 text-sm">
                    {reg.player.first_name} {reg.player.last_name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {reg.player.points} pts · {reg.series?.name}
                    {reg.player.club ? ` · ${reg.player.club}` : ''}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => confirmMutation.mutate(reg.id)}
                    disabled={confirmMutation.isPending}
                    className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded-md"
                  >
                    <CheckCircle size={12} /> Confirmer
                  </button>
                  <button
                    onClick={() => rejectMutation.mutate(reg.id)}
                    disabled={rejectMutation.isPending}
                    className="flex items-center gap-1 text-xs bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 rounded-md"
                  >
                    <XCircle size={12} /> Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase mb-2">
            Traitées ({others.length})
          </div>
          <div className="space-y-2">
            {others.map((reg) => {
              const cfg = regStatusCfg[reg.status] ?? regStatusCfg['PENDING'];
              return (
                <div key={reg.id} className="bg-white border border-gray-100 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-700 text-sm">
                      {reg.player.first_name} {reg.player.last_name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {reg.player.points} pts · {reg.series?.name}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.cls}`}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main AdminDashboard ────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('tournaments');
  const [showTournamentForm, setShowTournamentForm] = useState(false);
  const [editTournament, setEditTournament] = useState<Tournament | null>(null);
  const [seriesTournament, setSeriesTournament] = useState<Tournament | null>(null);
  const [tablesTournament, setTablesTournament] = useState<Tournament | null>(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);
  const [poolsTournamentId, setPoolsTournamentId] = useState<number | null>(null);
  const [showDemoConfirm, setShowDemoConfirm] = useState(false);
  const [demoResult, setDemoResult] = useState<DemoSeedResponse | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);

  const { data: tournaments, isLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: tournamentsApi.list,
  });

  const createMutation = useMutation({
    mutationFn: (payload: TournamentPayload) => tournamentsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setShowTournamentForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TournamentPayload }) =>
      tournamentsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setEditTournament(null);
    },
  });

  const openRegMutation = useMutation({
    mutationFn: tournamentsApi.openRegistration,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournaments'] }),
  });

  const closeRegMutation = useMutation({
    mutationFn: tournamentsApi.closeRegistration,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournaments'] }),
  });

  const startMutation = useMutation({
    mutationFn: tournamentsApi.start,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournaments'] }),
  });

  const demoMutation = useMutation({
    mutationFn: demoApi.seed,
    onSuccess: (data) => {
      setDemoResult(data);
      setDemoError(null);
      setShowDemoConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    },
    onError: (err: unknown) => {
      setDemoError(err instanceof Error ? err.message : 'Erreur lors du seed démo');
      setShowDemoConfirm(false);
    },
  });

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'tournaments', label: 'Tournois', icon: <Trophy size={15} /> },
    { key: 'series', label: 'Séries', icon: <Tag size={15} /> },
    { key: 'registrations', label: 'Inscriptions', icon: <Users size={15} /> },
    { key: 'pools', label: 'Poules', icon: <Network size={15} /> },
  ];

  const tournamentList = (tournaments as Tournament[]) ?? [];
  const regsOrSeriesTournament =
    tournamentList.find((t) => t.id === selectedTournamentId) ?? tournamentList[0] ?? null;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Administration</h1>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tournaments tab ── */}
        {activeTab === 'tournaments' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-700">Tournois</h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => { setShowDemoConfirm(true); setDemoError(null); }}
                  className="flex items-center gap-1.5 text-sm bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-lg transition-colors"
                  title="Recharger un jeu de données de démonstration"
                >
                  <Sparkles size={15} /> Charger des données demo
                </button>
                <button
                  onClick={() => { setShowTournamentForm(true); setEditTournament(null); }}
                  className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors"
                >
                  <Plus size={15} /> Nouveau tournoi
                </button>
              </div>
            </div>

            {demoResult && (
              <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 rounded-lg p-3 border border-green-100">
                <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-medium">
                    Tournoi démo « {demoResult.tournament_name} » créé
                  </div>
                  <div className="text-xs text-green-600 mt-0.5">
                    {demoResult.player_count} joueurs · {demoResult.registration_count} inscriptions · {demoResult.table_count} tables
                  </div>
                  <div className="text-xs text-green-600 mt-0.5">
                    {demoResult.login_hint}
                  </div>
                </div>
                <button
                  onClick={() => setDemoResult(null)}
                  className="text-green-500 hover:text-green-700"
                >
                  <XCircle size={14} />
                </button>
              </div>
            )}

            {demoError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3 border border-red-100">
                <AlertCircle size={14} /> {demoError}
              </div>
            )}

            {(showTournamentForm || editTournament) && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="font-semibold text-gray-700 mb-4">
                  {editTournament ? 'Modifier le tournoi' : 'Nouveau tournoi'}
                </h3>
                <TournamentForm
                  initial={editTournament ?? undefined}
                  onSubmit={async (payload) => {
                    if (editTournament) {
                      await updateMutation.mutateAsync({ id: editTournament.id, payload });
                    } else {
                      await createMutation.mutateAsync(payload);
                    }
                  }}
                  onCancel={() => { setShowTournamentForm(false); setEditTournament(null); }}
                  isLoading={createMutation.isPending || updateMutation.isPending}
                />
              </div>
            )}

            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
              </div>
            ) : tournamentList.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
                Aucun tournoi créé
              </div>
            ) : (
              <div className="space-y-3">
                {tournamentList.map((t) => (
                  <TournamentRow
                    key={t.id}
                    tournament={t}
                    onEdit={setEditTournament}
                    onOpenReg={(id) => openRegMutation.mutate(id)}
                    onCloseReg={(id) => closeRegMutation.mutate(id)}
                    onStart={(id) => startMutation.mutate(id)}
                    onManageSeries={(t) => { setSeriesTournament(t); setActiveTab('series'); }}
                    onManageTables={setTablesTournament}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Series tab ── */}
        {activeTab === 'series' && (
          <div className="space-y-4">
            {tournamentList.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sélectionner un tournoi
                </label>
                <select
                  value={seriesTournament?.id ?? regsOrSeriesTournament?.id ?? ''}
                  onChange={(e) => {
                    const t = tournamentList.find((t) => t.id === Number(e.target.value));
                    if (t) setSeriesTournament(t);
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {tournamentList.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
            {(seriesTournament ?? regsOrSeriesTournament) ? (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <SeriesPanel tournament={seriesTournament ?? regsOrSeriesTournament!} />
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">
                Aucun tournoi disponible
              </p>
            )}
          </div>
        )}

        {/* ── Pools tab ── */}
        {activeTab === 'pools' && (
          <div className="space-y-4">
            {tournamentList.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sélectionner un tournoi
                </label>
                <select
                  value={poolsTournamentId ?? regsOrSeriesTournament?.id ?? ''}
                  onChange={(e) => setPoolsTournamentId(Number(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {tournamentList.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
            {((poolsTournamentId
              ? tournamentList.find((t) => t.id === poolsTournamentId)
              : null) ?? regsOrSeriesTournament) ? (
              <PoolsManagement
                tournamentId={
                  ((poolsTournamentId
                    ? tournamentList.find((t) => t.id === poolsTournamentId)
                    : null) ?? regsOrSeriesTournament)!.id
                }
              />
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">Aucun tournoi disponible</p>
            )}
          </div>
        )}

        {/* ── Registrations tab ── */}
        {activeTab === 'registrations' && (
          <div className="space-y-4">
            {tournamentList.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sélectionner un tournoi
                </label>
                <select
                  value={selectedTournamentId ?? regsOrSeriesTournament?.id ?? ''}
                  onChange={(e) => setSelectedTournamentId(Number(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {tournamentList.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
            {regsOrSeriesTournament ? (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <RegistrationsPanel tournamentId={regsOrSeriesTournament.id} />
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">Aucun tournoi disponible</p>
            )}
          </div>
        )}
      </div>

      {/* Tables modal */}
      {tablesTournament && (
        <TablesModal
          tournament={tablesTournament}
          onClose={() => setTablesTournament(null)}
        />
      )}

      {/* Demo seed confirmation modal */}
      {showDemoConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Sparkles size={18} className="text-yellow-500" />
                Charger des données de démonstration
              </h2>
              <button
                onClick={() => setShowDemoConfirm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3 border border-red-100">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <div>
                  Cette action <strong>supprime toutes les données</strong> (hors
                  comptes admin) et crée un tournoi de démonstration avec 12
                  joueurs, 3 séries et 4 tables.
                </div>
              </div>
              <p className="text-sm text-gray-600">Confirmer le chargement ?</p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setShowDemoConfirm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => demoMutation.mutate()}
                disabled={demoMutation.isPending}
                className="flex items-center gap-2 px-5 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {demoMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                Charger la demo
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
