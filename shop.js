(function(){
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
  window.buyOrEquipSkin = buyOrEquipSkin;

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
  window.drawShop = drawShop;
})();
