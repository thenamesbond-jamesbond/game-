 
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const W = canvas.width;
  const H = canvas.height;

  // Game State
  let levelIndex = 0;
  let lives = 3;
  let won = false;
  let coinsCollected = 0;
  let totalCoins = 0;
  let shopOpen = false;
  let shopTab = 0; // 0=Skins, 1=Difficulty, 2=Mode
  let skinSel = 0;
  let diffSel = 0;
  let currentSurface = 'normal';
  let modeSel = 0;
  let onTitle = true;
  let diedThisFrame = false;
  let cameraX = 0;
  let transitioning = false;
  let coyoteFrames = 0;
  let jumpBufferFrames = 0;
  let prevJumpKey = false;
  let levelStartAt = 0;

  // Physics
  const GRAVITY = 0.7;
  const MOVE = 0.6;
  const MAX_SPEED = 5.0;
  const JUMP_V = -12.0;
  const FRICTION = 0.85;

  // Input
  const keys = new Set();
  function startFromTitle() {
    if (!onTitle) return;
    // apply selected mode from start screen
    selectedModeIndex = modeSel;
    if (typeof window !== 'undefined') window.selectedModeIndex = selectedModeIndex;
    if (usingInfinite()) startInfinite(); else startLevel(0);
    onTitle = false;
  }

  function circleRectIntersect(cx, cy, cr, rx, ry, rw, rh) {
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - closestX, dy = cy - closestY;
    return (dx*dx + dy*dy) <= cr*cr;
  }

  function generateRandomLevelEnemies(L) {
    const out = [];
    const plats = (L.platforms || []).filter(p => (p.t||'normal') !== 'death' && p.w >= 80);
    if (plats.length === 0) return out;
    // up to 2 enemies per level
    const n = Math.random() < 0.5 ? 1 : 2;
    for (let i=0;i<n;i++) {
      const p = plats[Math.floor(Math.random()*plats.length)];
      if (Math.random() < 0.5) {
        out.push({ type:'gnat', x: p.x + p.w*0.5, y: p.y - 50, baseY: p.y - 50, amp: 12 + Math.random()*10, speed: 0.6 + Math.random()*0.5, r: 8 });
      } else {
        out.push({ type:'rhino', x: p.x + 8, y: p.y - 18, w: 26, h: 18, dir: 1, speed: 1.0, minX: p.x + 4, maxX: p.x + p.w - 30 });
      }
    }
    return out;
  }

  addEventListener('keydown', (e) => {
    if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," ","a","d","w","A","D","W","r","R","p","P","Enter"].includes(e.key)) e.preventDefault();
    keys.add(e.key);

    // Shop toggle and navigation (edge-triggered on keydown)
    if (e.key === 'p' || e.key === 'P') {
      if (!onTitle) shopOpen = !shopOpen;
      return;
    }

    // Title menu
    if (onTitle) {
      if (e.key === 'ArrowLeft') modeSel = (modeSel - 1 + modes.length) % modes.length;
      if (e.key === 'ArrowRight') modeSel = (modeSel + 1) % modes.length;
      if (e.key === 'Enter' || e.key === ' ') startFromTitle();
      return;
    }
    // Debug: skip to next level
    if (e.key === 'n' || e.key === 'N' || e.key === 'l' || e.key === 'L') {
      if (!usingInfinite()) {
        const levels = getLevels();
        if (levelIndex < levels.length - 1) startLevel(levelIndex + 1);
      }
      return;
    }
    // Builder controls when playing (not shop)
    if (!shopOpen) {
      if ((e.key === 'q' || e.key === 'Q') && builderCharges > 0) {
        // place a small block aligned to 20px grid near player feet
        const px = Math.round(player.x / 20) * 20;
        const py = Math.round((player.y + player.h + 4) / 20) * 20;
        const newBlock = { x: px - 30, y: py, w: 60, h: 14, t: 'normal', _builder: true };
        // validate not overlapping goal
        const g = getGoal();
        const overlapsGoal = g && aabb(newBlock.x, newBlock.y, newBlock.w, newBlock.h, g.x, g.y, g.w, g.h);
        if (!overlapsGoal) {
          builderBlocks.push(newBlock);
          builderCharges -= 1;
        }
      }
      if (e.key === 'e' || e.key === 'E') {
        // delete nearest builder block within 50px
        let bi = -1, best = 1e9;
        for (let i=0;i<builderBlocks.length;i++) {
          const b = builderBlocks[i];
          const cx = b.x + b.w/2, cy = b.y + b.h/2;
          const d = Math.hypot((cx - player.x), (cy - player.y));
          if (d < best) { best = d; bi = i; }
        }
        if (bi !== -1 && best < 60 && builderCharges > 0) {
          builderBlocks.splice(bi,1);
          builderCharges -= 1;
        }
      }
    }
    if (!shopOpen) return;
    // While shop is open, handle navigation
    const TAB_COUNT = 3;
    if (e.key === 'ArrowLeft') shopTab = (shopTab - 1 + TAB_COUNT) % TAB_COUNT;
    if (e.key === 'ArrowRight') shopTab = (shopTab + 1) % TAB_COUNT;
    if (shopTab === 0) {
      if (e.key === 'ArrowUp') skinSel = (skinSel - 1 + skins.length) % skins.length;
      if (e.key === 'ArrowDown') skinSel = (skinSel + 1) % skins.length;
      if (e.key === 'PageUp') skinSel = Math.max(0, skinSel - 5);
      if (e.key === 'PageDown') skinSel = Math.min(skins.length - 1, skinSel + 5);
      if (e.key === 'Home') skinSel = 0;
      if (e.key === 'End') skinSel = skins.length - 1;
      if (e.key === 'Enter' || e.key === ' ') buyOrEquipSkin(skinSel);
    } else if (shopTab === 1) {
      if (e.key === 'ArrowUp') diffSel = (diffSel - 1 + difficulties.length) % difficulties.length;
      if (e.key === 'ArrowDown') diffSel = (diffSel + 1) % difficulties.length;
      if (e.key === 'PageUp') diffSel = Math.max(0, diffSel - 3);
      if (e.key === 'PageDown') diffSel = Math.min(difficulties.length - 1, diffSel + 3);
      if (e.key === 'Home') diffSel = 0;
      if (e.key === 'End') diffSel = difficulties.length - 1;
      if (e.key === 'Enter' || e.key === ' ') buyOrEquipDifficulty(diffSel);
    } else if (shopTab === 2) {
      if (e.key === 'ArrowUp') modeSel = (modeSel - 1 + modes.length) % modes.length;
      if (e.key === 'ArrowDown') modeSel = (modeSel + 1) % modes.length;
      if (e.key === 'Home') modeSel = 0;
      if (e.key === 'End') modeSel = modes.length - 1;
      if (e.key === 'Enter' || e.key === ' ') selectMode(modeSel);
    }
  });

  addEventListener('mousedown', () => { if (onTitle) startFromTitle(); });
  addEventListener('touchstart', () => { if (onTitle) startFromTitle(); }, { passive: true });

  // Move selectMode outside of the keydown handler
  function selectMode(i) {
    if (i < 0 || i >= modes.length) return;
    selectedModeIndex = i;
    if (typeof window !== 'undefined') window.selectedModeIndex = selectedModeIndex;
    if (usingInfinite()) startInfinite(); else startLevel(0);
  }
  addEventListener('keyup', (e) => keys.delete(e.key));

  // Entities
  const player = {
    x: 50, y: 0, w: 28, h: 38,
    vx: 0, vy: 0,
    onGround: false,
    color: '#7cf7a7',
  };

  const goalColor = '#ffd166';
  const platformColor = '#8ecae6';
  const platformColorsByType = {
    normal: '#8ecae6',
    sticky: '#e87d7d',
    ice: '#a8dadc',
    death: '#d00000',
  };
  const bgDecoColor = 'rgba(255,255,255,0.06)';
  const coinColor = '#f7e26b';
  const coinShineColor = '#fff6a9';

  // --- Visual texture helpers (cached patterns and background) ---
  const platformPatternCache = {};
  function makePlatformPattern(type) {
    if (platformPatternCache[type]) return platformPatternCache[type];
    const c = document.createElement('canvas');
    const size = 32; c.width = size; c.height = size;
    const g = c.getContext('2d');
    if (type === 'normal') {
      // stone tiles
      g.fillStyle = '#6ea8c5'; g.fillRect(0,0,size,size);
      g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 1;
      for (let x=0;x<=size;x+=8){ g.beginPath(); g.moveTo(x+0.5,0); g.lineTo(x+0.5,size); g.stroke(); }
      for (let y=0;y<=size;y+=8){ g.beginPath(); g.moveTo(0,y+0.5); g.lineTo(size,y+0.5); g.stroke(); }
      g.strokeStyle = 'rgba(255,255,255,0.06)';
      g.beginPath(); g.moveTo(0,0.5); g.lineTo(size,0.5); g.stroke();
    } else if (type === 'sticky') {
      // jam with seeds and drips
      const grad = g.createLinearGradient(0,0,0,size);
      grad.addColorStop(0,'#f19aa1'); grad.addColorStop(1,'#d7646f');
      g.fillStyle = grad; g.fillRect(0,0,size,size);
      g.fillStyle = 'rgba(255,255,255,0.15)';
      for (let i=0;i<6;i++){ g.beginPath(); g.arc(Math.random()*size, Math.random()*size, 1.2, 0, Math.PI*2); g.fill(); }
      g.strokeStyle = 'rgba(0,0,0,0.12)';
      g.beginPath(); g.moveTo(4,6); g.quadraticCurveTo(10,14,6,20); g.stroke();
    } else if (type === 'death') {
      // lava
      const grad = g.createLinearGradient(0,0,0,size);
      grad.addColorStop(0,'#ff6b6b'); grad.addColorStop(1,'#d00000');
      g.fillStyle = grad; g.fillRect(0,0,size,size);
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      for (let x=0;x<size;x+=8){ g.beginPath(); g.moveTo(x, 10+Math.sin(x*0.5)*2); g.lineTo(x+4, 14+Math.cos(x*0.3)*2); g.stroke(); }
    } else {
      // ice with sheen
      const grad = g.createLinearGradient(0,0,size,size);
      grad.addColorStop(0,'#c7ecf1'); grad.addColorStop(1,'#8fd3de');
      g.fillStyle = grad; g.fillRect(0,0,size,size);
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0,8); g.lineTo(8,0); g.moveTo(16,8); g.lineTo(24,0); g.moveTo(8,24); g.lineTo(24,8); g.stroke();
    }
    const pat = g.createPattern(c, 'repeat');
    platformPatternCache[type] = pat; return pat;
  }

  function drawSkyBackground(ctx, W, H, cameraX) {
    const sky = ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#b8e0ff');
    sky.addColorStop(1,'#fdf6e3');
    ctx.fillStyle = sky; ctx.fillRect(0,0,W,H);
    // clouds
    const t = performance.now()/1000;
    function cloud(x,y,scale){
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(x, y, 18*scale, 0, Math.PI*2); ctx.arc(x+20*scale, y+4*scale, 14*scale, 0, Math.PI*2); ctx.arc(x-18*scale, y+6*scale, 12*scale, 0, Math.PI*2); ctx.fill();
    }
    const par = (cameraX||0)*0.3;
    for (let i=0;i<3;i++) {
      const cx = (i*220 + (t*12)) % (W+260) - 130 - par % (W+260);
      const cy = 60 + (i%2)*24;
      cloud(cx, cy, 1 + (i%3)*0.2);
    }
  }

  function drawPlatformTextured(ctx, p, cameraX) {
    const x = Math.round(p.x - cameraX), y = Math.round(p.y), w = p.w, h = p.h;
    const type = p.t || 'normal';
    const pat = makePlatformPattern(type);
    ctx.fillStyle = pat;
    // body
    roundRect(ctx, x, y, w, h, 4, pat, 'rgba(0,0,0,0.25)');
    // top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x+2, y+1, w-4, 2);
  }

  function drawGoalPretty(ctx, g2, cameraX) {
    const gx = g2.x - cameraX, gy = g2.y, gw = g2.w, gh = g2.h;
    // cake stand
    roundRect(ctx, gx, gy, gw, gh, 6, '#ffe9b8', 'rgba(0,0,0,0.25)');
    ctx.fillStyle = '#ffcd69'; ctx.fillRect(gx+4, gy+6, gw-8, 6);
    // glass cover
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(gx+gw/2, gy+6, gw/2-6, Math.PI, 0); ctx.stroke();
  }

  const skins = [
    { key: 'orange',   name: 'Orange',    body: '#ffa730', outline: '#d77a00', cost: 0,  owned: true },
    { key: 'banana',   name: 'Banana',    body: '#ffd84d', outline: '#c9a800', cost: 5,  owned: false },
    { key: 'apple',    name: 'Apple',     body: '#e63946', outline: '#9d0208', cost: 5,  owned: false },
    { key: 'pear',     name: 'Pear',      body: '#94d82d', outline: '#5c940d', cost: 6,  owned: false },
    { key: 'apricot',  name: 'Apricot',   body: '#ff964f', outline: '#cc6b2c', cost: 6,  owned: false },
    { key: 'strawberry', name: 'Strawberry', body: '#ff4d6d', outline: '#a4161a', cost: 7,  owned: false },
    { key: 'tomato',   name: 'Tomato',    body: '#ff3b30', outline: '#b71c1c', cost: 7,  owned: false },
    { key: 'penguin',  name: 'Penguin',   body: '#4d4d4d', outline: '#1f1f1f', cost: 12, owned: false },
  ];

  // After LEVELS is defined, expose a getter for Normal mode
  function getLevels() { return LEVELS; }

  // Shop -> Mode selection
  function selectMode(i) {
    if (i < 0 || i >= modes.length) return;
    selectedModeIndex = i;
    if (typeof window !== 'undefined') window.selectedModeIndex = selectedModeIndex;
    if (usingInfinite()) startInfinite(); else startLevel(0);
  }

  // getLevels/selectMode will be defined after LEVELS to avoid TDZ

  // Placeholder; finalized after LEVELS is declared

  // Placeholder; finalized after LEVELS is declared
  // getLevels is assigned later after LEVELS is defined

  // Normal mode uses only the first 2 levels (defined after LEVELS)

  // Infinite mode state
  let infPlatforms = [];
  let infCoins = [];
  let infSpawnX = 0;
  let lastPlatX = 0;
  let lastPlatY = 320;
  let lastPlatW = 120;
  const INF_CHUNK = 240; // spawn chunk width (increase for more per-chunk room)
  const INF_PLATFORM_MIN_Y = 140;
  const INF_PLATFORM_MAX_Y = 380;
  const INF_PLATFORM_HEIGHT = 16;
  const INF_PLATFORM_WIDTHS = [70, 100, 120];

  // Power-ups state
  let speedUntil = 0;
  let superjumpUntil = 0;
  let builderCharges = 0;
  let builderBlocks = [];
  let levelsSinceBuilderRefill = 0; // refill every 2 levels to 2 charges
  // Power-ups runtime containers
  let levelPowerups = [];
  let infPowerups = [];
  // Enemies
  let levelEnemies = [];
  let infEnemies = [];

  function usingInfinite() { return selectedModeIndex === 1; }

  // For rendering/collisions, get platforms list for current mode
  function getPlatforms() {
    const base = usingInfinite() ? infPlatforms : getLevels()[levelIndex].platforms;
    return base.concat(builderBlocks);
  }
  function getGoal() {
    if (usingInfinite()) return null;
    return getLevels()[levelIndex].goal;
  }
  let selectedSkinIndex = 0;

  const difficulties = [
    { name: 'Easy',      g: 0.9, move: 1.1, jump: 1.1, max: 1.1, cost: 0, owned: true },
    { name: 'Medium',    g: 1.0, move: 1.0, jump: 1.0, max: 1.0, cost: 0, owned: true },
    { name: 'Hard',      g: 1.1, move: 0.95, jump: 0.95, max: 0.95, cost: 6, owned: false },
    { name: 'Very Hard', g: 1.2, move: 0.9,  jump: 0.9,  max: 0.9,  cost: 10, owned: false },
  ];
  let selectedDifficultyIndex = 1; // default Medium

  // Modes
  const modes = [
    { name: 'Normal' },
    { name: 'Infinite' },
  ];
  let selectedModeIndex = 0; // Normal by default

  // Expose to window for shop helpers outside the IIFE
  if (typeof window !== 'undefined') {
    window.skins = skins;
    window.difficulties = difficulties;
    window.modes = modes;
    window.selectedSkinIndex = selectedSkinIndex;
    window.selectedDifficultyIndex = selectedDifficultyIndex;
    window.selectedModeIndex = selectedModeIndex;
    window.coinsCollected = coinsCollected;
    window.shopTab = shopTab;
    window.skinSel = skinSel;
    window.diffSel = diffSel;
    window.modeSel = modeSel;
  }

  // Levels
  // y=0 is top; y increases downward
  /** @type {{spawn:{x:number,y:number}, goal:{x:number,y:number,w:number,h:number}, platforms:{x:number,y:number,w:number,h:number,t?:'normal'|'sticky'|'ice'}[], coins:{x:number,y:number,r:number}[]}[]} */
  const LEVELS = [
    {
      spawn: {x: 50, y: 340},
      goal:  {x: 680, y: 300, w: 120, h: 60},
      platforms: [
        {x: 0, y: 420, w: 800, h: 30, t: 'normal'},
        {x: 140, y: 360, w: 120, h: 16, t: 'normal'},
        {x: 320, y: 320, w: 120, h: 16, t: 'normal'},
        {x: 520, y: 340, w: 90,  h: 16, t: 'ice'},
        {x: 660, y: 310, w: 120, h: 16, t: 'normal'},
        {x: 260, y: 404, w: 80, h: 14, t: 'death'},
      ],
      powerups: [
        { x: 200, y: 340 - 24, r: 12, type: 'speed' },
        { x: 360, y: 320 - 24, r: 12, type: 'superjump' },
        { x: 540, y: 340 - 24, r: 12, type: 'builder' },
      ],
      coins: [
        {x: 190, y: 330, r: 10},
        {x: 360, y: 290, r: 10},
        {x: 550, y: 310, r: 10},
      ],
    },
    {
      spawn: {x: 40, y: 120},
      goal:  {x: 750, y: 80, w: 30, h: 60},
      platforms: [
        {x: 0, y: 420, w: 800, h: 30, t: 'normal'},
        {x: 0, y: 160, w: 160, h: 14, t: 'ice'},
        {x: 200, y: 220, w: 110, h: 14, t: 'normal'},
        {x: 360, y: 280, w: 90,  h: 14, t: 'sticky'},
        {x: 520, y: 220, w: 110, h: 14, t: 'normal'},
        {x: 650, y: 160, w: 150, h: 14, t: 'normal'},
        {x: 260, y: 360, w: 120, h: 16, t: 'ice'},
      ],
      coins: [
        {x: 80, y: 130, r: 10},
        {x: 255, y: 190, r: 10},
        {x: 570, y: 190, r: 10},
        {x: 720, y: 130, r: 10},
      ],
    },
    {
      spawn: {x: 24, y: 360},
      goal:  {x: 740, y: 110, w: 40, h: 50},
      platforms: [
        {x: 0, y: 420, w: 800, h: 30, t: 'normal'},
        {x: 120, y: 380, w: 80, h: 14, t: 'normal'},
        {x: 220, y: 340, w: 80, h: 14, t: 'sticky'},
        {x: 320, y: 300, w: 80, h: 14, t: 'normal'},
        {x: 420, y: 260, w: 80, h: 14, t: 'ice'},
        {x: 520, y: 220, w: 80, h: 14, t: 'normal'},
        {x: 620, y: 180, w: 80, h: 14, t: 'normal'},
        {x: 720, y: 140, w: 80, h: 14, t: 'normal'},
      ],
      coins: [
        {x: 160, y: 350, r: 10},
        {x: 260, y: 310, r: 10},
        {x: 360, y: 270, r: 10},
        {x: 460, y: 230, r: 10},
        {x: 560, y: 190, r: 10},
        {x: 660, y: 150, r: 10},
      ],
    },
    // Level 4
    {
      spawn: {x: 40, y: 320},
      goal:  {x: 740, y: 260, w: 40, h: 50},
      platforms: [
        {x: 0, y: 420, w: 800, h: 30, t: 'normal'},
        {x: 80, y: 360, w: 80, h: 16, t: 'normal'},
        {x: 200, y: 320, w: 80, h: 16, t: 'ice'},
        {x: 320, y: 280, w: 80, h: 16, t: 'normal'},
        {x: 440, y: 240, w: 80, h: 16, t: 'sticky'},
        {x: 560, y: 200, w: 80, h: 16, t: 'normal'},
        {x: 680, y: 260, w: 120, h: 16, t: 'ice'},
        {x: 380, y: 404, w: 100, h: 14, t: 'death'},
      ],
      coins: [
        {x: 120, y: 330, r: 10},
        {x: 240, y: 290, r: 10},
        {x: 360, y: 250, r: 10},
        {x: 480, y: 210, r: 10},
        {x: 600, y: 170, r: 10},
      ],
    },
    // Level 5
    {
      spawn: {x: 760, y: 100},
      goal:  {x: 20, y: 340, w: 40, h: 50},
      platforms: [
        {x: 0, y: 420, w: 800, h: 30, t: 'normal'},
        {x: 700, y: 140, w: 80, h: 16, t: 'sticky'},
        {x: 580, y: 180, w: 80, h: 16, t: 'normal'},
        {x: 460, y: 220, w: 80, h: 16, t: 'ice'},
        {x: 340, y: 260, w: 80, h: 16, t: 'normal'},
        {x: 220, y: 300, w: 80, h: 16, t: 'normal'},
        {x: 100, y: 340, w: 120, h: 16, t: 'ice'},
      ],
      coins: [
        {x: 740, y: 110, r: 10},
        {x: 620, y: 150, r: 10},
        {x: 500, y: 190, r: 10},
        {x: 380, y: 230, r: 10},
        {x: 260, y: 270, r: 10},
        {x: 140, y: 310, r: 10},
      ],
    },
    // Level 6
    {
      spawn: {x: 40, y: 300},
      goal:  {x: 760, y: 260, w: 40, h: 50},
      platforms: [
        {x: 0, y: 420, w: 800, h: 30, t: 'normal'},
        {x: 100, y: 360, w: 100, h: 16, t: 'ice'},
        {x: 240, y: 320, w: 100, h: 16, t: 'normal'},
        {x: 380, y: 280, w: 100, h: 16, t: 'sticky'},
        {x: 520, y: 240, w: 100, h: 16, t: 'normal'},
        {x: 660, y: 200, w: 120, h: 16, t: 'ice'},
      ],
      coins: [
        {x: 150, y: 330, r: 10},
        {x: 290, y: 290, r: 10},
        {x: 430, y: 250, r: 10},
        {x: 570, y: 210, r: 10},
        {x: 700, y: 170, r: 10},
      ],
    },
    // Level 7
    {
      spawn: {x: 60, y: 340},
      goal:  {x: 720, y: 140, w: 40, h: 50},
      platforms: [
        {x: 0, y: 420, w: 800, h: 30, t: 'normal'},
        {x: 160, y: 360, w: 90, h: 16, t: 'normal'},
        {x: 260, y: 320, w: 90, h: 16, t: 'ice'},
        {x: 360, y: 280, w: 90, h: 16, t: 'normal'},
        {x: 460, y: 240, w: 90, h: 16, t: 'sticky'},
        {x: 560, y: 200, w: 90, h: 16, t: 'normal'},
        {x: 660, y: 160, w: 120, h: 16, t: 'normal'},
      ],
      coins: [
        {x: 200, y: 330, r: 10},
        {x: 300, y: 290, r: 10},
        {x: 400, y: 250, r: 10},
        {x: 500, y: 210, r: 10},
        {x: 620, y: 170, r: 10},
      ],
    },
    // Level 8
    {
      spawn: {x: 40, y: 140},
      goal:  {x: 760, y: 320, w: 40, h: 50},
      platforms: [
        {x: 0, y: 420, w: 800, h: 30, t: 'normal'},
        {x: 80, y: 180, w: 140, h: 14, t: 'sticky'},
        {x: 280, y: 240, w: 120, h: 14, t: 'normal'},
        {x: 460, y: 300, w: 100, h: 14, t: 'ice'},
        {x: 620, y: 340, w: 120, h: 14, t: 'normal'},
      ],
      coins: [
        {x: 140, y: 150, r: 10},
        {x: 320, y: 210, r: 10},
        {x: 500, y: 270, r: 10},
        {x: 660, y: 310, r: 10},
      ],
    },
    // Level 9
    {
      spawn: {x: 60, y: 360},
      goal:  {x: 740, y: 80, w: 40, h: 50},
      platforms: [
        {x: 0, y: 420, w: 800, h: 30, t: 'normal'},
        {x: 120, y: 360, w: 80, h: 14, t: 'ice'},
        {x: 220, y: 320, w: 80, h: 14, t: 'normal'},
        {x: 320, y: 280, w: 80, h: 14, t: 'sticky'},
        {x: 420, y: 240, w: 80, h: 14, t: 'normal'},
        {x: 520, y: 200, w: 80, h: 14, t: 'ice'},
        {x: 620, y: 160, w: 100, h: 14, t: 'normal'},
      ],
      coins: [
        {x: 160, y: 330, r: 10},
        {x: 260, y: 290, r: 10},
        {x: 360, y: 250, r: 10},
        {x: 460, y: 210, r: 10},
        {x: 560, y: 170, r: 10},
        {x: 680, y: 130, r: 10},
      ],
    },
    // Level 10
    {
      spawn: {x: 24, y: 360},
      goal:  {x: 740, y: 110, w: 40, h: 50},
      platforms: [
        {x: 0, y: 420, w: 800, h: 30, t: 'normal'},
        {x: 140, y: 380, w: 100, h: 14, t: 'normal'},
        {x: 260, y: 340, w: 100, h: 14, t: 'ice'},
        {x: 380, y: 300, w: 100, h: 14, t: 'normal'},
        {x: 500, y: 260, w: 100, h: 14, t: 'sticky'},
        {x: 620, y: 220, w: 100, h: 14, t: 'normal'},
        {x: 700, y: 180, w: 80,  h: 14, t: 'ice'},
      ],
      coins: [
        {x: 190, y: 350, r: 10},
        {x: 310, y: 310, r: 10},
        {x: 430, y: 270, r: 10},
        {x: 550, y: 230, r: 10},
        {x: 670, y: 190, r: 10},
      ],
    },
    {
      spawn: {x: 60, y: 340},
      goal:  {x: 730, y: 100, w: 40, h: 50},
      platforms: [
        {x: 0, y: 420, w: 800, h: 30, t: 'normal'},
        {x: 120, y: 360, w: 80, h: 16, t: 'sticky'},
        {x: 240, y: 320, w: 80, h: 16, t: 'normal'},
        {x: 360, y: 280, w: 80, h: 16, t: 'ice'},
        {x: 480, y: 240, w: 80, h: 16, t: 'normal'},
        {x: 600, y: 200, w: 80, h: 16, t: 'sticky'},
      ],
      coins: [
        {x: 160, y: 330, r: 10},
        {x: 280, y: 290, r: 10},
        {x: 400, y: 250, r: 10},
        {x: 520, y: 210, r: 10},
        {x: 640, y: 170, r: 10},
      ],
    },
    {
      spawn: {x: 40, y: 160},
      goal:  {x: 760, y: 320, w: 40, h: 50},
      platforms: [
        {x: 0, y: 420, w: 800, h: 30, t: 'normal'},
        {x: 90, y: 200, w: 140, h: 14, t: 'ice'},
        {x: 260, y: 260, w: 120, h: 14, t: 'normal'},
        {x: 430, y: 320, w: 100, h: 14, t: 'sticky'},
        {x: 590, y: 360, w: 120, h: 14, t: 'normal'},
      ],
      coins: [
        {x: 160, y: 170, r: 10},
        {x: 320, y: 230, r: 10},
        {x: 480, y: 290, r: 10},
        {x: 640, y: 330, r: 10},
      ],
    },
    {
      spawn: {x: 24, y: 360},
      goal:  {x: 740, y: 140, w: 40, h: 50},
      platforms: [
        {x: 0, y: 420, w: 800, h: 30, t: 'normal'},
        {x: 120, y: 380, w: 90, h: 14, t: 'normal'},
        {x: 220, y: 340, w: 90, h: 14, t: 'sticky'},
        {x: 320, y: 300, w: 90, h: 14, t: 'normal'},
        {x: 420, y: 260, w: 90, h: 14, t: 'ice'},
        {x: 520, y: 220, w: 90, h: 14, t: 'normal'},
        {x: 620, y: 180, w: 110, h: 14, t: 'normal'},
      ],
      coins: [
        {x: 160, y: 350, r: 10},
        {x: 260, y: 310, r: 10},
        {x: 360, y: 270, r: 10},
        {x: 460, y: 230, r: 10},
        {x: 560, y: 190, r: 10},
      ],
    },
    {
      spawn: {x: 740, y: 120},
      goal:  {x: 40, y: 340, w: 40, h: 50},
      platforms: [
        {x: 0, y: 420, w: 800, h: 30, t: 'normal'},
        {x: 680, y: 160, w: 90, h: 16, t: 'ice'},
        {x: 560, y: 200, w: 90, h: 16, t: 'normal'},
        {x: 440, y: 240, w: 90, h: 16, t: 'sticky'},
        {x: 320, y: 280, w: 90, h: 16, t: 'normal'},
        {x: 200, y: 320, w: 90, h: 16, t: 'normal'},
        {x: 80,  y: 360, w: 120, h: 16, t: 'ice'},
      ],
      coins: [
        {x: 700, y: 130, r: 10},
        {x: 580, y: 170, r: 10},
        {x: 460, y: 210, r: 10},
        {x: 340, y: 250, r: 10},
        {x: 220, y: 290, r: 10},
        {x: 120, y: 330, r: 10},
      ],
    },
    {
      spawn: {x: 60, y: 320},
      goal:  {x: 740, y: 240, w: 40, h: 50},
      platforms: [
        {x: 0, y: 420, w: 800, h: 30, t: 'normal'},
        {x: 120, y: 360, w: 100, h: 16, t: 'ice'},
        {x: 260, y: 320, w: 100, h: 16, t: 'normal'},
        {x: 400, y: 280, w: 100, h: 16, t: 'sticky'},
        {x: 540, y: 240, w: 100, h: 16, t: 'normal'},
        {x: 680, y: 200, w: 110, h: 16, t: 'ice'},
      ],
      coins: [
        {x: 170, y: 330, r: 10},
        {x: 310, y: 290, r: 10},
        {x: 450, y: 250, r: 10},
        {x: 590, y: 210, r: 10},
        {x: 720, y: 170, r: 10},
      ],
    },
    {
      spawn: {x: 40, y: 140},
      goal:  {x: 760, y: 320, w: 40, h: 50},
      platforms: [
        {x: 0, y: 420, w: 800, h: 30, t: 'normal'},
        {x: 100, y: 180, w: 140, h: 14, t: 'sticky'},
        {x: 300, y: 240, w: 120, h: 14, t: 'normal'},
        {x: 480, y: 300, w: 100, h: 14, t: 'ice'},
        {x: 640, y: 340, w: 120, h: 14, t: 'normal'},
      ],
      coins: [
        {x: 160, y: 150, r: 10},
        {x: 340, y: 210, r: 10},
        {x: 520, y: 270, r: 10},
        {x: 680, y: 310, r: 10},
      ],
    },
  ];

  // Runtime level coins with collected flags
  let levelCoins = [];

  // Precompute total coins across all levels
  totalCoins = LEVELS.reduce((sum, L) => sum + (L.coins?.length || 0), 0);

  // Generate random power-ups for Normal levels that don't specify them
  function generateRandomLevelPowerups(L) {
    const result = [];
    const plats = (L.platforms || []).filter(p => (p.t||'normal') !== 'death' && p.w >= 60 && p.y <= 380);
    if (plats.length === 0) return result;
    const count = Math.random() < 0.5 ? 1 : 2;
    const types = ['speed','superjump','builder'];
    for (let n=0;n<count;n++) {
      const p = plats[Math.floor(Math.random()*plats.length)];
      const x = Math.round(p.x + p.w * (0.3 + Math.random()*0.4));
      const y = Math.round(p.y - 24);
      // avoid goal proximity overlap
      const g = L.goal;
      if (g) {
        const gx = g.x, gy = g.y, gw = g.w, gh = g.h;
        const bx = x - 12, by = y - 12, bw = 24, bh = 24;
        const overlapsGoal = !(bx + bw < gx || bx > gx + gw || by + bh < gy || by > gy + gh);
        if (overlapsGoal) continue;
      }
      const t = types[Math.floor(Math.random()*types.length)];
      result.push({ x, y, r: 12, type: t });
    }
    return result;
  }

  function startLevel(i) {
    transitioning = false;
    cameraX = 0;
    currentSurface = 'normal';
    if (usingInfinite()) {
      startInfinite();
      return;
    }
    levelIndex = i;
    const L = getLevels()[levelIndex];
    player.x = L.spawn.x; player.y = L.spawn.y; player.vx = 0; player.vy = 0;
    won = false;
    player.onGround = false;
    // reset temporary boosts
    speedUntil = 0; superjumpUntil = 0;
    levelStartAt = performance.now();
    // Fill runtime coins list
    levelCoins = (L.coins || []).map(c => ({...c, taken:false, float: Math.random()*Math.PI*2 }));
    // Power-ups for this level (auto-generate if not provided)
    if (L.powerups && L.powerups.length) {
      levelPowerups = L.powerups.map(p => ({...p, taken:false}));
    } else {
      levelPowerups = generateRandomLevelPowerups(L).map(p => ({...p, taken:false}));
    }
    // Enemies for this level (skip on Level 1 to avoid early unfair deaths)
    if (levelIndex === 0) levelEnemies = [];
    else levelEnemies = (L.enemies && L.enemies.length) ? L.enemies.map(e => ({...e})) : generateRandomLevelEnemies(L);
    // Refill builder charges every 2 levels progressed
    levelsSinceBuilderRefill = (levelsSinceBuilderRefill || 0);
    if (levelIndex === 0) { levelsSinceBuilderRefill = 0; builderCharges = 0; builderBlocks = []; }
    if (levelIndex > 0 && levelIndex % 2 === 0) { builderCharges = 2; levelsSinceBuilderRefill = 0; builderBlocks = []; }
  }

  function resetLevel() {
    if (usingInfinite()) startInfinite(); else startLevel(levelIndex);
  }

  function advanceLevel() {
    if (transitioning) return;
    transitioning = true;
    const levels = getLevels();
    const next = levelIndex + 1;
    try { console.log('[advanceLevel] current', levelIndex, 'next', next, 'levels', levels.length); } catch (_) {}
    if (next < levels.length) {
      startLevel(next);
    } else {
      won = true;
    }
  }

  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function startInfinite() {
    won = false;
    player.vx = 0; player.vy = 0;
    player.onGround = false;
    cameraX = 0;
    // Start near left
    player.x = 40; player.y = 200;
    infPlatforms = [];
    infCoins = [];
    infSpawnX = 0;
    // Base ground
    infPlatforms.push({ x: -200, y: 420, w: 1200, h: 30, t: 'normal' });
    infSpawnX = 0;
    lastPlatX = 40; lastPlatY = 320; lastPlatW = 120;
    // Seed ahead
    while (infSpawnX < 1000) generateInfiniteChunk();
    // reset powerups and builder in infinite
    infPowerups = [];
    builderBlocks = [];
    builderCharges = 0;
    infEnemies = [];
    speedUntil = 0; superjumpUntil = 0;
    levelStartAt = performance.now();
  }

  function randBetween(min, max) { return Math.random() * (max - min) + min; }
  function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function generateInfiniteChunk() {
    const startX = infSpawnX;
    const endX = startX + INF_CHUNK;
    // Difficulty scaling based on distance progressed
    const prog = Math.min(2, (infSpawnX || 0) / 3000); // 0..~2
    // platform with reachability constraints
    // bias platform width towards smaller as you progress
    const widthWeights = [
      { w: 120, p: Math.max(0.2, 0.6 - 0.2 * prog) },
      { w: 100, p: Math.max(0.3, 0.3) },
      { w: 70,  p: Math.min(0.5, 0.1 + 0.2 * prog) },
    ];
    const rW = Math.random();
    let acc = 0, platW = 100;
    for (const it of widthWeights) { acc += it.p; if (rW <= acc) { platW = it.w; break; } }
    const types = ['normal','sticky','ice'];
    // bias towards trickier surfaces with progress
    const typeWeights = [
      { t: 'normal', p: Math.max(0.2, 0.6 - 0.2 * prog) },
      { t: 'sticky', p: Math.min(0.5, 0.2 + 0.15 * prog) },
      { t: 'ice',    p: Math.min(0.5, 0.2 + 0.15 * prog) },
    ];
    const rT = Math.random();
    acc = 0; let type = 'normal';
    for (const it of typeWeights) { acc += it.p; if (rT <= acc) { type = it.t; break; } }
    // Strict safe distances (tuned to physics)
    const maxHorizGap = Math.round(100 + 10 * prog); // grows slightly but stays fair
    const minHorizGap = 70;
    const maxVertDelta = Math.round(50 + 10 * prog);
    let px = 0, platY = 0;
    let ok = false;
    for (let attempt = 0; attempt < 5 && !ok; attempt++) {
      const dx = Math.round(randBetween(minHorizGap, maxHorizGap));
      px = lastPlatX + Math.max(40, dx);
      // keep within this chunk
      if (px > endX - platW - 20) px = endX - platW - 20;
      platY = Math.round(lastPlatY + randBetween(-maxVertDelta, maxVertDelta));
      platY = Math.max(INF_PLATFORM_MIN_Y, Math.min(INF_PLATFORM_MAX_Y, platY));
      // validate final px within chunk and forward of last
      ok = (px >= startX + 40 && px > (lastPlatX + 40));
    }
    // As a last resort, place directly ahead at fixed offsets
    if (!ok) {
      px = Math.min(endX - platW - 20, lastPlatX + 90);
      platY = Math.max(INF_PLATFORM_MIN_Y, Math.min(INF_PLATFORM_MAX_Y, lastPlatY));
    }
    // Helper to add a platform and coins safely
    function addPlat(ax, ay, aw, at) {
      if (ax < startX + 20 || ax + aw > endX - 10) return false;
      ay = Math.max(INF_PLATFORM_MIN_Y, Math.min(INF_PLATFORM_MAX_Y, ay));
      infPlatforms.push({ x: Math.round(ax), y: Math.round(ay), w: Math.round(aw), h: INF_PLATFORM_HEIGHT, t: at });
      // coins per platform
      const cN = Math.max(1, Math.min(3, Math.floor(aw / 50)));
      for (let i=0;i<cN;i++) {
        const cx = ax + (i+1) * (aw/(cN+1));
        const cy = ay - 24 - Math.random()*10;
        infCoins.push({ x: Math.round(cx), y: Math.round(cy), r: 10, taken: false, float: Math.random()*Math.PI*2 });
      }
      lastPlatX = Math.round(ax); lastPlatY = Math.round(ay); lastPlatW = Math.round(aw);
      return true;
    }

    // Try emitting a pattern for variety
    let emitted = false;
    const canFit = (px + platW + 40) <= (endX - 10);
    const rPat = Math.random();
    if (!emitted && canFit && rPat < 0.28) {
      // Stairs (up or down), 3-4 steps
      const dir = Math.random() < 0.5 ? -1 : 1; // -1 up, 1 down (screen y grows downward)
      const steps = Math.random() < 0.5 ? 3 : 4;
      const stepDx = 55, stepDy = 18 * dir;
      let sx = px, sy = platY;
      for (let k=0;k<steps;k++) {
        const w = Math.max(60, platW - k*10);
        const tLocal = (Math.random() < 0.5) ? type : choice(['normal','ice','sticky']);
        if (!addPlat(sx, sy, w, tLocal)) { emitted = false; break; } else emitted = true;
        sx += stepDx; sy += stepDy;
      }
    }
    if (!emitted && canFit && rPat >= 0.28 && rPat < 0.55) {
      // Double platform (neighbor at small vertical offset)
      const t1 = type; const t2 = choice(['normal','ice','sticky']);
      emitted = addPlat(px, platY, platW, t1) && addPlat(px + Math.min(80, Math.max(50, platW - 20)), platY + (Math.random()<0.5?18:-18), Math.max(60, platW - 20), t2);
    }
    if (!emitted && rPat >= 0.55 && rPat < 0.75) {
      // Mini pillar above
      emitted = addPlat(px, platY, platW, type);
      if (emitted) {
        const miniW = 50;
        addPlat(px + platW*0.5 - miniW*0.5, platY - 60, miniW, choice(['normal','ice']));
      }
    }
    if (!emitted) {
      // Single fallback
      addPlat(px, platY, platW, type);
    }
    // Try to add a secondary small platform in the same chunk for density
    if (Math.random() < 0.8) {
      const dx2 = Math.round(randBetween(50, 90));
      const px2 = px + dx2;
      const w2 = Math.max(60, Math.min(100, platW - 10));
      const y2 = platY + (Math.random() < 0.5 ? 18 : -18);
      addPlat(px2, y2, w2, choice(['normal','ice','sticky']));
    }
    // Tertiary micro-platform attempt
    if (Math.random() < 0.6) {
      const dx3 = Math.round(randBetween(30, 70));
      const px3 = px + dx3;
      const w3 = 50;
      const y3 = platY + (Math.random() < 0.5 ? 36 : -36);
      addPlat(px3, y3, w3, choice(['normal','ice']));
    }
    infSpawnX = endX;
    // occasionally spawn a powerup (slightly fewer as progress increases)
    if (Math.random() < Math.max(0.12, 0.25 - 0.07 * prog)) {
      const types = ['speed','superjump','builder'];
      const kind = choice(types);
      infPowerups.push({ x: px + platW/2, y: platY - 20, r: 10, type: kind, taken: false });
    }
    // occasionally spawn an enemy (more frequent and faster with progress)
    if (Math.random() < Math.min(0.5, 0.2 + 0.15 * prog)) {
      if (Math.random() < 0.5) {
        // gnat hovering above platform
        infEnemies.push({ type:'gnat', x: px + platW/2, y: platY - 50, baseY: platY - 50, amp: 14 + Math.random()*12, speed: (0.8 + Math.random()*0.6) * (1 + 0.2 * prog), r: 8 });
      } else {
        // rhino patrolling on platform
        infEnemies.push({ type:'rhino', x: px + 10, y: platY - 18, w: 26, h: 18, dir: 1, speed: 1.0 + 0.2 * prog, minX: px + 4, maxX: px + platW - 30 });
      }
    }
  }

  function drawStartScreen() {
    // Background
    ctx.clearRect(0, 0, W, H);
    drawSkyBackground(ctx, W, H, 0);
    const panelW = 600, panelH = 340;
    const x = (W - panelW) / 2;
    const y = (H - panelH) / 2;
    roundRect(ctx, x, y, panelW, panelH, 12, '#f6ede4', '#c9b8a6');
    ctx.fillStyle = '#5b4636';
    ctx.font = '28px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    ctx.fillText('Bakery Platformer', x + 24, y + 44);
    ctx.font = '14px ui-sans-serif, system-ui';
    ctx.fillText('How to Play:', x + 24, y + 80);
    ctx.fillText('• Left/Right to move', x + 24, y + 102);
    ctx.fillText('• Up/Space to jump', x + 24, y + 120);
    ctx.fillText('• R to restart level', x + 24, y + 138);
    ctx.fillText('• P to open the Bakery Shop', x + 24, y + 156);
    ctx.fillText('• Q place block, E delete block (Builder power-up)', x + 24, y + 174);
    ctx.font = '14px ui-sans-serif, system-ui';
    ctx.fillText('Press Enter to Start', x + 24, y + 206);
    ctx.fillText('Use Left/Right to choose Mode', x + 24, y + 222);
    // Settings: Mode selection
    ctx.fillText('Settings: Mode', x + 24, y + 234);
    const tabW2 = 140, tabH2 = 36;
    for (let i=0;i<modes.length;i++) {
      const tx = x + 24 + i * (tabW2 + 12);
      const sel = i === modeSel;
      roundRect(ctx, tx, y + 250, tabW2, tabH2, 8, sel ? '#ffe8cc' : '#f3d6b4', sel ? '#b06f2e' : '#c49256');
      ctx.fillStyle = '#5b4636';
      ctx.font = '16px ui-sans-serif, system-ui';
      ctx.fillText(modes[i].name, tx + 16, y + 272);
    }
  }

  function update() {
    if (onTitle) return;
    // Sync state possibly changed by shop
    if (typeof window !== 'undefined') {
      if (typeof window.selectedSkinIndex === 'number') selectedSkinIndex = window.selectedSkinIndex;
      if (typeof window.selectedDifficultyIndex === 'number') selectedDifficultyIndex = window.selectedDifficultyIndex;
      if (typeof window.coinsCollected === 'number') coinsCollected = window.coinsCollected;
    }

    // If shop is open, still allow goal detection and advancing, but skip physics/combat
    if (shopOpen) {
      const g = getGoal();
      if (g) {
        // Advance as soon as the player overlaps the goal rectangle
        if (aabb(player.x, player.y, player.w, player.h, g.x, g.y, g.w, g.h)) { advanceLevel(); return; }
      }
      return;
    }
    // Effective physics from difficulty
    const diff = difficulties[selectedDifficultyIndex];
    const effGravity = GRAVITY * diff.g;
    const effMax = MAX_SPEED * diff.max;
    const effJump = JUMP_V * diff.jump;
    // Surface modifiers
    let surfaceMoveMul = 1.0;
    let surfaceFriction = FRICTION;
    if (currentSurface === 'sticky') {
      surfaceMoveMul = 0.6; // slower acceleration on sticky
      surfaceFriction = 0.6; // stronger friction (stops faster)
    } else if (currentSurface === 'ice') {
      surfaceMoveMul = 1.0; // normal acceleration
      surfaceFriction = 0.98; // very slippery
    }
    // Power-ups effects
    const now = performance.now();
    const speedBoost = now < speedUntil ? 1.6 : 1.0;
    const jumpBoost = now < superjumpUntil ? 1.35 : 1.0;
    const effMove = MOVE * diff.move * surfaceMoveMul * speedBoost;
    // Input horizontal
    const left = keys.has('ArrowLeft') || keys.has('a') || keys.has('A');
    const right = keys.has('ArrowRight') || keys.has('d') || keys.has('D');
    const jump = keys.has('ArrowUp') || keys.has('w') || keys.has('W') || keys.has(' ');
    const jumpPressed = jump && !prevJumpKey;

    if (left) player.vx -= effMove; if (right) player.vx += effMove;
    player.vx = Math.max(Math.min(player.vx, effMax), -effMax);

    // Gravity
    player.vy += effGravity;

    // Apply X movement and resolve collisions on X
    player.x += player.vx;
    collideAxis('x');

    // Apply Y movement and resolve collisions on Y
    player.y += player.vy;
    player.onGround = false;
    collideAxis('y');

    // Camera follow in infinite
    if (usingInfinite()) {
      cameraX = Math.max(0, player.x - 200);
      // Spawn more ahead
      while (infSpawnX < cameraX + 1000) generateInfiniteChunk();
    } else {
      cameraX = 0;
    }

    // Jump buffering and coyote time
    if (player.onGround) {
      coyoteFrames = 8;
    } else if (coyoteFrames > 0) {
      coyoteFrames -= 1;
    }
    if (jumpPressed) {
      jumpBufferFrames = 8;
    } else if (jumpBufferFrames > 0) {
      jumpBufferFrames -= 1;
    }
    if (jumpBufferFrames > 0 && (player.onGround || coyoteFrames > 0)) {
      player.vy = effJump * jumpBoost;
      player.onGround = false;
      coyoteFrames = 0;
      jumpBufferFrames = 0;
    }

    // Friction when on ground and no input
    if (!left && !right && player.onGround) {
      player.vx *= surfaceFriction;
      if (Math.abs(player.vx) < 0.05) player.vx = 0;
    }

    // Floor death (fell)
    if (player.y > H + 100) {
      lives -= 1;
      if (lives <= 0) {
        lives = 3;
        if (usingInfinite()) startInfinite(); else startLevel(0);
      } else {
        resetLevel();
      }
    }

    // Goal (skip in Infinite)
    const g = getGoal();
    if (g) {
      // Advance as soon as the player overlaps the goal rectangle
      if (aabb(player.x, player.y, player.w, player.h, g.x, g.y, g.w, g.h)) { advanceLevel(); return; }
    }
    // (No additional fallbacks; overlap with the goal is sufficient.)
    // No screen-edge fallback: only world-coordinate goal checks are used

    // Restart
    if (keys.has('r') || keys.has('R')) {
      resetLevel();
    }

    // Death block handling
    if (diedThisFrame) {
      diedThisFrame = false;
      lives -= 1;
      if (lives <= 0) {
        lives = 3;
        if (usingInfinite()) startInfinite(); else startLevel(0);
      } else {
        resetLevel();
      }
      return;
    }

    // Power-up pickups
    const pList = usingInfinite() ? infPowerups : levelPowerups;
    for (const p of pList) {
      if (p.taken) continue;
      const bx = p.x - (p.r||10), by = p.y - (p.r||10), bw = (p.r||10)*2, bh = (p.r||10)*2;
      if (aabb(player.x, player.y, player.w, player.h, bx, by, bw, bh)) {
        p.taken = true;
        const dur = 15000; // 15s
        if (p.type === 'speed') speedUntil = Math.max(speedUntil, now + dur);
        else if (p.type === 'superjump') superjumpUntil = Math.max(superjumpUntil, now + dur);
        else if (p.type === 'builder') builderCharges = Math.max(builderCharges, 2);
      }
    }

    // Enemies update and collisions (grace period after level start)
    const enemies = usingInfinite() ? infEnemies : levelEnemies;
    const enemyActive = performance.now() - levelStartAt > 1500;
    for (const e of enemies) {
      if (e.type === 'gnat') {
        e.x += e.speed; // drift right
        if (e.x - cameraX > W + 100) e.x -= (W + 200); // recycle a bit to left
        e.y = e.baseY + Math.sin(performance.now()/500 + (e.baseY*0.1)) * e.amp;
        const er = e.r || 8;
        if (enemyActive && circleRectIntersect(e.x, e.y, er, player.x, player.y, player.w, player.h)) diedThisFrame = true;
      } else if (e.type === 'rhino') {
        e.x += e.dir * e.speed * 2.0;
        if (e.x < e.minX) { e.x = e.minX; e.dir = 1; }
        if (e.x > e.maxX) { e.x = e.maxX; e.dir = -1; }
        if (enemyActive && aabb(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h)) diedThisFrame = true;
      }
    }

    prevJumpKey = jump;

    // Coin collection
    const coinsList = usingInfinite() ? infCoins : levelCoins;
    for (const c of coinsList) {
      if (c.taken) continue;
      const bx = c.x - c.r, by = c.y - c.r, bw = c.r * 2, bh = c.r * 2;
      if (aabb(player.x, player.y, player.w, player.h, bx, by, bw, bh)) {
        c.taken = true;
        coinsCollected += 1;
        if (typeof window !== 'undefined') window.coinsCollected = coinsCollected;
      }
    }
  }

  function collideAxis(axis) {
    const plats = getPlatforms();
    for (const p of plats) {
      if (aabb(player.x, player.y, player.w, player.h, p.x, p.y, p.w, p.h)) {
        if (p.t === 'death') { diedThisFrame = true; continue; }
        if (axis === 'x') {
          if (player.vx > 0) player.x = p.x - player.w; else if (player.vx < 0) player.x = p.x + p.w;
          player.vx = 0;
        } else {
          if (player.vy > 0) { player.y = p.y - player.h; player.vy = 0; player.onGround = true; currentSurface = p.t || 'normal'; }
          else if (player.vy < 0) { player.y = p.y + p.h; player.vy = 0; }
        }
      }
    }

    // Keep inside bounds on X for Normal mode; allow falling below screen on Y
    if (axis === 'x') {
      if (!usingInfinite()) {
        if (player.x < 0) { player.x = 0; player.vx = 0; }
        if (player.x + player.w > W) { player.x = W - player.w; player.vx = 0; }
      }
    } else if (axis === 'y') {
      if (player.y < 0) { player.y = 0; player.vy = 0; }
    }
  }

  function drawGrid() {
    ctx.strokeStyle = bgDecoColor;
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke();
    }
  }

  function render() {
    // Clear
    ctx.clearRect(0, 0, W, H);

    // Background
    drawSkyBackground(ctx, W, H, cameraX);

    if (onTitle) {
      drawStartScreen();
      return;
    }

    // Platforms
    for (const p of getPlatforms()) {
      drawPlatformTextured(ctx, p, cameraX);
      // draw death overlay if applicable
      if ((p.t||'normal') === 'death') {
        const x = Math.round(p.x - cameraX), y = Math.round(p.y), w = p.w, h = p.h;
        ctx.fillStyle = 'rgba(255,80,80,0.35)';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        for (let i=0;i<w;i+=12) {
          ctx.beginPath(); ctx.arc(x + i + 6, y + 6, 3, 0, Math.PI*2); ctx.fill();
        }
      }
    }

    // Coins
    const t = performance.now() / 1000;
    const coinsListR = usingInfinite() ? infCoins : levelCoins;
    for (const c of coinsListR) {
      if (c.taken) continue;
      const bob = Math.sin(t * 3 + c.float) * 2;
      const r = c.r;
      // coin body
      ctx.beginPath();
      ctx.arc(c.x - cameraX, c.y + bob, r, 0, Math.PI * 2);
      ctx.fillStyle = coinColor;
      ctx.fill();
      // shine
      ctx.beginPath();
      ctx.arc((c.x - cameraX) - r*0.3, c.y - r*0.2 + bob, r*0.35, 0, Math.PI * 2);
      ctx.fillStyle = coinShineColor;
      ctx.fill();
      // outline
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Enemies (visible)
    const enemiesR = usingInfinite() ? infEnemies : levelEnemies;
    for (const e of enemiesR) {
      const ex = Math.round(e.x - cameraX);
      const ey = Math.round(e.y);
      if (ex < -100 || ex > W + 100 || ey < -100 || ey > H + 100) continue;
      if (e.type === 'gnat') {
        const r = (e.r || 8) + 2;
        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.arc(ex + 2, ey + 2, r, 0, Math.PI*2); ctx.fill();
        // body
        ctx.fillStyle = '#2f2f2f';
        ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI*2); ctx.fill();
        // outline
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI*2); ctx.stroke();
        // wings
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ex-8,ey-3); ctx.lineTo(ex-14,ey-9); ctx.moveTo(ex+8,ey-3); ctx.lineTo(ex+14,ey-9); ctx.stroke();
      } else if (e.type === 'rhino') {
        const w = e.w || 26, h = e.h || 18;
        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(ex + 2, ey + 2, w, h);
        // body
        ctx.fillStyle = '#8d99ae'; ctx.fillRect(ex, ey, w, h);
        // outline
        ctx.strokeStyle = '#2b2d42'; ctx.lineWidth = 2; ctx.strokeRect(ex, ey, w, h);
        // horn
        ctx.fillStyle = '#e9ecef'; ctx.beginPath(); ctx.moveTo(ex + w, ey + 6); ctx.lineTo(ex + w + 8, ey + 9); ctx.lineTo(ex + w, ey + 12); ctx.fill();
        // eye
        ctx.fillStyle = '#1d1d1d'; ctx.fillRect(ex + w - 8, ey + 5, 3, 3);
      }
    }

    // Goal
    const g2 = getGoal();
    if (g2) {
      drawGoalPretty(ctx, g2, cameraX);
      // debug overlay to show when overlapping goal
      const pad = 6;
      const overlap = aabb(player.x, player.y, player.w, player.h, g2.x - pad, g2.y - pad, g2.w + pad*2, g2.h + pad*2);
      if (overlap) {
        ctx.fillStyle = 'rgba(0,255,0,0.18)';
        ctx.fillRect(g2.x - cameraX - pad, g2.y - pad, g2.w + pad*2, g2.h + pad*2);
      }
      // show goal center line for debugging progression
      const centerX = g2.x + g2.w/2;
      ctx.strokeStyle = 'rgba(0,128,255,0.6)';
      ctx.beginPath();
      ctx.moveTo(centerX - cameraX, g2.y - 12);
      ctx.lineTo(centerX - cameraX, g2.y + g2.h + 12);
      ctx.stroke();
      // TEMP: HUD with player/goal metrics
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(W - 210, H - 56, 200, 46);
      ctx.fillStyle = '#e8e9f3';
      ctx.font = '12px ui-sans-serif, system-ui';
      const pCX = Math.round(player.x + player.w/2);
      const gCX = Math.round(centerX);
      ctx.fillText(`pCX ${pCX}  gCX ${gCX}`, W - 200, H - 36);
      ctx.fillText(`pR ${Math.round(player.x + player.w)}  gR ${Math.round(g2.x + g2.w)}`, W - 200, H - 20);
    }

    // Player (sync skin immediately even while shop is open)
    if (typeof window !== 'undefined' && typeof window.selectedSkinIndex === 'number') {
      selectedSkinIndex = window.selectedSkinIndex;
    }
    window.CURRENT_SKIN = skins[selectedSkinIndex];
    drawPlayer(Math.round(player.x - cameraX), Math.round(player.y));

    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(10, 10, 240, 64);
    ctx.fillStyle = '#e8e9f3';
    ctx.font = '14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    const levelLabel = usingInfinite() ? 'Infinite' : `${levelIndex + 1}/${getLevels().length}`;
    ctx.fillText(`Level: ${levelLabel}`, 20, 32);
    ctx.fillText(`Lives: ${lives}`, 20, 52);
    ctx.fillText(`Coins: ${coinsCollected}/${totalCoins}`, 120, 32);
    ctx.fillText(`Difficulty: ${difficulties[selectedDifficultyIndex].name}`, 120, 52);
    ctx.fillText(`Mode: ${modes[selectedModeIndex].name}`, 260, 52);

    // Infinite mode debug: show player world coordinates (X/Y)
    if (usingInfinite()) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(10, 80, 220, 26);
      ctx.fillStyle = '#e8e9f3';
      ctx.font = '12px ui-sans-serif, system-ui';
      ctx.fillText(`X: ${Math.round(player.x)}  Y: ${Math.round(player.y)}  CamX: ${Math.round(cameraX)}`, 20, 98);
    }

    // Power-up HUD (top-right)
    const nowHud = performance.now();
    let hudX = W - 180, hudY = 10;
    function drawHudBadge(label, remainingMs, color) {
      const secs = Math.ceil(Math.max(0, remainingMs)/1000);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(hudX, hudY, 170, 22);
      ctx.fillStyle = color; ctx.font = '12px ui-sans-serif, system-ui';
      ctx.fillText(`${label}: ${secs}s`, hudX + 8, hudY + 15);
      hudY += 24;
    }
    if (nowHud < speedUntil) drawHudBadge('Speed', speedUntil - nowHud, '#4cc9f0');
    if (nowHud < superjumpUntil) drawHudBadge('Super Jump', superjumpUntil - nowHud, '#90be6d');
    if (builderCharges > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(hudX, hudY, 170, 22);
      ctx.fillStyle = '#f4a261'; ctx.font = '12px ui-sans-serif, system-ui';
      ctx.fillText(`Builder charges: ${builderCharges}`, hudX + 8, hudY + 15);
      hudY += 24;
    }

    // Sync window state for shop UI
    if (typeof window !== 'undefined') {
      window.selectedSkinIndex = selectedSkinIndex;
      window.selectedDifficultyIndex = selectedDifficultyIndex;
      window.selectedModeIndex = selectedModeIndex;
      window.coinsCollected = coinsCollected;
      window.shopTab = shopTab;
      window.skinSel = skinSel;
      window.diffSel = diffSel;
      window.modeSel = modeSel;
    }

    // Shop overlay
    if (shopOpen) {
      drawShop();
    }

    if (won) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#7cf7a7';
      ctx.font = '28px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      ctx.textAlign = 'center';
      ctx.fillText('You Win! Press R to play again', W/2, H/2);
      ctx.textAlign = 'start';
    }
    // subtle transition banner
    if (transitioning && !won) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(W/2 - 90, 10, 180, 28);
      ctx.fillStyle = '#e8e9f3';
      ctx.font = '16px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Next Level...', W/2, 30);
      ctx.textAlign = 'start';
    }
  }

  function loop() {
    if (!won && !shopOpen) update();
    render();
    requestAnimationFrame(loop);
  }

  // Start loop (title screen shown first)
  loop();
})();

