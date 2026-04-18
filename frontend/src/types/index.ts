// ─── Auth & Users ─────────────────────────────────────────────────────────────

export type Role = 'PLAYER' | 'REFEREE' | 'ADMIN';

export interface Player {
  id: string;
  first_name: string;
  last_name: string;
  fft_license?: string;
  points: number;
  club?: string;
  email: string;
}

export interface User {
  id: string;
  email: string;
  role: Role;
  player: Player;
}

export interface TokenPayload {
  sub: string;
  role: Role;
  exp: number;
  iat: number;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  fft_license?: string;
  points: number;
  club?: string;
}

// ─── Tournaments ──────────────────────────────────────────────────────────────

export type TournamentStatus =
  | 'DRAFT'
  | 'REGISTRATION_OPEN'
  | 'REGISTRATION_CLOSED'
  | 'IN_PROGRESS'
  | 'FINISHED';

export interface Tournament {
  id: string;
  name: string;
  description?: string;
  location?: string;
  start_date: string;
  end_date: string;
  status: TournamentStatus;
  created_at: string;
  max_series_per_player?: number | null;
}

export interface TournamentPayload {
  name: string;
  description?: string;
  location?: string;
  start_date: string;
  end_date: string;
  max_series_per_player?: number | null;
}

// ─── Series ───────────────────────────────────────────────────────────────────

export type PhaseFormat = 'POOLS_ONLY' | 'POOLS_THEN_ELIMINATION' | 'ELIMINATION_ONLY';

export interface Series {
  id: string;
  tournament_id: string;
  name: string;
  max_points: number;
  min_points?: number;
  phase_format: PhaseFormat;
  sets_to_win_match: number;
  sets_to_win_final: number;
  players_per_pool: number;
}

export interface SeriesPayload {
  name: string;
  max_points: number;
  min_points?: number;
  phase_format: PhaseFormat;
  sets_to_win_match: number;
  sets_to_win_final: number;
  players_per_pool: number;
}

// ─── Registrations ────────────────────────────────────────────────────────────

export type RegistrationStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

export interface Registration {
  id: string;
  player: Player;
  series: Series;
  tournament_id: string;
  status: RegistrationStatus;
  registered_at: string;
}

// ─── Tables ───────────────────────────────────────────────────────────────────

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';

export interface TournamentTable {
  id: string;
  tournament_id: string;
  number: number;
  status: TableStatus;
  current_match?: Match;
}

// ─── Matches ─────────────────────────────────────────────────────────────────

export type MatchStatus = 'PENDING' | 'SCHEDULED' | 'IN_PROGRESS' | 'FINISHED';
export type MatchPhase = 'POOL' | 'ELIMINATION';
export type MatchRound =
  | 'POOL'
  | 'ROUND_OF_16'
  | 'QUARTER_FINAL'
  | 'SEMI_FINAL'
  | 'FINAL'
  | 'THIRD_PLACE';

export interface SetScore {
  score_player1: number;
  score_player2: number;
}

export interface Match {
  id: string;
  tournament_id: string;
  series: Series;
  player1: Player;
  player2: Player;
  table?: TournamentTable;
  status: MatchStatus;
  phase: MatchPhase;
  round: MatchRound;
  sets: SetScore[];
  winner?: Player;
  scheduled_at?: string;
  started_at?: string;
  finished_at?: string;
  waiting_since?: string;
  pool_name?: string;
}

export interface MatchResultPayload {
  sets: SetScore[];
}

// ─── Standings ────────────────────────────────────────────────────────────────

export interface PoolPlayer {
  player: Player;
  wins: number;
  losses: number;
  sets_won: number;
  sets_lost: number;
  points: number;
}

export interface StandingsPool {
  name: string;
  players: PoolPlayer[];
}

export interface SeriesStandings {
  series_id: string;
  pools: StandingsPool[];
}

// ─── WebSocket Events ────────────────────────────────────────────────────────

export type WsEventType = 'match_updated' | 'standings_updated';

export interface WsEvent {
  type: WsEventType;
  data: Match | SeriesStandings;
}

// ─── Bracket ─────────────────────────────────────────────────────────────────

export interface BracketMatch {
  id: string;
  player1?: Player;
  player2?: Player;
  winner?: Player;
  sets: SetScore[];
  status: MatchStatus;
  round: MatchRound;
}

export interface BracketRound {
  name: string;
  matches: BracketMatch[];
}

// ─── Pools (draw / bracket management) ───────────────────────────────────────

export type PoolStatus = 'DRAFT' | 'CONFIRMED' | 'IN_PROGRESS' | 'FINISHED';

export interface PoolPlayerBrief {
  id: string;
  first_name: string;
  last_name: string;
  points: number;
  club?: string;
}

export interface PoolData {
  id: string;
  name: string;
  status: PoolStatus;
  table_id: string | null;
  series_id: string;
  series_name: string;
  players: PoolPlayerBrief[];
}

export interface SwapPlayersPayload {
  pool_a_id: string;
  player_a_id: string;
  pool_b_id: string;
  player_b_id: string;
}

// ─── Match suggestions (v2) ──────────────────────────────────────────────────

export interface SuggestionPoolBrief {
  id: string;
  name: string;
  series_name: string;
  players: PoolPlayerBrief[];
}

export interface SuggestionEliminationBrief {
  id: string;
  series_name: string;
  round: MatchRound;
  player1: PoolPlayerBrief;
  player2: PoolPlayerBrief;
}

export interface AvailableTableBrief {
  id: string;
  number: number;
  status: 'FREE';
}

export interface ActiveTableCurrentPool {
  id: string;
  name: string;
  series_name: string;
}

export interface ActiveTableCurrentMatch {
  id: string;
  player1: PoolPlayerBrief;
  player2: PoolPlayerBrief;
  sets: SetScore[];
}

export interface ActiveTableBrief {
  id: string;
  number: number;
  current_pool: ActiveTableCurrentPool | null;
  current_match: ActiveTableCurrentMatch | null;
  pool_progress: { played: number; total: number };
}

export interface MatchSuggestions {
  pools_to_start: SuggestionPoolBrief[];
  eliminations_to_start: SuggestionEliminationBrief[];
  available_tables: AvailableTableBrief[];
  active_tables: ActiveTableBrief[];
}

// ─── Live display state ──────────────────────────────────────────────────────

export interface DisplayActiveSeries {
  id: string;
  name: string;
  phase: 'POOLS' | 'ELIMINATION';
  pools_in_progress: number;
  pools_total: number;
}

export interface DisplayActiveMatch {
  table_number: number;
  series_name: string;
  pool_name: string;
  player1: PoolPlayerBrief;
  player2: PoolPlayerBrief;
  sets: SetScore[];
  current_set_score: { p1: number; p2: number };
}

export interface DisplayState {
  tournament: { id: string; name: string; status: TournamentStatus };
  active_series: DisplayActiveSeries[];
  active_matches: DisplayActiveMatch[];
}

// ─── Demo seed ───────────────────────────────────────────────────────────────

export interface DemoSeedResponse {
  tournament_id: string;
  tournament_name: string;
  player_count: number;
  registration_count: number;
  table_count: number;
  login_hint: string;
}
