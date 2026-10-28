'use strict';
function beatsPerBar(numerator, denominator) { return numerator * 4 / denominator; }
function progress({position, loopStart, loopEnd, beatsPerBar: beatCount}) {
  if (![position, loopStart, loopEnd, beatCount].every(Number.isFinite) || loopEnd <= loopStart || beatCount <= 0) return null;
  const bars = (loopEnd - loopStart) / beatCount;
  return {bar: Math.max(1, Math.min(Math.ceil(bars), Math.floor((position - loopStart) / beatCount) + 1)),
    bars, fraction: Math.max(0, Math.min(1, (position - loopStart) / (loopEnd - loopStart)))};
}
module.exports = { beatsPerBar, progress };
