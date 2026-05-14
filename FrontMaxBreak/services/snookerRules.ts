export interface SnookerRule {
  id: string;
  category: string;
  question: string;
  answer: string;
  keywords: string[];
}

export const RULE_CATEGORIES = [
  'Overview',
  'Balls & Values',
  'Sequence of Play',
  'Fouls',
  'Free Ball',
  'Snooker',
  'Colors Sequence',
  'Frame & Match',
  'Special Situations',
  'Common Scenarios',
] as const;

export const SNOOKER_RULES: SnookerRule[] = [
  // ── Overview ──────────────────────────────────────────────────────────────
  {
    id: 'ov1',
    category: 'Overview',
    question: 'What is the object of snooker?',
    answer:
      'Score more points than your opponent during a frame. Win more frames than your opponent in a match. Points are scored by potting balls and from opponent fouls.',
    keywords: ['object', 'goal', 'aim', 'purpose', 'win'],
  },
  {
    id: 'ov2',
    category: 'Overview',
    question: 'How many balls are used?',
    answer:
      '22 balls total: 15 red balls (1 pt each), 1 yellow (2), 1 green (3), 1 brown (4), 1 blue (5), 1 pink (6), 1 black (7), and 1 white cue ball.',
    keywords: ['balls', 'how many', 'count', '22'],
  },
  {
    id: 'ov3',
    category: 'Overview',
    question: 'What is the maximum possible break?',
    answer:
      '147 — pot all 15 reds each followed by black (15×8=120), then pot all 6 colors in sequence (2+3+4+5+6+7=27). Total: 147.',
    keywords: ['maximum', 'max', '147', 'break', 'highest'],
  },
  {
    id: 'ov4',
    category: 'Overview',
    question: 'What is a century break?',
    answer:
      'A break of 100 or more points scored in a single visit to the table (without missing or fouling).',
    keywords: ['century', '100', 'break'],
  },
  {
    id: 'ov5',
    category: 'Overview',
    question: 'How does a frame start?',
    answer:
      'A coin toss or choice decides who breaks. The break-off player places the cue ball anywhere in the D and must strike a red ball first. No reds need be potted on the break-off.',
    keywords: ['start', 'break off', 'begin', 'first shot', 'D'],
  },

  // ── Balls & Values ────────────────────────────────────────────────────────
  {
    id: 'bv1',
    category: 'Balls & Values',
    question: 'What are the point values of each ball?',
    answer:
      'Red = 1 pt, Yellow = 2 pts, Green = 3 pts, Brown = 4 pts, Blue = 5 pts, Pink = 6 pts, Black = 7 pts.',
    keywords: ['values', 'points', 'worth', 'score', 'red', 'yellow', 'green', 'brown', 'blue', 'pink', 'black'],
  },
  {
    id: 'bv2',
    category: 'Balls & Values',
    question: 'Where are the colored balls placed at the start?',
    answer:
      'Yellow: right of brown in the D. Green: left of brown in the D. Brown: centre of the D. Blue: centre of the table. Pink: between blue spot and top cushion. Black: 32.5 cm from top cushion.',
    keywords: ['spot', 'position', 'place', 'start', 'colored', 'colours'],
  },
  {
    id: 'bv3',
    category: 'Balls & Values',
    question: 'What is the D?',
    answer:
      "The D is the semicircle at the bottom of the table, with a radius of 29.2 cm drawn from the brown ball's spot. The cue ball is placed inside this area for the break-off and after a forced off-table event.",
    keywords: ['D', 'semicircle', 'baulk', 'cue ball in hand'],
  },
  {
    id: 'bv4',
    category: 'Balls & Values',
    question: 'What happens if a color has no spot available when it should be re-spotted?',
    answer:
      'Place the color on the highest available spot below its own. If no spot is available, place it as close to its own spot as possible between that spot and the top cushion.',
    keywords: ['respot', 're-spot', 'occupied', 'spot taken', 'no spot'],
  },
  {
    id: 'bv5',
    category: 'Balls & Values',
    question: 'Can the cue ball be placed anywhere after it goes off the table?',
    answer:
      'No. After a foul where the cue ball is potted or goes off the table, the incoming player plays from in-hand — the cue ball can be placed anywhere inside the D.',
    keywords: ['cue ball', 'in hand', 'off table', 'potted white'],
  },

  // ── Sequence of Play ──────────────────────────────────────────────────────
  {
    id: 'sp1',
    category: 'Sequence of Play',
    question: 'What must I pot first — a red or a color?',
    answer:
      'Always pot a red first. After potting a red you must pot a nominated color. This red-then-color sequence repeats until all reds are off the table.',
    keywords: ['first', 'sequence', 'order', 'red', 'color', 'what to pot'],
  },
  {
    id: 'sp2',
    category: 'Sequence of Play',
    question: 'Does the color go back after being potted?',
    answer:
      'Yes — during the reds phase, any nominated color potted after a red is replaced on its spot. Colors only stay off the table during the final colors sequence (after all reds are gone).',
    keywords: ['color back', 'replaced', 'respotted', 'return', 'goes back'],
  },
  {
    id: 'sp3',
    category: 'Sequence of Play',
    question: 'What happens after all reds are potted?',
    answer:
      'The final nominated color (after the last red) is re-spotted, then the colors sequence begins: yellow, green, brown, blue, pink, black — in that order. Colors potted in the sequence stay off the table.',
    keywords: ['all reds', 'last red', 'colors phase', 'sequence', 'order', 'after reds'],
  },
  {
    id: 'sp4',
    category: 'Sequence of Play',
    question: 'Can I stay at the table after potting a red?',
    answer:
      'Yes. Potting a red continues your visit. You then nominate and attempt to pot a color. If you pot the color, you continue with another red (if any remain). You only leave the table when you miss or foul.',
    keywords: ['continue', 'stay', 'keep playing', 'visit', 'turn'],
  },
  {
    id: 'sp5',
    category: 'Sequence of Play',
    question: 'Must I hit the red or can I play a safety shot?',
    answer:
      "You must hit a red (or the ball 'on' if a free ball has been awarded) with your first impact. You can play any type of shot — safety, stun, side — as long as you hit the correct ball first.",
    keywords: ['safety', 'must hit', 'touch', 'first impact', 'what to hit'],
  },
  {
    id: 'sp6',
    category: 'Sequence of Play',
    question: 'Do I need to nominate a color out loud?',
    answer:
      'In formal play, you must nominate a color before playing if asked by the referee. In casual/hobby play, the intended ball is usually obvious and nomination can be assumed.',
    keywords: ['nominate', 'declare', 'announce', 'call'],
  },
  {
    id: 'sp7',
    category: 'Sequence of Play',
    question: 'What is a break?',
    answer:
      "A break is the total points scored in a single uninterrupted visit to the table. Your break resets to zero when your visit ends (miss, foul, or end of frame).",
    keywords: ['break', 'visit', 'consecutive', 'run'],
  },
  {
    id: 'sp8',
    category: 'Sequence of Play',
    question: 'Can I pot more than one red in one shot?',
    answer:
      'Yes. If two or more reds are potted in a single shot, each counts as 1 point. You then nominate one color for your next shot.',
    keywords: ['two reds', 'multiple reds', 'two balls', 'cannon'],
  },
  {
    id: 'sp9',
    category: 'Sequence of Play',
    question: 'What is a plant?',
    answer:
      "A plant (or set) is when you deliberately use one object ball to pot another. It is legal provided the designated ball goes in. If balls are touching before the shot, the cue ball must visibly move the first ball for it to count as a legal shot.",
    keywords: ['plant', 'set', 'touching', 'cluster', 'cannon'],
  },
  {
    id: 'sp10',
    category: 'Sequence of Play',
    question: 'Can I play any shot I like with the cue?',
    answer:
      'No push shots. Your cue tip must strike the cue ball cleanly with a single contact; maintaining contact while the cue ball is moving is a foul (push shot). Stun, screw, top, side, and massé shots are all legal.',
    keywords: ['push', 'double contact', 'legal shot', 'cue tip', 'masse'],
  },

  // ── Fouls ─────────────────────────────────────────────────────────────────
  {
    id: 'fo1',
    category: 'Fouls',
    question: 'What is the minimum foul penalty?',
    answer:
      'Four points. The opponent receives the higher of 4 points or the value of the ball involved in the foul.',
    keywords: ['minimum', 'foul', 'penalty', '4 points', 'least'],
  },
  {
    id: 'fo2',
    category: 'Fouls',
    question: 'What is the foul value if I pot the wrong ball?',
    answer:
      'The penalty is the higher of 4 points or the value of the ball incorrectly potted. Example: potting the blue (5) when on a red = 5-point foul. Potting yellow (2) when on a red = 4-point foul (minimum applies).',
    keywords: ['wrong ball', 'pot wrong', 'incorrect', 'foul value', 'penalty'],
  },
  {
    id: 'fo3',
    category: 'Fouls',
    question: 'What foul is called if I miss completely (no ball touched)?',
    answer:
      '4-point foul (minimum) for failing to hit the ball on. If the referee decides the player made no genuine attempt, a miss is also called.',
    keywords: ['miss', 'no contact', 'nothing', 'air shot', 'completely miss'],
  },
  {
    id: 'fo4',
    category: 'Fouls',
    question: 'What happens if the cue ball is potted (in-off)?',
    answer:
      'Foul — minimum 4 points. The penalty equals the higher of 4 or the value of the ball "on" at the time. The next player plays from in-hand inside the D.',
    keywords: ['in-off', 'cue ball potted', 'white potted', 'pocket white'],
  },
  {
    id: 'fo5',
    category: 'Fouls',
    question: 'What is the foul if I hit a color first when I should be hitting a red?',
    answer:
      'The penalty equals the higher of 4 points or the value of the color struck first. Example: hitting the pink (6) instead of a red = 6-point foul.',
    keywords: ['wrong ball hit', 'first contact', 'touch color', 'on red', 'hit wrong'],
  },
  {
    id: 'fo6',
    category: 'Fouls',
    question: 'What is the foul if a ball jumps off the table?',
    answer:
      'If any ball (including cue ball) is forced off the table it is a foul. Minimum 4 points, or the value of the jumped ball. The jumped ball is re-spotted; if the cue ball, opponent plays from in-hand.',
    keywords: ['jump', 'off table', 'fly', 'leave table'],
  },
  {
    id: 'fo7',
    category: 'Fouls',
    question: 'Is it a foul to play out of turn?',
    answer:
      'Yes — 4-point foul. Both players should keep track of whose turn it is; in formal play the referee calls this.',
    keywords: ['out of turn', 'wrong player', 'play twice'],
  },
  {
    id: 'fo8',
    category: 'Fouls',
    question: 'Is it a foul if I touch a ball with my hand or clothing?',
    answer:
      'Yes — touching any ball other than the cue ball with your cue tip (other than on the legal first strike) or touching any ball with your body, clothing, or the butt of the cue is a foul. Minimum 4 points.',
    keywords: ['touch', 'hand', 'body', 'clothing', 'accidental'],
  },
  {
    id: 'fo9',
    category: 'Fouls',
    question: 'Is it a foul to play before all balls have stopped moving?',
    answer:
      'Yes — 4-point foul. You must wait until all balls (including the cue ball) are completely at rest before playing.',
    keywords: ['moving', 'still moving', 'ball rolling', 'before stop'],
  },
  {
    id: 'fo10',
    category: 'Fouls',
    question: 'What happens after a foul — does the opponent have to play next?',
    answer:
      'The opponent may choose to: (1) play the next shot themselves, or (2) ask the player who fouled to play again from the position left. This option is theirs alone.',
    keywords: ['after foul', 'play again', 'foul play', 'opponent choice', 'who plays next'],
  },
  {
    id: 'fo11',
    category: 'Fouls',
    question: 'Can I concede a frame?',
    answer:
      'Yes. Either player may concede at any time. The opponent is awarded the frame.',
    keywords: ['concede', 'give up', 'resign', 'surrender'],
  },
  {
    id: 'fo12',
    category: 'Fouls',
    question: 'What is a push shot?',
    answer:
      'A push shot occurs when the cue tip is still in contact with the cue ball as it strikes the object ball, or re-contacts the cue ball after the initial stroke. It is a foul.',
    keywords: ['push shot', 'double tap', 'follow through', 'cue contact'],
  },
  {
    id: 'fo13',
    category: 'Fouls',
    question: 'Is it a foul if I accidentally move a ball while getting down to play?',
    answer:
      'Yes — if you disturb any ball while addressing the shot or during the stroke it is a foul. The referee replaces the disturbed ball and awards the appropriate penalty.',
    keywords: ['disturb', 'move accidentally', 'knock', 'touch ball'],
  },
  {
    id: 'fo14',
    category: 'Fouls',
    question: 'Foul penalty on black — how many points?',
    answer:
      '7 points — the value of the black. Applies whether you pot the black illegally, hit it when not the ball on, or it jumps off the table.',
    keywords: ['black foul', '7 points', 'foul on black'],
  },
  {
    id: 'fo15',
    category: 'Fouls',
    question: 'Foul penalty on pink — how many points?',
    answer:
      '6 points — the value of the pink.',
    keywords: ['pink foul', '6 points', 'foul on pink'],
  },

  // ── Free Ball ─────────────────────────────────────────────────────────────
  {
    id: 'fb1',
    category: 'Free Ball',
    question: 'What is a free ball?',
    answer:
      'After a foul, if the cue ball is left snookered (cannot hit either side of any ball "on" in a straight line), the incoming player is awarded a free ball. They may nominate any other ball and treat it as the ball "on" for that shot only.',
    keywords: ['free ball', 'snookered after foul', 'nominate any ball', 'escape'],
  },
  {
    id: 'fb2',
    category: 'Free Ball',
    question: 'How many points is a free ball worth?',
    answer:
      'The free ball scores the same value as the ball that was "on." If a red was on, the free ball scores 1. If a color was on, it scores that color\'s value. The nominated ball is not potted for its own value.',
    keywords: ['free ball value', 'worth', 'points', 'score'],
  },
  {
    id: 'fb3',
    category: 'Free Ball',
    question: 'After potting the free ball, what happens next?',
    answer:
      'If a red was on, the free ball counts as a red and the player then nominates and plays a color. If a color was on, the free ball counts as that color; play continues normally.',
    keywords: ['after free ball', 'next shot', 'continue'],
  },
  {
    id: 'fb4',
    category: 'Free Ball',
    question: 'Can the referee call a miss after a foul-and-miss situation?',
    answer:
      'Yes. If the referee judges the player did not make a genuine attempt to hit the ball on, a miss is called and the shot is replayed from the original position. This can be called repeatedly.',
    keywords: ['miss', 'foul and miss', 'no attempt', 'genuine effort'],
  },
  {
    id: 'fb5',
    category: 'Free Ball',
    question: 'Is a free ball awarded if the cue ball is touching the ball on?',
    answer:
      'No. If the cue ball is touching the ball on, the player plays away from that ball; no free ball is awarded.',
    keywords: ['touching', 'cue ball touching', 'touching ball on', 'play away'],
  },

  // ── Snooker ───────────────────────────────────────────────────────────────
  {
    id: 'sn1',
    category: 'Snooker',
    question: 'What is a snooker?',
    answer:
      'You are snookered when — after a legal shot — you cannot hit any part of every ball "on" in a straight line. When snookered, you must attempt to escape; you may play off the cushion(s) to reach the ball on.',
    keywords: ['snooker', 'snookered', 'definition', 'what is'],
  },
  {
    id: 'sn2',
    category: 'Snooker',
    question: 'What happens if I cannot escape a snooker?',
    answer:
      'You must still make your best effort to hit the ball on. If you touch the wrong ball it is a foul. The opponent then decides whether to play from that position or ask you to play again.',
    keywords: ['cannot escape', 'impossible', 'stuck', 'hit wrong ball'],
  },
  {
    id: 'sn3',
    category: 'Snooker',
    question: 'Can you be snookered behind a free ball?',
    answer:
      'No. A free ball is awarded only when you are snookered directly after a foul. If the free ball itself is blocking you, you can still play the free ball.',
    keywords: ['snookered behind free ball', 'free ball blocks'],
  },
  {
    id: 'sn4',
    category: 'Snooker',
    question: 'Is a self-snooker possible?',
    answer:
      "Yes — if you play a shot that leaves yourself snookered on the ball on, it is legal. However, your opponent is not obliged to give a free ball unless there was a foul on the shot.",
    keywords: ['self snooker', 'own snooker', 'leave snookered'],
  },
  {
    id: 'sn5',
    category: 'Snooker',
    question: 'What is a "total snooker"?',
    answer:
      'A total snooker means the player cannot reach the ball on from any angle, even via the cushion. A free ball is awarded only if this results from a foul — otherwise, the player must simply do their best.',
    keywords: ['total snooker', 'impossible escape', 'no way out'],
  },

  // ── Colors Sequence ───────────────────────────────────────────────────────
  {
    id: 'cs1',
    category: 'Colors Sequence',
    question: 'What is the order of the colors in the final sequence?',
    answer:
      'Yellow (2), Green (3), Brown (4), Blue (5), Pink (6), Black (7). This is the order they must be potted once all reds are off the table.',
    keywords: ['order', 'sequence', 'colors', 'yellow green brown blue pink black'],
  },
  {
    id: 'cs2',
    category: 'Colors Sequence',
    question: 'Do colors go back on their spots during the colors sequence?',
    answer:
      'No. Once the colors sequence begins, each potted color stays off the table permanently (unless there is a foul, in which case it may be re-spotted for penalty purposes).',
    keywords: ['colors phase', 'stay off', 'permanent', 'not replaced'],
  },
  {
    id: 'cs3',
    category: 'Colors Sequence',
    question: 'What if I accidentally pot the wrong color in the colors sequence?',
    answer:
      'Foul. The penalty is the higher of 4 points or the value of the ball incorrectly potted. The wrongly potted ball is re-spotted. You must then pot the correct next color.',
    keywords: ['wrong color', 'out of order', 'sequence foul', 'skip color'],
  },
  {
    id: 'cs4',
    category: 'Colors Sequence',
    question: 'What happens if the pink or black lands on the other\'s spot after a foul?',
    answer:
      'A color that cannot be placed on its own spot after a foul is placed on the highest available spot. If no spot is free, it goes as close to its own spot as possible, without touching another ball.',
    keywords: ['pink spot', 'black spot', 'respotting', 'no spot'],
  },
  {
    id: 'cs5',
    category: 'Colors Sequence',
    question: 'Can I play a safety shot during the colors sequence?',
    answer:
      'Yes. You must first strike the correct next color in sequence, but you do not have to attempt to pot it. Safety play (leaving the cue ball safe) is a valid tactic.',
    keywords: ['safety colors', 'snooker on color', 'safety sequence'],
  },

  // ── Frame & Match ─────────────────────────────────────────────────────────
  {
    id: 'fm1',
    category: 'Frame & Match',
    question: 'How does a frame end?',
    answer:
      'A frame ends when all 21 object balls are potted (or one player concedes). The player with the higher score wins the frame.',
    keywords: ['frame end', 'finish', 'over', 'winner', 'last ball'],
  },
  {
    id: 'fm2',
    category: 'Frame & Match',
    question: 'What happens if the frame is tied after the black is potted?',
    answer:
      'The black is re-spotted on the black spot. A coin toss determines who plays. Both players have one shot each (not alternating) — whoever pots the black wins. If neither pots it, the player who leaves the ball closer to the black spot wins.',
    keywords: ['tie', 'draw', 'equal', 'black respot', 'tied frame'],
  },
  {
    id: 'fm3',
    category: 'Frame & Match',
    question: 'What is a re-rack?',
    answer:
      "A re-rack can be called by the referee (or agreed by players in casual games) if the game has become clearly irretrievable or stuck in a stalemate. The balls are re-racked and the same player who broke off plays again.",
    keywords: ['rerack', 're-rack', 'stalemate', 'restart', 'stuck'],
  },
  {
    id: 'fm4',
    category: 'Frame & Match',
    question: 'What does "best of" mean?',
    answer:
      'Best of N means the first player to win the majority of N frames wins the match. Best of 7: first to 4. Best of 9: first to 5. Best of 11: first to 6.',
    keywords: ['best of', 'match format', 'frames needed', 'first to'],
  },
  {
    id: 'fm5',
    category: 'Frame & Match',
    question: 'Who breaks off first in subsequent frames?',
    answer:
      'Players alternate the break-off each frame. The player who did NOT break off in the previous frame breaks off in the next.',
    keywords: ['break off', 'next frame', 'who breaks', 'alternate'],
  },

  // ── Special Situations ────────────────────────────────────────────────────
  {
    id: 'ss1',
    category: 'Special Situations',
    question: 'What is the miss rule?',
    answer:
      'If the referee believes a player did not make a genuine attempt to hit the ball on, they call a "miss." The shot is replayed from the original position. The referee can keep calling misses and the opponent can keep asking for replays — there is no limit.',
    keywords: ['miss rule', 'genuine attempt', 'no effort', 'replay'],
  },
  {
    id: 'ss2',
    category: 'Special Situations',
    question: 'Can a ball be played after touching the cushion?',
    answer:
      'Yes. Playing off one or more cushions is legal at any time, whether to reach the ball on or for safety. If a cushion shot causes an opponent ball to be potted, it counts for the correct player.',
    keywords: ['cushion', 'rail', 'bank', 'off cushion', 'kick'],
  },
  {
    id: 'ss3',
    category: 'Special Situations',
    question: 'What is a kick or "dirty" contact?',
    answer:
      'A kick occurs when chalk or debris between the cue ball and object ball causes an unexpected deflection. It is not a foul — it is bad luck. The shot stands.',
    keywords: ['kick', 'dirty', 'chalk', 'debris', 'unexpected'],
  },
  {
    id: 'ss4',
    category: 'Special Situations',
    question: 'Can I jump the cue ball over another ball?',
    answer:
      'No. Deliberately causing the cue ball to jump over another ball is a foul (masse or jump shot to avoid a snooker is illegal). The cue ball must be struck above its centre; accidentally rising over a ball due to normal play is not a foul.',
    keywords: ['jump shot', 'jump over', 'jump ball', 'illegal jump', 'masse'],
  },
  {
    id: 'ss5',
    category: 'Special Situations',
    question: 'What if two balls are touching before a shot?',
    answer:
      'The player must play away from the touching ball (the cue ball must move visibly first if touching the object ball). No force is needed. Merely resting the cue on the touching ball without moving it is NOT a shot.',
    keywords: ['touching balls', 'touching ball', 'contact', 'play away from'],
  },

  // ── Common Scenarios ──────────────────────────────────────────────────────
  {
    id: 'com1',
    category: 'Common Scenarios',
    question: 'I potted a red and then accidentally potted a second ball — is that a foul?',
    answer:
      'If you are on a red and pot one or more reds in the same shot, all count (1 pt each). If you also pot a color in the same shot while on a red, it is a foul — the color is re-spotted and the penalty is the higher of 4 or that color\'s value.',
    keywords: ['pot two balls', 'pot red and color same shot', 'both balls'],
  },
  {
    id: 'com2',
    category: 'Common Scenarios',
    question: 'I potted the correct color but also the cue ball — what happens?',
    answer:
      'In-off (cue ball potted) is always a foul. The color is re-spotted (or stays off, depending on phase), and the opponent receives the higher of 4 points or the value of the ball you were on.',
    keywords: ['in-off', 'pot cue ball', 'pocket white', 'along with color'],
  },
  {
    id: 'com3',
    category: 'Common Scenarios',
    question: 'Can I pot a red when I should be potting a color (after already potting a red)?',
    answer:
      'No — you must pot a nominated color next. Potting a red instead is a foul. Penalty: 4 points (since red = 1, minimum 4 applies). The red is re-spotted.',
    keywords: ['wrong sequence', 'red when on color', 'pot red instead'],
  },
  {
    id: 'com4',
    category: 'Common Scenarios',
    question: 'We lost track of whose turn it is — what do we do?',
    answer:
      "Agree between yourselves based on who last potted or missed. If genuinely unsure, replay from the position using whoever seems logical. In casual play, communication prevents this — always announce 'your shot' after a miss.",
    keywords: ['whose turn', 'lost track', 'confused', 'turn order'],
  },
  {
    id: 'com5',
    category: 'Common Scenarios',
    question: 'A ball was disturbed by a non-player — what happens?',
    answer:
      'An outside agency (spectator, phone falling, etc.) causing a ball to move is not a foul by either player. Replace the ball as close to its original position as possible and continue.',
    keywords: ['outside agency', 'disturbed', 'spectator', 'non-player', 'accident'],
  },
  {
    id: 'com6',
    category: 'Common Scenarios',
    question: 'How do I work out if I can still win the frame?',
    answer:
      "Subtract your opponent's score from yours. Check the 'Points on table' shown on the scoreboard. If the deficit is greater than points remaining, you cannot win unless your opponent fouls. Factor in that fouls can give up to 7 points.",
    keywords: ['can I win', 'points needed', 'still win', 'behind', 'deficit'],
  },
  {
    id: 'com7',
    category: 'Common Scenarios',
    question: 'Do I have to declare which color I am going to pot?',
    answer:
      'Formally yes — if the referee or opponent asks. In practice, in casual games the intention is usually clear. If in doubt, say "I\'m on the blue" before playing.',
    keywords: ['declare', 'announce', 'say which', 'nominate color', 'call shot'],
  },
  {
    id: 'com8',
    category: 'Common Scenarios',
    question: 'The pink and black are both close to a pocket — which do I pot first?',
    answer:
      'You must pot the next ball in the colors sequence. If pink comes before black in the sequence (which it always does), you must pot the pink first, then the black. Potting the black when on pink is a 7-point foul.',
    keywords: ['pink before black', 'pot black instead', 'order', 'sequence end'],
  },
  {
    id: 'com9',
    category: 'Common Scenarios',
    question: 'A red was disturbed and accidentally went into a pocket — does it stay off the table?',
    answer:
      'If a red is accidentally potted by any means other than a legal shot (e.g. disturbed while placing cue, or by outside agency), it is re-spotted if possible. Only reds legally potted by a player stay off.',
    keywords: ['red accidentally potted', 'knocked in', 'disturbed red', 'replace red'],
  },
  {
    id: 'com10',
    category: 'Common Scenarios',
    question: 'Can I ask my opponent for the score or how many reds are left?',
    answer:
      'Yes. In formal play the referee provides this information. In casual/hobby games, both players may check the scoreboard and agree on the count of remaining reds at any time.',
    keywords: ['ask score', 'how many reds', 'count balls', 'check', 'tally'],
  },
];

export function searchRules(query: string): SnookerRule[] {
  if (!query.trim()) return SNOOKER_RULES;
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return SNOOKER_RULES.filter(rule => {
    const text = `${rule.question} ${rule.answer} ${rule.keywords.join(' ')}`.toLowerCase();
    return terms.every(t => text.includes(t));
  }).sort((a, b) => {
    // Boost rules whose question directly contains the query
    const aQ = a.question.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
    const bQ = b.question.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
    return bQ - aQ;
  });
}

export function getRulesByCategory(category: string): SnookerRule[] {
  return SNOOKER_RULES.filter(r => r.category === category);
}
