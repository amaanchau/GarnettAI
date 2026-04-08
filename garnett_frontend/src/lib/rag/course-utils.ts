/** Normalize user-facing course code to "CSCE 221" style */
export function normalizeCourseCode(course: string): string {
  return course.trim().toUpperCase().replace(/\s+/g, " ");
}

/** Table name used in Postgres (e.g. csce221) */
export function courseToTableName(course: string): string {
  return course.toLowerCase().replace(/\s+/g, "");
}

/** Only allow safe identifiers for dynamic table names */
export function isSafeTableName(name: string): boolean {
  return /^[a-z0-9]+$/.test(name);
}

/**
 * e.g. "csce221" -> "CSCE 221" (letters + digits table names).
 * Falls back to uppercase if no match.
 */
export function formatTableNameAsCourseCode(tableName: string): string {
  const m = tableName.match(/^([a-z]+)(\d+)$/i);
  if (m) return `${m[1].toUpperCase()} ${m[2]}`;
  return tableName.toUpperCase();
}

/** Sanitize a user/LLM prefix for ILIKE (e.g. csce -> csce) */
export function sanitizeTableNamePrefix(prefix: string): string | null {
  const raw = prefix.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!raw || raw.length > 12) return null;
  return raw;
}

/** Numeric part of table name, e.g. csce421 -> 421. */
export function parseCourseNumberFromTableName(tableName: string): number | null {
  const m = tableName.match(/^([a-z]+)(\d+)$/i);
  if (!m) return null;
  return parseInt(m[2], 10);
}
