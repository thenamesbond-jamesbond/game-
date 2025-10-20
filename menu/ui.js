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
       ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
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
     }

     function drawPastry(cx, cy, kind) {
       if (kind === 'cookie') {
         ctx.fillStyle = '#d9a066';
         ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI*2); ctx.fill();
         ctx.fillStyle = '#6b3d12';
         for (let i=0;i<5;i++) { const a=(i/5)*Math.PI*2; ctx.beginPath(); ctx.arc(cx+Math.cos(a)*6, cy+Math.sin(a)*6, 1.8, 0, Math.PI*2); ctx.fill(); }
       } else if (kind === 'donut') {
         ctx.strokeStyle = '#ff8fab'; ctx.lineWidth = 4;
         ctx.beginPath(); ctx.arc(cx, cy, 8, 0.6, Math.PI*2+0.6); ctx.stroke();
         ctx.fillStyle = '#fff0f5'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI*2); ctx.fill();
       } else {
         ctx.fillStyle = '#ffd6e7';
         ctx.beginPath(); ctx.moveTo(cx - 16, cy + 8); ctx.lineTo(cx + 16, cy + 8); ctx.lineTo(cx, cy - 10); ctx.closePath(); ctx.fill();
         ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.stroke();
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
         case 'orange': default: return 'orange_donut';
       }
     }

     drawBakeryBackdrop();

     ctx.fillStyle = '#5b4636';
     ctx.font = '18px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
     ctx.beginPath(); ctx.arc(x + 12, y + 26, 6, 0, Math.PI*2); ctx.fillStyle = '#ffcd69'; ctx.fill();
     ctx.fillStyle = '#5b4636';
     ctx.fillText('Bakery Shop', x + 20, y + 32);
     ctx.font = '12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
     ctx.fillText('P: Close  |  Left/Right: Tabs  |  Up/Down: Navigate  |  Enter/Space: Buy/Equip/Select', x + 20, y + 52);

     const tabY = y + 70;
     const tabW = 120, tabH = 28;
     const tabs = ['Skins', 'Modes', 'Upgrades'];
     for (let i = 0; i < tabs.length; i++) {
       const tx = x + 20 + i * (tabW + 10);
       const active = i === window.shopTab;
       roundRect(ctx, tx, tabY, tabW, tabH, 6, active ? '#ffe8cc' : '#f3d6b4', active ? '#b06f2e' : '#c49256');
       ctx.save(); ctx.translate(tx + 10, tabY + tabH/2); ctx.strokeStyle = '#a0753e'; ctx.fillStyle = '#a0753e';
       if (i === 0) { ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill(); }
       else if (i === 1) { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4,0); ctx.lineTo(4,0); ctx.moveTo(0,-4); ctx.lineTo(0,4); ctx.stroke(); }
       else if (i === 2) { ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0,0,4,0,Math.PI*2); ctx.moveTo(-4,0); ctx.lineTo(4,0); ctx.stroke(); }
       else { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4,0); ctx.lineTo(0,-4); ctx.lineTo(4,0); ctx.lineTo(0,4); ctx.closePath(); ctx.stroke(); }
       ctx.restore();
       ctx.fillStyle = '#5b4636'; ctx.font = '14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
       ctx.fillText(tabs[i], tx + 20, tabY + 19);
     }

     const listX = x + 20;
     const listY = y + 110;
     const rowH = 38;

     if (window.shopTab === 0) {
       const total = (window.skins||[]).length;
       const maxRows = 7;
       const start = Math.min(Math.max(window.skinSel - Math.floor(maxRows/2), 0), Math.max(0, total - maxRows));
       const end = Math.min(total, start + maxRows);
       ctx.fillStyle = '#8a6a4b'; ctx.font = '12px ui-sans-serif, system-ui';
       ctx.fillText(`Skins ${start + 1}-${end} of ${total}`, x + panelW - 180, y + 90);
       for (let vi = 0, i = start; i < end; i++, vi++) {
         const s = window.skins[i];
         const ry = listY + vi * rowH;
         const selected = i === window.skinSel;
         roundRect(ctx, listX, ry, panelW - 40, rowH - 6, 10, selected ? '#fff3e6' : '#fde9d6', '#e2bf92');
         if (selected) {
           const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
           ctx.strokeStyle = `rgba(192, 120, 60, ${0.6 * pulse + 0.2})`; ctx.lineWidth = 3;
           roundRect(ctx, listX - 2, ry - 2, panelW - 36, rowH - 2, 12, null, ctx.strokeStyle);
         }
         const kind = pastryForSkin(s.key);
         drawPastry(listX + 20, ry + (rowH/2) - 2, kind);
         roundRect(ctx, listX + 40, ry + 10, 28, rowH - 22, 8, s.body, s.outline);
         ctx.fillStyle = '#5b4636'; ctx.font = '14px ui-sans-serif, system-ui';
         ctx.fillText(`${s.name}`, listX + 70, ry + 16);
         ctx.font = '12px ui-sans-serif, system-ui';
         const pillText = s.owned ? (i === window.selectedSkinIndex ? 'Selected' : 'Equip') : `Buy ${s.cost}`;
         const owned = s.owned; const isSelectedSkin = i === window.selectedSkinIndex;
         const fillCol = owned ? (isSelectedSkin ? 'rgba(47,122,74,0.15)' : 'rgba(67,97,238,0.15)') : 'rgba(138,106,75,0.15)';
         const strokeCol = owned ? (isSelectedSkin ? '#2f7a4a' : '#4361ee') : '#8a6a4b';
         const pillX = listX + 70; const pillY = ry + 20; const pillW = 100;
         roundRect(ctx, pillX, pillY, pillW, 14, 7, fillCol, strokeCol);
         ctx.fillStyle = strokeCol; ctx.fillText(pillText, pillX + 8, pillY + 11);
       }
     } else if (window.shopTab === 1) {
       for (let i = 0; i < (window.modes||[]).length; i++) {
         const m = window.modes[i];
         const ry = listY + i * rowH;
         roundRect(ctx, listX, ry, panelW - 40, rowH - 6, 10, i === window.modeSel ? '#fff3e6' : '#fde9d6', '#e2bf92');
         drawPastry(listX + 20, ry + (rowH/2) - 2, i % 2 === 0 ? 'donut' : 'cookie');
         ctx.fillStyle = '#5b4636'; ctx.font = '14px ui-sans-serif, system-ui';
         const status = (i === window.selectedModeIndex) ? 'Selected' : 'Press Enter to Select';
         ctx.fillText(`${m.name} — ${status}`, listX + 50, ry + 24);
       }
     } else if (window.shopTab === 2) {
       const lvl = (window.upgrades && typeof window.upgrades.staminaLevel === 'number') ? window.upgrades.staminaLevel : 0;
       const maxLvl = 5; const costs = [10, 20, 35, 55, 80];
       const nextCost = lvl >= maxLvl ? null : costs[Math.min(lvl, costs.length - 1)];
       const ry = listY;
       roundRect(ctx, listX, ry, panelW - 40, rowH - 6, 10, '#fff3e6', '#e2bf92');
       ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(listX + 20, ry + rowH/2 - 2, 8, 0, Math.PI*2); ctx.stroke();
       ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.arc(listX + 20, ry + rowH/2 - 2, 2, 0, Math.PI*2); ctx.fill();
       ctx.fillStyle = '#5b4636'; ctx.font = '14px ui-sans-serif, system-ui';
       const secs = 7 + lvl * 2;
       ctx.fillText(`Stamina Flight — Level ${lvl}/${maxLvl} — ${secs}s`, listX + 40, ry + 16);
       ctx.font = '12px ui-sans-serif, system-ui';
       const pillText = (lvl >= maxLvl) ? 'Maxed' : (window.coinsCollected >= nextCost ? `Buy ${nextCost}` : `Need ${nextCost}`);
       const canBuy = (lvl < maxLvl) && (window.coinsCollected >= nextCost);
       const fillCol = canBuy ? 'rgba(47,122,74,0.15)' : 'rgba(138,106,75,0.15)';
       const strokeCol = canBuy ? '#2f7a4a' : '#8a6a4b';
       const pillX = listX + 300; const pillY = ry + 20; const pillW = 110;
       roundRect(ctx, pillX, pillY, pillW, 14, 7, fillCol, strokeCol);
       ctx.fillStyle = strokeCol; ctx.fillText(pillText, pillX + 8, pillY + 11);
       ctx.fillStyle = '#8a6a4b'; ctx.fillText('Press Enter/Space to buy', listX + 40, ry + 30);
     }

     ctx.fillStyle = '#5b4636'; ctx.font = '14px ui-sans-serif, system-ui';
     const coinX = x + panelW - 160; const coinY = y + 26;
     ctx.beginPath(); ctx.arc(coinX, coinY, 8, 0, Math.PI*2); ctx.fillStyle = '#f7e26b'; ctx.fill();
     ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; ctx.stroke();
     const tSpark = performance.now()/400; ctx.save(); ctx.translate(coinX, coinY); ctx.rotate(tSpark % (Math.PI*2));
     ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0,-10); ctx.lineTo(0,-6); ctx.moveTo(0,6); ctx.lineTo(0,10); ctx.moveTo(-10,0); ctx.lineTo(-6,0); ctx.moveTo(6,0); ctx.lineTo(10,0); ctx.stroke();
     ctx.restore();
     ctx.fillStyle = '#5b4636'; ctx.fillText(`Coins: ${window.coinsCollected}`, coinX + 14, y + 32);
   }
   window.drawShop = drawShop;

   function buyUpgradeStamina() {
     if (!window.upgrades) window.upgrades = { staminaLevel: 0 };
     const maxLvl = 5; const costs = [10, 20, 35, 55, 80];
     const lvl = window.upgrades.staminaLevel || 0; if (lvl >= maxLvl) return;
     const cost = costs[Math.min(lvl, costs.length - 1)];
     if (window.coinsCollected >= cost) {
       window.coinsCollected -= cost;
       window.upgrades.staminaLevel = Math.min(maxLvl, lvl + 1);
     }
   }
   window.buyUpgradeStamina = buyUpgradeStamina;
 })();
