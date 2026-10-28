export function fitRows(count, availablePx, {gap = 6, min = 44, max = 120} = {}) {
  const fit = count ? (availablePx - (count - 1) * gap) / count : max;
  return {rowHeight:Math.max(min, Math.min(max, fit)), scroll:fit < min};
}
