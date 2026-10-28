export function createHoldGesture({ms = 1000} = {}) {
  const pointers = new Set();
  let active = null;
  return {
    down(id, t) {
      const second = pointers.size > 0;
      pointers.add(id);
      active = second ? null : {id, t};
    },
    move(id, inside) { if (active && active.id === id && !inside) active = null; },
    up(id, t) {
      const fire = !!active && active.id === id && t >= active.t + ms;
      if (active && active.id === id) active = null;
      pointers.delete(id);
      return fire;
    },
    cancel(id) { if (active && active.id === id) active = null; pointers.delete(id); },
    reset() { pointers.clear(); active = null; },
    progress(t) { return active ? Math.max(0, Math.min(1, (t - active.t) / ms)) : 0; }
  };
}
