export function createTapDetector({maxMove = 10, maxMs = 500} = {}) {
  const pointers = new Map();
  let blocked = false;
  function move(id, x, y) {
    const p = pointers.get(id);
    if (p && Math.hypot(x - p.x, y - p.y) >= maxMove) p.moved = true;
  }
  return {
    down(id, x, y, t, target) {
      if (pointers.size) blocked = true;
      pointers.set(id, {x, y, t, target, moved:false});
    },
    move,
    up(id, x, y, t, target) {
      move(id, x, y);
      const p = pointers.get(id);
      const hit = p && !blocked && !p.moved && t >= p.t && t - p.t < maxMs && target === p.target ? target : null;
      pointers.delete(id);
      if (!pointers.size) blocked = false;
      return hit;
    },
    cancel(id) { pointers.delete(id); if (!pointers.size) blocked = false; }
  };
}
