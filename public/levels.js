(function(){
  // Provide a global getLevels that interleaves LEVELS and WALL_LEVELS if present
  function interleaveLevels(A, B) {
    const out = [];
    const max = Math.max(A.length, B.length);
    for (let i = 0; i < max; i++) {
      if (i < A.length) out.push(A[i]);
      if (i < B.length) out.push(B[i]);
    }
    return out;
  }
  window.getLevels = function() {
    const A = window.LEVELS || [];
    const B = window.WALL_LEVELS || [];
    return interleaveLevels(A, B);
  };
})();
