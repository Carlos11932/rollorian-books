/**
 * Converts a string to Title Case.
 * Used to normalize genre strings from Google Books API
 * which return inconsistent casing ("fiction", "Fiction", "FICTION").
 */
export function toTitleCase(str: string): string {
  if (!str) return ""
  return str
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

/**
 * Strips HTML tags from a string and decodes common HTML entities.
 * Google Books API returns descriptions with HTML formatting.
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return ""
  return html
    .replace(/<[^>]*>/g, " ")        // remove HTML tags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")            // collapse multiple spaces
    .trim()
}
