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

// X32 vertical faders decide direction once; the existing Ableton gesture stays unchanged.
export function axisLock(dx, dy) {
  if (Math.max(Math.abs(dx),Math.abs(dy)) <= 10) return null;
  return Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
}
export function createVerticalFaderGesture({fullScalePx} = {}) {
  let drag = null;
  return {
    down(id,x,y,startValue) { drag = Number.isFinite(startValue) && fullScalePx > 0 ? {id,x,y,startValue,axis:null,value:null} : null; },
    move(id,x,y) {
      if (!drag || drag.id !== id) return null;
      drag.axis = drag.axis || axisLock(x-drag.x,y-drag.y);
      if (drag.axis !== 'y') return null;
      return drag.value = clamp(drag.startValue + (drag.y-y)/fullScalePx);
    },
    up(id) { if (!drag || drag.id !== id) return null; const value=drag.value; drag=null; return value; },
    cancel() { drag=null; }
  };
}
