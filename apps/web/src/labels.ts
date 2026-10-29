/** Format UI metadata labels without modifying source prose or identifiers. */
export function labelCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/(^|[\s/-])\p{Ll}/gu, (part) => part.toLocaleUpperCase());
}
