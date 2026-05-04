// ═══════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════
const STATE = {
  playerName: 'Trainer',
  difficulty: 'easy',
  gameMode: 'classic',
  inputMode: 'type',
  score: 0,
  streak: 0,
  bestStreak: 0,
  lives: 3,
  round: 0,
  totalRounds: 20,
  correctCount: 0,
  usedIds: new Set(),
  currentPokemon: null,
  timerInterval: null,
  timeLeft: 0,
  answered: false,
  active: false,
  musicOn: true
};

const MUSIC = {
  ctx: null,
  master: null,
  loopTimer: null,
  nodes: [],
  enabled: true,
  playing: false,
  loopLength: 0,
  nextStart: 0
};

function midiToFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function ensureMusicContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return false;
  if (MUSIC.ctx) return true;

  MUSIC.ctx = new AudioContext();
  MUSIC.master = MUSIC.ctx.createGain();
  MUSIC.master.gain.value = 0.16;
  MUSIC.master.connect(MUSIC.ctx.destination);
  return true;
}

function playRetroTone(note, start, duration, gain, type) {
  if (note === null) return;
  const ctx = MUSIC.ctx;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(midiToFreq(note), start);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.linearRampToValueAtTime(gain, start + 0.015);
  amp.gain.setValueAtTime(gain, start + duration * 0.72);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(amp);
  amp.connect(MUSIC.master);
  osc.start(start);
  osc.stop(start + duration + 0.03);

  MUSIC.nodes.push(osc);
  osc.onended = () => {
    MUSIC.nodes = MUSIC.nodes.filter(node => node !== osc);
  };
}

function scheduleRetroLoop(start) {
  const beat = 60 / 142;
  MUSIC.loopLength = beat * 16;

  const lead = [
    [76,0,0.5],[79,0.5,0.5],[83,1,0.5],[81,1.5,0.5],
    [79,2,0.5],[76,2.5,0.5],[72,3,1],
    [74,4,0.5],[76,4.5,0.5],[79,5,0.5],[84,5.5,0.5],
    [83,6,0.5],[79,6.5,0.5],[81,7,1],
    [79,8,0.5],[83,8.5,0.5],[86,9,0.5],[88,9.5,0.5],
    [86,10,0.5],[83,10.5,0.5],[79,11,1],
    [76,12,0.5],[79,12.5,0.5],[81,13,0.5],[83,13.5,0.5],
    [81,14,0.5],[79,14.5,0.5],[76,15,1]
  ];
  const bass = [
    [52,0,1],[52,1,1],[55,2,1],[55,3,1],
    [57,4,1],[57,5,1],[55,6,1],[55,7,1],
    [52,8,1],[52,9,1],[59,10,1],[59,11,1],
    [57,12,1],[55,13,1],[52,14,2]
  ];

  lead.forEach(([note, pos, len]) => playRetroTone(note, start + pos * beat, len * beat * 0.92, 0.055, 'square'));
  bass.forEach(([note, pos, len]) => playRetroTone(note, start + pos * beat, len * beat * 0.82, 0.04, 'triangle'));
}

async function startMusic() {
  if (!MUSIC.enabled || !ensureMusicContext()) return;
  if (MUSIC.ctx.state === 'suspended') await MUSIC.ctx.resume();
  if (!MUSIC.enabled || MUSIC.playing) return;

  MUSIC.playing = true;
  MUSIC.master.gain.cancelScheduledValues(MUSIC.ctx.currentTime);
  MUSIC.master.gain.setValueAtTime(0.16, MUSIC.ctx.currentTime);
  MUSIC.nextStart = MUSIC.ctx.currentTime + 0.05;
  scheduleRetroLoop(MUSIC.nextStart);
  MUSIC.nextStart += MUSIC.loopLength;
  MUSIC.loopTimer = setInterval(() => {
    if (!MUSIC.playing) return;
    const start = Math.max(MUSIC.nextStart, MUSIC.ctx.currentTime + 0.05);
    scheduleRetroLoop(start);
    MUSIC.nextStart = start + MUSIC.loopLength;
  }, Math.max(500, (MUSIC.loopLength - 0.5) * 1000));
}

function stopMusic() {
  MUSIC.playing = false;
  clearInterval(MUSIC.loopTimer);
  MUSIC.loopTimer = null;
  MUSIC.nodes.forEach(node => {
    try { node.stop(); } catch(e) {}
  });
  MUSIC.nodes = [];
}

