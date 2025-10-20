(function(){
  // Platform pattern cache and drawing helpers
  const platformPatternCache = {};
  function makePlatformPattern(type) {
    if (platformPatternCache[type]) return platformPatternCache[type];
    const c = document.createElement('canvas');
    const size = 32; c.width = size; c.height = size;
    const g = c.getContext('2d');
    if (type === 'normal') {
      g.fillStyle = '#6ea8c5'; g.fillRect(0,0,size,size);
      g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 1;
      for (let x=0;x<=size;x+=8){ g.beginPath(); g.moveTo(x+0.5,0); g.lineTo(x+0.5,size); g.stroke(); }
      for (let y=0;y<=size;y+=8){ g.beginPath(); g.moveTo(0,y+0.5); g.lineTo(size,y+0.5); g.stroke(); }
      g.strokeStyle = 'rgba(255,255,255,0.06)';
      g.beginPath(); g.moveTo(0,0.5); g.lineTo(size,0.5); g.stroke();
    } else if (type === 'sticky') {
      const grad = g.createLinearGradient(0,0,0,size);
      grad.addColorStop(0,'#f19aa1'); grad.addColorStop(1,'#d7646f');
      g.fillStyle = grad; g.fillRect(0,0,size,size);
      g.fillStyle = 'rgba(255,255,255,0.15)';
      for (let i=0;i<6;i++){ g.beginPath(); g.arc(Math.random()*size, Math.random()*size, 1.2, 0, Math.PI*2); g.fill(); }
      g.strokeStyle = 'rgba(0,0,0,0.12)';
      g.beginPath(); g.moveTo(4,6); g.quadraticCurveTo(10,14,6,20); g.stroke();
    } else if (type === 'start') {
      g.fillStyle = '#ffe066'; g.fillRect(0,0,size,size);
      g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 1;
      for (let x=0;x<=size;x+=8){ g.beginPath(); g.moveTo(x+0.5,0); g.lineTo(x+0.5,size); g.stroke(); }
      g.strokeStyle = 'rgba(255,255,255,0.2)'; g.beginPath(); g.moveTo(0,2); g.lineTo(size,2); g.stroke();
    } else if (type === 'death') {
      const grad = g.createLinearGradient(0,0,0,size);
      grad.addColorStop(0,'#ff6b6b'); grad.addColorStop(1,'#d00000');
      g.fillStyle = grad; g.fillRect(0,0,size,size);
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      for (let x=0;x<size;x+=8){ g.beginPath(); g.moveTo(x, 10+Math.sin(x*0.5)*2); g.lineTo(x+4, 14+Math.cos(x*0.3)*2); g.stroke(); }
    } else {
      const grad = g.createLinearGradient(0,0,size,size);
      grad.addColorStop(0,'#c7ecf1'); grad.addColorStop(1,'#8fd3de');
      g.fillStyle = grad; g.fillRect(0,0,size,size);
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0,8); g.lineTo(8,0); g.moveTo(16,8); g.lineTo(24,0); g.moveTo(8,24); g.lineTo(24,8); g.stroke();
    }
    function drawBird() {
      // Body
      ctx.fillStyle = skin.body;
      ctx.beginPath();
      ctx.ellipse(cx, cy + bob, r*0.9, r*0.65, 0.1, 0, Math.PI*2);
      ctx.fill();
      // Head
      ctx.beginPath();
      ctx.ellipse(cx + r*0.55, cy - r*0.15 + bob, r*0.45, r*0.42, 0, 0, Math.PI*2);
      ctx.fill();
      // Outline
      ctx.strokeStyle = skin.outline;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, cy + bob, r*0.9, r*0.65, 0.1, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx + r*0.55, cy - r*0.15 + bob, r*0.45, r*0.42, 0, 0, Math.PI*2); ctx.stroke();
      // Beak (triangle)
      ctx.fillStyle = '#ffb703';
      ctx.beginPath();
      const hx = cx + r*0.9, hy = cy - r*0.12 + bob;
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + 8, hy + 3);
      ctx.lineTo(hx, hy + 6);
      ctx.closePath();
      ctx.fill();
      // Eye
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(cx + r*0.58, cy - r*0.22 + bob, 2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(cx + r*0.6, cy - r*0.25 + bob, 0.8, 0, Math.PI*2); ctx.fill();
      // Wings (flap)
      const flap = Math.sin(t*10) * 0.5; // -0.5..0.5
      ctx.fillStyle = skin.body;
      ctx.save();
      ctx.translate(cx - r*0.4, cy + bob);
      ctx.rotate(-0.6 + flap*0.4);
      ctx.beginPath(); ctx.ellipse(0, 0, r*0.5, r*0.28, 0.2, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(cx + r*0.1, cy + bob);
      ctx.rotate(0.9 - flap*0.4);
      ctx.beginPath(); ctx.ellipse(0, 0, r*0.45, r*0.26, -0.2, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      // Tail feathers
      ctx.strokeStyle = skin.outline;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - r*0.9, cy + bob);
      ctx.lineTo(cx - r*1.2, cy + bob - 4);
      ctx.moveTo(cx - r*0.9, cy + bob);
      ctx.lineTo(cx - r*1.2, cy + bob + 4);
      ctx.stroke();
      // Feet (small)
      ctx.strokeStyle = '#ffb703';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy + r*0.7 + bob);
      ctx.lineTo(cx - 8, cy + r*0.75 + bob);
      ctx.moveTo(cx + 2, cy + r*0.72 + bob);
      ctx.lineTo(cx - 2, cy + r*0.78 + bob);
      ctx.stroke();
    }
    const pat = g.createPattern(c, 'repeat');
    platformPatternCache[type] = pat; return pat;
  }
  window.makePlatformPattern = makePlatformPattern;

  function drawSkyBackground(ctx, W, H, cameraX) {
    const sky = ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#b8e0ff');
    sky.addColorStop(1,'#fdf6e3');
    ctx.fillStyle = sky; ctx.fillRect(0,0,W,H);
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
  window.drawSkyBackground = drawSkyBackground;

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
  window.roundRect = roundRect;

  function drawPlatformTextured(ctx, p, cameraX) {
    const x = Math.round(p.x - (cameraX||0)), y = Math.round(p.y), w = p.w, h = p.h;
    const type = p.t || 'normal';
    const pat = makePlatformPattern(type);
    ctx.fillStyle = pat;
    roundRect(ctx, x, y, w, h, 4, pat, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x+2, y+1, w-4, 2);
  }
  window.drawPlatformTextured = drawPlatformTextured;

  function drawGoalPretty(ctx, g2, cameraX) {
    const gx = g2.x - (cameraX||0), gy = g2.y, gw = g2.w, gh = g2.h;
    roundRect(ctx, gx, gy, gw, gh, 6, '#ffe9b8', 'rgba(0,0,0,0.25)');
    ctx.fillStyle = '#ffcd69'; ctx.fillRect(gx+4, gy+6, gw-8, 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(gx+gw/2, gy+6, gw/2-6, Math.PI, 0); ctx.stroke();
  }
  window.drawGoalPretty = drawGoalPretty;

  function drawPlayer(px, py) {
    const ctx = document.getElementById('game').getContext('2d');
    const t = performance.now() / 1000;
    const cx = px + 14;
    const cy = py + 22;
    const r = 16;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, py + 38, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    const bob = Math.sin(t * 6) * 1.2;
    const skin = (window && window.CURRENT_SKIN) ? window.CURRENT_SKIN : { key: 'orange', body: '#ffa730', outline: '#d77a00' };
    function drawRoundFruit(baseColor, outlineColor) {
      const grad = ctx.createRadialGradient(cx - r*0.3, cy - r*0.3 + bob, r*0.2, cx, cy + bob, r);
      grad.addColorStop(0, '#fff0c2');
      grad.addColorStop(0.4, baseColor);
      grad.addColorStop(1, outlineColor);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy + bob, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy + bob, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#6b3d12';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 1, cy - r + bob);
      ctx.quadraticCurveTo(cx + 2, cy - r - 6 + bob, cx + 5, cy - r - 2 + bob);
      ctx.stroke();
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
      ctx.fillStyle = '#6b3d12';
      ctx.beginPath(); ctx.arc(cx - 12, cy + 8 + bob, 2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 12, cy - 6 + bob, 2, 0, Math.PI*2); ctx.fill();
    }
    function drawStrawberry() {
      ctx.fillStyle = skin.body;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r/2 + bob);
      ctx.bezierCurveTo(cx + r, cy - r + bob, cx + r, cy + r/2 + bob, cx, cy + r + bob);
      ctx.bezierCurveTo(cx - r, cy + r/2 + bob, cx - r, cy - r + bob, cx, cy - r/2 + bob);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd166';
      for (let i=0;i<10;i++) {
        const ang = (i/10) * Math.PI*2;
        const rr = r*0.6;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(ang)*rr*0.6, cy + bob + Math.sin(ang)*rr*0.8, 1.3, 2.1, ang, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.fillStyle = '#2f9e44';
      ctx.beginPath();
      ctx.ellipse(cx, cy - r + bob, 10, 5, 0, 0, Math.PI*2);
      ctx.fill();
    }
    function drawPenguin() {
      ctx.fillStyle = skin.body;
      ctx.beginPath();
      ctx.ellipse(cx, cy + bob, r*0.9, r*1.1, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#f5f5f5';
      ctx.beginPath();
      ctx.ellipse(cx, cy + bob + 4, r*0.6, r*0.8, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(cx - 5, cy - 6 + bob, 2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 5, cy - 6 + bob, 2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffb703';
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy - 1 + bob);
      ctx.lineTo(cx + 2, cy - 1 + bob);
      ctx.lineTo(cx, cy + 3 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffb703';
      ctx.beginPath(); ctx.ellipse(cx - 6, cy + r + bob - 2, 5, 2, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 6, cy + r + bob - 2, 5, 2, 0, 0, Math.PI*2); ctx.fill();
    }
    function drawBird() {
      // Subtle tilt using input if available
      const k = (window && window.keys) ? window.keys : null;
      const tilt = Math.max(-0.35, Math.min(0.35,
        (k && k.has('ArrowUp') ? -0.22 : 0) + (k && k.has('ArrowDown') ? 0.22 : 0)
      ));

      // Body with soft shading
      ctx.save();
      ctx.translate(cx, cy + bob + 2);
      ctx.rotate(tilt);
      const bodyGrad = ctx.createRadialGradient(-r*0.2, -r*0.2, r*0.1, 0, 0, r*0.95);
      bodyGrad.addColorStop(0, 'rgba(255,255,255,0.35)');
      bodyGrad.addColorStop(1, skin.body);
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.ellipse(-2, 0, r*0.95, r*0.7, 0.08, 0, Math.PI*2);
      ctx.fill();
      // Belly patch
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.ellipse(-4, 4, r*0.55, r*0.45, 0.05, 0, Math.PI*2); ctx.fill();

      // Head
      ctx.fillStyle = skin.body;
      ctx.beginPath(); ctx.ellipse(r*0.55, -r*0.12, r*0.5, r*0.48, 0, 0, Math.PI*2); ctx.fill();
      // Eye ring and pupil
      ctx.strokeStyle = skin.outline; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(r*0.55, -r*0.22, 4, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(r*0.55, -r*0.22, 2.2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(r*0.6, -r*0.26, 0.9, 0, Math.PI*2); ctx.fill();
      // Beak two-tone
      const hx = r*0.95, hy = -r*0.06;
      ctx.fillStyle = '#ffbf47';
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + 8, hy + 2); ctx.lineTo(hx, hy + 4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#d99000'; ctx.lineWidth = 1.5; ctx.stroke();

      // Wings (outlined, slight feather hint)
      const flap = Math.sin(t*10) * 0.5;
      ctx.fillStyle = skin.body; ctx.strokeStyle = skin.outline; ctx.lineWidth = 2;
      // Rear wing
      ctx.save(); ctx.translate(-r*0.42, 2); ctx.rotate(-0.7 + flap*0.5);
      ctx.beginPath(); ctx.ellipse(0, 0, r*0.52, r*0.3, 0.15, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-r*0.2, -r*0.05); ctx.lineTo(r*0.2, r*0.05); ctx.stroke();
      ctx.restore();
      // Front wing
      ctx.save(); ctx.translate(r*0.08, 2); ctx.rotate(0.95 - flap*0.45);
      ctx.strokeStyle = skin.outline; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, r*0.48, r*0.28, -0.1, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-r*0.18, -r*0.04); ctx.lineTo(r*0.18, r*0.04); ctx.stroke();
      ctx.restore();

      // Tail (filled tri-feather)
      ctx.fillStyle = skin.body; ctx.strokeStyle = skin.outline; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r*0.95, 0);
      ctx.lineTo(-r*1.28, -4);
      ctx.lineTo(-r*1.28, 6);
      ctx.closePath();
      ctx.fill(); ctx.stroke();

      // Feet
      ctx.strokeStyle = '#ffb703'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, r*0.74);
      ctx.lineTo(-10, r*0.78);
      ctx.moveTo(1, r*0.76);
      ctx.lineTo(-3, r*0.82);
      ctx.stroke();

      // Outlines around body/head
      ctx.strokeStyle = skin.outline; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(-2, 0, r*0.95, r*0.7, 0.08, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(r*0.55, -r*0.12, r*0.5, r*0.48, 0, 0, Math.PI*2); ctx.stroke();

      ctx.restore();
    }
    switch (skin.key) {
      case 'banana': drawBanana(); break;
      case 'apple': drawRoundFruit(skin.body, skin.outline); break;
      case 'pear': drawRoundFruit(skin.body, skin.outline); break;
      case 'apricot': drawRoundFruit(skin.body, skin.outline); break;
      case 'strawberry': drawStrawberry(); break;
      case 'tomato': drawRoundFruit(skin.body, skin.outline); break;
      case 'penguin': drawPenguin(); break;
      case 'bird': drawBird(); break;
      case 'orange':
      default:
        drawRoundFruit(skin.body || '#ffa730', skin.outline || '#d77a00');
        break;
    }
  }
  window.drawPlayer = drawPlayer;
})();
