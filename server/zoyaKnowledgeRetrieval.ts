import type { NutriKnowledgeEntry } from "../drizzle/schema";

const SEARCH_STOP_WORDS = new Set([
  "а", "без", "бы", "был", "была", "были", "было", "быть", "в", "вам", "вас",
  "во", "все", "вы", "где", "да", "для", "до", "его", "ее", "если", "есть", "еще",
  "же", "за", "и", "из", "или", "их", "к", "как", "ко", "когда", "кто", "ли",
  "либо", "мне", "мой", "мы", "на", "надо", "наш", "не", "нет", "но", "о", "об",
  "он", "она", "они", "от", "по", "под", "при", "с", "со", "так", "также", "то",
  "только", "у", "уже", "чем", "что", "чтобы", "эта", "эти", "это", "я", "меня",
  "можно", "какой", "какая", "какие", "какое", "расскажи", "расскажите", "подскажи",
  "подскажите", "скажи", "скажите", "помоги", "помогите", "сколько", "подходит",
  "подойдут", "подойдет", "полезен", "полезна", "полезно", "полезны", "безопасен",
  "безопасна", "безопасно", "безопасны",
]);

const MAX_QUERY_TERMS = 12;

export interface KnowledgeSearchPlan {
  terms: string[];
  patterns: string[];
}

export interface RankedKnowledgeEntry {
  entry: NutriKnowledgeEntry;
  score: number;
  matchedTerms: string[];
  titleMatches: number;
  tagMatches: number;
  contentMatches: number;
}

export function normalizeKnowledgeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function canonicalizeDomainTerm(token: string): string {
  if (token === "a2" || token === "а2") return "a2";
  if (/^кальц/.test(token)) return "кальц";
  if (/^бел(ок|к)/.test(token)) return "белк";
  if (/^коз/.test(token)) return "коз";
  if (/^(овеч|овц)/.test(token)) return "овеч";
  if (/^молок/.test(token)) return "молок";
  if (/^казеин/.test(token)) return "казеин";
  if (/^аллерг/.test(token)) return "аллерг";
  if (/^лактоз/.test(token)) return "лактоз";
  if (/^(неперенос|недостаточ)/.test(token)) return "неперенос";
  if (/^микробиом/.test(token)) return "микробиом";
  if (/^фермент/.test(token)) return "фермент";
  if (/^продукт/.test(token)) return "продукт";
  if (/^сыр/.test(token)) return "сыр";
  if (/^витамин/.test(token)) return "витамин";
  if (/^минерал/.test(token)) return "минерал";
  if (/^фосфор/.test(token)) return "фосфор";
  if (/^антиоксид/.test(token)) return "антиоксид";
  if (/^пробиот/.test(token)) return "пробиот";
  if (/^триглиц/.test(token)) return "триглицерид";
  if (/^пищевар/.test(token)) return "пищевар";
  if (/^кишеч/.test(token)) return "кишеч";
  return stemRussianToken(token);
}

function stemRussianToken(token: string): string {
  if (!/[а-я]/.test(token) || token.length < 5) return token;

  const suffixes = [
    "ьими", "ьего", "ьему", "иями", "ями", "иях", "ией", "остью", "ениями",
    "ение", "ений", "ения", "ению", "енный", "енная", "енные", "енного",
    "ированными", "ированного", "ированные", "ированный", "ировать", "ьих", "ьем",
    "ьей", "ого", "ему", "ами", "ями", "ах", "ях", "ия", "ии", "ию", "ий",
    "ый", "ая", "ое", "ые", "ой", "ей", "ым", "ем", "ам", "ям", "ом", "ов",
    "ев", "а", "я", "ы", "и", "у", "ю", "е", "о",
  ];

  for (const suffix of suffixes) {
    if (token.endsWith(suffix) && token.length - suffix.length >= 4) {
      return token.slice(0, -suffix.length).replace(/ь$/, "");
    }
  }

  return token;
}

