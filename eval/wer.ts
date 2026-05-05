/**
 * Word Error Rate computation.
 * WER = (substitutions + deletions + insertions) / total reference words
 *
 * Tokenization is intentionally simple — lowercase, strip punctuation,
 * collapse whitespace, split on space. Numbers spelled out vs. digits
 * are normalized to a canonical form before scoring.
 */

const NUMBER_WORDS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", thirteen: "13", fourteen: "14",
  fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18",
  nineteen: "19", twenty: "20",
};

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => NUMBER_WORDS[w] ?? w);
}

export type WerResult = {
  wer: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  hits: number;
  refLength: number;
  hypLength: number;
};

export function wer(reference: string, hypothesis: string): WerResult {
  const ref = tokenize(reference);
  const hyp = tokenize(hypothesis);
  const m = ref.length;
  const n = hyp.length;

  // Levenshtein DP with op tracking
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  const op: ("M" | "S" | "D" | "I")[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill("M"));

  for (let i = 0; i <= m; i++) { dp[i][0] = i; op[i][0] = "D"; }
  for (let j = 0; j <= n; j++) { dp[0][j] = j; op[0][j] = "I"; }
  op[0][0] = "M";

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (ref[i - 1] === hyp[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
        op[i][j] = "M";
      } else {
        const sub = dp[i - 1][j - 1] + 1;
        const del = dp[i - 1][j] + 1;
        const ins = dp[i][j - 1] + 1;
        const min = Math.min(sub, del, ins);
        dp[i][j] = min;
        op[i][j] = min === sub ? "S" : min === del ? "D" : "I";
      }
    }
  }

  let i = m, j = n;
  let substitutions = 0, deletions = 0, insertions = 0, hits = 0;
  while (i > 0 || j > 0) {
    const o = op[i][j];
    if (o === "M") { hits++; i--; j--; }
    else if (o === "S") { substitutions++; i--; j--; }
    else if (o === "D") { deletions++; i--; }
    else { insertions++; j--; }
  }

  const errors = substitutions + deletions + insertions;
  return {
    wer: m === 0 ? 0 : errors / m,
    substitutions, deletions, insertions, hits,
    refLength: m, hypLength: n,
  };
}

/**
 * Domain-term recall: of the domain terms that appear in the reference,
 * what fraction are correctly transcribed in the hypothesis?
 *
 * Multi-word terms ("ridge cap") are matched as adjacent token sequences.
 * Single-word terms are matched as token-set membership.
 */
export function domainTermRecall(
  reference: string,
  hypothesis: string,
  domainTerms: string[],
): { found: number; expected: number; missed: string[]; recall: number } {
  const refTokens = tokenize(reference);
  const hypTokens = tokenize(hypothesis);
  const refSet = new Set(refTokens);

  const expected: string[] = [];
  for (const term of domainTerms) {
    const t = tokenize(term);
    if (t.length === 0) continue;
    if (t.length === 1) {
      if (refSet.has(t[0])) expected.push(term);
    } else {
      if (containsSubsequence(refTokens, t)) expected.push(term);
    }
  }

  const missed: string[] = [];
  let found = 0;
  for (const term of expected) {
    const t = tokenize(term);
    const matched = t.length === 1 ? hypTokens.includes(t[0]) : containsSubsequence(hypTokens, t);
    if (matched) found++;
    else missed.push(term);
  }

  return {
    found,
    expected: expected.length,
    missed,
    recall: expected.length === 0 ? 1 : found / expected.length,
  };
}

function containsSubsequence(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0) return true;
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}
