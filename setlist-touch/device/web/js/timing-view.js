export function noSongsMessage({connected, receivedEmpty, indexing}) {
  return connected && receivedEmpty && !indexing ? 'No songs found. Name a scene "* Song title".' : null;
}
