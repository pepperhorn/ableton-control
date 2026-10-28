const clamp = value => Math.max(0, Math.min(1, value));
export function createFaderGesture({slop = 8, fullScalePx} = {}) {
  const pointers = new Set();
  let gesture = null;
  return {
    down(id, x, y, startValue) {
      pointers.add(id);
      if (pointers.size !== 1) { if (gesture) gesture.axis = 'cancelled'; return; }
      gesture = Number.isFinite(startValue) && fullScalePx > 0 ? {id,x,y,startValue,axis:null,value:null} : null;
    },
    move(id, x, y) {
      if (!gesture || gesture.id !== id || pointers.size !== 1 || gesture.axis === 'cancelled') return null;
      const dx = x - gesture.x, dy = y - gesture.y;
      if (!gesture.axis) {
        // Ambiguous diagonal samples are treated as scrolling, conservatively.
        if (Math.abs(dy) >= slop) gesture.axis = 'cancelled';
        else if (Math.abs(dx) >= slop) gesture.axis = 'horizontal';
      }
      if (gesture.axis !== 'horizontal') return null;
      gesture.value = clamp(gesture.startValue + dx / fullScalePx);
      return gesture.value;
    },
    up(id) {
      pointers.delete(id);
      if (!gesture || gesture.id !== id) return null;
      const value = gesture.axis === 'horizontal' ? gesture.value : null;
      gesture = null;
      return value;
    },
    cancel(id) {
      pointers.delete(id);
      if (gesture) gesture.axis = 'cancelled';
      if (!pointers.size) gesture = null;
    }
  };
}