function toggleMusic(el) {
  MUSIC.enabled = !MUSIC.enabled;
  STATE.musicOn = MUSIC.enabled;
  el.classList.toggle('active', MUSIC.enabled);
  el.textContent = MUSIC.enabled ? 'Retro Chiptune On' : 'Retro Chiptune Off';
  if (MUSIC.enabled) startMusic();
  else stopMusic();
}

// ═══════════════════════════════════════════
// POKÉMON CACHE & API
// ═══════════════════════════════════════════
const CACHE = {};
const GEN_RANGES = {
  easy:   { min:1,  max:151 },
  medium: { min:1,  max:493 },
  hard:   { min:1,  max:1010 }
};
const TIMER_DURATIONS = { classic:20, speed:10, survival:15 };
const POINTS_BASE = { classic:100, speed:200, survival:150 };

async function fetchPokemon(id) {
  if (CACHE[id]) return CACHE[id];
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    if (!res.ok) throw new Error('Not found');
    const data = await res.json();
    const poke = {
      id,
      name: data.name,
      displayName: data.name.charAt(0).toUpperCase() + data.name.slice(1).replace(/-/g,' '),
      img: data.sprites.other['official-artwork']?.front_default || data.sprites.front_default,
      types: data.types.map(t => t.type.name),
      gen: getGen(id)
    };
    CACHE[id] = poke;
    return poke;
  } catch(e) { return null; }
}

function getGen(id) {
  if(id<=151) return 1; if(id<=251) return 2;
  if(id<=386) return 3; if(id<=493) return 4;
  if(id<=649) return 5; if(id<=721) return 6;
  if(id<=809) return 7; if(id<=905) return 8;
  return 9;
}

function randomPokemonId() {
  const range = GEN_RANGES[STATE.difficulty];
  let id, attempts = 0;
  do {
    id = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    attempts++;
  } while (STATE.usedIds.has(id) && attempts < 200);
  STATE.usedIds.add(id);
  return id;
}

async function getWrongChoices(correctId, correctName) {
  const range = GEN_RANGES[STATE.difficulty];
  const wrong = [];
  const tried = new Set([correctId]);
  while (wrong.length < 3) {
    let id;
    do { id = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min; }
    while (tried.has(id));
    tried.add(id);
    const p = await fetchPokemon(id);
    if (p && p.name !== correctName) wrong.push(p);
  }
  return wrong;
}

// ═══════════════════════════════════════════
// MENU SETUP
// ═══════════════════════════════════════════
function setDiff(d, el) {
  STATE.difficulty = d;
  document.querySelectorAll('[data-diff]').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}
function setMode(m, el) {
  STATE.gameMode = m;
  document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}
function setInput(i, el) {
  STATE.inputMode = i;
  document.querySelectorAll('[data-input]').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
}

// ═══════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════
function getLeaderboard() {
  try { return JSON.parse(localStorage.getItem('poke_lb') || '[]'); }
  catch(e) { return []; }
}
function saveScore(entry) {
  const lb = getLeaderboard();
  lb.push(entry);
  lb.sort((a,b) => b.score - a.score);
  lb.splice(10);
  localStorage.setItem('poke_lb', JSON.stringify(lb));
}
function renderMenuLeaderboard() {
  const lb = getLeaderboard();
  const el = document.getElementById('menuLeaderboard');
  if (!lb.length) { el.style.display='none'; return; }
  el.style.display='block';
  const medals = ['🥇','🥈','🥉'];
  el.innerHTML = `<div class="lb-header">🏆 Hall of Fame</div>` +
    lb.slice(0,5).map((e,i) => `
      <div class="lb-row">
        <span class="lb-rank">${medals[i]||'#'+(i+1)}</span>
        <span class="lb-name">${e.name}</span>
        <span class="lb-mode">${e.mode}</span>
        <span class="lb-score">${e.score}</span>
      </div>`).join('');
}

