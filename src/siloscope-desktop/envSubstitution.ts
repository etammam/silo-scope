const ENV_TOKEN_REGEX = /\$\{env:([^}]+)\}|\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g;

interface TokenMatch {
  key: string;
  start: number;
  end: number;
  raw: string;
}

function findMatches(text: string): TokenMatch[] {
  const matches: TokenMatch[] = [];
  ENV_TOKEN_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ENV_TOKEN_REGEX.exec(text)) !== null) {
    const key = match[1] ?? match[2];
    matches.push({
      key,
      start: match.index,
      end: match.index + match[0].length,
      raw: match[0],
    });
  }

  return matches;
}

/**
 * Extracts all environment token keys from the given text.
 * Tokens use the syntax `${env:KEY}` or `{{KEY}}`.
 */
export function extractEnvTokens(text: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];

  for (const match of findMatches(text)) {
    if (!seen.has(match.key)) {
      seen.add(match.key);
      tokens.push(match.key);
    }
  }

  return tokens;
}

/**
 * Substitutes all `${env:KEY}` and `{{KEY}}` tokens in the text with their corresponding
 * values from the provided variables map.
 */
export function substituteEnvTokens(
  text: string,
  variables: Record<string, string>,
): string {
  return text.replace(ENV_TOKEN_REGEX, (_match, key1: string | undefined, key2: string | undefined) => {
    const key = (key1 ?? key2) ?? "";
    return variables[key] ?? _match;
  });
}

/**
 * Finds environment token keys present in the text that are missing
 * from the provided variables map.
 */
export function findMissingTokens(
  text: string,
  variables: Record<string, string>,
): string[] {
  const tokens = extractEnvTokens(text);
  return tokens.filter((key) => !(key in variables));
}

/**
 * Finds all token matches and classifies them as valid or missing.
 */
export function classifyTokens(
  text: string,
  variables: Record<string, string>,
): { valid: TokenMatch[]; missing: TokenMatch[] } {
  const valid: TokenMatch[] = [];
  const missing: TokenMatch[] = [];

  for (const match of findMatches(text)) {
    if (match.key in variables) {
      valid.push(match);
    } else {
      missing.push(match);
    }
  }

  return { valid, missing };
}