export function extractKnowledgeSearchTerms(query: string): string[] {
  const normalized = normalizeKnowledgeText(query);
  if (!normalized) return [];

  const terms: string[] = [];
  const seen = new Set<string>();

  for (const token of normalized.split(" ")) {
    if (!token || SEARCH_STOP_WORDS.has(token)) continue;
    if (token.length < 3 && !/\d/.test(token)) continue;

    const canonical = canonicalizeDomainTerm(token);
    if (canonical.length < 3 && !/\d/.test(canonical)) continue;
    if (seen.has(canonical)) continue;

    seen.add(canonical);
    terms.push(canonical);
    if (terms.length >= MAX_QUERY_TERMS) break;
  }

  return terms;
}

export function buildKnowledgeSearchPlan(query: string): KnowledgeSearchPlan {
  const terms = extractKnowledgeSearchTerms(query);
  const patterns = Array.from(
    new Set(terms.flatMap((term) => (term === "a2" ? ["a2", "а2"] : [term]))),
  );
  return { terms, patterns };
}

function entryTerms(value: string | null | undefined): Set<string> {
  return new Set(extractKnowledgeSearchTerms(value ?? ""));
}

function confidenceRank(confidence: NutriKnowledgeEntry["confidence"]): number {
  if (confidence === "verified") return 3;
  if (confidence === "trusted") return 2;
  return 0;
}

function updatedTimestamp(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function exactDedupeKey(entry: NutriKnowledgeEntry): string {
  return `${normalizeKnowledgeText(entry.title)}\n${normalizeKnowledgeText(entry.content)}`;
}

export function scoreKnowledgeEntries(
  entries: NutriKnowledgeEntry[],
  query: string,
): RankedKnowledgeEntry[] {
  const queryTerms = extractKnowledgeSearchTerms(query);
  if (queryTerms.length === 0) return [];

  return entries
    .filter((entry) => entry.status === "active")
    .map((entry) => {
      const titleTerms = entryTerms(entry.title);
      const tagTerms = entryTerms(Array.isArray(entry.tags) ? entry.tags.join(" ") : "");
      const contentTerms = entryTerms(entry.content);
      const matchedTerms: string[] = [];
      let titleMatches = 0;
      let tagMatches = 0;
      let contentMatches = 0;
      let score = 0;

      for (const term of queryTerms) {
        const inTitle = titleTerms.has(term);
        const inTags = tagTerms.has(term);
        const inContent = contentTerms.has(term);
        if (!inTitle && !inTags && !inContent) continue;

        matchedTerms.push(term);
        if (inTitle) {
          titleMatches += 1;
          score += 8;
        } else if (inTags) {
          tagMatches += 1;
          score += 6;
        } else {
          contentMatches += 1;
          score += 3;
        }

        if (inTitle && inTags) score += 1;
        if ((inTitle || inTags) && inContent) score += 1;
      }

      const coverage = matchedTerms.length / queryTerms.length;
      score += coverage * 12;
      score += (titleMatches / queryTerms.length) * 6;
      score += confidenceRank(entry.confidence);

      return {
        entry,
        score,
        matchedTerms,
        titleMatches,
        tagMatches,
        contentMatches,
      };
    })
    .filter((ranked) => ranked.matchedTerms.length > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.matchedTerms.length !== a.matchedTerms.length) {
        return b.matchedTerms.length - a.matchedTerms.length;
      }
      if (b.titleMatches !== a.titleMatches) return b.titleMatches - a.titleMatches;
      const confidenceDiff = confidenceRank(b.entry.confidence) - confidenceRank(a.entry.confidence);
      if (confidenceDiff !== 0) return confidenceDiff;
      const updatedDiff = updatedTimestamp(b.entry.updatedAt) - updatedTimestamp(a.entry.updatedAt);
      if (updatedDiff !== 0) return updatedDiff;
      return a.entry.id - b.entry.id;
    });
}

export function rankKnowledgeEntries(
  entries: NutriKnowledgeEntry[],
  query: string,
  limit = 10,
): NutriKnowledgeEntry[] {
  if (limit <= 0) return [];

  const seen = new Set<string>();
  const results: NutriKnowledgeEntry[] = [];

  for (const ranked of scoreKnowledgeEntries(entries, query)) {
    const key = exactDedupeKey(ranked.entry);
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(ranked.entry);
    if (results.length >= limit) break;
  }

  return results;
}