// ═══════════════════════════════════════════
// GAME FLOW
// ═══════════════════════════════════════════
async function startGame() {
  const nameEl = document.getElementById('playerName');
  STATE.playerName = nameEl.value.trim() || 'Trainer';
  STATE.score = 0; STATE.streak = 0; STATE.bestStreak = 0;
  STATE.lives = 3; STATE.round = 0; STATE.correctCount = 0;
  STATE.usedIds = new Set(); STATE.active = true;
  STATE.totalRounds = STATE.gameMode === 'speed' ? 15 : 20;

  // HUD setup
  const modeBadge = document.getElementById('hud-mode');
  modeBadge.textContent = {classic:'Classic',speed:'Speed Run',survival:'Survival'}[STATE.gameMode];
  modeBadge.className = 'mode-badge ' + STATE.gameMode;
  updateHUD();
  renderLives();
  showScreen('game');

  await nextRound();
}

async function nextRound() {
  if (!STATE.active) return;
  clearInterval(STATE.timerInterval);
  STATE.answered = false;
  STATE.round++;

  if (STATE.round > STATE.totalRounds) { endGame(); return; }

  document.getElementById('nextBtn').style.display = 'none';
  document.getElementById('answerZone').innerHTML = '';
  document.getElementById('hintRow').innerHTML = '';
  document.getElementById('questionNum').textContent = `Question ${STATE.round}`;
  document.getElementById('hud-round').textContent = `${STATE.round}/${STATE.totalRounds}`;
  updateHUD();

  // Show loading
  document.getElementById('loadingStage').style.display = 'flex';
  document.getElementById('pokeImg').style.display = 'none';
  document.getElementById('suspenseText').style.display = 'none';

  const id = randomPokemonId();
  const poke = await fetchPokemon(id);
  if (!poke) { await nextRound(); return; }
  STATE.currentPokemon = poke;

  // Load image
  const img = document.getElementById('pokeImg');
  img.onload = () => onPokeLoaded(poke);
  img.src = poke.img;
  img.className = 'poke-img hidden';
  img.style.display = 'block';
}

async function onPokeLoaded(poke) {
  document.getElementById('loadingStage').style.display = 'none';
  document.getElementById('suspenseText').style.display = 'block';

  // Build answer UI
  if (STATE.inputMode === 'mc') {
    await buildMCMode(poke);
  } else {
    buildTypeMode(poke);
  }

  // Reveal hints over time
  scheduleHints(poke);

  // Start timer
  startTimer(poke);
}

function buildTypeMode(poke) {
  const zone = document.getElementById('answerZone');
  zone.innerHTML = `
    <div class="type-mode">
      <input type="text" id="guessInput" placeholder="Name this Pokémon..." autocomplete="off" autocorrect="off" spellcheck="false" autofocus>
      <button class="submit-btn" id="submitBtn" onclick="submitGuess()">Go!</button>
    </div>`;
  const inp = document.getElementById('guessInput');
  inp.addEventListener('keydown', e => { if (e.key==='Enter') submitGuess(); });
  setTimeout(() => inp.focus(), 100);
}

async function buildMCMode(poke) {
  const zone = document.getElementById('answerZone');
  zone.innerHTML = '<div style="color:var(--poke-muted);font-size:13px;text-align:center">Loading choices...</div>';
  const wrongs = await getWrongChoices(poke.id, poke.name);
  const choices = [poke, ...wrongs].sort(() => Math.random()-0.5);
  zone.innerHTML = `<div class="mc-grid">${
    choices.map(c=>`<button class="mc-btn" onclick="mcGuess('${c.name}','${poke.name}',this)">${c.displayName}</button>`).join('')
  }</div>`;
}

function submitGuess() {
  if (STATE.answered) return;
  const inp = document.getElementById('guessInput');
  if (!inp) return;
  const guess = inp.value.trim().toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
  const correct = STATE.currentPokemon.name.toLowerCase();
  handleAnswer(guess === correct || correct.includes(guess) && guess.length >= 3, inp);
}

function mcGuess(chosen, correct, btn) {
  if (STATE.answered) return;
  document.querySelectorAll('.mc-btn').forEach(b => {
    b.disabled = true;
    const name = b.textContent.toLowerCase().replace(/\s+/g,'-');
    if (name === correct) b.classList.add('correct');
  });
  if (chosen !== correct) btn.classList.add('wrong');
  handleAnswer(chosen === correct, null);
}

