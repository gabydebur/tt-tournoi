// ─── Auth & Users ─────────────────────────────────────────────────────────────

export type Role = 'PLAYER' | 'REFEREE' | 'ADMIN';

export interface Player {
  id: number;
  first_name: string;
  last_name: string;
  fft_license?: string;
  points: number;
  club?: string;
  email: string;
}

export interface User {
  id: number;
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
  id: number;
  name: string;
  description?: string;
  location?: string;
  start_date: string;
  end_date: string;
  status: TournamentStatus;
  created_at: string;
}

export interface TournamentPayload {
  name: string;
  description?: string;
  location?: string;
  start_date: string;
  end_date: string;
}

// ─── Series ───────────────────────────────────────────────────────────────────

export type PhaseFormat = 'POOL_ONLY' | 'POOL_THEN_ELIMINATION' | 'ELIMINATION_ONLY';

export interface Series {
  id: number;
  tournament_id: number;
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
  id: number;
  player: Player;
  series: Series;
  tournament_id: number;
  status: RegistrationStatus;
  registered_at: string;
}

// ─── Tables ───────────────────────────────────────────────────────────────────

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';

export interface TournamentTable {
  id: number;
  tournament_id: number;
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
  id: number;
  tournament_id: number;
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

export interface Pool {
  name: string;
  players: PoolPlayer[];
}

export interface SeriesStandings {
  series_id: number;
  pools: Pool[];
}

// ─── WebSocket Events ────────────────────────────────────────────────────────

export type WsEventType = 'match_updated' | 'standings_updated';

export interface WsEvent {
  type: WsEventType;
  data: Match | SeriesStandings;
}

// ─── Bracket ─────────────────────────────────────────────────────────────────

export interface BracketMatch {
  id: number;
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
