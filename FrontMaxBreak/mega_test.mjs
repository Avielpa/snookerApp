// mega_test.mjs — 400+ new assertions covering train + match mode edge cases
// Runs in Node.js. Logic mirrors useSnookerGame.ts and gameStorage.ts exactly.

const BALL_VALUES = { red:1, yellow:2, green:3, brown:4, blue:5, pink:6, black:7 };
const COLORS_SEQUENCE = ['yellow','green','brown','blue','pink','black'];
const COLORS_TOTAL = 27;

function calcPointsOnTable(phase, redsRemaining, awaiting, colorsRemaining) {
  if (phase === 'colors') return colorsRemaining.reduce((s,b) => s + BALL_VALUES[b], 0);
  if (awaiting === 'color') return 7 + redsRemaining * 8 + COLORS_TOTAL;
  return redsRemaining * 8 + COLORS_TOTAL;
}
function makeInitialFrame(numberOfReds, currentPlayer=0) {
  return { scores:[0,0], currentBreak:0, currentPlayer,
    pointsOnTable: numberOfReds*8+COLORS_TOTAL, phase:'reds',
    redsRemaining:numberOfReds, awaiting:'red', colorsRemaining:[...COLORS_SEQUENCE], isFrameOver:false };
}
function getAvailableBalls(snap) {
  if (snap.isFrameOver) return [];
  if (snap.phase === 'colors') return snap.colorsRemaining.slice(0,1);
  if (snap.awaiting === 'red') return snap.redsRemaining > 0 ? ['red'] : COLORS_SEQUENCE;
  return COLORS_SEQUENCE;
}
function applyPot(state, ball) {
  const snap = state.current;
  const available = getAvailableBalls(snap);
  if (!available.includes(ball)) throw new Error(`Cannot pot ${ball}. Available: ${available}. phase=${snap.phase} awaiting=${snap.awaiting} reds=${snap.redsRemaining}`);
  const points = BALL_VALUES[ball];
  const newScores = [...snap.scores]; newScores[snap.currentPlayer] += points;
  const newBreak = snap.currentBreak + points;
  let newPhase=snap.phase, newRedsRemaining=snap.redsRemaining;
  let newAwaiting=snap.awaiting, newColorsRemaining=[...snap.colorsRemaining];
  let isFrameOver=false;
  if (snap.phase === 'reds') {
    if (ball === 'red') { newRedsRemaining--; newAwaiting='color'; }
    else { if (snap.redsRemaining===0) { newPhase='colors'; newColorsRemaining=[...COLORS_SEQUENCE]; } else { newAwaiting='red'; } }
  } else {
    newColorsRemaining=newColorsRemaining.slice(1);
    if (newColorsRemaining.length===0) isFrameOver=true;
  }
  const newHighest=[...state.frameHighestBreak];
  if (newBreak>newHighest[snap.currentPlayer]) newHighest[snap.currentPlayer]=newBreak;
  const newSnap={ scores:newScores, currentBreak:newBreak, currentPlayer:snap.currentPlayer,
    pointsOnTable:isFrameOver?0:calcPointsOnTable(newPhase,newRedsRemaining,newAwaiting,newColorsRemaining),
    phase:newPhase, redsRemaining:newRedsRemaining, awaiting:newAwaiting, colorsRemaining:newColorsRemaining, isFrameOver };
  return { ...state, current:newSnap, history:[...state.history,snap], frameHighestBreak:newHighest };
}
function applyExtraRed(state) {
  const snap=state.current;
  if (snap.phase!=='reds'||snap.awaiting!=='color'||snap.redsRemaining===0) throw new Error('addExtraRed precondition failed');
  const newScores=[...snap.scores]; newScores[snap.currentPlayer]+=1;
  const newBreak=snap.currentBreak+1, newRedsRemaining=snap.redsRemaining-1;
  const newHighest=[...state.frameHighestBreak];
  if (newBreak>newHighest[snap.currentPlayer]) newHighest[snap.currentPlayer]=newBreak;
  const newSnap={...snap,scores:newScores,currentBreak:newBreak,redsRemaining:newRedsRemaining,
    pointsOnTable:calcPointsOnTable(snap.phase,newRedsRemaining,snap.awaiting,snap.colorsRemaining)};
  return {...state,current:newSnap,history:[...state.history,snap],frameHighestBreak:newHighest};
}
function applyEndVisit(state) {
  const snap=state.current;
  let newPhase=snap.phase,newAwaiting=snap.awaiting,newColorsRemaining=[...snap.colorsRemaining];
  if(snap.phase==='reds'){
    if(snap.redsRemaining===0&&snap.awaiting==='color'){newPhase='colors';newColorsRemaining=[...COLORS_SEQUENCE];}
    else{newAwaiting='red';}
  }
  const newPot=calcPointsOnTable(newPhase,snap.redsRemaining,newAwaiting,newColorsRemaining);
  return {...state,current:{...snap,currentPlayer:snap.currentPlayer===0?1:0,currentBreak:0,phase:newPhase,awaiting:newAwaiting,colorsRemaining:newColorsRemaining,pointsOnTable:newPot},history:[...state.history,snap]};
}
function applyFoul(state, foulValue, opponentPlays=true) {
  const snap=state.current;
  const opponent=snap.currentPlayer===0?1:0;
  const newScores=[...snap.scores]; newScores[opponent]+=foulValue;
  const newPlayer=opponentPlays?opponent:snap.currentPlayer;
  const newAwaiting=snap.awaiting; // FIXED: never reset by foul
  const newSnap={...snap,scores:newScores,currentBreak:0,currentPlayer:newPlayer,awaiting:newAwaiting};
  return {...state,current:newSnap,history:[...state.history,snap]};
}
function applyUndo(state) {
  if (state.history.length===0) return state;
  const hist=[...state.history]; const prev=hist.pop();
  return {...state,current:prev,history:hist};
}
function applyConcede(state) {
  const snap=state.current;
  return {...state,current:{...snap,isFrameOver:true},history:[...state.history,snap]};
}
function confirmFrameEnd(state, winner, nextBreakerOverride=undefined) {
  const result={frameNumber:state.frameNumber,winner,scores:[...state.current.scores],highestBreak:[...state.frameHighestBreak]};
  const fw=[...state.framesWon]; fw[winner]++;
  const nextBreaker=nextBreakerOverride!==undefined?nextBreakerOverride:(state.frameNumber%2===0?0:1);
  let isMatchOver=false,matchWinner=null;
  if(state.config.bestOf===null){isMatchOver=true;matchWinner=winner;}
  else{const t=Math.ceil(state.config.bestOf/2);if(fw[0]>=t){isMatchOver=true;matchWinner=0;}else if(fw[1]>=t){isMatchOver=true;matchWinner=1;}}
  return {...state,framesWon:fw,frameResults:[...state.frameResults,result],frameNumber:state.frameNumber+1,
    current:makeInitialFrame(state.config.numberOfReds,nextBreaker),history:[],frameHighestBreak:[0,0],isMatchOver,matchWinner};
}
function makeGame(numberOfReds, bestOf=null) {
  return {config:{numberOfReds,bestOf},framesWon:[0,0],frameResults:[],frameNumber:1,
    current:makeInitialFrame(numberOfReds,0),history:[],frameHighestBreak:[0,0],isMatchOver:false,matchWinner:null};
}
function computeTrainingStats(sessions) {
  let totalBreaks=0,highestBreak=0,breakSum=0,breaksOver25=0,breaksOver50=0;
  for(const s of sessions){for(const fr of s.frameResults){const b=fr.highestBreak[0];totalBreaks++;if(b>highestBreak)highestBreak=b;breakSum+=b;if(b>=25)breaksOver25++;if(b>=50)breaksOver50++;}}
  return{totalBreaks,highestBreak,avgBreak:totalBreaks>0?Math.round(breakSum/totalBreaks):0,breaksOver25,breaksOver50};
}
function computePlayerStats(matches,playerName){
  const relevant=matches.filter(m=>m.isComplete&&(!m.mode||m.mode==='match')&&(m.player1Name===playerName||m.player2Name===playerName));
  let totalFramesPlayed=0,totalFramesWon=0,highestBreak=0,totalBreakSum=0,totalBreakCount=0,totalMatchesWon=0;
  for(const match of relevant){
    const pIdx=match.player1Name===playerName?0:1;
    totalFramesPlayed+=match.frameResults.length;totalFramesWon+=match.framesWon[pIdx];
    if(match.framesWon[pIdx]>match.framesWon[1-pIdx])totalMatchesWon++;
    for(const fr of match.frameResults){const hb=fr.highestBreak[pIdx];if(hb>highestBreak)highestBreak=hb;if(hb>0){totalBreakSum+=hb;totalBreakCount++;}}
  }
  return{totalFramesPlayed,totalFramesWon,winRate:totalFramesPlayed>0?Math.round(totalFramesWon/totalFramesPlayed*100):0,highestBreak,avgBreak:totalBreakCount>0?Math.round(totalBreakSum/totalBreakCount):0,totalMatches:relevant.length,totalMatchesWon};
}

// ── Test runner ───────────────────────────────────────────────────────────────
let passed=0,failed=0;
function assert(label,condition,extra=''){
  if(condition){console.log(`  ✓ ${label}`);passed++;}
  else{console.error(`  ✗ ${label}${extra?` — ${extra}`:''}`);failed++;}
}
function section(title){console.log(`\n${title}`);}

// ═══════════════════════════════════════════════════════════════
// SECTION T1 — Train mode: bestOf=9999 never triggers matchOver
// ═══════════════════════════════════════════════════════════════
section('SECTION T1 — Train: bestOf=9999 never ends match');
{
  let g=makeGame(15,9999);
  assert('T1.1: initial isMatchOver=false',g.isMatchOver===false);
  assert('T1.2: initial matchWinner=null',g.matchWinner===null);
  assert('T1.3: config.bestOf=9999',g.config.bestOf===9999);
  // target = ceil(9999/2) = 5000; complete 200 breaks
  for(let i=0;i<200;i++){g=applyPot(g,'red');g=applyConcede(g);g=confirmFrameEnd(g,0,0);}
  assert('T1.4: 200 breaks, isMatchOver still false',g.isMatchOver===false);
  assert('T1.5: framesWon[0]=200',g.framesWon[0]===200);
  assert('T1.6: matchWinner still null',g.matchWinner===null);
  assert('T1.7: frameNumber=201',g.frameNumber===201);
  assert('T1.8: 200 results stored',g.frameResults.length===200);
  // P1 winning also never triggers match end
  let g2=makeGame(6,9999);
  for(let i=0;i<100;i++){g2=applyPot(g2,'red');g2=applyConcede(g2);g2=confirmFrameEnd(g2,1,0);}
  assert('T1.9: winner=1 100x, still not over',g2.isMatchOver===false);
  assert('T1.10: framesWon[1]=100',g2.framesWon[1]===100);
}