function handleAnswer(isCorrect, inputEl) {
  if (STATE.answered) return;
  STATE.answered = true;
  clearInterval(STATE.timerInterval);

  const poke = STATE.currentPokemon;
  revealPokemon(isCorrect);

  if (isCorrect) {
    const timeBonus = Math.floor(STATE.timeLeft * 3);
    const streakBonus = Math.min(STATE.streak, 9);
    const modeMulti = STATE.gameMode === 'speed' ? 2 : STATE.gameMode === 'survival' ? 1.5 : 1;
    const points = Math.floor((POINTS_BASE[STATE.gameMode] + timeBonus + streakBonus * 20) * modeMulti);
    STATE.score += points;
    STATE.streak++;
    STATE.correctCount++;
    if (STATE.streak > STATE.bestStreak) STATE.bestStreak = STATE.streak;
    if (inputEl) { inputEl.className += ' correct'; }
    showFeedback(true, poke.displayName, points);
    spawnParticles(true);
    updateHUD();
    if (STATE.streak > 1) showToast(`🔥 ${STATE.streak}x Streak! +${points} pts`, '#f97316');
  } else {
    STATE.streak = 0;
    if (STATE.gameMode === 'survival') {
      STATE.lives--;
      renderLives();
      if (STATE.lives <= 0) { setTimeout(() => { revealPokemon(false); showFeedback(false, poke.displayName, 0); setTimeout(endGame, 2000); }, 300); return; }
    }
    if (inputEl) { inputEl.className += ' wrong'; }
    showFeedback(false, poke.displayName, 0);
    spawnParticles(false);
    updateHUD();
  }

  document.getElementById('nextBtn').style.display = 'block';
  if (STATE.round >= STATE.totalRounds) {
    document.getElementById('nextBtn').textContent = 'See Results →';
  }

  // Auto-advance for speed mode
  if (STATE.gameMode === 'speed') {
    setTimeout(() => nextRound(), 1800);
  }
}

function revealPokemon(correct) {
  const img = document.getElementById('pokeImg');
  img.classList.remove('hidden');
  img.classList.add(correct ? 'revealed' : 'wrong-reveal');
  document.getElementById('suspenseText').style.display = 'none';
}

function startTimer(poke) {
  const duration = TIMER_DURATIONS[STATE.gameMode];
  STATE.timeLeft = duration;
  const bar = document.getElementById('timerBar');
  bar.style.transition = 'none';
  bar.style.width = '100%';
  bar.style.background = 'var(--poke-green)';

  STATE.timerInterval = setInterval(() => {
    STATE.timeLeft -= 0.1;
    const pct = (STATE.timeLeft / duration) * 100;
    bar.style.transition = 'width 0.1s linear';
    bar.style.width = pct + '%';
    if (pct < 40) bar.style.background = 'var(--poke-orange)';
    if (pct < 20) bar.style.background = '#ef4444';
    if (STATE.timeLeft <= 0) {
      clearInterval(STATE.timerInterval);
      if (!STATE.answered) {
        showToast("⏰ Time's up!", '#ef4444');
        handleAnswer(false, document.getElementById('guessInput'));
      }
    }
  }, 100);
}

function scheduleHints(poke) {
  const dur = TIMER_DURATIONS[STATE.gameMode];
  const hints = [
    { time: dur * 0.6, label: `Type: ${poke.types.map(t=>t.charAt(0).toUpperCase()+t.slice(1)).join('/')}` },
    { time: dur * 0.3, label: `Starts with: ${poke.displayName[0]}` },
    { time: dur * 0.1, label: `Gen ${poke.gen}` }
  ];
  const row = document.getElementById('hintRow');
  hints.forEach((h,i) => {
    const chip = document.createElement('div');
    chip.className = 'hint-chip';
    chip.textContent = '?';
    chip.dataset.hint = h.label;
    chip.dataset.time = h.time;
    row.appendChild(chip);

    const check = setInterval(() => {
      if (STATE.timeLeft <= h.time || STATE.answered) {
        chip.textContent = h.label;
        chip.classList.add('visible');
        clearInterval(check);
      }
    }, 200);
  });
}

// ═══════════════════════════════════════════
// HUD & UI UPDATES
// ═══════════════════════════════════════════
function updateHUD() {
  document.getElementById('hud-score').textContent = STATE.score.toLocaleString();
  document.getElementById('hud-streak').textContent = STATE.streak + (STATE.streak>=3?'🔥':'');
}
function renderLives() {
  const el = document.getElementById('hud-lives');
  if (STATE.gameMode !== 'survival') { el.innerHTML=''; return; }
  el.innerHTML = [0,1,2].map(i=>`<span class="life-heart${i>=STATE.lives?' lost':''}">❤️</span>`).join('');
}

