/**
 * Normalizes raw genre/category/subject strings from book providers
 * (Google Books categories, OpenLibrary subjects) into a curated set
 * of broad, user-friendly genre labels.
 *
 * Design decisions:
 * - A book with "Fiction / Fantasy / Epic" maps to "Fantasía"
 * - A book matching multiple broad genres gets ALL of them (max 3)
 * - Unknown/unmappable genres are discarded (no "Sin género" noise)
 * - Matching is case-insensitive and works on partial segments
 *   (e.g. "Fiction / Fantasy / Epic" splits into ["fiction", "fantasy", "epic"])
 */

// ---------------------------------------------------------------------------
// Genre catalog — order matters for display priority
// ---------------------------------------------------------------------------

const GENRE_MAP: Record<string, string[]> = {
  "Fantasía": [
    "fantasy", "fantasia", "epic fantasy", "urban fantasy", "dark fantasy",
    "high fantasy", "sword", "sorcery", "mythological", "fairy tale",
  ],
  "Ciencia Ficción": [
    "science fiction", "sci-fi", "scifi", "dystopia", "dystopian",
    "cyberpunk", "space opera", "post-apocalyptic", "time travel",
    "alien", "futuristic",
  ],
  "Terror": [
    "horror", "terror", "gothic", "supernatural", "paranormal",
    "ghost", "haunted", "zombie", "lovecraftian", "creepy",
  ],
  "Misterio": [
    "mystery", "detective", "crime", "thriller", "suspense",
    "noir", "whodunit", "espionage", "spy", "police",
  ],
  "Romance": [
    "romance", "love", "romantic", "chick lit", "contemporary romance",
    "historical romance", "erotic",
  ],
  "Historia": [
    "history", "historical", "historia", "ancient", "medieval",
    "world war", "civil war", "revolution", "archaeology",
  ],
  "Biografía": [
    "biography", "autobiography", "memoir", "biographical",
    "personal narrative", "life story",
  ],
  "Ciencia": [
    "science", "physics", "chemistry", "biology", "astronomy",
    "neuroscience", "geology", "ecology", "evolution", "genetics",
    "quantum", "cosmology",
  ],
  "Tecnología": [
    "technology", "computer", "programming", "software", "engineering",
    "artificial intelligence", "machine learning", "data science",
    "coding", "web development", "clean code", "architecture",
  ],
  "Filosofía": [
    "philosophy", "philosophical", "ethics", "metaphysics",
    "existentialism", "stoicism", "logic",
  ],
  "Psicología": [
    "psychology", "psychological", "mental health", "cognitive",
    "behavioral", "psychotherapy", "mindfulness",
  ],
  "Economía": [
    "economics", "economy", "finance", "business", "entrepreneurship",
    "investing", "market", "capitalism", "startup",
  ],
  "Política": [
    "politics", "political", "government", "democracy", "policy",
    "geopolitics", "diplomacy", "activism",
  ],
  "Arte": [
    "art", "painting", "sculpture", "photography", "design",
    "illustration", "graphic", "visual arts", "architecture",
    "cinema", "film", "music",
  ],
  "Poesía": [
    "poetry", "poems", "verse", "poetic", "lyric",
  ],
  "Ensayo": [
    "essay", "essays", "literary criticism", "non-fiction",
    "nonfiction", "creative nonfiction",
  ],
  "Infantil": [
    "children", "kids", "juvenile", "picture book", "middle grade",
    "bedtime", "young readers",
  ],
  "Juvenil": [
    "young adult", "ya fiction", "teen", "adolescent", "coming of age",
  ],
  "Aventura": [
    "adventure", "action", "quest", "exploration", "survival",
    "pirate", "treasure",
  ],
  "Humor": [
    "humor", "comedy", "satire", "parody", "funny", "comic",
    "humorous", "wit",
  ],
  "Autoayuda": [
    "self-help", "self help", "personal development", "motivation",
    "productivity", "habits", "leadership", "coaching",
  ],
  "Cocina": [
    "cooking", "cookbook", "recipe", "culinary", "gastronomy",
    "baking", "food",
  ],
  "Religión": [
    "religion", "religious", "theology", "spiritual", "spirituality",
    "bible", "christianity", "islam", "buddhism", "hindu",
  ],
  "Deportes": [
    "sports", "athletics", "football", "soccer", "basketball",
    "tennis", "fitness", "exercise", "martial arts",
  ],
  "Naturaleza": [
    "nature", "environment", "wildlife", "animal", "botanical",
    "gardening", "outdoor", "travel", "geography",
  ],
  "Derecho": [
    "law", "legal", "jurisprudence", "constitutional", "criminal law",
    "human rights",
  ],
};

// Pre-compute a flat lookup: keyword → normalized genre
const KEYWORD_TO_GENRE = new Map<string, string>();
for (const [genre, keywords] of Object.entries(GENRE_MAP)) {
  for (const keyword of keywords) {
    KEYWORD_TO_GENRE.set(keyword.toLowerCase(), genre);
  }
}

const MAX_GENRES_PER_BOOK = 3;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Takes an array of raw genre strings from any provider and returns
 * a deduplicated, sorted array of normalized broad genre labels.
 *
 * Returns empty array if no genres could be mapped.
 */
export function normalizeGenres(rawGenres: string[]): string[] {
  if (rawGenres.length === 0) return [];

  const matched = new Set<string>();

  for (const raw of rawGenres) {
    // Split compound genres: "Fiction / Fantasy / Epic" → ["fiction", "fantasy", "epic"]
    const segments = raw
      .toLowerCase()
      .split(/[/,|·—–-]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    // Try matching the full raw string first, then individual segments
    const candidates = [raw.toLowerCase(), ...segments];

    for (const candidate of candidates) {
      // Direct keyword match (exact)
      const direct = KEYWORD_TO_GENRE.get(candidate);
      if (direct) {
        matched.add(direct);
        continue;
      }

      // Partial match: candidate must CONTAIN the keyword (not the reverse)
      // This prevents "fiction" from matching "science fiction"
      for (const [keyword, genre] of KEYWORD_TO_GENRE) {
        if (keyword.length >= 4 && candidate.includes(keyword)) {
          matched.add(genre);
        }
      }
    }
  }

  // Return sorted, capped at MAX_GENRES_PER_BOOK
  return Array.from(matched)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, MAX_GENRES_PER_BOOK);
}

/**
 * Groups books by their normalized genres.
 * Books with multiple genres appear in each section.
 * Books with no mappable genres go to the fallback label.
 */
export function groupByNormalizedGenre<T extends { genres: string[] }>(
  books: T[],
  fallbackLabel: string,
): [string, T[]][] {
  const genreMap = new Map<string, T[]>();

  for (const book of books) {
    const normalized = normalizeGenres(book.genres);
    const labels = normalized.length > 0 ? normalized : [fallbackLabel];

    for (const label of labels) {
      const list = genreMap.get(label) ?? [];
      list.push(book);
      genreMap.set(label, list);
    }
  }

  // Sort alphabetically, fallback label last
  return Array.from(genreMap.entries()).sort(([a], [b]) => {
    if (a === fallbackLabel) return 1;
    if (b === fallbackLabel) return -1;
    return a.localeCompare(b);
  });
}
