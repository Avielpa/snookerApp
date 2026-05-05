import { api } from './api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PlayerFeatures {
  elo: number;
  weighted_form: number;
  h2h_win_rate: number;
  world_ranking: number;
  ranking_trend: number;
  frame_win_pct: number;
  deciding_pct: number;
  finals_pct: number;
  streak_norm: number;
  century_rate: number;
  top16_seasons: number;
  avg_break_quality: number | null;
  break_rate: number | null;
  frame_dominance: number | null;
  stamina_score: number | null;
}

export interface AIPrediction {
  predicted_winner_id: number;
  p1_win_probability: number;
  p2_win_probability: number;
  confidence: 'high' | 'medium' | 'low';
  features_p1: PlayerFeatures;
  features_p2: PlayerFeatures;
  top_factors: string[];
  narrative: string;
  model_version: string;
  model_brier_score: number | null;
  generated_at: string;
}

export interface MatchPlayers {
  p1Id: number;
  p2Id: number;
  p1Name: string;
  p2Name: string;
}

// ── API calls ──────────────────────────────────────────────────────────────

export async function fetchMatchPlayers(matchId: number): Promise<MatchPlayers> {
  const res = await api.get(`matches/${matchId}/`);
  const d = res.data;
  return {
    p1Id: d.Player1ID,
    p2Id: d.Player2ID,
    p1Name: d.player1_name || `Player ${d.Player1ID}`,
    p2Name: d.player2_name || `Player ${d.Player2ID}`,
  };
}

export async function fetchAIPrediction(p1Id: number, p2Id: number): Promise<AIPrediction> {
  const res = await api.get(`ai-prediction/${p1Id}/${p2Id}/`, { ttl: 3600 } as any);
  return res.data as AIPrediction;
}
