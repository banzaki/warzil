// Room codes. No look-alike characters (0/O, 1/I/L). 8 characters from 31 give
// about 8.5e11 codes (39 bits); with the join limit, guessing a live room is
// impractical. Rooms created before v0.7.1 used 5 characters; they still work
// until they expire.
export const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 8;
export const LEGACY_CODE_LENGTH = 5;

// What the player typed or pasted -> the code: case, spaces and dashes ignored.
export const normalizeCode = (text) =>
  String(text ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CODE_LENGTH);

// Shown as two groups ("ABCD-EFGH") so it is easy to read aloud.
export const formatCode = (code) => (code?.length === CODE_LENGTH ? `${code.slice(0, 4)}-${code.slice(4)}` : (code ?? ''));

// Unbiased: bytes that would favour some characters (>= 248) are drawn again.
export function randomCode(randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const limit = 256 - (256 % CODE_CHARS.length);
  let code = '';
  while (code.length < CODE_LENGTH) {
    for (const b of randomBytes(CODE_LENGTH * 2)) {
      if (b < limit && code.length < CODE_LENGTH) code += CODE_CHARS[b % CODE_CHARS.length];
    }
  }
  return code;
}
