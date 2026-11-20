'use strict';
// OSC messages only: the desk's scalar s/i/f replies, not bundles or blobs.
function stringBuffer(value) {
  if (typeof value !== 'string' || value.includes('\0')) throw new TypeError('Invalid OSC string');
  const bytes = Buffer.from(value, 'utf8');
  const out = Buffer.alloc(Math.ceil((bytes.length + 1) / 4) * 4);
  bytes.copy(out); return out;
}
function encode(address, args = []) {
  if (typeof address !== 'string' || !address.startsWith('/')) throw new TypeError('Invalid OSC address');
  const values = args.map(arg => typeof arg === 'number' ? {type:'f',value:arg} : typeof arg === 'string' ? {type:'s',value:arg} : arg);
  const data = values.map(arg => {
    if (!arg || !['s','i','f'].includes(arg.type)) throw new TypeError('Unsupported OSC type');
    if (arg.type === 's') return stringBuffer(arg.value);
    if (typeof arg.value !== 'number') throw new TypeError('Invalid OSC number');
    const buf = Buffer.alloc(4);
    if (arg.type === 'i') buf.writeInt32BE(arg.value); else buf.writeFloatBE(arg.value);
    return buf;
  });
  return Buffer.concat([stringBuffer(address), stringBuffer(',' + values.map(v => v.type).join('')), ...data]);
}
function decode(buf) {
  try {
    if (!Buffer.isBuffer(buf) || !buf.length || buf.length % 4) return null;
    let offset = 0;
    const readString = () => {
      const end = buf.indexOf(0, offset);
      if (end < offset) throw Error('Missing terminator');
      const next = Math.ceil((end + 1) / 4) * 4;
      if (next > buf.length) throw Error('Truncated string');
      for (let i = end; i < next; i++) if (buf[i]) throw Error('Invalid padding');
      const bytes = buf.subarray(offset, end), value = bytes.toString('utf8');
      if (!Buffer.from(value).equals(bytes)) throw Error('Invalid UTF-8');
      offset = next; return value;
    };
    const address = readString(), tags = readString();
    if (!address.startsWith('/') || !tags.startsWith(',')) return null;
    const args = [];
    for (const type of tags.slice(1)) {
      if (type === 's') args.push(readString());
      else if (type === 'i' || type === 'f') {
        if (offset + 4 > buf.length) return null;
        const value = type === 'i' ? buf.readInt32BE(offset) : buf.readFloatBE(offset);
        if (!Number.isFinite(value)) return null;
        args.push(value); offset += 4;
      } else return null;
    }
    return offset === buf.length ? {address,args} : null;
  } catch (_) { return null; }
}
module.exports = {encode,decode};
