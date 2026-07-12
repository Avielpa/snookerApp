// Baize/brass visual theme for the scoreboard session only (app/scoreboard/*.tsx and
// app/components/scoreboard/*.tsx). Deliberately NOT part of contexts/ThemeContext.tsx —
// that context is read by every screen in the app, and editing it would risk bleeding
// this palette into Home/Rankings/Calendar/etc. See
// docs/SCOREBOARD_RESTYLE_AND_INSIGHTS_PLAN.md, section 2.4, for why this is a separate file.
//
// Field names match the subset of contexts/ThemeContext.tsx's `Colors` interface that the
// scoreboard screens actually use, so call sites only need `const c = scoreboardColors`
// instead of `const c = theme.colors` — no JSX/structure changes required anywhere.

export interface ScoreboardColors {
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  cardBackground: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textHeader: string;
  primary: string;
  error: string;
}

export const scoreboardColors: ScoreboardColors = {
  background: '#0a2e21',          // felt
  backgroundSecondary: '#0a2a1f', // ball-pad tray / panels
  backgroundTertiary: '#123526',  // pills, inputs
  cardBackground: '#0f3527',      // cards
  cardBorder: '#2b5940',          // card borders
  textPrimary: '#f2ece0',         // chalk
  textSecondary: '#b9b0a0',       // chalk, dimmer
  textMuted: '#877e70',           // chalk, faint
  textHeader: '#eccb7c',          // brass bright (headings)
  primary: '#c79a3e',             // brass
  error: '#e0645f',               // foul red
};

// True snooker-ball colours, used only for the BallPad's button fills — replaces the
// generic swatch previously exported as BALL_COLORS from hooks/useSnookerGame.ts.
// Point values (BALL_VALUES) are unaffected and still come from the hook — this is a
// pure rendering-color table, not game logic.
export const scoreboardBallColors: Record<'red' | 'yellow' | 'green' | 'brown' | 'blue' | 'pink' | 'black', string> = {
  red: '#c31f3a',
  yellow: '#f0bd3e',
  green: '#1c7a3e',
  brown: '#6d4423',
  blue: '#25529e',
  pink: '#e792ae',
  black: '#161616',
};
