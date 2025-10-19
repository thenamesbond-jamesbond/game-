    (() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // Mobile/tablet: responsive canvas scaling to fit screen while preserving aspect
  const BASE_W = canvas.width;
  const BASE_H = canvas.height;
  function updateCanvasScale() {
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const scale = Math.max(0.5, Math.min(vw / BASE_W, vh / BASE_H));
    canvas.style.width = Math.round(BASE_W * scale) + 'px';
    canvas.style.height = Math.round(BASE_H * scale) + 'px';
  }

  // --- Infinite Walls (vertical) generator and starters ---
  function startInfiniteWalls() {
    // Reset state
    infWallsPlatforms = [];
    builderBlocks = [];
    coinsCollected = 0; totalCoins = 0; // coins not used here yet
    // Place player near bottom center
    player.x = W/2 - player.w/2;
    player.y = H - 80;
    player.vx = 0; player.vy = 0; player.onGround = false;
    cameraX = 0; cameraY = player.y - 200;
    // Base floor
    infWallsPlatforms.push({ x: 0, y: H - 20, w: W, h: 40, t: 'normal' });
    wallsLastPlatY = H - 80;
    wallsLastPlatX = W/2 - 60;
    infWallsSpawnY = H - 240; // start generating upwards from here (decreasing y)
    // seed a couple ledges
    infWallsPlatforms.push({ x: wallsLastPlatX - 120, y: H - 140, w: 100, h: 16, t: 'normal' });
    infWallsPlatforms.push({ x: wallsLastPlatX + 140, y: H - 200, w: 100, h: 16, t: 'normal' });
  }

  function generateInfiniteWallsChunk() {
    // Generate a vertical segment from infWallsSpawnY downwards by INF_WALLS_CHUNK_H
    const startY = infWallsSpawnY;
    const endY = startY - INF_WALLS_CHUNK_H;
    // Add paired vertical columns to bounce between
    const colW = 20;
    const gap = 140 + Math.random()*40;
    const center = W/2 + (Math.random()*120 - 60);
    const leftX = Math.max(40, Math.min(W-40, Math.round(center - gap/2)));
    const rightX = Math.max(40, Math.min(W-40, Math.round(center + gap/2)));
    const stickyLeft = Math.random() < 0.5;
    infWallsPlatforms.push({ x: leftX - colW, y: endY, w: colW, h: startY - endY, t: stickyLeft ? 'sticky' : 'normal' });
    infWallsPlatforms.push({ x: rightX,      y: endY, w: colW, h: startY - endY, t: stickyLeft ? 'normal' : 'sticky' });
    // Add 1-2 horizontal ledges between columns
    const nLedges = 1 + Math.round(Math.random());
    for (let i=0;i<nLedges;i++) {
      const ly = Math.round(startY - 30 - Math.random()*(INF_WALLS_CHUNK_H - 60));
      const onLeft = Math.random() < 0.5;
      const lx = onLeft ? (leftX - 100) : (rightX + colW);
      const lw = 90 + Math.round(Math.random()*60);
      const type = Math.random() < 0.2 ? 'ice' : 'normal';
      const plat = { x: Math.max(10, Math.min(W - lw - 10, lx)), y: ly, w: lw, h: 16, t: type };
      infWallsPlatforms.push(plat);
      wallsLastPlatY = ly;
      wallsLastPlatX = plat.x;
    }
    // Advance spawn pointer upwards (towards smaller y)
    infWallsSpawnY = endY;
  }
  addEventListener('resize', updateCanvasScale);
  addEventListener('orientationchange', () => setTimeout(updateCanvasScale, 50));
  updateCanvasScale();

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
  let currentSurface = 'normal';
  let modeSel = 0;
  let onTitle = true;
  let diedThisFrame = false;
  let cameraX = 0;
  let cameraY = 0; // for Infinite Walls vertical mode
  let transitioning = false;
  let coyoteFrames = 0;
  let jumpBufferFrames = 0;
  let prevJumpKey = false;
  let levelStartAt = 0;
  let wallCoyoteFrames = 0;

  // Physics
  const GRAVITY = 0.7;
  const MOVE = 0.6;
  const MAX_SPEED = 5.0;
  const JUMP_V = -12.0;
  const FRICTION = 0.85;
  // Wall jump tunables
  const WALL_JUMP_PUSH_X = 5.2;
  const WALL_JUMP_PUSH_Y = -12.0;
  const WALL_LOCK_FRAMES = 6; // frames to ignore wall re-stick after jump
  const WALL_SLIDE_MAX_FALL = 3.6;
  const WALL_SLIDE_MAX_FALL_STICKY = 1.8; // slower on sticky walls
  // Spawn tunables
  const INF_COIN_EMIT_CHANCE = 0.35; // chance to emit coins for an infinite platform
  const INF_POWERUP_CHANCE_BASE = 0.08; // base chance for powerup in infinite
  const INF_POWERUP_CHANCE_SLOPE = 0.08; // reduction with progress

  // Input
  const keys = new Set();
  // Bind on-screen mobile controls if present
  function bindMobileControls() {
    const leftBtn = document.getElementById('btn-left');
    const rightBtn = document.getElementById('btn-right');
    const jumpBtn = document.getElementById('btn-jump');
    function attach(btn, keyDown, keyUp) {
      if (!btn) return;
      const down = (ev) => { ev.preventDefault(); keys.add(keyDown); btn.classList.add('active'); btn.setPointerCapture && btn.setPointerCapture(ev.pointerId || 1); };
      const up = (ev) => { ev.preventDefault(); keys.delete(keyDown); if (keyUp) keys.delete(keyUp); btn.classList.remove('active'); };
      btn.addEventListener('pointerdown', down, { passive: false });
      btn.addEventListener('pointerup', up, { passive: false });
      btn.addEventListener('pointercancel', up, { passive: false });
      btn.addEventListener('pointerleave', up, { passive: false });
    }
    attach(leftBtn, 'ArrowLeft');
    attach(rightBtn, 'ArrowRight');
    // Make jump map to both Up and Space so our key code sees it either way
    if (jumpBtn) {
      jumpBtn.addEventListener('pointerdown', (ev) => { ev.preventDefault(); keys.add('ArrowUp'); keys.add(' '); jumpBtn.classList.add('active'); }, { passive: false });
      const up = (ev) => { ev.preventDefault(); keys.delete('ArrowUp'); keys.delete(' '); jumpBtn.classList.remove('active'); };
      jumpBtn.addEventListener('pointerup', up, { passive: false });
      jumpBtn.addEventListener('pointercancel', up, { passive: false });
      jumpBtn.addEventListener('pointerleave', up, { passive: false });
    }
  }
  bindMobileControls();
  function startFromTitle() {
    if (!onTitle) return;
    // apply selected mode from start screen
    selectedModeIndex = modeSel;
    if (typeof window !== 'undefined') window.selectedModeIndex = selectedModeIndex;
    if (usingInfinite()) startInfinite();
    else if (usingInfiniteWalls()) startInfiniteWalls();
    else startLevel(0);
    onTitle = false;
  }

  // Lightweight physics step for the title demo (WASD control; W to jump)
  function titleUpdate() {
    // Do minimal physics using the same collision helpers
    jumpedThisFrame = false;
    touchedWallThisFrame = false;
    player.isTouchingWall = false;
    if (wallLockFrames > 0) wallLockFrames -= 1;

    const effGravity = GRAVITY;
    const effMax = MAX_SPEED;
    let surfaceMoveMul = 1.0;
    let surfaceFriction = FRICTION;
    if (currentSurface === 'sticky') { surfaceMoveMul = 0.6; surfaceFriction = 0.6; }
    else if (currentSurface === 'ice') { surfaceMoveMul = 1.0; surfaceFriction = 0.98; }
    const effMove = MOVE * surfaceMoveMul;

    // Title controls: use A/D for left/right, W for jump (avoid Space/Arrows which drive the menu)
    const left = keys.has('a') || keys.has('A');
    const right = keys.has('d') || keys.has('D');
    const jump = keys.has('w') || keys.has('W');
    const jumpPressed = jump && !prevJumpKey;

    if (left) player.vx -= effMove; if (right) player.vx += effMove;
    player.vx = Math.max(Math.min(player.vx, effMax), -effMax);

    // Gravity and wall slide
    player.vy += effGravity;
    const holdingTowardWall = (player.wallSide === -1 && left) || (player.wallSide === 1 && right);
    const wantSlide = player.wallIsSticky || holdingTowardWall;
    const slideCap = player.wallIsSticky ? WALL_SLIDE_MAX_FALL_STICKY : WALL_SLIDE_MAX_FALL;
    if (!player.onGround && (player.isTouchingWall || wallCoyoteFrames > 0) && wantSlide && wallLockFrames === 0 && player.vy > slideCap) {
      player.vy = slideCap;
    }

    // X
    player.x += player.vx;
    collideAxis('x');
    // Y
    const wasOnGround = player.onGround;
    player.y += player.vy;
    player.onGround = false;
    collideAxis('y');

    // Touch wall pass
    if (!player.onGround && wallLockFrames === 0) {
      const platsTouch = getPlatforms();
      for (const p of platsTouch) {
        const vertOverlap = (player.y < p.y + p.h) && (player.y + player.h > p.y);
        if (!vertOverlap) continue;
        const touchRight = Math.abs((player.x + player.w) - p.x) <= 0.6;
        const touchLeft = Math.abs(player.x - (p.x + p.w)) <= 0.6;
        if (touchRight || touchLeft) {
          player.wallSide = touchRight ? +1 : -1;
          player.isTouchingWall = true;
          player.wallIsSticky = ((p.t || 'normal') === 'sticky');
          touchedWallThisFrame = true;
          break;
        }
      }
    }

    // Coyote + jump buffer
    if (player.onGround) { coyoteFrames = 8; }
    else if (coyoteFrames > 0) { coyoteFrames -= 1; }

    if (jumpPressed && (player.onGround || coyoteFrames > 0)) {
      player.vy = JUMP_V;
      player.onGround = false;
      coyoteFrames = 0;
      jumpedThisFrame = true;
    }
    // Wall jump
    if (jumpPressed && !player.onGround && !jumpedThisFrame && (player.isTouchingWall || wallCoyoteFrames > 0)) {
      const side = player.wallSide || 0;
      if (side !== 0) player.vx = -side * WALL_JUMP_PUSH_X;
      player.vy = WALL_JUMP_PUSH_Y;
      wallLockFrames = WALL_LOCK_FRAMES;
      jumpedThisFrame = true;
      const baseX = player.x + (side > 0 ? player.w : 0);
      const baseY = player.y + player.h - 2;
      for (let i = 0; i < 4; i++) {
        const ang = Math.random() * Math.PI - Math.PI/2;
        const spd = 1 + Math.random() * 1.2;
        fxPuffs.push({ x: baseX, y: baseY, vx: Math.cos(ang) * spd * (side>0?-1:1), vy: Math.sin(ang) * spd, born: performance.now(), life: 220, r: 2.5 + Math.random()*1.5 });
      }
    }

    // Wall coyote bookkeeping
    if (player.onGround) { wallCoyoteFrames = 0; player.isTouchingWall = false; player.wallIsSticky = false; }
    else if (touchedWallThisFrame) { player.isTouchingWall = true; wallCoyoteFrames = 8; }
    else if (wallCoyoteFrames > 0) { player.isTouchingWall = false; wallCoyoteFrames -= 1; }
    else { player.isTouchingWall = false; player.wallIsSticky = false; }

    // Ground friction
    if (!left && !right && player.onGround) {
      player.vx *= surfaceFriction;
      if (Math.abs(player.vx) < 0.05) player.vx = 0;
    }

    // Keep within screen horizontally and above top
    if (player.x < 0) { player.x = 0; player.vx = 0; }
    if (player.x + player.w > W) { player.x = W - player.w; player.vx = 0; }
    if (player.y < 0) { player.y = 0; player.vy = 0; }
    // If fell, reset demo
    if (player.y > H + 80) { setupTitleDemo(); }

    prevJumpKey = jump;
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

    // (removed) Quick Walls mode advance on key '2'

    // Quick jump to Level 17 (index 16) in Normal mode
    if (e.key === '1') {
      // From title: force Normal mode and jump directly
      if (onTitle) {
        selectedModeIndex = 0; modeSel = 0;
        if (typeof window !== 'undefined') window.selectedModeIndex = selectedModeIndex;
        startLevel(16);
        onTitle = false;
        return;
      }
      // In-game: only if not using Infinite and shop closed
      if (!usingInfinite() && !shopOpen) {
        startLevel(16);
      }
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
    const TAB_COUNT = 2;
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
    if (usingInfinite()) startInfinite();
    else if (usingInfiniteWalls()) startInfiniteWalls();
    else startLevel(0);
  }
  addEventListener('keyup', (e) => keys.delete(e.key));

  // Entities
  const player = {
    x: 50, y: 0, w: 28, h: 38,
    vx: 0, vy: 0,
    onGround: false,
    color: '#7cf7a7',
    isTouchingWall: false,
    wallSide: 0, // -1 left, +1 right
    wallIsSticky: false,
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

  // Rendering helpers are now provided by rendering.js (makePlatformPattern, drawSkyBackground,
  // drawPlatformTextured, drawGoalPretty, roundRect, drawPlayer)

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

  // Walls Mode Levels: wall-centric layouts for practicing wall jumps/slides
  /** @type {{spawn:{x:number,y:number}, goal:{x:number,y:number,w:number,h:number}, platforms:{x:number,y:number,w:number,h:number,t?:string}[], coins:{x:number,y:number,r:number}[]}[]} */
  const WALL_LEVELS = [
    // W1
    {
      spawn: { x: 60, y: 360 },
      goal:  { x: 740, y: 120, w: 40, h: 50 },
      platforms: [
        { x: 0, y: 420, w: 800, h: 30, t: 'normal' },
        { x: 220, y: 360, w: 100, h: 14, t: 'normal' },
        { x: 380, y: 240, w: 20,  h: 200, t: 'normal' },
        { x: 520, y: 220, w: 20,  h: 200, t: 'normal' },
        { x: 660, y: 260, w: 100, h: 14, t: 'normal' },
      ],
      coins: [ {x: 400, y: 200, r: 10}, {x: 500, y: 200, r: 10}, {x: 720, y: 230, r: 10} ],
    },
    // W2
    {
      spawn: { x: 40, y: 360 },
      goal:  { x: 760, y: 180, w: 40, h: 50 },
      platforms: [
        { x: 0, y: 420, w: 800, h: 30, t: 'normal' },
        { x: 260, y: 220, w: 20,  h: 220, t: 'normal' },
        { x: 320, y: 260, w: 20,  h: 180, t: 'normal' },
        { x: 380, y: 300, w: 20,  h: 140, t: 'normal' },
        { x: 520, y: 300, w: 20,  h: 140, t: 'normal' },
        { x: 580, y: 260, w: 20,  h: 180, t: 'normal' },
        { x: 640, y: 220, w: 20,  h: 220, t: 'normal' },
      ],
      coins: [ {x: 300, y: 200, r: 10}, {x: 420, y: 260, r: 10}, {x: 560, y: 260, r: 10}, {x: 700, y: 200, r: 10} ],
    },
    // W3
    {
      spawn: { x: 60, y: 320 },
      goal:  { x: 740, y: 140, w: 40, h: 50 },
      platforms: [
        { x: 0, y: 420, w: 800, h: 30, t: 'normal' },
        { x: 200, y: 360, w: 90,  h: 16, t: 'normal' },
        { x: 340, y: 220, w: 20,  h: 220, t: 'normal' },
        { x: 440, y: 200, w: 20,  h: 240, t: 'normal' },
        { x: 540, y: 220, w: 20,  h: 220, t: 'normal' },
        { x: 660, y: 260, w: 120, h: 16, t: 'normal' },
      ],
      coins: [ {x: 360, y: 200, r: 10}, {x: 460, y: 190, r: 10}, {x: 560, y: 200, r: 10}, {x: 700, y: 240, r: 10} ],
    },
    // W4 (Sticky walls focus)
    {
      spawn: { x: 60, y: 340 },
      goal:  { x: 740, y: 140, w: 40, h: 50 },
      platforms: [
        { x: 0,   y: 420, w: 800, h: 30, t: 'normal' },
        { x: 200, y: 360, w: 100, h: 16, t: 'normal' },
        { x: 340, y: 200, w: 22,  h: 240, t: 'sticky' },
        { x: 480, y: 220, w: 22,  h: 220, t: 'sticky' },
        { x: 620, y: 260, w: 110, h: 16, t: 'normal' },
      ],
      coins: [ {x: 360, y: 180, r: 10}, {x: 500, y: 200, r: 10}, {x: 660, y: 240, r: 10} ],
    },
    // W5 (Alternating sticky/non-sticky ladder)
    {
      spawn: { x: 60, y: 340 },
      goal:  { x: 740, y: 140, w: 40, h: 50 },
      platforms: [
        { x: 0,   y: 420, w: 800, h: 30, t: 'normal' },
        { x: 100, y: 360, w: 80,  h: 14, t: 'normal' },
        { x: 240, y: 220, w: 18,  h: 220, t: 'sticky' },
        { x: 300, y: 260, w: 18,  h: 180, t: 'normal' },
        { x: 360, y: 300, w: 18,  h: 140, t: 'sticky' },
        { x: 420, y: 300, w: 18,  h: 140, t: 'normal' },
        { x: 480, y: 260, w: 18,  h: 180, t: 'sticky' },
        { x: 540, y: 220, w: 18,  h: 220, t: 'normal' },
        { x: 660, y: 260, w: 110, h: 16, t: 'normal' },
      ],
      coins: [ {x: 260, y: 190, r: 10}, {x: 380, y: 260, r: 10}, {x: 500, y: 240, r: 10}, {x: 700, y: 240, r: 10} ],
    },
    // W6 (Sticky chute and ledges)
    {
      spawn: { x: 80, y: 160 },
      goal:  { x: 740, y: 300, w: 40, h: 50 },
      platforms: [
        { x: 0,   y: 420, w: 800, h: 30, t: 'normal' },
        { x: 120, y: 200, w: 90,  h: 14,  t: 'normal' },
        { x: 260, y: 100, w: 20,  h: 260, t: 'sticky' },
        { x: 320, y: 120, w: 20,  h: 240, t: 'sticky' },
        { x: 380, y: 160, w: 20,  h: 200, t: 'sticky' },
        { x: 500, y: 340, w: 120, h: 16, t: 'normal' },
        { x: 650, y: 300, w: 120, h: 16, t: 'normal' },
      ],
      coins: [ {x: 140, y: 180, r: 10}, {x: 280, y: 90, r: 10}, {x: 340, y: 110, r: 10}, {x: 400, y: 150, r: 10}, {x: 560, y: 320, r: 10} ],
    },
    // W7 (Sticky twin columns with gaps)
    {
      spawn: { x: 60, y: 340 },
      goal:  { x: 740, y: 180, w: 40, h: 50 },
      platforms: [
        { x: 0,   y: 420, w: 800, h: 30, t: 'normal' },
        { x: 140, y: 360, w: 100, h: 14, t: 'normal' },
        { x: 360, y: 180, w: 22,  h: 240, t: 'sticky' },
        { x: 500, y: 200, w: 22,  h: 220, t: 'sticky' },
        { x: 300, y: 280, w: 80,  h: 14,  t: 'normal' },
        { x: 560, y: 260, w: 80,  h: 14,  t: 'normal' },
        { x: 660, y: 220, w: 110, h: 16, t: 'normal' },
      ],
      coins: [ {x: 200, y: 340, r: 10}, {x: 380, y: 160, r: 10}, {x: 520, y: 160, r: 10}, {x: 690, y: 200, r: 10} ],
    },
  ];

  // After LEVELS is defined, expose getter for static levels
  // Normal mode now uses an interleaving of LEVELS and WALL_LEVELS by default.
  function getLevels() {
    const A = LEVELS;
    const B = WALL_LEVELS;
    const out = [];
    const max = Math.max(A.length, B.length);
    for (let i = 0; i < max; i++) {
      if (i < A.length) out.push(A[i]);
      if (i < B.length) out.push(B[i]);
    }
    return out;
  }

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
  // Infinite Walls (vertical) state
  let infWallsPlatforms = [];
  let infWallsSpawnY = 0; // highest generated Y (can go negative as we go up)
  let wallsLastPlatY = 0;
  let wallsLastPlatX = 0;
  const INF_WALLS_CHUNK_H = 220;
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
  let airJumpsLeft = 0;
  let jumpedThisFrame = false;
  let touchedWallThisFrame = false;
  let wallLockFrames = 0;
  let fxPuffs = [];

  // Title screen demo state (small playground to test wall jumps)
  let titlePlatforms = [];
  function setupTitleDemo() {
    // Simple floor and two vertical walls to practice wall slides/jumps
    titlePlatforms = [
      { x: 0, y: 420, w: 800, h: 30, t: 'normal' },
      { x: 360, y: 200, w: 20,  h: 200, t: 'normal' },
      { x: 460, y: 200, w: 20,  h: 200, t: 'sticky' },
      { x: 240, y: 340, w: 80,  h: 16,  t: 'normal' },
      { x: 540, y: 320, w: 100, h: 16,  t: 'ice' },
    ];
    // Place player between the walls
    player.x = 400 - player.w/2;
    player.y = 180;
    player.vx = 0; player.vy = 0;
    player.onGround = false;
    player.isTouchingWall = false;
    player.wallSide = 0;
    player.wallIsSticky = false;
    cameraX = 0;
    coyoteFrames = 0; jumpBufferFrames = 0; wallCoyoteFrames = 0; wallLockFrames = 0;
  }

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
  function usingInfiniteWalls() { return selectedModeIndex === 2; }

  // For rendering/collisions, get platforms list for current mode
  function getPlatforms() {
    if (onTitle) return titlePlatforms;
    let base;
    if (usingInfinite()) base = infPlatforms;
    else if (usingInfiniteWalls()) base = infWallsPlatforms;
    else base = getLevels()[levelIndex].platforms;
    return base.concat(builderBlocks);
  }
  function getGoal() {
    if (onTitle || usingInfinite() || usingInfiniteWalls()) return null;
    return getLevels()[levelIndex].goal;
  }
  let selectedSkinIndex = 0;

  // difficulty removed

  // Modes (Walls and Mixed removed; Normal now uses interleaved levels by default)
  const modes = [
    { name: 'Normal' },
    { name: 'Infinite' },
    { name: 'Infinite Walls' },
  ];
  let selectedModeIndex = 0; // Normal by default

  // Expose to window for shop helpers outside the IIFE
  if (typeof window !== 'undefined') {
    window.skins = skins;
    window.modes = modes;
    window.selectedSkinIndex = selectedSkinIndex;
    window.selectedModeIndex = selectedModeIndex;
    window.coinsCollected = coinsCollected;
    window.shopTab = shopTab;
    window.skinSel = skinSel;
    window.modeSel = modeSel;
  }

  // Levels
  // y=0 is top; y increases downward
  /** @type {{spawn:{x:number,y:number}, goal:{x:number,y:number,w:number,h:number}, platforms:{x:number,y:number,w:number,h:number,t?:'normal'|'sticky'|'ice'|'death'|'start'}[], coins:{x:number,y:number,r:number}[]}[]} */
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
    {
      spawn: {x: 60, y: 360},
      goal:  {x: 740, y: 120, w: 40, h: 50},
      platforms: [
        {x: 0, y: 420, w: 800, h: 30, t: 'normal'},
        {x: 220, y: 360, w: 100, h: 14, t: 'normal'},
        {x: 340, y: 350, w: 40,  h: 12, t: 'normal'},
        {x: 560, y: 300, w: 40,  h: 12, t: 'normal'},
        {x: 380, y: 220, w: 20,  h: 200, t: 'normal'},
        {x: 520, y: 220, w: 20,  h: 200, t: 'normal'},
        {x: 660, y: 260, w: 100, h: 14, t: 'normal'}
      ],
      coins: [
        {x: 400, y: 200, r: 10},
        {x: 500, y: 200, r: 10},
        {x: 420, y: 260, r: 10},
        {x: 480, y: 260, r: 10},
        {x: 720, y: 230, r: 10}
      ]
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
    // Mostly 0 or 1 power-up; rarely 2
    const roll = Math.random();
    const count = roll < 0.55 ? 1 : (roll < 0.90 ? 0 : 2);
    const types = ['speed','superjump','builder','life'];
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
    const levelsNow = getLevels();
    if (!levelsNow || levelsNow.length === 0) return;
    if (typeof i !== 'number' || i < 0 || i >= levelsNow.length) i = 0;
    levelIndex = i;
    const L = levelsNow[levelIndex];
    player.x = L.spawn.x; player.y = L.spawn.y; player.vx = 0; player.vy = 0;
    won = false;
    player.onGround = false;
    // reset temporary boosts
    speedUntil = 0; superjumpUntil = 0;
    airJumpsLeft = (skins[selectedSkinIndex]?.key === 'penguin') ? 1 : 0;
    levelStartAt = performance.now();
    // Recompute total coins for current mode and fill runtime coins list
    totalCoins = levelsNow.reduce((sum, L2) => sum + (L2.coins?.length || 0), 0);
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
    
    infPlatforms = [];
    infCoins = [];
    infSpawnX = 0;
    infPlatforms.push({ x: -200, y: 420, w: 1200, h: 30, t: 'normal' });
    const sX = 20, sY = 320, sW = 120;
    infPlatforms.push({ x: sX, y: sY, w: sW, h: INF_PLATFORM_HEIGHT, t: 'start' });
    player.x = sX + 10; player.y = sY - player.h - 1;
    infSpawnX = 0;
    lastPlatX = sX; lastPlatY = sY; lastPlatW = sW;
    
    while (infSpawnX < 1000) generateInfiniteChunk();
    infPowerups = [];
    builderBlocks = [];
    builderCharges = 0;
    infEnemies = [];
    speedUntil = 0; superjumpUntil = 0;
    airJumpsLeft = (skins[selectedSkinIndex]?.key === 'penguin') ? 1 : 0;
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
    if (Math.random() < 0.3) platW = Math.min(160, platW + 20);
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
    const maxHorizGap = 130;
    const minHorizGap = 90;
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
      px = Math.min(endX - platW - 20, lastPlatX + Math.round(randBetween(minHorizGap, maxHorizGap)));
      platY = Math.max(INF_PLATFORM_MIN_Y, Math.min(INF_PLATFORM_MAX_Y, lastPlatY));
    }
    function okPlace(ax, ay, aw, ah) {
      const margin = 6;
      const bx = ax - margin, by = ay - margin, bw = aw + margin*2, bh = ah + margin*2;
      for (let i = Math.max(0, infPlatforms.length - 300); i < infPlatforms.length; i++) {
        const p = infPlatforms[i];
        if (aabb(bx, by, bw, bh, p.x, p.y, p.w, p.h)) return false;
        const horizOverlap = !(ax + aw + margin <= p.x || ax - margin >= p.x + p.w);
        if (horizOverlap) {
          const minClear = 12;
          if (!(ay + ah + minClear <= p.y || ay >= p.y + p.h + minClear)) return false;
        }
      }
      return true;
    }
    function addPlat(ax, ay, aw, at, primary=false) {
      if (ax < startX + 20 || ax + aw > endX - 10) return false;
      ay = Math.max(INF_PLATFORM_MIN_Y, Math.min(INF_PLATFORM_MAX_Y, ay));
      if (!okPlace(ax, ay, Math.round(aw), INF_PLATFORM_HEIGHT)) return false;
      infPlatforms.push({ x: Math.round(ax), y: Math.round(ay), w: Math.round(aw), h: INF_PLATFORM_HEIGHT, t: at });
      const cN = Math.max(1, Math.min(3, Math.floor(aw / 50)));
      if (Math.random() < INF_COIN_EMIT_CHANCE) {
        for (let i=0;i<cN;i++) {
          const cx = ax + (i+1) * (aw/(cN+1));
          const cy = ay - 24 - Math.random()*10;
          infCoins.push({ x: Math.round(cx), y: Math.round(cy), r: 10, taken: false, float: Math.random()*Math.PI*2 });
        }
      }
      if (primary) { lastPlatX = Math.round(ax); lastPlatY = Math.round(ay); lastPlatW = Math.round(aw); }
      return true;
    }

    // Try emitting a pattern for variety
    let emitted = false;
    let placedPrimary = false;
    const canFit = (px + platW + 40) <= (endX - 10);
    const rPat = Math.random();
    if (!emitted && canFit && rPat < 0.28) {
      // Stairs (up or down), 3-4 steps
      const dir = Math.random() < 0.5 ? -1 : 1; // -1 up, 1 down (screen y grows downward)
      const steps = Math.random() < 0.5 ? 3 : 4;
      const stepDx = minHorizGap, stepDy = 18 * dir;
      let sx = px, sy = platY;
      const maxSteps = 2;
      for (let k=0;k<maxSteps;k++) {
        const w = Math.max(60, platW - k*10);
        const tLocal = (Math.random() < 0.5) ? type : choice(['normal','ice','sticky']);
        if (!addPlat(sx, sy, w, tLocal, k===0)) { emitted = false; break; } else { emitted = true; if (k===0) placedPrimary = true; }
        sx += stepDx; sy += stepDy;
      }
    }
    if (!emitted && canFit && rPat >= 0.28 && rPat < 0.55) {
      // Double platform (neighbor at small vertical offset)
      const t1 = type; const t2 = choice(['normal','ice','sticky']);
      const ok1 = addPlat(px, platY, platW, t1, true); if (ok1) placedPrimary = true;
      const ok2 = ok1 && addPlat(px + Math.round(randBetween(minHorizGap, maxHorizGap)), platY + (Math.random()<0.5?18:-18), Math.max(60, platW - 20), t2, false);
      emitted = ok1 && ok2;
    }
    if (!emitted && rPat >= 0.55 && rPat < 0.75) {
      // Mini pillar above
      const okp = addPlat(px, platY, platW, type, true); if (okp) placedPrimary = true; emitted = okp;
      if (emitted) {
        const miniW = 50;
        addPlat(px + platW*0.5 - miniW*0.5, platY - 60, miniW, choice(['normal','ice']), false);
      }
    }
    if (!emitted) {
      // Single fallback
      const okp2 = addPlat(px, platY, platW, type, true); if (okp2) placedPrimary = true;
    }
    if (Math.random() < 0.95) {
      const dx2 = Math.round(randBetween(minHorizGap, maxHorizGap));
      const px2 = px + dx2;
      const w2 = Math.max(60, Math.min(100, platW - 10));
      const y2 = platY + (Math.random() < 0.5 ? 18 : -18);
      addPlat(px2, y2, w2, choice(['normal','ice','sticky']), false);
    }
    if (Math.random() < 0.8) {
      const dx2b = Math.round(randBetween(minHorizGap, maxHorizGap));
      const px2b = px + dx2b + 20;
      const w2b = 60;
      const y2b = platY + (Math.random() < 0.5 ? 24 : -24);
      addPlat(px2b, y2b, w2b, choice(['normal','ice','sticky']), false);
    }
    if (Math.random() < 0.85) {
      const dx3 = Math.round(randBetween(minHorizGap, maxHorizGap));
      const px3 = px + dx3;
      const w3 = 50;
      const y3 = platY + (Math.random() < 0.5 ? 36 : -36);
      addPlat(px3, y3, w3, choice(['normal','ice']), false);
    }
    for (let extra = 0; extra < 3; extra++) {
      const ex = Math.min(endX - 100, Math.max(startX + 40, px + Math.round(randBetween(minHorizGap, maxHorizGap))));
      const ew = choice([50, 60, 70]);
      const ey = Math.round(Math.max(INF_PLATFORM_MIN_Y, Math.min(INF_PLATFORM_MAX_Y, platY + randBetween(-maxVertDelta, maxVertDelta))));
      addPlat(ex, ey, ew, choice(['normal','ice','sticky']), false);
    }
    // If no primary platform was placed due to overlaps, force a reachable placement with several attempts
    if (!placedPrimary) {
      for (let tries=0; tries<8 && !placedPrimary; tries++) {
        const pxf = Math.min(endX - platW - 20, Math.max(startX + 40, lastPlatX + Math.round(randBetween(minHorizGap, maxHorizGap))));
        // scan multiple Y candidates to avoid vertical stacking in same column
        for (let yi=0; yi<6 && !placedPrimary; yi++) {
          let pyf = Math.round(lastPlatY + randBetween(-maxVertDelta, maxVertDelta));
          pyf = Math.max(INF_PLATFORM_MIN_Y, Math.min(INF_PLATFORM_MAX_Y, pyf));
          if (addPlat(pxf, pyf, platW, type, true)) { placedPrimary = true; break; }
        }
      }
    }
    infSpawnX = endX;
    // occasionally spawn a powerup (less common, decreases with progress)
    if (Math.random() < Math.max(INF_POWERUP_CHANCE_BASE, 0.20 - INF_POWERUP_CHANCE_SLOPE * prog)) {
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
    jumpedThisFrame = false;
    touchedWallThisFrame = false;
    player.isTouchingWall = false;
    // do not reset wallIsSticky here to preserve coyote behavior; reset when grounded or after coyote ends
    if (wallLockFrames > 0) wallLockFrames -= 1;
    // Effective physics (difficulty removed)
    const effGravity = GRAVITY;
    const effMax = MAX_SPEED;
    const effJump = JUMP_V;
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
    const effMove = MOVE * surfaceMoveMul * speedBoost;
    // Input horizontal
    const left = keys.has('ArrowLeft') || keys.has('a') || keys.has('A');
    const right = keys.has('ArrowRight') || keys.has('d') || keys.has('D');
    const jump = keys.has('ArrowUp') || keys.has('w') || keys.has('W') || keys.has(' ');
    const jumpPressed = jump && !prevJumpKey;

    if (left) player.vx -= effMove; if (right) player.vx += effMove;
    player.vx = Math.max(Math.min(player.vx, effMax), -effMax);

    // Gravity
    player.vy += effGravity;
    // Wall slide: reduce falling speed. Sticky walls slide even without holding.
    const holdingTowardWall = (player.wallSide === -1 && left) || (player.wallSide === 1 && right);
    const wantSlide = player.wallIsSticky || holdingTowardWall;
    const slideCap = player.wallIsSticky ? WALL_SLIDE_MAX_FALL_STICKY : WALL_SLIDE_MAX_FALL;
    if (!player.onGround && (player.isTouchingWall || wallCoyoteFrames > 0) && wantSlide && wallLockFrames === 0 && player.vy > slideCap) {
      player.vy = slideCap;
    }

    // Apply X movement and resolve collisions on X
    player.x += player.vx;
    collideAxis('x');

    // Apply Y movement and resolve collisions on Y
    const wasOnGround = player.onGround;
    player.y += player.vy;
    player.onGround = false;
    collideAxis('y');

    // Post-collision wall contact detection based on hitbox touching
    if (!player.onGround && wallLockFrames === 0) {
      const platsTouch = getPlatforms();
      let foundWallTouch = false;
      for (const p of platsTouch) {
        // vertical overlap required
        const vertOverlap = (player.y < p.y + p.h) && (player.y + player.h > p.y);
        if (!vertOverlap) continue;
        // touching right side of player to left side of platform
        const touchRight = Math.abs((player.x + player.w) - p.x) <= 0.6;
        // touching left side of player to right side of platform
        const touchLeft = Math.abs(player.x - (p.x + p.w)) <= 0.6;
        if (touchRight || touchLeft) {
          player.wallSide = touchRight ? +1 : -1;
          player.isTouchingWall = true;
          player.wallIsSticky = ((p.t || 'normal') === 'sticky');
          touchedWallThisFrame = true;
          foundWallTouch = true;
          break;
        }
      }
      if (!foundWallTouch && !touchedWallThisFrame) {
        // do not force false here; coyote and previous collisions manage state
      }
    }

    // Camera follow in infinite
    if (usingInfinite()) {
      cameraX = Math.max(0, player.x - 200);
      // Spawn more ahead
      while (infSpawnX < cameraX + 1000) generateInfiniteChunk();
      const cullX = cameraX - 500;
      if (infPlatforms.length > 0) infPlatforms = infPlatforms.filter(p => (p.x + p.w) > cullX);
      if (infCoins.length > 0) infCoins = infCoins.filter(c => (c.x > cullX) && !c.taken);
      if (infPowerups.length > 0) infPowerups = infPowerups.filter(pu => (pu.x > cullX) && !pu.taken);
      if (infEnemies.length > 0) infEnemies = infEnemies.filter(e => (e.x || 0) > cullX - 100);
    } else if (usingInfiniteWalls()) {
      // Vertical camera: allow negative cameraY so we can scroll up beyond 0
      if (typeof cameraY !== 'number') cameraY = 0;
      const targetY = player.y - 220; // keep player slightly above center
      cameraY = Math.min(cameraY, targetY);
      // Spawn more above
      while (infWallsSpawnY > cameraY - 600) generateInfiniteWallsChunk();
      // Cull below camera
      const cullY = cameraY + H + 500;
      infWallsPlatforms = infWallsPlatforms.filter(p => (p.y) <= cullY);
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
      jumpedThisFrame = true;
    }
    // Wall jump (takes priority over air jump). Requires recent wall contact.
    if (jumpPressed && !player.onGround && !jumpedThisFrame && (player.isTouchingWall || wallCoyoteFrames > 0)) {
      // Push away from wall and upwards
      const side = player.wallSide || 0;
      if (side !== 0) {
        player.vx = -side * WALL_JUMP_PUSH_X;
      }
      player.vy = WALL_JUMP_PUSH_Y * jumpBoost;
      wallLockFrames = WALL_LOCK_FRAMES;
      jumpBufferFrames = 0;
      jumpedThisFrame = true;
      // FX: spawn dust puffs
      const baseX = player.x + (side > 0 ? player.w : 0);
      const baseY = player.y + player.h - 2;
      for (let i = 0; i < 6; i++) {
        const ang = Math.random() * Math.PI - Math.PI/2;
        const spd = 1 + Math.random() * 1.5;
        fxPuffs.push({ x: baseX, y: baseY, vx: Math.cos(ang) * spd * (side>0?-1:1), vy: Math.sin(ang) * spd, born: performance.now(), life: 260, r: 3 + Math.random()*2 });
      }
    }
    if (jumpPressed && !player.onGround && !jumpedThisFrame && airJumpsLeft > 0) {
      player.vy = effJump * jumpBoost;
      airJumpsLeft -= 1;
      jumpBufferFrames = 0;
      jumpedThisFrame = true;
    }

    // Wall coyote logic (short grace window to recognize recent wall contact)
    if (player.onGround) {
      wallCoyoteFrames = 0;
      player.isTouchingWall = false;
      player.wallIsSticky = false;
    } else {
      if (touchedWallThisFrame) {
        player.isTouchingWall = true;
        wallCoyoteFrames = 8;
      } else if (wallCoyoteFrames > 0) {
        player.isTouchingWall = false; // still allow slide via coyote; wallIsSticky preserved
        wallCoyoteFrames -= 1;
      } else {
        player.isTouchingWall = false;
        player.wallIsSticky = false;
      }
    }

    // Friction when on ground and no input
    if (!left && !right && player.onGround) {
      player.vx *= surfaceFriction;
      if (Math.abs(player.vx) < 0.05) player.vx = 0;
    }
    if (player.onGround && !wasOnGround) {
      airJumpsLeft = (skins[selectedSkinIndex]?.key === 'penguin') ? 1 : 0;
    }

    // Floor death (fell)
    if (usingInfiniteWalls()) {
      if (player.y > cameraY + H + 100) {
        lives -= 1;
        if (lives <= 0) { lives = 3; startInfiniteWalls(); }
        else { startInfiniteWalls(); }
        return;
      }
    } else if (player.y > H + 100) {
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
        else if (p.type === 'life') { lives += 1; }
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
        if (enemyActive && circleRectIntersect(e.x, e.y, er, player.x, player.y, player.w, player.h)) {
          // Stomp check: falling and player's bottom above enemy center
          const canStomp = player.vy > 1.0 && (player.y + player.h) <= (e.y + 4);
          if (canStomp) {
            e.dead = true;
            player.vy = JUMP_V * 0.7; // bounce
            jumpedThisFrame = true;
          } else {
            diedThisFrame = true;
          }
        }
      } else if (e.type === 'rhino') {
        e.x += e.dir * e.speed * 2.0;
        if (e.x < e.minX) { e.x = e.minX; e.dir = 1; }
        if (e.x > e.maxX) { e.x = e.maxX; e.dir = -1; }
        if (enemyActive && aabb(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h)) {
          // Stomp check: falling and contacting top surface region
          const onTop = (player.y + player.h) <= (e.y + 6) && player.vy > 1.0;
          if (onTop) {
            e.dead = true;
            player.y = e.y - player.h; // place on top to avoid sticky overlap
            player.vy = JUMP_V * 0.7;
            jumpedThisFrame = true;
          } else {
            diedThisFrame = true;
          }
        }
      }
    }
    // Remove defeated enemies
    if (usingInfinite()) infEnemies = infEnemies.filter(e => !e.dead);
    else levelEnemies = levelEnemies.filter(e => !e.dead);

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
          // Detect wall contact on X collisions
          if (!player.onGround && wallLockFrames === 0) {
            if (player.vx > 0) { player.wallSide = +1; }
            else if (player.vx < 0) { player.wallSide = -1; }
            player.wallIsSticky = ((p.t || 'normal') === 'sticky');
            touchedWallThisFrame = true;
          }
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
      if (!usingInfiniteWalls() && player.y < 0) { player.y = 0; player.vy = 0; }
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
      // Draw title playground platforms
      for (const p of getPlatforms()) {
        drawPlatformTextured(ctx, p, 0);
        if ((p.t||'normal') === 'death') {
          const x = Math.round(p.x), y = Math.round(p.y), w = p.w, h = p.h;
          ctx.fillStyle = 'rgba(255,80,80,0.35)';
          ctx.fillRect(x, y, w, h);
        }
      }
      // Player
      window.CURRENT_SKIN = skins[selectedSkinIndex];
      drawPlayer(Math.round(player.x), Math.round(player.y));
      // Overlay UI
      drawStartScreen();
      return;
    }

    // Platforms (with vertical translate for Infinite Walls)
    if (usingInfiniteWalls()) ctx.save(), ctx.translate(0, -cameraY);
    for (const p of getPlatforms()) {
      const drawCamX = usingInfinite() ? cameraX : 0;
      drawPlatformTextured(ctx, p, drawCamX);
      if ((p.t||'normal') === 'death') {
        const x = Math.round(p.x - drawCamX), y = Math.round(p.y), w = p.w, h = p.h;
        ctx.fillStyle = 'rgba(255,80,80,0.35)'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        for (let i=0;i<w;i+=12) { ctx.beginPath(); ctx.arc(x + i + 6, y + 6, 3, 0, Math.PI*2); ctx.fill(); }
      }
    }
    if (usingInfiniteWalls()) ctx.restore();

    // Coins
    const t = performance.now() / 1000;
    const coinsListR = usingInfinite() ? infCoins : (usingInfiniteWalls() ? [] : levelCoins);
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

    // Power-ups (distinct from coins)
    const pListR = usingInfinite() ? infPowerups : (usingInfiniteWalls() ? [] : levelPowerups);
    for (const p of pListR) {
      if (p.taken) continue;
      const px = Math.round(p.x - cameraX);
      const py = Math.round(p.y);
      const r = p.r || 12;
      // backdrop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.arc(px + 2, py + 2, r + 2, 0, Math.PI*2); ctx.fill();
      // body color by type
      let body = '#888';
      if (p.type === 'speed') body = '#4cc9f0';
      else if (p.type === 'superjump') body = '#90be6d';
      else if (p.type === 'builder') body = '#f4a261';
      else if (p.type === 'life') body = '#e63946';
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2); ctx.fill();
      // simple icon overlay
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      if (p.type === 'speed') {
        // lightning bolt
        ctx.beginPath(); ctx.moveTo(px-3,py-6); ctx.lineTo(px+1,py-2); ctx.lineTo(px-1,py-2); ctx.lineTo(px+3,py+6); ctx.stroke();
      } else if (p.type === 'superjump') {
        // up arrow
        ctx.beginPath(); ctx.moveTo(px,py-6); ctx.lineTo(px,py+6); ctx.moveTo(px-4,py-2); ctx.lineTo(px,py-6); ctx.lineTo(px+4,py-2); ctx.stroke();
      } else if (p.type === 'builder') {
        // small wrench-like mark
        ctx.beginPath(); ctx.arc(px-2, py-1, 2, 0, Math.PI*2); ctx.moveTo(px-1,py); ctx.lineTo(px+4,py+4); ctx.stroke();
      } else if (p.type === 'life') {
        // heart
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.moveTo(px, py+2);
        ctx.bezierCurveTo(px-6, py-4, px-6, py+5, px, py+8);
        ctx.bezierCurveTo(px+6, py+5, px+6, py-4, px, py+2);
        ctx.fill();
      }
      // outline
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2); ctx.stroke();
    }

    // Enemies (visible)
    const enemiesR = usingInfinite() ? infEnemies : (usingInfiniteWalls() ? [] : levelEnemies);
    for (const e of enemiesR) {
      const ex = Math.round(e.x - cameraX);
      const ey = Math.round(e.y);
      if (ex < -100 || ex > W + 100 || ey < -100 || ey > H + 100) continue;
      if (e.type === 'gnat') {
        const tnow = performance.now();
        const r = (e.r || 8) + 4;
        const flap = Math.sin(tnow/110) * 6;
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(ex + 2, ey + 4, r + 2, r, 0, 0, Math.PI*2); ctx.fill();
        const bodyGrad = ctx.createRadialGradient(ex-3, ey-3, 2, ex, ey, r);
        bodyGrad.addColorStop(0, '#4a4e69'); bodyGrad.addColorStop(1, '#22223b');
        ctx.fillStyle = bodyGrad; ctx.beginPath(); ctx.ellipse(ex, ey, r, r*0.9, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(ex-6,ey-4); ctx.lineTo(ex-2,ey-10); ctx.lineTo(ex+2,ey-10); ctx.lineTo(ex+6,ey-4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2d3142'; ctx.beginPath(); ctx.moveTo(ex-10,ey-2); ctx.bezierCurveTo(ex-18,ey-8-flap, ex-20,ey+2, ex-8,ey+4); ctx.lineTo(ex-2,ey); ctx.fill();
        ctx.beginPath(); ctx.moveTo(ex+10,ey-2); ctx.bezierCurveTo(ex+18,ey-8+flap, ex+20,ey+2, ex+8,ey+4); ctx.lineTo(ex+2,ey); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex-3, ey-1, 2, 0, Math.PI*2); ctx.arc(ex+3, ey-1, 2, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ex-3, ey-1, 1, 0, Math.PI*2); ctx.arc(ex+3, ey-1, 1, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f1faee'; ctx.beginPath(); ctx.moveTo(ex-1,ey+3); ctx.lineTo(ex-3,ey+6); ctx.lineTo(ex,ey+5); ctx.moveTo(ex+1,ey+3); ctx.lineTo(ex+3,ey+6); ctx.lineTo(ex,ey+5); ctx.fill();
      } else if (e.type === 'rhino') {
        const w = e.w || 28, h = e.h || 18;
        const tnow = performance.now();
        const step = Math.sin(tnow/180 + ex*0.02) * 1.2; // subtle bob for legs
        const headBob = Math.sin(tnow/260 + ex*0.03) * 0.8;
        const blink = ((tnow / 800) % 1) < 0.08; // brief blink
        // Drop shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.ellipse(ex + w*0.5 + 3, ey + h + 3, w*0.55, 3.5, 0, 0, Math.PI*2); ctx.fill();
        // Body
        const bodyGrad = ctx.createLinearGradient(ex, ey, ex, ey + h);
        bodyGrad.addColorStop(0, '#a3a8af'); bodyGrad.addColorStop(1, '#6c757d');
        ctx.fillStyle = bodyGrad;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(ex, ey, w, h, 5); ctx.fill(); }
        else { ctx.fillRect(ex, ey, w, h); }
        // Back plates
        ctx.strokeStyle = 'rgba(43,45,66,0.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ex + 6, ey + 4); ctx.lineTo(ex + 12, ey + 2); ctx.lineTo(ex + 18, ey + 4); ctx.stroke();
        // Belly line
        ctx.strokeStyle = 'rgba(43,45,66,0.35)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(ex + 4, ey + h - 4); ctx.lineTo(ex + w - 6, ey + h - 3); ctx.stroke();
        // Legs
        ctx.fillStyle = '#495057';
        ctx.fillRect(ex + 4, ey + h - 3 + step*0.2, 6, 3);
        ctx.fillRect(ex + Math.max(10, w - 14), ey + h - 3 - step*0.2, 6, 3);
        // Head
        const hx = ex + w - 6, hy = ey + h*0.45 + headBob, hr = Math.max(7, h*0.6);
        const headGrad = ctx.createRadialGradient(hx-2, hy-2, 2, hx, hy, hr);
        headGrad.addColorStop(0, '#b6bcc2'); headGrad.addColorStop(1, '#7a858e');
        ctx.fillStyle = headGrad;
        ctx.beginPath(); ctx.ellipse(hx, hy, hr*0.8, hr*0.7, 0, 0, Math.PI*2); ctx.fill();
        // Horns (with slight shine)
        const hornGrad = ctx.createLinearGradient(hx + 2, hy, hx + 10, hy);
        hornGrad.addColorStop(0, '#eaecef'); hornGrad.addColorStop(1, '#caced3');
        ctx.fillStyle = hornGrad;
        // main horn
        ctx.beginPath(); ctx.moveTo(hx + 6, hy - 2); ctx.lineTo(hx + 12, hy + 2); ctx.lineTo(hx + 6, hy + 6); ctx.closePath(); ctx.fill();
        // small horn
        ctx.beginPath(); ctx.moveTo(hx + 2, hy + 1); ctx.lineTo(hx + 6, hy + 3); ctx.lineTo(hx + 2, hy + 5); ctx.closePath(); ctx.fill();
        // Ears
        ctx.fillStyle = '#6d747c';
        ctx.beginPath(); ctx.moveTo(hx - 8, hy - 6); ctx.lineTo(hx - 3, hy - 10); ctx.lineTo(hx - 1, hy - 4); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(hx - 2, hy - 7); ctx.lineTo(hx + 2, hy - 11); ctx.lineTo(hx + 4, hy - 6); ctx.closePath(); ctx.fill();
        // inner ear tint
        ctx.fillStyle = 'rgba(255,192,203,0.35)';
        ctx.beginPath(); ctx.arc(hx - 3, hy - 8, 1.8, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(hx + 2, hy - 9, 1.6, 0, Math.PI*2); ctx.fill();
        // Eye + highlight
        if (blink) {
          ctx.strokeStyle = '#0b090a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx - 7, hy - 2); ctx.lineTo(hx - 5, hy - 2); ctx.stroke();
        } else {
          ctx.fillStyle = '#0b090a'; ctx.beginPath(); ctx.arc(hx - 6, hy - 2, 1.6, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(hx - 5.4, hy - 2.4, 0.6, 0, Math.PI*2); ctx.fill();
        }
        // Nostrils
        ctx.fillStyle = '#2b2d42'; ctx.beginPath(); ctx.arc(hx - 1, hy + 4, 0.8, 0, Math.PI*2); ctx.arc(hx + 1, hy + 4, 0.8, 0, Math.PI*2); ctx.fill();
        // Tail
        ctx.strokeStyle = '#495057'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ex - 2, ey + h - 6); ctx.lineTo(ex - 6, ey + h - 2); ctx.stroke();
        // Outline
        ctx.strokeStyle = '#2b2d42'; ctx.lineWidth = 2; ctx.beginPath(); ctx.rect(ex, ey, w, h); ctx.stroke();
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

    // FX puffs
    if (fxPuffs && fxPuffs.length) {
      const nowFx = performance.now();
      for (const f of fxPuffs) {
        const age = Math.max(0, Math.min(1, (nowFx - f.born) / f.life));
        const alpha = (1 - age) * 0.6;
        const fx = Math.round(f.x - (usingInfinite() ? cameraX : 0));
        const fy = Math.round(f.y - (usingInfiniteWalls() ? cameraY : 0));
        ctx.fillStyle = `rgba(120,110,100,${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(fx, fy, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Player (sync skin immediately even while shop is open)
    if (typeof window !== 'undefined' && typeof window.selectedSkinIndex === 'number') {
      selectedSkinIndex = window.selectedSkinIndex;
    }
    window.CURRENT_SKIN = skins[selectedSkinIndex];
    if (usingInfiniteWalls()) drawPlayer(Math.round(player.x), Math.round(player.y - cameraY));
    else drawPlayer(Math.round(player.x - cameraX), Math.round(player.y));

    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(10, 10, 240, 64);
    ctx.fillStyle = '#e8e9f3';
    ctx.font = '14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    const levelLabel = usingInfinite() ? 'Infinite' : (usingInfiniteWalls() ? 'Infinite Walls' : `${levelIndex + 1}/${getLevels().length}`);
    ctx.fillText(`Level: ${levelLabel}`, 20, 32);
    ctx.fillText(`Lives: ${lives}`, 20, 52);
    ctx.fillText(`Coins: ${coinsCollected}/${totalCoins}`, 120, 32);
    ctx.fillText(`Mode: ${modes[selectedModeIndex].name}`, 260, 52);

    // Infinite mode debug: show player world coordinates (X/Y)
    if (usingInfinite()) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(10, 80, 220, 26);
      ctx.fillStyle = '#e8e9f3';
      ctx.font = '12px ui-sans-serif, system-ui';
      ctx.fillText(`X: ${Math.round(player.x)}  Y: ${Math.round(player.y)}  CamX: ${Math.round(cameraX)}`, 20, 98);
    } else if (usingInfiniteWalls()) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(10, 80, 220, 26);
      ctx.fillStyle = '#e8e9f3';
      ctx.font = '12px ui-sans-serif, system-ui';
      ctx.fillText(`X: ${Math.round(player.x)}  Y: ${Math.round(player.y)}  CamY: ${Math.round(cameraY)}`, 20, 98);
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
      window.selectedModeIndex = selectedModeIndex;
      window.coinsCollected = coinsCollected;
      window.shopTab = shopTab;
      window.skinSel = skinSel;
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
    if (!won && !shopOpen) {
      if (onTitle) titleUpdate(); else update();
    }
    render();
    requestAnimationFrame(loop);
  }

  // Initialize title playground and start loop (title screen shown first)
  setupTitleDemo();
  loop();
})();

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

function drawShop() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  // Backdrop overlay + vignette
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);
  const vg = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.25, W/2, H/2, Math.max(W,H)*0.6);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  const panelW = 560, panelH = 320;
  const x = (W - panelW) / 2;
  const y = (H - panelH) / 2;

  function drawBakeryBackdrop() {
    // soft drop shadow
    roundRect(ctx, x + 6, y + 8, panelW, panelH, 14, 'rgba(0,0,0,0.25)', null);
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
  // small emblem
  ctx.beginPath(); ctx.arc(x + 12, y + 26, 6, 0, Math.PI*2); ctx.fillStyle = '#ffcd69'; ctx.fill();
  ctx.fillStyle = '#5b4636';
  ctx.fillText('Bakery Shop', x + 20, y + 32);
  ctx.font = '12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
  ctx.fillText('P: Close  |  Left/Right: Tabs  |  Up/Down: Navigate  |  Enter/Space: Buy/Equip/Select', x + 20, y + 52);

  const tabY = y + 70;
  const tabW = 120, tabH = 28;
  const tabs = ['Skins', 'Modes'];
  for (let i = 0; i < tabs.length; i++) {
    const tx = x + 20 + i * (tabW + 10);
    const active = i === window.shopTab;
    roundRect(ctx, tx, tabY, tabW, tabH, 6, active ? '#ffe8cc' : '#f3d6b4', active ? '#b06f2e' : '#c49256');
    // tiny icon
    ctx.save();
    ctx.translate(tx + 10, tabY + tabH/2);
    ctx.strokeStyle = '#a0753e';
    ctx.fillStyle = '#a0753e';
    if (i === 0) { ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill(); }
    else if (i === 1) { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4,0); ctx.lineTo(4,0); ctx.moveTo(0,-4); ctx.lineTo(0,4); ctx.stroke(); }
    else { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4,0); ctx.lineTo(0,-4); ctx.lineTo(4,0); ctx.lineTo(0,4); ctx.closePath(); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = '#5b4636';
    ctx.font = '14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    ctx.fillText(tabs[i], tx + 20, tabY + 19);
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
      // color swatch capsule
      roundRect(ctx, listX + 40, ry + 10, 28, rowH - 22, 8, s.body, s.outline);
      ctx.fillStyle = '#5b4636';
      ctx.font = '14px ui-sans-serif, system-ui';
      const status = s.owned ? (i === window.selectedSkinIndex ? 'Selected' : 'Owned') : `Cost: ${s.cost}`;
      ctx.fillText(`${s.name}`, listX + 70, ry + 16);
      ctx.font = '12px ui-sans-serif, system-ui';
      // status pill/button
      const pillText = s.owned ? (i === window.selectedSkinIndex ? 'Selected' : 'Equip') : `Buy ${s.cost}`;
      const owned = s.owned;
      const isSelectedSkin = i === window.selectedSkinIndex;
      const fillCol = owned ? (isSelectedSkin ? 'rgba(47,122,74,0.15)' : 'rgba(67,97,238,0.15)') : 'rgba(138,106,75,0.15)';
      const strokeCol = owned ? (isSelectedSkin ? '#2f7a4a' : '#4361ee') : '#8a6a4b';
      const textCol = strokeCol;
      const pillX = listX + 70;
      const pillY = ry + 20;
      const pillW = 100;
      roundRect(ctx, pillX, pillY, pillW, 14, 7, fillCol, strokeCol);
      ctx.fillStyle = textCol;
      ctx.fillText(pillText, pillX + 8, pillY + 11);
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
  // coin
  ctx.beginPath(); ctx.arc(coinX, coinY, 8, 0, Math.PI*2); ctx.fillStyle = '#f7e26b'; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; ctx.stroke();
  // sparkle
  const tSpark = performance.now()/400;
  ctx.save();
  ctx.translate(coinX, coinY);
  ctx.rotate(tSpark % (Math.PI*2));
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0,-10); ctx.lineTo(0,-6); ctx.moveTo(0,6); ctx.lineTo(0,10); ctx.moveTo(-10,0); ctx.lineTo(-6,0); ctx.moveTo(6,0); ctx.lineTo(10,0); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#5b4636';
  ctx.fillText(`Coins: ${window.coinsCollected}`, coinX + 14, y + 32);
}