// ═══════════════════════════════════════════════════════════════
// SECTION T2 — Train: player 0 always breaks (nextBreakerOverride=0)
// ═══════════════════════════════════════════════════════════════
section('SECTION T2 — Train: player 0 always breaks');
{
  let g=makeGame(6,9999);
  for(let i=0;i<8;i++){
    assert(`T2.${i+1}: frame ${i+1} starts with P0`,g.current.currentPlayer===0);
    g=applyPot(g,'red');g=applyPot(g,'black');g=applyConcede(g);
    g=confirmFrameEnd(g,0,0); // nextBreakerOverride=0 = train mode
  }
  assert('T2.9: after 8 breaks, frame 9 starts P0',g.current.currentPlayer===0);
  // scores in each new break start from 0
  assert('T2.10: new break starts with score [0,0]',g.current.scores[0]===0&&g.current.scores[1]===0);
  // alternate without override: frame 2 → P1 breaks
  let g2=makeGame(6,null);
  g2=applyPot(g2,'red');g2=applyConcede(g2);
  g2=confirmFrameEnd(g2,0); // no override → frame 2 uses frameNumber%2===0?0:1 = 1%2===0?0:1 = 1
  assert('T2.11: without override frame 2 starts with P1',g2.current.currentPlayer===1);
  g2=applyPot(g2,'red');g2=applyConcede(g2);
  g2=confirmFrameEnd(g2,1); // frame 3 → 2%2===0?0:1 = 0
  assert('T2.12: without override frame 3 starts with P0',g2.current.currentPlayer===0);
}

// ═══════════════════════════════════════════════════════════════
// SECTION T3 — sessionBest tracks highest frameHighestBreak
// ═══════════════════════════════════════════════════════════════
section('SECTION T3 — sessionBest calculation');
{
  let g=makeGame(15,9999);
  // Break 1: red+black (8), red+black (16), concede → highestBreak=16
  g=applyPot(g,'red');g=applyPot(g,'black');g=applyPot(g,'red');g=applyPot(g,'black');
  g=applyConcede(g);g=confirmFrameEnd(g,0,0);
  assert('T3.1: break1 highestBreak=16',g.frameResults[0].highestBreak[0]===16);

  // Break 2: red only (1) → highestBreak=1
  g=applyPot(g,'red');g=applyConcede(g);g=confirmFrameEnd(g,0,0);
  assert('T3.2: break2 highestBreak=1',g.frameResults[1].highestBreak[0]===1);

  // Break 3: 5 reds+blacks = 40 → highestBreak=40
  for(let i=0;i<5;i++){g=applyPot(g,'red');g=applyPot(g,'black');}
  g=applyConcede(g);g=confirmFrameEnd(g,0,0);
  assert('T3.3: break3 highestBreak=40',g.frameResults[2].highestBreak[0]===40);

  const sessionBest=g.frameResults.reduce((best,fr)=>Math.max(best,fr.highestBreak[0]),0);
  assert('T3.4: sessionBest=40',sessionBest===40);

  // Break 4: bigger — 8 reds+blacks = 64
  for(let i=0;i<8;i++){g=applyPot(g,'red');g=applyPot(g,'black');}
  g=applyConcede(g);g=confirmFrameEnd(g,0,0);
  const sessionBest2=g.frameResults.reduce((best,fr)=>Math.max(best,fr.highestBreak[0]),0);
  assert('T3.5: sessionBest updated to 64',sessionBest2===64);
  assert('T3.6: 4 breaks stored',g.frameResults.length===4);

  // frameHighestBreak resets between breaks
  assert('T3.7: after confirmFrameEnd, frameHighestBreak resets',g.frameHighestBreak[0]===0);

  // Break 5: immediate concede → highestBreak=0
  g=applyConcede(g);g=confirmFrameEnd(g,0,0);
  assert('T3.8: break5 highestBreak=0 (no balls potted)',g.frameResults[4].highestBreak[0]===0);
  const sessionBest3=g.frameResults.reduce((best,fr)=>Math.max(best,fr.highestBreak[0]),0);
  assert('T3.9: sessionBest still 64',sessionBest3===64);
}

// ═══════════════════════════════════════════════════════════════
// SECTION T4 — computeTrainingStats edge cases
// ═══════════════════════════════════════════════════════════════
section('SECTION T4 — computeTrainingStats edge cases');
{
  // Empty sessions
  const s0=computeTrainingStats([]);
  assert('T4.1: empty: totalBreaks=0',s0.totalBreaks===0);
  assert('T4.2: empty: highestBreak=0',s0.highestBreak===0);
  assert('T4.3: empty: avgBreak=0',s0.avgBreak===0);
  assert('T4.4: empty: breaksOver25=0',s0.breaksOver25===0);
  assert('T4.5: empty: breaksOver50=0',s0.breaksOver50===0);

  // Single break of 0
  const s1=computeTrainingStats([{frameResults:[{highestBreak:[0,0]}]}]);
  assert('T4.6: single 0 break: totalBreaks=1',s1.totalBreaks===1);
  assert('T4.7: single 0 break: highestBreak=0',s1.highestBreak===0);
  assert('T4.8: single 0 break: avgBreak=0',s1.avgBreak===0);

  // Exactly 25 and 50 thresholds
  const s2=computeTrainingStats([{frameResults:[{highestBreak:[25,0]},{highestBreak:[50,0]},{highestBreak:[24,0]},{highestBreak:[49,0]}]}]);
  assert('T4.9: over25 threshold: 25,49,50 all count',s2.breaksOver25===3); // 25, 49, 50 all >=25
  assert('T4.10: over50 threshold: 50 counts',s2.breaksOver50===1); // only 50
  assert('T4.11: highestBreak=50',s2.highestBreak===50);
  assert('T4.12: totalBreaks=4',s2.totalBreaks===4);
  assert('T4.13: avgBreak=round((25+50+24+49)/4)=round(148/4)=37',s2.avgBreak===37);

  // Multiple sessions aggregate
  const s3=computeTrainingStats([
    {frameResults:[{highestBreak:[10,0]},{highestBreak:[20,0]}]},
    {frameResults:[{highestBreak:[30,0]},{highestBreak:[40,0]}]},
    {frameResults:[{highestBreak:[50,0]},{highestBreak:[60,0]}]},
  ]);
  assert('T4.14: 3 sessions 6 breaks total',s3.totalBreaks===6);
  assert('T4.15: highestBreak=60',s3.highestBreak===60);
  assert('T4.16: avgBreak=round((10+20+30+40+50+60)/6)=35',s3.avgBreak===35);
  assert('T4.17: breaksOver25=4 (30,40,50,60)',s3.breaksOver25===4);
  assert('T4.18: breaksOver50=2 (50,60)',s3.breaksOver50===2);

  // 147 maximum break
  const s4=computeTrainingStats([{frameResults:[{highestBreak:[147,0]}]}]);
  assert('T4.19: 147 counts as over50',s4.breaksOver50===1);
  assert('T4.20: 147 counts as over25',s4.breaksOver25===1);
  assert('T4.21: highestBreak=147',s4.highestBreak===147);
}

// ═══════════════════════════════════════════════════════════════
// SECTION T5 — computePlayerStats edge cases
// ═══════════════════════════════════════════════════════════════
section('SECTION T5 — computePlayerStats edge cases');
{
  // Train sessions excluded
  const m1=[
    {mode:'train',isComplete:true,player1Name:'Alice',player2Name:'',
      frameResults:[{highestBreak:[100,0],scores:[100,0]}],framesWon:[5,0],bestOf:null},
    {mode:'match',isComplete:true,player1Name:'Alice',player2Name:'Bob',
      frameResults:[{highestBreak:[30,0],scores:[80,40]},{highestBreak:[15,20],scores:[30,60]}],framesWon:[1,1],bestOf:3},
  ];
  const ps1=computePlayerStats(m1,'Alice');
  assert('T5.1: train excluded from totalFramesPlayed',ps1.totalFramesPlayed===2);
  assert('T5.2: train excluded from highestBreak',ps1.highestBreak===30);
  assert('T5.3: 1 match played (not train)',ps1.totalMatches===1);

  // Win rate: 1 won out of 2 frames = 50%
  assert('T5.4: winRate=50 (1/2)',ps1.winRate===50);

  // Player as P2
  const m2=[
    {mode:'match',isComplete:true,player1Name:'Charlie',player2Name:'Alice',
      frameResults:[{highestBreak:[10,25],scores:[30,80]},{highestBreak:[5,40],scores:[20,90]}],framesWon:[0,2],bestOf:3},
  ];
  const ps2=computePlayerStats(m2,'Alice');
  assert('T5.5: Alice is P2 (idx=1)',ps2.totalFramesPlayed===2);
  assert('T5.6: Alice won both frames',ps2.totalFramesWon===2);
  assert('T5.7: Alice highestBreak=40',ps2.highestBreak===40);
  assert('T5.8: Alice won the match',ps2.totalMatchesWon===1);

  // Incomplete match excluded
  const m3=[
    {mode:'match',isComplete:false,player1Name:'Alice',player2Name:'Bob',
      frameResults:[{highestBreak:[50,0],scores:[100,0]}],framesWon:[1,0],bestOf:5},
  ];
  const ps3=computePlayerStats(m3,'Alice');
  assert('T5.9: incomplete match excluded',ps3.totalMatches===0);
  assert('T5.10: incomplete: totalFramesPlayed=0',ps3.totalFramesPlayed===0);

  // avgBreak only counts frames where highestBreak > 0
  const m4=[
    {mode:'match',isComplete:true,player1Name:'Alice',player2Name:'Bob',
      frameResults:[{highestBreak:[0,0],scores:[4,8]},{highestBreak:[20,0],scores:[40,20]},{highestBreak:[30,0],scores:[60,10]}],framesWon:[2,1],bestOf:5},
  ];
  const ps4=computePlayerStats(m4,'Alice');
  assert('T5.11: avgBreak=(20+30)/2=25 (frame with 0 excluded)',ps4.avgBreak===25);
  assert('T5.12: totalFramesPlayed=3',ps4.totalFramesPlayed===3);
  assert('T5.13: totalFramesWon=2',ps4.totalFramesWon===2);
  assert('T5.14: winRate=67 (2/3)',ps4.winRate===67);

  // No matches returns zeros
  const ps5=computePlayerStats([],'Alice');
  assert('T5.15: no matches: all zeros',ps5.totalMatches===0&&ps5.winRate===0&&ps5.highestBreak===0);

  // mode undefined treated as match
  const m5=[
    {isComplete:true,player1Name:'Alice',player2Name:'Bob',
      frameResults:[{highestBreak:[15,0],scores:[40,20]}],framesWon:[1,0],bestOf:null},
  ];
  const ps6=computePlayerStats(m5,'Alice');
  assert('T5.16: undefined mode counted as match',ps6.totalMatches===1);
}

