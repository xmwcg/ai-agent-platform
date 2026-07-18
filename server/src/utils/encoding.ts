/**
 * Fix double-encoded UTF-8 strings.
 * When Chinese text is saved as Latin-1 and then re-encoded as UTF-8,
 * the result is mojibake. This detects and reverses that.
 */
export function fixDoubleEncoding(str: string | null | undefined): string {
  if (!str) return str || '';
  // Double-encoded strings contain characters in the Latin-1 supplement range (0x80-0xFF)
  const hasHighBytes = /[\x80-\xFF]/.test(str);
  if (!hasHighBytes) return str;
  try {
    // Decode: treat current as Latin-1, then interpret bytes as UTF-8
    const buf = Buffer.from(str, 'latin1');
    const fixed = buf.toString('utf8');
    return fixed;
  } catch {
    return str;
  }
}

/** Apply fixDoubleEncoding to known text fields of an object */
export function fixDocEncoding(doc: Record<string, any>): Record<string, any> {
  const fields = ['title', 'summary', 'content', 'description', 'name'];
  for (const key of fields) {
    if (typeof doc[key] === 'string') {
      doc[key] = fixDoubleEncoding(doc[key]);
    }
  }
  return doc;
}