// ═══════════════════════════════════════════
// FEEDBACK OVERLAY
// ═══════════════════════════════════════════
function showFeedback(correct, name, pts) {
  const ov = document.getElementById('feedbackOverlay');
  document.getElementById('fb-emoji').textContent = correct ? ['🎉','🔥','⚡','✨','🌟'][Math.floor(Math.random()*5)] : ['😭','💀','🫠','😩'][Math.floor(Math.random()*4)];
  const title = document.getElementById('fb-title');
  title.textContent = correct ? 'Correct!' : 'Wrong!';
  title.className = 'feedback-title ' + (correct?'correct':'wrong');
  document.getElementById('fb-name').textContent = name;
  document.getElementById('fb-points').innerHTML = correct ? `+<span>${pts}</span> points` : 'Better luck next time!';
  document.getElementById('fb-streak').textContent = STATE.streak > 1 ? `🔥 ${STATE.streak}x Streak!` : '';
  ov.classList.add('show');
  setTimeout(() => ov.classList.remove('show'), 1800);
}

// ═══════════════════════════════════════════
// PARTICLES
// ═══════════════════════════════════════════
function spawnParticles(correct) {
  const container = document.getElementById('particles');
  const colors = correct
    ? ['#FFD700','#22c55e','#a3e635','#fbbf24']
    : ['#ef4444','#dc2626','#b91c1c','#9f1239'];
  const cx = window.innerWidth/2, cy = window.innerHeight/2;
  for (let i=0;i<(correct?24:12);i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = 6 + Math.random()*10;
    const angle = Math.random()*Math.PI*2;
    const dist = 80 + Math.random()*160;
    p.style.cssText = `
      width:${size}px;height:${size}px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      left:${cx}px;top:${cy}px;
      --dx:${Math.cos(angle)*dist}px;--dy:${Math.sin(angle)*dist}px;
    `;
    container.appendChild(p);
    setTimeout(()=>p.remove(),1000);
  }
}

// ═══════════════════════════════════════════
// TOASTS
// ═══════════════════════════════════════════
function showToast(msg, color='var(--poke-yellow)') {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  t.style.borderColor = color;
  t.style.color = color;
  document.getElementById('toasts').appendChild(t);
  requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(),300); },2000);
}

// ═══════════════════════════════════════════
// GAME OVER
// ═══════════════════════════════════════════
function endGame() {
  STATE.active = false;
  clearInterval(STATE.timerInterval);

  const accuracy = STATE.round > 0 ? Math.round((STATE.correctCount / STATE.round)*100) : 0;

  saveScore({ name: STATE.playerName, score: STATE.score, mode: STATE.gameMode, streak: STATE.bestStreak, date: Date.now() });

  document.getElementById('go-score').textContent = STATE.score.toLocaleString();
  document.getElementById('go-streak').textContent = STATE.bestStreak;
  document.getElementById('go-correct').textContent = STATE.correctCount;
  document.getElementById('go-total').textContent = `of ${STATE.round}`;
  document.getElementById('go-accuracy').textContent = accuracy + '%';

  const rank = accuracy>=90?['🏆 Pokémon Master','#FFD700']:accuracy>=70?['⭐ Ace Trainer','#60a5fa']:accuracy>=50?['🌿 Rising Trainer','#22c55e']:['🔰 Youngster','#8888aa'];
  const badge = document.getElementById('go-rank-badge');
  badge.textContent = rank[0];
  badge.style.cssText = `background:${rank[1]}22;color:${rank[1]};border:2px solid ${rank[1]}44;`;

  const subtitles = ['Keep training, Trainer!','Your Pokémon knowledge is growing!','Impressive, Trainer!','You\'re almost a Pokémon Master!','A true Pokémon Master!'];
  document.getElementById('go-subtitle').textContent = subtitles[Math.min(Math.floor(accuracy/20), 4)];

  showScreen('gameover');
  renderMenuLeaderboard();
}

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
renderMenuLeaderboard();
document.addEventListener('pointerdown', () => {
  if (MUSIC.enabled) startMusic();
}, { once: true });