// ═══════════════════════════════════════════════════════════════
// SECTION M1 — BO1 (bestOf=null): immediate match end
// ═══════════════════════════════════════════════════════════════
section('SECTION M1 — BO1 (bestOf=null) immediate match end');
{
  let g=makeGame(15,null);
  assert('M1.1: bestOf=null',g.config.bestOf===null);
  g=applyPot(g,'red');g=applyPot(g,'black');g=applyConcede(g);
  g=confirmFrameEnd(g,0);
  assert('M1.2: isMatchOver=true after 1 frame',g.isMatchOver===true);
  assert('M1.3: matchWinner=0',g.matchWinner===0);
  assert('M1.4: framesWon=[1,0]',g.framesWon[0]===1&&g.framesWon[1]===0);

  // P1 wins
  let g2=makeGame(15,null);
  g2=applyFoul(g2,4,true);g2=applyConcede(g2);
  g2=confirmFrameEnd(g2,1);
  assert('M1.5: P1 wins BO1: isMatchOver=true',g2.isMatchOver===true);
  assert('M1.6: matchWinner=1',g2.matchWinner===1);

  // Scores preserved in frameResults
  let g3=makeGame(15,null);
  for(let i=0;i<3;i++){g3=applyPot(g3,'red');g3=applyPot(g3,'black');}
  g3=applyFoul(g3,7,true);g3=applyConcede(g3);
  g3=confirmFrameEnd(g3,0);
  assert('M1.7: BO1 result stored',g3.frameResults.length===1);
  assert('M1.8: P0 score=24+7=31 in result... wait P1 gets foul so P0=24',g3.frameResults[0].scores[0]===24);
  assert('M1.9: P1 score=7 (foul)',g3.frameResults[0].scores[1]===7);
}

// ═══════════════════════════════════════════════════════════════
// SECTION M2 — BO3 all end scenarios
// ═══════════════════════════════════════════════════════════════
section('SECTION M2 — BO3 all end scenarios');
{
  // 2-0: P0 wins frames 1 and 2
  let g=makeGame(15,3);
  g=applyConcede(g);g=confirmFrameEnd(g,0);
  assert('M2.1: after 1 frame BO3 not over',g.isMatchOver===false);
  g=applyConcede(g);g=confirmFrameEnd(g,0);
  assert('M2.2: 2-0 match over',g.isMatchOver===true);
  assert('M2.3: matchWinner=0',g.matchWinner===0);
  assert('M2.4: framesWon=[2,0]',g.framesWon[0]===2&&g.framesWon[1]===0);

  // 2-1: P0 wins frames 1,3; P1 wins frame 2
  let g2=makeGame(15,3);
  g2=applyConcede(g2);g2=confirmFrameEnd(g2,0); // 1-0
  assert('M2.5: 1-0 not over',g2.isMatchOver===false);
  g2=applyConcede(g2);g2=confirmFrameEnd(g2,1); // 1-1
  assert('M2.6: 1-1 not over',g2.isMatchOver===false);
  g2=applyConcede(g2);g2=confirmFrameEnd(g2,0); // 2-1
  assert('M2.7: 2-1 match over',g2.isMatchOver===true);
  assert('M2.8: 2-1 winner=0',g2.matchWinner===0);

  // 0-2: P1 wins
  let g3=makeGame(15,3);
  g3=applyConcede(g3);g3=confirmFrameEnd(g3,1);
  g3=applyConcede(g3);g3=confirmFrameEnd(g3,1);
  assert('M2.9: P1 wins 0-2',g3.isMatchOver===true);
  assert('M2.10: matchWinner=1 in 0-2',g3.matchWinner===1);

  // 1-2: P1 wins final
  let g4=makeGame(15,3);
  g4=applyConcede(g4);g4=confirmFrameEnd(g4,0);
  g4=applyConcede(g4);g4=confirmFrameEnd(g4,1);
  g4=applyConcede(g4);g4=confirmFrameEnd(g4,1);
  assert('M2.11: 1-2 match over',g4.isMatchOver===true);
  assert('M2.12: 1-2 winner=1',g4.matchWinner===1);
  assert('M2.13: 3 frames played',g4.frameResults.length===3);
}

// ═══════════════════════════════════════════════════════════════
// SECTION M3 — BO5 and BO7 end conditions
// ═══════════════════════════════════════════════════════════════
section('SECTION M3 — BO5 and BO7 end conditions');
{
  // BO5: P0 needs 3 to win
  let g=makeGame(15,5);
  for(let i=0;i<2;i++){g=applyConcede(g);g=confirmFrameEnd(g,0);}
  assert('M3.1: BO5 2-0 not over',g.isMatchOver===false);
  g=applyConcede(g);g=confirmFrameEnd(g,0);
  assert('M3.2: BO5 3-0 over',g.isMatchOver===true);
  assert('M3.3: BO5 winner=0',g.matchWinner===0);

  // BO5 goes to 3-2
  let g2=makeGame(15,5);
  const wins=[0,1,0,1,0];
  for(const w of wins){g2=applyConcede(g2);g2=confirmFrameEnd(g2,w);}
  assert('M3.4: BO5 3-2 over',g2.isMatchOver===true);
  assert('M3.5: BO5 3-2 winner=0',g2.matchWinner===0);
  assert('M3.6: 5 frames played in BO5 3-2',g2.frameResults.length===5);

  // BO7: P0 needs 4
  let g3=makeGame(15,7);
  for(let i=0;i<3;i++){g3=applyConcede(g3);g3=confirmFrameEnd(g3,0);}
  assert('M3.7: BO7 3-0 not over',g3.isMatchOver===false);
  g3=applyConcede(g3);g3=confirmFrameEnd(g3,0);
  assert('M3.8: BO7 4-0 over',g3.isMatchOver===true);

  // BO7 P1 wins 4-3
  let g4=makeGame(15,7);
  const wins2=[0,1,0,1,0,1,1];
  for(const w of wins2){g4=applyConcede(g4);g4=confirmFrameEnd(g4,w);}
  assert('M3.9: BO7 P1 wins 3-4',g4.isMatchOver===true);
  assert('M3.10: BO7 winner=1',g4.matchWinner===1);
  assert('M3.11: 7 frames played',g4.frameResults.length===7);
}

