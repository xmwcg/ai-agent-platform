/**
 * Fix double-encoded UTF-8 strings.
 * When Chinese text is saved as Latin-1 and then re-encoded as UTF-8,
 * the result is mojibake. This detects and reverses that.
 *
 * Unlike the previous version, this uses proper mojibake pattern detection
 * instead of blindly re-encoding all strings with high bytes (which corrupted
 * correctly-encoded Chinese text).
 */
const MOJIBAKE_PATTERN = /[\u00C0-\u00FF](?:[\u0080-\u00BF]|$)/;

function hasMojibake(str: string): boolean {
  return MOJIBAKE_PATTERN.test(str);
}

export function fixDoubleEncoding(str: string | null | undefined): string {
  if (!str) return str || "";
  if (!hasMojibake(str)) return str;
  try {
    // Decode: treat current string as Latin-1 byte values, then interpret as UTF-8
    const buf = Buffer.from(str, "latin1");
    const fixed = buf.toString("utf8");
    // Only apply fix if it reduced mojibake patterns (avoid corrupting correct text)
    if (hasMojibake(fixed)) return str;
    return fixed;
  } catch {
    return str;
  }
}

/** Apply fixDoubleEncoding to known text fields of an object */
export function fixDocEncoding(doc: Record<string, any>): Record<string, any> {
  const fields = ["title", "summary", "content", "description", "name"];
  for (const key of fields) {
    if (typeof doc[key] === "string") {
      doc[key] = fixDoubleEncoding(doc[key]);
    }
  }
  return doc;
}