// Draw a simple but more detailed player sprite with head/body/legs and a little animation
function drawPlayer(px, py) {
  const ctx = document.getElementById('game').getContext('2d');
  const t = performance.now() / 1000;
  const cx = px + 14; // center x within player bounds (w=28)
  const cy = py + 22; // center y within player bounds (h=38)
  const r = 16;       // orange radius

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, py + 38, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Slight bob when moving
  const bob = Math.sin(t * 6) * 1.2;

  const skin = (window && window.CURRENT_SKIN) ? window.CURRENT_SKIN : { key: 'orange', body: '#ffa730', outline: '#d77a00' };

  function drawRoundFruit(baseColor, outlineColor) {
    // body
    const grad = ctx.createRadialGradient(cx - r*0.3, cy - r*0.3 + bob, r*0.2, cx, cy + bob, r);
    grad.addColorStop(0, '#fff0c2');
    grad.addColorStop(0.4, baseColor);
    grad.addColorStop(1, outlineColor);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy + bob, r, 0, Math.PI * 2);
    ctx.fill();
    // outline
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy + bob, r, 0, Math.PI * 2);
    ctx.stroke();
    // stem
    ctx.strokeStyle = '#6b3d12';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 1, cy - r + bob);
    ctx.quadraticCurveTo(cx + 2, cy - r - 6 + bob, cx + 5, cy - r - 2 + bob);
    ctx.stroke();
    // leaf
    ctx.fillStyle = '#2f9e44';
    ctx.beginPath();
    ctx.ellipse(cx + 7, cy - r - 2 + bob, 8, 4, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawBanana() {
    ctx.fillStyle = skin.body;
    ctx.strokeStyle = skin.outline;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy + bob - 2);
    ctx.quadraticCurveTo(cx + 2, cy - 18 + bob, cx + 12, cy - 6 + bob);
    ctx.quadraticCurveTo(cx + 2, cy + 4 + bob, cx - 12, cy + 8 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // tips
    ctx.fillStyle = '#6b3d12';
    ctx.beginPath(); ctx.arc(cx - 12, cy + 8 + bob, 2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 12, cy - 6 + bob, 2, 0, Math.PI*2); ctx.fill();
  }

  function drawStrawberry() {
    // body heart-ish
    ctx.fillStyle = skin.body;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r/2 + bob);
    ctx.bezierCurveTo(cx + r, cy - r + bob, cx + r, cy + r/2 + bob, cx, cy + r + bob);
    ctx.bezierCurveTo(cx - r, cy + r/2 + bob, cx - r, cy - r + bob, cx, cy - r/2 + bob);
    ctx.fill();
    ctx.stroke();
    // seeds
    ctx.fillStyle = '#ffd166';
    for (let i=0;i<10;i++) {
      const ang = (i/10) * Math.PI*2;
      const rr = r*0.6;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(ang)*rr*0.6, cy + bob + Math.sin(ang)*rr*0.8, 1.3, 2.1, ang, 0, Math.PI*2);
      ctx.fill();
    }
    // leaf cap
    ctx.fillStyle = '#2f9e44';
    ctx.beginPath();
    ctx.ellipse(cx, cy - r + bob, 10, 5, 0, 0, Math.PI*2);
    ctx.fill();
  }

  function drawPenguin() {
    // body
    ctx.fillStyle = skin.body;
    ctx.beginPath();
    ctx.ellipse(cx, cy + bob, r*0.9, r*1.1, 0, 0, Math.PI*2);
    ctx.fill();
    // belly
    ctx.fillStyle = '#f5f5f5';
    ctx.beginPath();
    ctx.ellipse(cx, cy + bob + 4, r*0.6, r*0.8, 0, 0, Math.PI*2);
    ctx.fill();
    // eyes
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(cx - 5, cy - 6 + bob, 2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 5, cy - 6 + bob, 2, 0, Math.PI*2); ctx.fill();
    // beak
    ctx.fillStyle = '#ffb703';
    ctx.beginPath();
    ctx.moveTo(cx - 2, cy - 1 + bob);
    ctx.lineTo(cx + 2, cy - 1 + bob);
    ctx.lineTo(cx, cy + 3 + bob);
    ctx.closePath();
    ctx.fill();
    // feet
    ctx.fillStyle = '#ffb703';
    ctx.beginPath(); ctx.ellipse(cx - 6, cy + r + bob - 2, 5, 2, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 6, cy + r + bob - 2, 5, 2, 0, 0, Math.PI*2); ctx.fill();
  }

  switch (skin.key) {
    case 'banana': drawBanana(); break;
    case 'apple': drawRoundFruit(skin.body, skin.outline); break;
    case 'pear': drawRoundFruit(skin.body, skin.outline); break;
    case 'apricot': drawRoundFruit(skin.body, skin.outline); break;
    case 'strawberry': drawStrawberry(); break;
    case 'tomato': drawRoundFruit(skin.body, skin.outline); break;
    case 'penguin': drawPenguin(); break;
    case 'orange':
    default:
      drawRoundFruit(skin.body || '#ffa730', skin.outline || '#d77a00');
      break;
  }
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}