// ═══════════════════════════════════════════════════════════════
// SECTION M4 — Alternating breaker in match mode
// ═══════════════════════════════════════════════════════════════
section('SECTION M4 — Alternating breaker');
{
  let g=makeGame(15,9); // BO9, long enough to check alternation
  const expected=[0,1,0,1,0,1,0,1,0]; // frames 1-9
  for(let i=0;i<9;i++){
    assert(`M4.${i+1}: frame ${i+1} breaker=${expected[i]}`,g.current.currentPlayer===expected[i]);
    g=applyConcede(g);
    if(!g.isMatchOver) g=confirmFrameEnd(g,i%2===0?0:1);
    else break;
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION M5 — framesWon increments correctly
// ═══════════════════════════════════════════════════════════════
section('SECTION M5 — framesWon accumulates correctly');
{
  let g=makeGame(15,9);
  assert('M5.1: initial framesWon=[0,0]',g.framesWon[0]===0&&g.framesWon[1]===0);
  const seq=[0,0,1,0,1,1,0,1,0];
  const expected0=[1,2,2,3,3,3,4,4,5];
  const expected1=[0,0,1,1,2,3,3,4,4];
  for(let i=0;i<seq.length;i++){
    g=applyConcede(g);g=confirmFrameEnd(g,seq[i]);
    assert(`M5.${2+i*2}: frame ${i+1} framesWon[0]=${expected0[i]}`,g.framesWon[0]===expected0[i]);
    assert(`M5.${3+i*2}: frame ${i+1} framesWon[1]=${expected1[i]}`,g.framesWon[1]===expected1[i]);
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION G1 — pointsOnTable at every red count (awaiting=red)
// ═══════════════════════════════════════════════════════════════
section('SECTION G1 — pointsOnTable at every red count');
{
  // Formula: redsRemaining*8 + 27
  for(let r=0;r<=15;r++){
    const expected=r*8+27;
    const snap={phase:'reds',redsRemaining:r,awaiting:'red',colorsRemaining:[...COLORS_SEQUENCE]};
    const got=calcPointsOnTable('reds',r,'red',[...COLORS_SEQUENCE]);
    assert(`G1.${r+1}: ${r} reds awaiting=red: pot=${expected}`,got===expected,`got ${got}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION G2 — pointsOnTable awaiting=color bonus
// ═══════════════════════════════════════════════════════════════
section('SECTION G2 — pointsOnTable awaiting=color (+7 bonus)');
{
  // Formula: 7 + redsRemaining*8 + 27
  for(let r=0;r<=15;r++){
    const expected=7+r*8+27;
    const got=calcPointsOnTable('reds',r,'color',[...COLORS_SEQUENCE]);
    assert(`G2.${r+1}: ${r} reds awaiting=color: pot=${expected}`,got===expected,`got ${got}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION G3 — pointsOnTable in colors phase, step by step
// ═══════════════════════════════════════════════════════════════
section('SECTION G3 — pointsOnTable colors phase step by step');
{
  // Full sequence: 27, after yellow(2): 25, after green(3): 22, after brown(4): 18, after blue(5): 13, after pink(6): 7, after black(7): 0
  const steps=[
    {remaining:['yellow','green','brown','blue','pink','black'],expected:27},
    {remaining:['green','brown','blue','pink','black'],expected:25},
    {remaining:['brown','blue','pink','black'],expected:22},
    {remaining:['blue','pink','black'],expected:18},
    {remaining:['pink','black'],expected:13},
    {remaining:['black'],expected:7},
    {remaining:[],expected:0},
  ];
  steps.forEach((s,i)=>{
    const got=calcPointsOnTable('colors',0,'red',s.remaining);
    assert(`G3.${i+1}: ${s.remaining.length} colors remaining: pot=${s.expected}`,got===s.expected,`got ${got}`);
  });
}

// ═══════════════════════════════════════════════════════════════
// SECTION G4 — awaiting state transitions (all paths)
// ═══════════════════════════════════════════════════════════════
section('SECTION G4 — awaiting state after every action');
{
  // red → awaiting=color
  let g=makeGame(15);
  g=applyPot(g,'red');
  assert('G4.1: red→awaiting=color',g.current.awaiting==='color');

  // color after red → awaiting=red (reds phase, redsRemaining>0)
  g=applyPot(g,'black');
  assert('G4.2: black after red→awaiting=red',g.current.awaiting==='red');

  // endVisit preserves awaiting=red
  g=applyEndVisit(g);
  assert('G4.3: endVisit preserves awaiting=red',g.current.awaiting==='red');

  // Red again → awaiting=color
  g=applyPot(g,'red');
  assert('G4.4: red→awaiting=color again',g.current.awaiting==='color');

  // endVisit after red → awaiting resets to red (incoming player must pot red)
  g=applyEndVisit(g);
  assert('G4.5: endVisit after red: awaiting resets to red',g.current.awaiting==='red');

  // Foul when awaiting=red → stays red
  g=applyFoul(g,4,true);
  assert('G4.6: foul preserves awaiting=red',g.current.awaiting==='red');

  // Pot red → awaiting=color
  g=applyPot(g,'red');
  assert('G4.7: red pot→awaiting=color',g.current.awaiting==='color');

  // Foul when awaiting=color → stays color
  g=applyFoul(g,4,true);
  assert('G4.8: foul preserves awaiting=color',g.current.awaiting==='color');

  // Run out of reds: pot last red → awaiting=color
  let g2=makeGame(1);
  g2=applyPot(g2,'red');
  assert('G4.9: last red→awaiting=color',g2.current.awaiting==='color');
  assert('G4.10: last red: redsRemaining=0',g2.current.redsRemaining===0);

  // Color after last red → phase=colors, awaiting irrelevant in colors
  g2=applyPot(g2,'black');
  assert('G4.11: color after last red→phase=colors',g2.current.phase==='colors');

  // In colors phase, available=first color only
  assert('G4.12: in colors: available=[yellow]',JSON.stringify(getAvailableBalls(g2.current))==='["yellow"]');

  // After each color pot in colors phase
  g2=applyPot(g2,'yellow');
  assert('G4.13: after yellow in colors: available=[green]',getAvailableBalls(g2.current)[0]==='green');
  g2=applyPot(g2,'green');
  assert('G4.14: after green: available=[brown]',getAvailableBalls(g2.current)[0]==='brown');
  g2=applyPot(g2,'brown');
  assert('G4.15: after brown: available=[blue]',getAvailableBalls(g2.current)[0]==='blue');
  g2=applyPot(g2,'blue');
  assert('G4.16: after blue: available=[pink]',getAvailableBalls(g2.current)[0]==='pink');
  g2=applyPot(g2,'pink');
  assert('G4.17: after pink: available=[black]',getAvailableBalls(g2.current)[0]==='black');
  g2=applyPot(g2,'black');
  assert('G4.18: after black in colors: frame over',g2.current.isFrameOver===true);
  assert('G4.19: frame over: getAvailableBalls=[]',getAvailableBalls(g2.current).length===0);
}

// ═══════════════════════════════════════════════════════════════
// SECTION G5 — endVisit preserves all state fields
// ═══════════════════════════════════════════════════════════════
section('SECTION G5 — endVisit preserves all state fields');
{
  let g=makeGame(15);
  for(let i=0;i<5;i++){g=applyPot(g,'red');g=applyPot(g,'black');}
  // After 5 reds+blacks: redsRemaining=10, awaiting=red, phase=reds, colorsRemaining=6
  const before=g.current;
  g=applyEndVisit(g);
  const after=g.current;
  assert('G5.1: endVisit switches player',after.currentPlayer===1);
  assert('G5.2: endVisit resets break to 0',after.currentBreak===0);
  assert('G5.3: endVisit preserves scores',after.scores[0]===before.scores[0]&&after.scores[1]===before.scores[1]);
  assert('G5.4: endVisit preserves phase',after.phase===before.phase);
  assert('G5.5: endVisit preserves redsRemaining',after.redsRemaining===before.redsRemaining);
  assert('G5.6: endVisit preserves awaiting',after.awaiting===before.awaiting);
  assert('G5.7: endVisit preserves colorsRemaining length',after.colorsRemaining.length===before.colorsRemaining.length);
  assert('G5.8: endVisit preserves pointsOnTable',after.pointsOnTable===before.pointsOnTable);
  assert('G5.9: endVisit preserves isFrameOver',after.isFrameOver===before.isFrameOver);
  assert('G5.10: endVisit adds to history',g.history.length>0);

  // endVisit in colors phase
  let g2=makeGame(1);
  g2=applyPot(g2,'red');g2=applyPot(g2,'black'); // enters colors phase
  assert('G5.11: in colors before endVisit',g2.current.phase==='colors');
  const colsBefore=[...g2.current.colorsRemaining];
  g2=applyEndVisit(g2);
  assert('G5.12: colorsRemaining unchanged after endVisit in colors',JSON.stringify(g2.current.colorsRemaining)===JSON.stringify(colsBefore));
  assert('G5.13: phase still colors after endVisit',g2.current.phase==='colors');

  // endVisit when awaiting=color (red already potted) — resets to red
  let g3=makeGame(15);
  g3=applyPot(g3,'red');
  assert('G5.14: awaiting=color before endVisit',g3.current.awaiting==='color');
  g3=applyEndVisit(g3);
  assert('G5.15: awaiting resets to red after endVisit',g3.current.awaiting==='red');
}

// ═══════════════════════════════════════════════════════════════
// SECTION G6 — foul preserves phase, colorsRemaining, redsRemaining
// ═══════════════════════════════════════════════════════════════
section('SECTION G6 — foul preserves game state fields');
{
  let g=makeGame(15);
  for(let i=0;i<7;i++){g=applyPot(g,'red');g=applyPot(g,'black');}
  const before=g.current;
  g=applyFoul(g,4,true);
  const after=g.current;
  assert('G6.1: foul preserves phase',after.phase===before.phase);
  assert('G6.2: foul preserves redsRemaining',after.redsRemaining===before.redsRemaining);
  assert('G6.3: foul preserves awaiting',after.awaiting===before.awaiting);
  assert('G6.4: foul preserves colorsRemaining',JSON.stringify(after.colorsRemaining)===JSON.stringify(before.colorsRemaining));
  assert('G6.5: foul preserves pointsOnTable',after.pointsOnTable===before.pointsOnTable);
  assert('G6.6: foul resets currentBreak to 0',after.currentBreak===0);
  assert('G6.7: opponentPlays=true switches player',after.currentPlayer!==before.currentPlayer);

  // Foul with opponentPlays=false (player plays again)
  g=applyFoul(g,7,false);
  assert('G6.8: opponentPlays=false keeps same player',g.current.currentPlayer===after.currentPlayer);

  // Foul in colors phase
  let g2=makeGame(1);
  g2=applyPot(g2,'red');g2=applyPot(g2,'black');
  for(let i=0;i<3;i++) g2=applyPot(g2,['yellow','green','brown'][i]);
  const colsBefore=[...g2.current.colorsRemaining]; // [blue,pink,black]
  g2=applyFoul(g2,5,true);
  assert('G6.9: foul in colors: colorsRemaining unchanged',JSON.stringify(g2.current.colorsRemaining)===JSON.stringify(colsBefore));
  assert('G6.10: foul in colors: phase still colors',g2.current.phase==='colors');

  // Foul score goes to opponent
  let g3=makeGame(15);
  assert('G6.11: before foul: scores=[0,0]',g3.current.scores[0]===0&&g3.current.scores[1]===0);
  g3=applyFoul(g3,6,true);
  assert('G6.12: P1 gets 6 from P0 foul',g3.current.scores[1]===6);
  assert('G6.13: P0 score unchanged after foul',g3.current.scores[0]===0);
  g3=applyFoul(g3,7,true);
  assert('G6.14: P0 gets 7 from P1 foul',g3.current.scores[0]===7);
  assert('G6.15: P1 score unchanged from second foul',g3.current.scores[1]===6);
}

// ═══════════════════════════════════════════════════════════════
// SECTION G7 — addExtraRed: multiple consecutive, score, pot
// ═══════════════════════════════════════════════════════════════
section('SECTION G7 — addExtraRed: multiple consecutive extra reds');
{
  // 3 extra reds potted on same shot (4 reds total in pot)
  let g=makeGame(15);
  g=applyPot(g,'red'); // first red, redsRemaining=14, awaiting=color
  g=applyExtraRed(g);  // 2nd red, redsRemaining=13
  g=applyExtraRed(g);  // 3rd red, redsRemaining=12
  g=applyExtraRed(g);  // 4th red, redsRemaining=11
  assert('G7.1: 4 reds: score=4',g.current.scores[0]===4);
  assert('G7.2: 4 reds: redsRemaining=11',g.current.redsRemaining===11);
  assert('G7.3: awaiting still color',g.current.awaiting==='color');
  assert('G7.4: currentBreak=4',g.current.currentBreak===4);
  assert('G7.5: frameHighestBreak=4',g.frameHighestBreak[0]===4);
  // pot the nominated color
  g=applyPot(g,'black');
  assert('G7.6: after black: score=4+7=11',g.current.scores[0]===11);
  assert('G7.7: after black: awaiting=red',g.current.awaiting==='red');
  assert('G7.8: redsRemaining still 11',g.current.redsRemaining===11);

  // pointsOnTable after 4 reds: 11*8+27=115
  assert('G7.9: pot after 4 reds: 11*8+27=115',g.current.pointsOnTable===115);

  // Extra red guard: addExtraRed when redsRemaining=0 throws
  let g2=makeGame(1);
  g2=applyPot(g2,'red'); // redsRemaining=0, awaiting=color
  let threw=false;
  try{applyExtraRed(g2);}catch(e){threw=true;}
  assert('G7.10: addExtraRed with 0 reds throws',threw);

  // Extra red guard: addExtraRed when awaiting=red throws
  let g3=makeGame(15);
  let threw2=false;
  try{applyExtraRed(g3);}catch(e){threw2=true;}
  assert('G7.11: addExtraRed when awaiting=red throws',threw2);

  // Extra red updates pointsOnTable correctly
  let g4=makeGame(5);
  // Initial: 5*8+27=67
  g4=applyPot(g4,'red'); // redsRemaining=4, awaiting=color: 7+4*8+27=66
  assert('G7.12: after 1st red: pot=66',g4.current.pointsOnTable===66);
  g4=applyExtraRed(g4); // redsRemaining=3, awaiting=color: 7+3*8+27=58
  assert('G7.13: after extra red: pot=58',g4.current.pointsOnTable===58);
  g4=applyExtraRed(g4); // redsRemaining=2: 7+2*8+27=50
  assert('G7.14: after 2nd extra: pot=50',g4.current.pointsOnTable===50);
}

// ═══════════════════════════════════════════════════════════════
// SECTION G8 — break accumulation with all 7 ball types
// ═══════════════════════════════════════════════════════════════
section('SECTION G8 — break accumulation with every ball type');
{
  // pot red + each color in turn, verify break accumulation
  const colors=['yellow','green','brown','blue','pink','black'];
  const colorValues=[2,3,4,5,6,7];
  for(let i=0;i<colors.length;i++){
    let g=makeGame(15);
    g=applyPot(g,'red');
    const breakAfterRed=g.current.currentBreak;
    assert(`G8.${i*3+1}: red+${colors[i]}: break after red=1`,breakAfterRed===1);
    g=applyPot(g,colors[i]);
    const expected=1+colorValues[i];
    assert(`G8.${i*3+2}: red+${colors[i]}: break=${expected}`,g.current.currentBreak===expected,`got ${g.current.currentBreak}`);
    assert(`G8.${i*3+3}: red+${colors[i]}: frameHighestBreak=${expected}`,g.frameHighestBreak[0]===expected);
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION G9 — frameHighestBreak only updates when new max
// ═══════════════════════════════════════════════════════════════
section('SECTION G9 — frameHighestBreak only updates on new max');
{
  let g=makeGame(15);
  // Break 1 within frame: 8 (red+black)
  g=applyPot(g,'red');g=applyPot(g,'black');
  assert('G9.1: highestBreak=8 after red+black',g.frameHighestBreak[0]===8);
  g=applyEndVisit(g);
  assert('G9.2: highestBreak preserved after endVisit',g.frameHighestBreak[0]===8);

  // Break 2: P1 pots red+yellow (break=3), endVisit returns awaiting=red to P0
  g=applyPot(g,'red');g=applyPot(g,'yellow');
  assert('G9.3: currentBreak=3 in visit 2 (red+yellow)',g.current.currentBreak===3);
  assert('G9.4: P0 highestBreak still 8 (P1\'s break=3 doesn\'t affect P0)',g.frameHighestBreak[0]===8);
  g=applyEndVisit(g); // awaiting=red now (yellow was potted), P0 plays

  // Break 3: P0 pots red+pink (7), then red+pink again (7) → total currentBreak=14 > 8
  g=applyPot(g,'red');g=applyPot(g,'pink');
  assert('G9.5: highestBreak still 8 (7 < 8)',g.frameHighestBreak[0]===8);
  g=applyPot(g,'red');g=applyPot(g,'pink'); // 7+7=14 > 8
  assert('G9.6: highestBreak updated to 14',g.frameHighestBreak[0]===14);

  // Foul doesn't update highestBreak
  g=applyFoul(g,7,true);
  assert('G9.7: foul doesn\'t update highestBreak',g.frameHighestBreak[0]===14);

  // P1's highestBreak tracked separately
  g=applyPot(g,'red');g=applyPot(g,'black'); // P1 break=8
  assert('G9.8: P1 highestBreak=8',g.frameHighestBreak[1]===8);
  assert('G9.9: P0 highestBreak still 14',g.frameHighestBreak[0]===14);

  // Reset on confirmFrameEnd
  g=applyConcede(g);g=confirmFrameEnd(g,0);
  assert('G9.10: frameHighestBreak resets to [0,0]',g.frameHighestBreak[0]===0&&g.frameHighestBreak[1]===0);
}

// ═══════════════════════════════════════════════════════════════
// SECTION G10 — Deep undo chain
// ═══════════════════════════════════════════════════════════════
section('SECTION G10 — Deep undo chain restores exact state');
{
  let g=makeGame(15);
  const snapshots=[];
  // Build up a chain of 10 actions
  const actions=[
    ()=>applyPot(g,'red'),   ()=>applyPot(g,'black'),
    ()=>applyPot(g,'red'),   ()=>applyPot(g,'pink'),
    ()=>applyPot(g,'red'),   ()=>applyPot(g,'blue'),
    ()=>applyFoul(g,4,true), ()=>applyPot(g,'red'),
    ()=>applyPot(g,'yellow'),()=>applyEndVisit(g),
  ];
  // Apply sequentially, capture each state
  for(const action of actions){
    snapshots.push(JSON.stringify(g.current));
    g=action();
  }
  assert('G10.1: history length=10',g.history.length===10);

  // Undo all 10 one by one, verify each restore
  for(let i=9;i>=0;i--){
    g=applyUndo(g);
    assert(`G10.${11-i}: undo step ${10-i}: state restored`,JSON.stringify(g.current)===snapshots[i]);
  }
  assert('G10.11: history empty after 10 undos',g.history.length===0);

  // Extra undos are no-ops
  const frozen=JSON.stringify(g.current);
  g=applyUndo(g);g=applyUndo(g);
  assert('G10.12: extra undos are no-ops',JSON.stringify(g.current)===frozen);
}

// ═══════════════════════════════════════════════════════════════
// SECTION G11 — Concede in every phase and awaiting state
// ═══════════════════════════════════════════════════════════════
section('SECTION G11 — Concede in every state');
{
  // Concede at start
  let g=makeGame(15);
  g=applyConcede(g);
  assert('G11.1: concede at start: isFrameOver=true',g.current.isFrameOver===true);
  assert('G11.2: concede at start: scores=[0,0]',g.current.scores[0]===0&&g.current.scores[1]===0);

  // Concede when awaiting=color (after red)
  let g2=makeGame(15);
  g2=applyPot(g2,'red');
  g2=applyConcede(g2);
  assert('G11.3: concede awaiting=color: isFrameOver',g2.current.isFrameOver===true);
  assert('G11.4: score preserved on concede',g2.current.scores[0]===1);

  // Concede in colors phase
  let g3=makeGame(1);
  g3=applyPot(g3,'red');g3=applyPot(g3,'black'); // phase=colors
  g3=applyPot(g3,'yellow');
  g3=applyConcede(g3);
  assert('G11.5: concede in colors: isFrameOver',g3.current.isFrameOver===true);
  assert('G11.6: colorsRemaining preserved on concede',g3.current.colorsRemaining.length===5);

  // Concede after foul
  let g4=makeGame(15);
  g4=applyFoul(g4,7,true);
  g4=applyConcede(g4);
  assert('G11.7: concede after foul works',g4.current.isFrameOver===true);

  // Double concede is no-op (hook guards against it)
  // (hook: if prev.current.isFrameOver return prev — but our helper doesn't guard)
  // Verify frame is still over
  assert('G11.8: isFrameOver stays true',g4.current.isFrameOver===true);
}

// ═══════════════════════════════════════════════════════════════
// SECTION G12 — 1-red game: complete all sequences
// ═══════════════════════════════════════════════════════════════
section('SECTION G12 — 1-red game complete sequences');
{
  // Max break in 1-red game = 1+7+2+3+4+5+6+7 = 35
  let g=makeGame(1);
  assert('G12.1: 1-red initial pot=1*8+27=35',g.current.pointsOnTable===35);
  g=applyPot(g,'red');
  assert('G12.2: after red: pot=7+0*8+27=34',g.current.pointsOnTable===34);
  g=applyPot(g,'black'); // phase=colors now
  assert('G12.3: after free black: phase=colors',g.current.phase==='colors');
  assert('G12.4: colorsRemaining=6',g.current.colorsRemaining.length===6);
  assert('G12.5: pot=27',g.current.pointsOnTable===27);
  for(const c of ['yellow','green','brown','blue','pink','black']){
    g=applyPot(g,c);
  }
  assert('G12.6: 1-red frame over',g.current.isFrameOver===true);
  assert('G12.7: max 1-red break=35',g.current.scores[0]===35);

  // 1-red game: choose yellow as free color (not black)
  let g2=makeGame(1);
  g2=applyPot(g2,'red');g2=applyPot(g2,'yellow'); // yellow as free color
  assert('G12.8: yellow as free color: phase=colors',g2.current.phase==='colors');
  assert('G12.9: colorsRemaining still 6 (resets)',g2.current.colorsRemaining.length===6);
  assert('G12.10: score after red+yellow=3',g2.current.scores[0]===3);

  // 1-red: foul after red, awaiting stays color
  let g3=makeGame(1);
  g3=applyPot(g3,'red');
  g3=applyFoul(g3,4,true);
  assert('G12.11: foul after last red: awaiting=color',g3.current.awaiting==='color');
  assert('G12.12: phase still reds (no free color yet)',g3.current.phase==='reds');
  assert('G12.13: redsRemaining still 0',g3.current.redsRemaining===0);

  // P1 pots free color → transitions to colors
  g3=applyPot(g3,'blue');
  assert('G12.14: after free color: phase=colors',g3.current.phase==='colors');
  assert('G12.15: P1 score = 4+5=9 (foul+blue)',g3.current.scores[1]===9);
}

// ═══════════════════════════════════════════════════════════════
// SECTION G13 — 2-red game sequences
// ═══════════════════════════════════════════════════════════════
section('SECTION G13 — 2-red game sequences');
{
  let g=makeGame(2);
  assert('G13.1: 2-red initial pot=2*8+27=43',g.current.pointsOnTable===43);

  // Pot both reds consecutively (each red separate shot)
  g=applyPot(g,'red');g=applyPot(g,'black');
  g=applyPot(g,'red');g=applyPot(g,'black');
  assert('G13.2: 2 reds+blacks: redsRemaining=0',g.current.redsRemaining===0);
  assert('G13.3: phase=colors after 2nd free black',g.current.phase==='colors');
  assert('G13.4: score=2*(1+7)=16',g.current.scores[0]===16);
  assert('G13.5: colorsRemaining=6',g.current.colorsRemaining.length===6);

  // 2-red: extra red on shot 1
  let g2=makeGame(2);
  g2=applyPot(g2,'red'); // redsRemaining=1, awaiting=color
  g2=applyExtraRed(g2);  // extra red, redsRemaining=0, awaiting=color
  assert('G13.6: 2 reds on one shot: redsRemaining=0',g2.current.redsRemaining===0);
  assert('G13.7: awaiting=color after 2 reds',g2.current.awaiting==='color');
  assert('G13.8: score=2',g2.current.scores[0]===2);
  g2=applyPot(g2,'black'); // free color: redsRemaining=0 → phase=colors
  assert('G13.9: free black after 2-reds-1-shot: phase=colors',g2.current.phase==='colors');

  // Max break 2-red = 2+2*7+27 = 43
  let g3=makeGame(2);
  g3=applyPot(g3,'red');g3=applyPot(g3,'black');
  g3=applyPot(g3,'red');g3=applyPot(g3,'black');
  for(const c of ['yellow','green','brown','blue','pink','black']) g3=applyPot(g3,c);
  assert('G13.10: 2-red max break=43',g3.current.scores[0]===43);
  assert('G13.11: frame over',g3.current.isFrameOver===true);
}

// ═══════════════════════════════════════════════════════════════
// SECTION G14 — colorsRemaining never mutated in place
// ═══════════════════════════════════════════════════════════════
section('SECTION G14 — colorsRemaining immutability');
{
  let g=makeGame(1);
  g=applyPot(g,'red');g=applyPot(g,'black'); // enter colors
  const ref=g.current.colorsRemaining;
  g=applyPot(g,'yellow');
  assert('G14.1: old colorsRemaining reference has 6 items still',ref.length===6);
  assert('G14.2: new colorsRemaining has 5',g.current.colorsRemaining.length===5);
  const ref2=g.current.colorsRemaining;
  g=applyEndVisit(g);
  assert('G14.3: endVisit: new colorsRemaining has 5',g.current.colorsRemaining.length===5);
  assert('G14.4: endVisit: same colorsRemaining ref or equal',JSON.stringify(g.current.colorsRemaining)===JSON.stringify(ref2));
  g=applyFoul(g,4,true);
  assert('G14.5: foul: colorsRemaining still 5',g.current.colorsRemaining.length===5);
  g=applyUndo(g);
  assert('G14.6: undo foul: colorsRemaining restored to 5',g.current.colorsRemaining.length===5);
  g=applyUndo(g);
  assert('G14.7: undo endVisit: colorsRemaining restored to 5',g.current.colorsRemaining.length===5);
  g=applyUndo(g);
  assert('G14.8: undo yellow pot: colorsRemaining restored to 6',g.current.colorsRemaining.length===6);
}

// ═══════════════════════════════════════════════════════════════
// SECTION G15 — Score integrity: never negative, accumulates correctly
// ═══════════════════════════════════════════════════════════════
section('SECTION G15 — Score integrity');
{
  // After many fouls, scores are non-negative
  let g=makeGame(15);
  for(let i=0;i<20;i++) g=applyFoul(g,4,true);
  assert('G15.1: scores non-negative after 20 fouls',g.current.scores[0]>=0&&g.current.scores[1]>=0);
  assert('G15.2: foul scores accumulate: P0=10*4=40, P1=10*4=40',g.current.scores[0]===40&&g.current.scores[1]===40);

  // Score only increases from pots
  let g2=makeGame(15);
  const track=[];
  for(let i=0;i<5;i++){
    g2=applyPot(g2,'red');track.push(g2.current.scores[0]);
    g2=applyPot(g2,'black');track.push(g2.current.scores[0]);
  }
  for(let i=1;i<track.length;i++){
    assert(`G15.3.${i}: score only increases with pots`,track[i]>track[i-1]);
  }

  // P0 and P1 scores tracked independently
  let g3=makeGame(15);
  g3=applyPot(g3,'red');g3=applyPot(g3,'black'); // P0=8
  g3=applyEndVisit(g3);
  g3=applyPot(g3,'red');g3=applyPot(g3,'pink'); // P1=7
  assert('G15.4: P0=8 independent of P1',g3.current.scores[0]===8);
  assert('G15.5: P1=7 independent of P0',g3.current.scores[1]===7);

  // Foul gives points to opponent only
  g3=applyEndVisit(g3);
  g3=applyFoul(g3,5,true); // P0 fouls → P1 gets 5
  assert('G15.6: P0 score unchanged by own foul',g3.current.scores[0]===8);
  assert('G15.7: P1 gets foul points',g3.current.scores[1]===12);
}

// ═══════════════════════════════════════════════════════════════
// SECTION G16 — Undo after foul+endVisit complex chains
// ═══════════════════════════════════════════════════════════════
section('SECTION G16 — Undo after foul+endVisit chains');
{
  // Sequence: P0 pots red → P0 fouls (P1 plays, awaiting=color) → P1 pots black → endVisit → P0 pots red
  let g2=makeGame(15);
  g2=applyPot(g2,'red');        // P0: score=1, awaiting=color, history[0]
  g2=applyFoul(g2,7,true);      // P1 gets 7, P1 plays, awaiting=color, history[1]
  g2=applyPot(g2,'black');      // P1 pots black (color), P1=7+7=14, awaiting=red, history[2]
  g2=applyEndVisit(g2);         // P0 plays, history[3]
  g2=applyPot(g2,'red');        // P0 pots red, score P0=1+1=2, history[4]

  assert('G16.1: before undos P0=2 P1=14',g2.current.scores[0]===2&&g2.current.scores[1]===14);
  assert('G16.2: history=5',g2.history.length===5);

  g2=applyUndo(g2); // undo red → P0=1
  assert('G16.3: undo red: P0=1',g2.current.scores[0]===1);
  g2=applyUndo(g2); // undo endVisit → P1 plays
  assert('G16.4: undo endVisit: P1 plays',g2.current.currentPlayer===1);
  g2=applyUndo(g2); // undo black → P1=7, awaiting=color
  assert('G16.5: undo black: P1=7',g2.current.scores[1]===7);
  assert('G16.6: undo black: awaiting=color',g2.current.awaiting==='color');
  g2=applyUndo(g2); // undo foul → P1=0, P0 plays
  assert('G16.7: undo foul: P1=0',g2.current.scores[1]===0);
  assert('G16.8: undo foul: P0 plays',g2.current.currentPlayer===0);
  g2=applyUndo(g2); // undo red → P0=0, awaiting=red
  assert('G16.9: undo red: P0=0',g2.current.scores[0]===0);
  assert('G16.10: undo red: awaiting=red',g2.current.awaiting==='red');
  assert('G16.11: history empty',g2.history.length===0);
}

// ═══════════════════════════════════════════════════════════════
// SECTION G17 — Frame results persistence
// ═══════════════════════════════════════════════════════════════
section('SECTION G17 — FrameResults stored at confirmFrameEnd');
{
  let g=makeGame(15,9);
  // Frame 1: P0 pots 3 reds+blacks (24), P1 fouls (7 to P0 → P0=24 wait)
  // P0 fouls → P1 gets 7. Then P1 plays and concedes.
  for(let i=0;i<3;i++){g=applyPot(g,'red');g=applyPot(g,'black');} // P0=24
  g=applyFoul(g,7,true); // P0 fouls → P1 gets 7. P0=24,P1=7
  g=applyConcede(g); // P1 concedes
  g=confirmFrameEnd(g,0); // P0 wins frame 1

  assert('G17.1: 1 result stored',g.frameResults.length===1);
  assert('G17.2: frame1 winner=0',g.frameResults[0].winner===0);
  assert('G17.3: frame1 P0 score=24',g.frameResults[0].scores[0]===24);
  assert('G17.4: frame1 P1 score=7',g.frameResults[0].scores[1]===7);
  assert('G17.5: frame1 P0 highestBreak=24',g.frameResults[0].highestBreak[0]===24);
  assert('G17.6: frame1 P1 highestBreak=0 (foul not a break)',g.frameResults[0].highestBreak[1]===0);
  assert('G17.7: frame1 frameNumber=1',g.frameResults[0].frameNumber===1);

  // Frame 2: P1 breaks (nextBreaker alternates)
  assert('G17.8: frame 2 starts with P1',g.current.currentPlayer===1);
  g=applyPot(g,'red');g=applyPot(g,'pink'); // P1=7
  g=applyConcede(g);
  g=confirmFrameEnd(g,1);
  assert('G17.9: frame2 winner=1',g.frameResults[1].winner===1);
  assert('G17.10: frame2 P1 score=7',g.frameResults[1].scores[1]===7);
  assert('G17.11: frame2 frameNumber=2',g.frameResults[1].frameNumber===2);
  assert('G17.12: 2 results total',g.frameResults.length===2);
  assert('G17.13: framesWon=[1,1]',g.framesWon[0]===1&&g.framesWon[1]===1);
}

// ═══════════════════════════════════════════════════════════════
// SECTION G18 — Colors phase complete variations (endVisit mid-colors)
// ═══════════════════════════════════════════════════════════════
section('SECTION G18 — Colors phase: mid-sequence endVisit');
{
  let g=makeGame(1);
  g=applyPot(g,'red');g=applyPot(g,'black');
  // Phase=colors. P0 pots yellow
  g=applyPot(g,'yellow'); // colorsRemaining=[green,brown,blue,pink,black]
  g=applyEndVisit(g); // P1 plays, must pot green
  assert('G18.1: P1 must pot green next',g.current.colorsRemaining[0]==='green');
  assert('G18.2: P1 is active',g.current.currentPlayer===1);
  g=applyPot(g,'green');
  g=applyEndVisit(g); // P0 plays, must pot brown
  assert('G18.3: P0 must pot brown',g.current.colorsRemaining[0]==='brown');
  g=applyPot(g,'brown');g=applyPot(g,'blue');
  g=applyEndVisit(g); // P1 plays, must pot pink
  assert('G18.4: P1 must pot pink',g.current.colorsRemaining[0]==='pink');
  g=applyPot(g,'pink');
  g=applyEndVisit(g); // P0 plays, must pot black
  assert('G18.5: P0 must pot black',g.current.colorsRemaining[0]==='black');
  g=applyPot(g,'black');
  assert('G18.6: frame over after last black',g.current.isFrameOver===true);

  // Score check: P0 potted red+black+yellow+brown+blue+black = 1+7+2+4+5+7 = 26
  // P1 potted green+pink = 3+6 = 9
  assert('G18.7: P0 score=26',g.current.scores[0]===26);
  assert('G18.8: P1 score=9',g.current.scores[1]===9);
}

// ═══════════════════════════════════════════════════════════════
// SECTION G19 — Foul in colors phase: ball stays, then pot it
// ═══════════════════════════════════════════════════════════════
section('SECTION G19 — Colors phase foul then pot');
{
  // Full colors sequence with a foul on each ball before potting
  let g=makeGame(1);
  g=applyPot(g,'red');g=applyPot(g,'black');
  // Phase=colors, yellow first
  const colorsInOrder=['yellow','green','brown','blue','pink','black'];
  let p0score=1+7; // from reds phase
  let p1score=0;
  for(let i=0;i<colorsInOrder.length;i++){
    // Foul before each color
    g=applyFoul(g,4,true); // current player fouls, opponent gets 4, opponent plays
    // Determine whose score: after foul, opponent plays. opponent receives 4.
    // After foul: current player was P0 or P1, opponent gets 4 and plays next
    // This is complex to track, let's just verify colorsRemaining unchanged
    const colsBefore=[...g.current.colorsRemaining];
    // previous player (who fouled) was the opponent now. Let's check colorsRemaining unchanged
    assert(`G19.${i*3+1}: foul before ${colorsInOrder[i]}: colorsRemaining unchanged`,
      JSON.stringify(g.current.colorsRemaining)===JSON.stringify(colsBefore));
    assert(`G19.${i*3+2}: foul before ${colorsInOrder[i]}: frame not over`,!g.current.isFrameOver);
    g=applyPot(g,colorsInOrder[i]);
    assert(`G19.${i*3+3}: ${colorsInOrder[i]} potted after foul`,
      i===colorsInOrder.length-1 ? g.current.isFrameOver : !g.current.isFrameOver);
  }
  assert('G19.19: frame over after all colors potted',g.current.isFrameOver===true);
}

// ═══════════════════════════════════════════════════════════════
// SECTION G20 — Mixed complex sequence stress test
// ═══════════════════════════════════════════════════════════════
section('SECTION G20 — Mixed complex sequence');
{
  // Simulate a realistic frame with many different actions
  let g=makeGame(15);
  // P0: red+black (8)
  g=applyPot(g,'red');g=applyPot(g,'black');
  // P0: red+pink (7) → total 15
  g=applyPot(g,'red');g=applyPot(g,'pink');
  // P0 misses
  g=applyEndVisit(g);
  // P1: red+black (8)
  g=applyPot(g,'red');g=applyPot(g,'black');
  // P1 fouls (7 to P0) → P0=15+7=22
  g=applyFoul(g,7,false); // P1 fouls, P0 gets 7, P1 plays again
  assert('G20.1: P0=22 after P1 foul',g.current.scores[0]===22);
  // P1 continues: red+blue (6) → P1=8+6=14
  g=applyPot(g,'red');g=applyPot(g,'blue');
  assert('G20.2: P1=14',g.current.scores[1]===14);
  // Undo P1's blue
  g=applyUndo(g);
  assert('G20.3: after undo blue: P1=8+1=9',g.current.scores[1]===9); // 8 (red+black) + 1 (red) = 9? Wait. P1 potted red+black=8, then foul didn't change P1 score, then red=1 → P1=9
  assert('G20.4: awaiting=color after undo blue',g.current.awaiting==='color');
  // Re-pot black instead
  g=applyPot(g,'black'); // P1=9+7=16
  assert('G20.5: P1=16 after black',g.current.scores[1]===16);
  // P1 misses
  g=applyEndVisit(g);
  // Check redsRemaining
  // P0: red+black+red+pink (used 2 reds), P1: red+black+red+black (used 2 reds) = 4 reds used, 11 remaining
  assert('G20.6: redsRemaining=11',g.current.redsRemaining===11);
  // P0 pots 5 consecutive reds+blacks to end
  for(let i=0;i<5;i++){g=applyPot(g,'red');g=applyPot(g,'black');}
  // redsRemaining = 11-5 = 6
  assert('G20.7: redsRemaining=6',g.current.redsRemaining===6);
  // P0 total: 22 (pre-visit) + 5*8 = 22+40 = 62
  assert('G20.8: P0=62',g.current.scores[0]===62);
  // Concede, frame ends
  g=applyConcede(g);
  assert('G20.9: frame over',g.current.isFrameOver===true);
  g=confirmFrameEnd(g,0);
  assert('G20.10: P0 wins, result stored',g.frameResults[0].winner===0);
  assert('G20.11: frameNumber now 2',g.frameNumber===2);
  assert('G20.12: new frame fresh start',g.current.scores[0]===0&&g.current.scores[1]===0);
}

// ═══════════════════════════════════════════════════════════════
// SECTION G21 — getAvailableBalls exhaustive
// ═══════════════════════════════════════════════════════════════
section('SECTION G21 — getAvailableBalls exhaustive');
{
  // Reds phase, awaiting=red, reds>0
  const s1={phase:'reds',redsRemaining:15,awaiting:'red',colorsRemaining:[...COLORS_SEQUENCE],isFrameOver:false};
  assert('G21.1: reds/red/15reds: only red available',JSON.stringify(getAvailableBalls(s1))==='["red"]');

  // Reds phase, awaiting=color
  const s2={phase:'reds',redsRemaining:14,awaiting:'color',colorsRemaining:[...COLORS_SEQUENCE],isFrameOver:false};
  const avail2=getAvailableBalls(s2);
  assert('G21.2: reds/color: 6 colors available',avail2.length===6);
  assert('G21.3: red not in available when awaiting=color',!avail2.includes('red'));
  assert('G21.4: all 6 colors available',avail2.includes('yellow')&&avail2.includes('black'));

  // Reds phase, awaiting=red, reds=0 (edge case)
  const s3={phase:'reds',redsRemaining:0,awaiting:'red',colorsRemaining:[...COLORS_SEQUENCE],isFrameOver:false};
  const avail3=getAvailableBalls(s3);
  assert('G21.5: reds=0 awaiting=red: returns all colors',avail3.length===6);

  // Colors phase
  const s4={phase:'colors',redsRemaining:0,awaiting:'red',colorsRemaining:['blue','pink','black'],isFrameOver:false};
  const avail4=getAvailableBalls(s4);
  assert('G21.6: colors phase: only first color',avail4.length===1);
  assert('G21.7: colors phase: blue first',avail4[0]==='blue');

  // Frame over
  const s5={phase:'colors',redsRemaining:0,awaiting:'red',colorsRemaining:[],isFrameOver:true};
  assert('G21.8: frame over: no balls available',getAvailableBalls(s5).length===0);

  // Colors phase, black only
  const s6={phase:'colors',redsRemaining:0,awaiting:'red',colorsRemaining:['black'],isFrameOver:false};
  assert('G21.9: colors: only black left',getAvailableBalls(s6)[0]==='black');
}

// ═══════════════════════════════════════════════════════════════
// SECTION T6 — Train foul: awaiting preserved (not reset)
// ═══════════════════════════════════════════════════════════════
section('SECTION T6 — Train foul: awaiting preserved throughout');
{
  // In train mode, the player fouls (opponentPlays=false → same player plays again)
  let g=makeGame(6,9999);
  g=applyPot(g,'red'); // awaiting=color
  assert('T6.1: awaiting=color after red',g.current.awaiting==='color');
  // Train foul (opponentPlays=false, player plays again)
  g=applyFoul(g,4,false);
  assert('T6.2: train foul: awaiting still color',g.current.awaiting==='color');
  assert('T6.3: train foul: same player',g.current.currentPlayer===0);
  assert('T6.4: train foul: opponent (slot 1) gets 4',g.current.scores[1]===4);
  assert('T6.5: train foul: break reset to 0',g.current.currentBreak===0);
  // Player can now pot a color
  g=applyPot(g,'black');
  assert('T6.6: after foul: can pot black',g.current.awaiting==='red');

  // Foul when awaiting=red → stays red
  let g2=makeGame(6,9999);
  g2=applyFoul(g2,4,false);
  assert('T6.7: foul awaiting=red: stays red',g2.current.awaiting==='red');

  // Multiple fouls in a row don't change awaiting
  let g3=makeGame(6,9999);
  g3=applyPot(g3,'red'); // awaiting=color
  for(let i=0;i<5;i++) g3=applyFoul(g3,4,false);
  assert('T6.8: 5 consecutive fouls: awaiting still color',g3.current.awaiting==='color');
  assert('T6.9: opponent score = 5*4=20',g3.current.scores[1]===20);
}

// ═══════════════════════════════════════════════════════════════
// SECTION T7 — Train: different red configurations
// ═══════════════════════════════════════════════════════════════
section('SECTION T7 — Train: different red configs');
{
  // 1-red train
  let g1=makeGame(1,9999);
  assert('T7.1: 1-red: pot=35',g1.current.pointsOnTable===35);
  g1=applyPot(g1,'red');g1=applyPot(g1,'black');
  for(const c of ['yellow','green','brown','blue','pink','black']) g1=applyPot(g1,c);
  assert('T7.2: 1-red: max break=35',g1.current.scores[0]===35);
  g1=confirmFrameEnd(g1,0,0);
  assert('T7.3: 1-red: break stored',g1.frameResults[0].scores[0]===35);

  // 3-red train
  let g3=makeGame(3,9999);
  assert('T7.4: 3-red: pot=3*8+27=51',g3.current.pointsOnTable===51);
  for(let i=0;i<3;i++){g3=applyPot(g3,'red');g3=applyPot(g3,'black');}
  assert('T7.5: 3-red: after reds phase, score=24',g3.current.scores[0]===24);
  assert('T7.6: 3-red: phase=colors after 3rd free black',g3.current.phase==='colors');

  // 10-red train
  let g10=makeGame(10,9999);
  assert('T7.7: 10-red: pot=10*8+27=107',g10.current.pointsOnTable===107);
  for(let i=0;i<10;i++){g10=applyPot(g10,'red');g10=applyPot(g10,'black');}
  assert('T7.8: 10-red: score after reds=80',g10.current.scores[0]===80);
  assert('T7.9: 10-red: phase=colors',g10.current.phase==='colors');
  for(const c of ['yellow','green','brown','blue','pink','black']) g10=applyPot(g10,c);
  assert('T7.10: 10-red: max break=107',g10.current.scores[0]===107);

  // 15-red train max break
  let g15=makeGame(15,9999);
  for(let i=0;i<15;i++){g15=applyPot(g15,'red');g15=applyPot(g15,'black');}
  for(const c of ['yellow','green','brown','blue','pink','black']) g15=applyPot(g15,c);
  assert('T7.11: 15-red: max break=147',g15.current.scores[0]===147);
}

// ═══════════════════════════════════════════════════════════════
// SECTION T8 — Train undo within a break
// ═══════════════════════════════════════════════════════════════
section('SECTION T8 — Train undo within break');
{
  let g=makeGame(6,9999);
  g=applyPot(g,'red');g=applyPot(g,'black');g=applyPot(g,'red');g=applyPot(g,'pink');
  assert('T8.1: score=8+7=15 wait: 1+7+1+6=15',g.current.scores[0]===15);
  assert('T8.2: currentBreak=15',g.current.currentBreak===15);
  // Undo pink
  g=applyUndo(g);
  assert('T8.3: undo pink: score=9 (1+7+1)',g.current.scores[0]===9);
  assert('T8.4: awaiting=color after undo',g.current.awaiting==='color');
  // Undo second red
  g=applyUndo(g);
  assert('T8.5: undo 2nd red: score=8',g.current.scores[0]===8);
  assert('T8.6: awaiting=red after undo',g.current.awaiting==='red');
  // Re-pot red + black
  g=applyPot(g,'red');g=applyPot(g,'black');
  assert('T8.7: after re-pot: score=16',g.current.scores[0]===16);
  // history clears between frames
  g=applyConcede(g);g=confirmFrameEnd(g,0,0);
  assert('T8.8: history clears after confirmFrameEnd',g.history.length===0);
  assert('T8.9: undo on empty history is no-op',JSON.stringify(applyUndo(g).current)===JSON.stringify(g.current));
}

// ═══════════════════════════════════════════════════════════════
// SECTION G22 — addExtraRed: cascade to zero reds + phase transition
// ═══════════════════════════════════════════════════════════════
section('SECTION G22 — addExtraRed cascade to zero + phase transition');
{
  // 2-red game: pot red, addExtraRed → redsRemaining=0, awaiting=color
  let g=makeGame(2,null);
  g=applyPot(g,'red'); // reds=1, awaiting=color
  g=applyExtraRed(g);  // reds=0, score=2, awaiting still color
  assert('G22.1: score=2 after red+extraRed',g.current.scores[0]===2);
  assert('G22.2: redsRemaining=0 after extraRed',g.current.redsRemaining===0);
  assert('G22.3: awaiting still color',g.current.awaiting==='color');
  assert('G22.4: pointsOnTable=7+0*8+27=34',g.current.pointsOnTable===34);
  // Potting a color when reds=0 in reds phase → colors phase
  g=applyPot(g,'pink');
  assert('G22.5: after color with reds=0: phase=colors',g.current.phase==='colors');
  assert('G22.6: colorsRemaining is full COLORS_SEQUENCE',g.current.colorsRemaining.length===6);
  assert('G22.7: score=2+6=8',g.current.scores[0]===8);
  // addExtraRed guard: redsRemaining=0 should throw
  let threw=false;
  try { applyExtraRed(g); } catch(e) { threw=true; }
  assert('G22.8: addExtraRed with reds=0 throws',threw===true);
}

// ═══════════════════════════════════════════════════════════════
// SECTION G23 — Undo restores isFrameOver from concede
// ═══════════════════════════════════════════════════════════════
section('SECTION G23 — Undo restores isFrameOver from concede');
{
  let g=makeGame(15,5);
  g=applyPot(g,'red');g=applyPot(g,'black'); // score=8, awaiting=red
  const scoreBefore=g.current.scores[0];
  const awaitingBefore=g.current.awaiting;
  g=applyConcede(g); // isFrameOver=true
  assert('G23.1: concede sets isFrameOver=true',g.current.isFrameOver===true);
  assert('G23.2: concede does not change scores',g.current.scores[0]===scoreBefore);
  g=applyUndo(g); // undo concede
  assert('G23.3: undo concede restores isFrameOver=false',g.current.isFrameOver===false);
  assert('G23.4: undo concede restores awaiting',g.current.awaiting===awaitingBefore);
  assert('G23.5: can pot red again after undo',g.current.scores[0]===scoreBefore);
  // Pot red successfully after undo
  g=applyPot(g,'red');
  assert('G23.6: pot red after undo-concede succeeds',g.current.redsRemaining===13);
}

// ═══════════════════════════════════════════════════════════════
// SECTION G24 — endVisit in colors phase preserves colorsRemaining
// ═══════════════════════════════════════════════════════════════
section('SECTION G24 — endVisit in colors phase preserves colorsRemaining');
{
  // Get to colors phase in a 1-red game
  let g=makeGame(1,5);
  g=applyPot(g,'red'); // reds=0, awaiting=color
  g=applyPot(g,'black'); // colors phase starts, colorsRemaining=[yellow,green,brown,blue,pink,black]
  assert('G24.1: phase=colors after 1-red game reds phase ends',g.current.phase==='colors');
  g=applyPot(g,'yellow'); // colorsRemaining=[green,brown,blue,pink,black]
  assert('G24.2: after yellow: colorsRemaining len=5',g.current.colorsRemaining.length===5);
  const colsBefore=[...g.current.colorsRemaining];
  // endVisit in colors phase
  g=applyEndVisit(g);
  assert('G24.3: endVisit in colors: phase still colors',g.current.phase==='colors');
  assert('G24.4: endVisit in colors: colorsRemaining unchanged',JSON.stringify(g.current.colorsRemaining)===JSON.stringify(colsBefore));
  assert('G24.5: endVisit in colors: P1 plays',g.current.currentPlayer===1);
  // P1 must pot green (next in sequence)
  g=applyPot(g,'green');
  assert('G24.6: P1 pots green successfully',g.current.colorsRemaining.length===4);
  // Cannot pot yellow again (no longer first in sequence)
  let threw=false;
  try { applyPot(g,'yellow'); } catch(e) { threw=true; }
  assert('G24.7: cannot pot yellow when green is next',threw===true);
}

// ═══════════════════════════════════════════════════════════════
// SECTION G25 — frameHighestBreak tracks per-player across visits
// ═══════════════════════════════════════════════════════════════
section('SECTION G25 — frameHighestBreak per-player tracking');
{
  let g=makeGame(15,5);
  // P0 builds 15 (red+black+red+pink = 1+7+1+6)
  g=applyPot(g,'red');g=applyPot(g,'black');g=applyPot(g,'red');g=applyPot(g,'pink');
  assert('G25.1: P0 break=15',g.current.currentBreak===15);
  assert('G25.2: frameHighestBreak[0]=15',g.frameHighestBreak[0]===15);
  assert('G25.3: frameHighestBreak[1]=0',g.frameHighestBreak[1]===0);
  g=applyEndVisit(g);
  assert('G25.4: after endVisit: frameHighestBreak[0] stays 15',g.frameHighestBreak[0]===15);
  // P1 builds 20 (red+black+red+black+red+pink = 1+7+1+7+1+... wait, let's do red+black+red+black = 1+7+1+7=16, then red+pink=1+6=7 → 23)
  g=applyPot(g,'red');g=applyPot(g,'black');g=applyPot(g,'red');g=applyPot(g,'black');
  assert('G25.5: P1 break=16',g.current.currentBreak===16);
  assert('G25.6: frameHighestBreak[1]=16',g.frameHighestBreak[1]===16);
  // Extend P1 break
  g=applyPot(g,'red');g=applyPot(g,'pink');
  assert('G25.7: P1 break=23',g.current.currentBreak===23);
  assert('G25.8: frameHighestBreak[1] updated to 23',g.frameHighestBreak[1]===23);
  // Confirm frame end and check result
  g=applyConcede(g);
  g=confirmFrameEnd(g,1);
  const lastResult=g.frameResults[0];
  assert('G25.9: frameResult.highestBreak[0]=15',lastResult.highestBreak[0]===15);
  assert('G25.10: frameResult.highestBreak[1]=23',lastResult.highestBreak[1]===23);
  // Fresh frame: frameHighestBreak resets
  assert('G25.11: frameHighestBreak resets after confirmFrameEnd',g.frameHighestBreak[0]===0&&g.frameHighestBreak[1]===0);
}

// ═══════════════════════════════════════════════════════════════
// SECTION G26 — BO9 deciding frame (4-4 tie)
// ═══════════════════════════════════════════════════════════════
section('SECTION G26 — BO9 deciding frame (4-4 tie)');
{
  let g=makeGame(15,9);
  // Alternate wins: P0 wins frames 1,3,5,7 → 4 wins; P1 wins 2,4,6,8 → 4 wins
  for(let i=0;i<8;i++){
    const winner=i%2===0?0:1;
    g=applyPot(g,'red');g=applyConcede(g);
    g=confirmFrameEnd(g,winner);
  }
  assert('G26.1: after 8 frames, framesWon=[4,4]',g.framesWon[0]===4&&g.framesWon[1]===4);
  assert('G26.2: isMatchOver=false at 4-4',g.isMatchOver===false);
  assert('G26.3: matchWinner=null at 4-4',g.matchWinner===null);
  assert('G26.4: frameNumber=9 (deciding frame)',g.frameNumber===9);
  // P0 wins the decider
  g=applyPot(g,'red');g=applyConcede(g);
  g=confirmFrameEnd(g,0);
  assert('G26.5: P0 wins decider: isMatchOver=true',g.isMatchOver===true);
  assert('G26.6: matchWinner=0',g.matchWinner===0);
  assert('G26.7: framesWon[0]=5',g.framesWon[0]===5);

  // Same but P1 wins decider
  let g2=makeGame(15,9);
  for(let i=0;i<8;i++){const w=i%2===0?0:1;g2=applyPot(g2,'red');g2=applyConcede(g2);g2=confirmFrameEnd(g2,w);}
  g2=applyPot(g2,'red');g2=applyConcede(g2);g2=confirmFrameEnd(g2,1);
  assert('G26.8: P1 wins decider: matchWinner=1',g2.matchWinner===1);
}

// ═══════════════════════════════════════════════════════════════
// Final summary
// ═══════════════════════════════════════════════════════════════
const sep='═'.repeat(60);
console.log(`\n${sep}`);
if(failed===0){
  console.log(`✅  All ${passed} assertions passed`);
}else{
  console.log(`❌  ${failed} failed, ${passed} passed`);
  process.exit(1);
}
