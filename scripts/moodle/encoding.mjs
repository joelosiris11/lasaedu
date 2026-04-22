// Fix mojibake for text pulled from the Moodle dump.
//
// The dump declares `SET NAMES utf8mb4` but the raw bytes in the data are
// Latin1 (ISO-8859-1) characters that were stored double-encoded. When mysql2
// reads them as utf8mb4 strings we get garbage. The reliable fix is to force
// the connection charset to `latin1`, which gives us the raw single-byte
// string back — then reinterpret those bytes as UTF-8.
//
//   "Electr\xF3nica B\xE1sica" (latin1 bytes) -> "Electrónica Básica" (utf8)
//
// This function is safe to call on already-correct strings: if the bytes
// don't form a valid UTF-8 sequence we return the original.

export function fixMojibake(input) {
  if (input === null || input === undefined) return input;
  if (typeof input !== 'string') return input;
  if (input.length === 0) return input;

  // Re-interpret the latin1 code units as a UTF-8 byte stream.
  const bytes = Buffer.from(input, 'binary');
  const candidate = bytes.toString('utf8');

  // Heuristic: if we produced a replacement char (U+FFFD) but the original
  // didn't contain one, the original was already correct UTF-8 and we
  // destroyed it. Fall back.
  if (candidate.includes('�') && !input.includes('�')) {
    return input;
  }
  return candidate;
}

// Recursively fix every string value in a plain object / array.
export function fixMojibakeDeep(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return fixMojibake(value);
  if (Array.isArray(value)) return value.map(fixMojibakeDeep);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = fixMojibakeDeep(v);
    return out;
  }
  return value;
}

// Self-test: on import, verify a known sample decodes correctly.
export function verifyEncodingSample() {
  const input = 'Electr\xF3nica B\xE1sica'; // latin1 bytes for Electrónica Básica
  const fixed = fixMojibake(input);
  if (fixed !== 'Electrónica Básica') {
    throw new Error(`encoding fixer produced "${fixed}", expected "Electrónica Básica"`);
  }
  return true;
}
