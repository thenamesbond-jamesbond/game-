(function(){
  // Shared keyboard state used by the game
  const keys = window.keys || new Set();
  window.keys = keys;

  // Maintain keys Set for basic movement keys; do not handle game-specific menu/shop logic here
  const CONTROL_KEYS = new Set([
    'ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ',
    'a','d','w','A','D','W'
  ]);
  addEventListener('keydown', (e) => {
    if (CONTROL_KEYS.has(e.key)) e.preventDefault();
    keys.add(e.key);
  });
  addEventListener('keyup', (e) => {
    keys.delete(e.key);
  });

  // Mobile / touch on-screen controls
  function bindMobileControls() {
    const leftBtn = document.getElementById('btn-left');
    const rightBtn = document.getElementById('btn-right');
    const jumpBtn = document.getElementById('btn-jump');
    const shopBtn = document.getElementById('btn-shop');
    function attach(btn, keyDown) {
      if (!btn) return;
      const down = (ev) => { ev.preventDefault(); keys.add(keyDown); btn.classList.add('active'); btn.setPointerCapture && btn.setPointerCapture(ev.pointerId || 1); };
      const up = (ev) => { ev.preventDefault(); keys.delete(keyDown); btn.classList.remove('active'); };
      btn.addEventListener('pointerdown', down, { passive: false });
      btn.addEventListener('pointerup', up, { passive: false });
      btn.addEventListener('pointercancel', up, { passive: false });
      btn.addEventListener('pointerleave', up, { passive: false });
    }
    attach(leftBtn, 'ArrowLeft');
    attach(rightBtn, 'ArrowRight');
    if (jumpBtn) {
      const down = (ev) => { ev.preventDefault(); keys.add('ArrowUp'); keys.add(' '); jumpBtn.classList.add('active'); };
      const up = (ev) => { ev.preventDefault(); keys.delete('ArrowUp'); keys.delete(' '); jumpBtn.classList.remove('active'); };
      jumpBtn.addEventListener('pointerdown', down, { passive: false });
      jumpBtn.addEventListener('pointerup', up, { passive: false });
      jumpBtn.addEventListener('pointercancel', up, { passive: false });
      jumpBtn.addEventListener('pointerleave', up, { passive: false });
    }
    if (shopBtn) {
      const click = (ev) => { ev.preventDefault(); if (window && typeof window.toggleShop === 'function') window.toggleShop(); };
      shopBtn.addEventListener('pointerdown', click, { passive: false });
    }
  }
  window.bindMobileControls = bindMobileControls;
  // Auto-bind on load
  bindMobileControls();
})();