// Shop logic
function buyOrEquipSkin(i) {
  const s = window.skins ? window.skins[i] : null;
  if (!s) return;
  if (s.owned) {
    window.selectedSkinIndex = i;
    return;
  }
  if (window.coinsCollected >= s.cost) {
    window.coinsCollected -= s.cost;
    s.owned = true;
    window.selectedSkinIndex = i;
  }
}

function buyOrEquipDifficulty(i) {
  const d = window.difficulties ? window.difficulties[i] : null;
  if (!d) return;
  if (d.owned) {
    window.selectedDifficultyIndex = i;
    return;
  }
  if (window.coinsCollected >= d.cost) {
    window.coinsCollected -= d.cost;
    d.owned = true;
    window.selectedDifficultyIndex = i;
  }
}

function drawShop() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, W, H);

  const panelW = 560, panelH = 320;
  const x = (W - panelW) / 2;
  const y = (H - panelH) / 2;

  function drawBakeryBackdrop() {
    roundRect(ctx, x, y, panelW, panelH, 12, '#f6ede4', '#c9b8a6');
    const wallGrad = ctx.createLinearGradient(0, y, 0, y + panelH);
    wallGrad.addColorStop(0, 'rgba(255,255,255,0.35)');
    wallGrad.addColorStop(1, 'rgba(0,0,0,0.05)');
    roundRect(ctx, x, y, panelW, panelH, 12, wallGrad, null);
    const counterH = 90;
    const woodY = y + panelH - counterH;
    const woodGrad = ctx.createLinearGradient(0, woodY, 0, woodY + counterH);
    woodGrad.addColorStop(0, '#9c6b3c');
    woodGrad.addColorStop(1, '#6f4e2b');
    roundRect(ctx, x + 8, woodY - 4, panelW - 16, counterH + 12, 10, '#d7c7b7', '#b8a796');
    roundRect(ctx, x + 12, woodY, panelW - 24, counterH, 8, woodGrad, '#4a2f16');
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 18, woodY + 30);
    ctx.lineTo(x + panelW - 18, woodY + 30);
    ctx.moveTo(x + 18, woodY + 60);
    ctx.lineTo(x + panelW - 18, woodY + 60);
    ctx.stroke();
    const caseX = x + 24;
    const caseY = y + 64;
    const caseW = panelW - 48;
    const caseH = panelH - counterH - 76;
    const glass = 'rgba(200,230,255,0.25)';
    roundRect(ctx, caseX, caseY, caseW, caseH, 10, glass, 'rgba(180,200,220,0.6)');
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(caseX + 8, caseY + 36);
    ctx.lineTo(caseX + caseW - 8, caseY + 36);
    ctx.moveTo(caseX + 8, caseY + 72);
    ctx.lineTo(caseX + caseW - 8, caseY + 72);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(caseX + 16, caseY + 8);
    ctx.lineTo(caseX + 80, caseY + 8);
    ctx.stroke();
    const decoKinds = ['cake','cookie','donut','cake','cookie','donut'];
    for (let i = 0; i < decoKinds.length; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      drawPastry(caseX + 40 + col * 80, caseY + 26 + row * 36, decoKinds[i]);
    }
  }

  function drawPastry(cx, cy, kind) {
    if (kind === 'cake') {
      ctx.fillStyle = '#ffd6e7';
      ctx.beginPath();
      ctx.moveTo(cx - 16, cy + 8);
      ctx.lineTo(cx + 16, cy + 8);
      ctx.lineTo(cx, cy - 10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.stroke();
      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath(); ctx.arc(cx, cy - 4, 3, 0, Math.PI*2); ctx.fill();
    } else if (kind === 'cookie') {
      ctx.fillStyle = '#d9a066';
      ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#6b3d12';
      for (let i=0;i<5;i++) {
        const a = (i/5)*Math.PI*2;
        ctx.beginPath(); ctx.arc(cx + Math.cos(a)*6, cy + Math.sin(a)*6, 1.8, 0, Math.PI*2); ctx.fill();
      }
    } else if (kind === 'donut') {
      ctx.strokeStyle = '#ff8fab';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cx, cy, 8, 0.6, Math.PI*2+0.6); ctx.stroke();
      ctx.fillStyle = '#fff0f5';
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI*2); ctx.fill();
    } else if (kind === 'banana_bread') {
      ctx.fillStyle = '#c78f5a';
      roundRect(ctx, cx - 14, cy - 8, 28, 16, 4, '#c78f5a', '#8a5a2b');
      ctx.fillStyle = '#6b3d12';
      for (let i=0;i<3;i++) { ctx.fillRect(cx - 10 + i*8, cy - 4, 2, 8); }
    } else if (kind === 'apple_pie') {
      ctx.fillStyle = '#f1c27d';
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy + 10);
      ctx.lineTo(cx + 14, cy + 10);
      ctx.lineTo(cx, cy - 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#c58940'; ctx.stroke();
      ctx.strokeStyle = 'rgba(139,69,19,0.5)';
      for (let i=-10;i<=10;i+=5) { ctx.beginPath(); ctx.moveTo(cx + i, cy + 6); ctx.lineTo(cx + i, cy - 2); ctx.stroke(); }
    } else if (kind === 'pear_tart') {
      ctx.fillStyle = '#f7e1a0';
      ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#7fc36e';
      for (let i=0;i<4;i++) { ctx.beginPath(); ctx.arc(cx + Math.cos(i)*5, cy + Math.sin(i)*3, 2, 0, Math.PI*2); ctx.fill(); }
    } else if (kind === 'apricot_danish') {
      roundRect(ctx, cx - 10, cy - 10, 20, 20, 3, '#f3d6b4', '#c49256');
      ctx.fillStyle = '#ff964f';
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI*2); ctx.fill();
    } else if (kind === 'strawberry_cake') {
      ctx.fillStyle = '#ffe1eb';
      roundRect(ctx, cx - 14, cy - 8, 28, 16, 3, '#ffe1eb', '#b87393');
      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath(); ctx.arc(cx, cy - 10, 4, 0, Math.PI*2); ctx.fill();
    } else if (kind === 'tomato_tart') {
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#2f9e44';
      ctx.beginPath(); ctx.ellipse(cx + 2, cy - 5, 4, 2, -0.6, 0, Math.PI*2); ctx.fill();
    } else if (kind === 'penguin_icecream') {
      ctx.fillStyle = '#d4a373';
      ctx.beginPath(); ctx.moveTo(cx - 6, cy + 8); ctx.lineTo(cx + 6, cy + 8); ctx.lineTo(cx, cy - 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#bde0fe';
      ctx.beginPath(); ctx.arc(cx, cy - 4, 7, 0, Math.PI*2); ctx.fill();
    } else if (kind === 'orange_donut') {
      ctx.strokeStyle = '#ffa730';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = '#fff7e6';
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI*2); ctx.fill();
    }
  }

  function pastryForSkin(key) {
    switch (key) {
      case 'banana': return 'banana_bread';
      case 'apple': return 'apple_pie';
      case 'pear': return 'pear_tart';
      case 'apricot': return 'apricot_danish';
      case 'strawberry': return 'strawberry_cake';
      case 'tomato': return 'tomato_tart';
      case 'penguin': return 'penguin_icecream';
      case 'orange':
      default: return 'orange_donut';
    }
  }

  drawBakeryBackdrop();

  ctx.fillStyle = '#5b4636';
  ctx.font = '18px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
  ctx.fillText('Bakery Shop', x + 20, y + 32);
  ctx.font = '12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
  ctx.fillText('P: Close  |  Left/Right: Tabs  |  Up/Down: Navigate  |  Enter/Space: Buy/Equip/Select', x + 20, y + 52);

  const tabY = y + 70;
  const tabW = 120, tabH = 28;
  const tabs = ['Skins', 'Difficulty', 'Settings'];
  for (let i = 0; i < tabs.length; i++) {
    const tx = x + 20 + i * (tabW + 10);
    roundRect(ctx, tx, tabY, tabW, tabH, 6, i === window.shopTab ? '#ffe8cc' : '#f3d6b4', i === window.shopTab ? '#b06f2e' : '#c49256');
    ctx.fillStyle = '#5b4636';
    ctx.font = '14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    ctx.fillText(tabs[i], tx + 14, tabY + 19);
  }

  const listX = x + 20;
  const listY = y + 110;
  const rowH = 38;
  if (window.shopTab === 0) {
    const total = window.skins.length;
    const maxRows = 7;
    const start = Math.min(Math.max(window.skinSel - Math.floor(maxRows/2), 0), Math.max(0, total - maxRows));
    const end = Math.min(total, start + maxRows);
    // page indicator
    ctx.fillStyle = '#8a6a4b';
    ctx.font = '12px ui-sans-serif, system-ui';
    ctx.fillText(`Skins ${start + 1}-${end} of ${total}`, x + panelW - 180, y + 90);
    for (let vi = 0, i = start; i < end; i++, vi++) {
      const s = window.skins[i];
      const ry = listY + vi * rowH;
      const selected = i === window.skinSel;
      roundRect(ctx, listX, ry, panelW - 40, rowH - 6, 10, selected ? '#fff3e6' : '#fde9d6', '#e2bf92');
      if (selected) {
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
        ctx.strokeStyle = `rgba(192, 120, 60, ${0.6 * pulse + 0.2})`;
        ctx.lineWidth = 3;
        roundRect(ctx, listX - 2, ry - 2, panelW - 36, rowH - 2, 12, null, ctx.strokeStyle);
      }
      const kind = pastryForSkin(s.key);
      drawPastry(listX + 20, ry + (rowH/2) - 2, kind);
      ctx.fillStyle = s.body;
      ctx.fillRect(listX + 40, ry + 10, 22, rowH - 22);
      ctx.fillStyle = s.outline; ctx.fillRect(listX + 40, ry + 10, 22, 2);
      ctx.fillStyle = '#5b4636';
      ctx.font = '14px ui-sans-serif, system-ui';
      const status = s.owned ? (i === window.selectedSkinIndex ? 'Selected' : 'Owned') : `Cost: ${s.cost}`;
      ctx.fillText(`${s.name}`, listX + 70, ry + 16);
      ctx.font = '12px ui-sans-serif, system-ui';
      ctx.fillStyle = s.owned ? '#2f7a4a' : '#8a6a4b';
      roundRect(ctx, listX + 70, ry + 20, 90, 14, 7, s.owned ? 'rgba(47,122,74,0.15)' : 'rgba(138,106,75,0.15)', s.owned ? '#2f7a4a' : '#8a6a4b');
      ctx.fillStyle = s.owned ? '#2f7a4a' : '#8a6a4b';
      ctx.fillText(`${status}`, listX + 76, ry + 31);
    }
    if (total > maxRows) {
      const trackX = x + panelW - 24;
      const trackY = listY - 6;
      const trackW = 6;
      const trackH = maxRows * rowH - 6;
      roundRect(ctx, trackX, trackY, trackW, trackH, 3, '#e8d8c7', '#c9b8a6');
      const thumbH = Math.max(18, Math.round(trackH * (maxRows / total)));
      const maxStart = total - maxRows;
      const t = maxStart > 0 ? (start / maxStart) : 0;
      const thumbY = trackY + Math.round((trackH - thumbH) * t);
      roundRect(ctx, trackX, thumbY, trackW, thumbH, 3, '#c49256', '#a0753e');
      // arrows
      ctx.fillStyle = '#a0753e';
      ctx.beginPath(); ctx.moveTo(trackX + trackW/2, trackY - 6); ctx.lineTo(trackX + trackW/2 - 3, trackY - 1); ctx.lineTo(trackX + trackW/2 + 3, trackY - 1); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(trackX + trackW/2, trackY + trackH + 6); ctx.lineTo(trackX + trackW/2 - 3, trackY + trackH + 1); ctx.lineTo(trackX + trackW/2 + 3, trackY + trackH + 1); ctx.closePath(); ctx.fill();
    }
  } else if (window.shopTab === 1) {
    for (let i = 0; i < window.difficulties.length; i++) {
      const d = window.difficulties[i];
      const ry = listY + i * rowH;
      roundRect(ctx, listX, ry, panelW - 40, rowH - 6, 10, i === window.diffSel ? '#fff3e6' : '#fde9d6', '#e2bf92');
      drawPastry(listX + 20, ry + (rowH/2) - 2, i % 2 === 0 ? 'cookie' : 'cake');
      ctx.fillStyle = '#5b4636';
      ctx.font = '14px ui-sans-serif, system-ui';
      const status = d.owned ? (i === window.selectedDifficultyIndex ? 'Selected' : 'Owned') : `Cost: ${d.cost}`;
      ctx.fillText(`${d.name} — ${status}`, listX + 50, ry + 24);
    }
  } else if (window.shopTab === 2) {
    for (let i = 0; i < window.modes.length; i++) {
      const m = window.modes[i];
      const ry = listY + i * rowH;
      roundRect(ctx, listX, ry, panelW - 40, rowH - 6, 10, i === window.modeSel ? '#fff3e6' : '#fde9d6', '#e2bf92');
      drawPastry(listX + 20, ry + (rowH/2) - 2, i % 2 === 0 ? 'donut' : 'cookie');
      ctx.fillStyle = '#5b4636';
      ctx.font = '14px ui-sans-serif, system-ui';
      const status = (i === window.selectedModeIndex) ? 'Selected' : 'Press Enter to Select';
      ctx.fillText(`${m.name} — ${status}`, listX + 50, ry + 24);
    }
  }

  ctx.fillStyle = '#5b4636';
  ctx.font = '14px ui-sans-serif, system-ui';
  const coinX = x + panelW - 160;
  const coinY = y + 26;
  ctx.beginPath(); ctx.arc(coinX, coinY, 8, 0, Math.PI*2); ctx.fillStyle = '#f7e26b'; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#5b4636';
  ctx.fillText(`Coins: ${window.coinsCollected}`, coinX + 14, y + 32);
}
