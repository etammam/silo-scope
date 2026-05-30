/**
 * Dynamic Mock Data Generation & Localization Introspection Engine.
 *
 * Token syntax: {{faker.fieldName}} or {{faker.fieldName:locale}}
 *
 * Examples:
 *   {{faker.firstName}}      -> English first name
 *   {{faker.firstName:fr}}   -> French first name
 *   {{faker.uuid}}           -> Random UUID
 *   {{faker.email}}          -> Random email address
 *
 * Locales fallback silently to English when unsupported.
 */

import {
  fakerEN,
  fakerFR,
  fakerDE,
  fakerES,
  fakerIT,
  fakerJA,
  fakerZH_CN,
  fakerRU,
  fakerPT_PT,
  fakerNL,
  fakerKO,
  fakerAR,
  type Faker,
} from "@faker-js/faker";

export const FAKER_TOKEN_REGEX = /\{\{faker\.([A-Za-z][A-Za-z0-9_]*)(?::([a-z]{2}))?\}\}/g;

export interface MockTokenMatch {
  raw: string;
  field: string;
  locale: string | null;
  start: number;
  end: number;
}

export const FAKER_FIELDS = [
  "firstName",
  "lastName",
  "fullName",
  "email",
  "uuid",
  "word",
  "sentence",
  "paragraph",
  "number",
  "boolean",
  "date",
  "city",
  "country",
  "phone",
  "company",
  "jobTitle",
  "product",
  "color",
  "ip",
  "url",
  "username",
  "streetAddress",
  "zipCode",
  "lorem",
] as const;

export const FAKER_LOCALES = [
  "en", "fr", "de", "es", "it", "ja", "zh", "ru", "pt", "nl", "ko", "ar",
] as const;

const DEFAULT_LOCALE = "en";

const SUPPORTED_LOCALES: Set<string> = new Set(FAKER_LOCALES);

const localeFakers: Record<string, Faker> = {
  en: fakerEN,
  fr: fakerFR,
  de: fakerDE,
  es: fakerES,
  it: fakerIT,
  ja: fakerJA,
  zh: fakerZH_CN,
  ru: fakerRU,
  pt: fakerPT_PT,
  nl: fakerNL,
  ko: fakerKO,
  ar: fakerAR,
};

function resolveLocale(locale: string | null): Faker {
  const key = locale && SUPPORTED_LOCALES.has(locale) ? locale : DEFAULT_LOCALE;
  return localeFakers[key] ?? fakerEN;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomHex(len: number): string {
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < len; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function uuidv4(): string {
  return `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-${randomHex(4)}-${randomHex(12)}`;
}

/* ------------------------------------------------------------------ */
/*  Generators                                                        */
/* ------------------------------------------------------------------ */

function generateValue(field: string, f: Faker): string {
  switch (field) {
    case "firstName":
      return f.person.firstName();
    case "lastName":
      return f.person.lastName();
    case "fullName":
      return f.person.fullName();
    case "email": {
      const genericDomains = ["example.com", "mail.test", "demo.org", "sample.net"];
      const domain = genericDomains[Math.floor(Math.random() * genericDomains.length)];
      const fn = f.person.firstName().toLowerCase().replace(/\s+/g, "");
      const ln = f.person.lastName().toLowerCase().replace(/\s+/g, "");
      return `${fn}.${ln}@${domain}`;
    }
    case "uuid":
      return uuidv4();
    case "word":
      return f.lorem.word();
    case "sentence":
      return f.lorem.sentence();
    case "paragraph":
      return f.lorem.paragraph();
    case "number":
      return String(randomInt(0, 9999));
    case "boolean":
      return String(Math.random() < 0.5);
    case "date":
      return f.date.recent({ days: 365 * 5 }).toISOString();
    case "city":
      return f.location.city();
    case "country":
      return f.location.country();
    case "phone":
      return f.phone.number();
    case "company":
      return f.company.name();
    case "jobTitle":
      return f.person.jobTitle();
    case "product":
      return `${f.commerce.productName()} ${f.commerce.productMaterial()}`;
    case "color":
      return f.color.human();
    case "ip":
      return f.internet.ip();
    case "url": {
      const tld = f.internet.domainSuffix();
      return `https://www.${f.lorem.word()}.${tld}`;
    }
    case "username": {
      const fn = f.person.firstName().toLowerCase().replace(/\s+/g, "");
      const ln = f.person.lastName().toLowerCase().replace(/\s+/g, "");
      return `${fn}_${ln}_${randomInt(10, 99)}`;
    }
    case "streetAddress":
      return f.location.streetAddress();
    case "zipCode":
      return f.location.zipCode();
    case "lorem":
      return f.lorem.sentence();
    default:
      return "";
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

export function findMockTokens(text: string): MockTokenMatch[] {
  const matches: MockTokenMatch[] = [];
  FAKER_TOKEN_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = FAKER_TOKEN_REGEX.exec(text)) !== null) {
    matches.push({
      raw: match[0],
      field: match[1],
      locale: match[2] ?? null,
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return matches;
}

/**
 * Substitutes all {{faker.fieldName}} and {{faker.fieldName:locale}} tokens
 * in the text with freshly generated mock values. Each invocation produces
 * new random data.
 */
export function substituteMockTokens(text: string): string {
  return text.replace(FAKER_TOKEN_REGEX, (_match, field: string, locale: string | undefined) => {
    const f = resolveLocale(locale ?? null);
    return generateValue(field, f);
  });
}

/**
 * Returns true if the text contains at least one faker token.
 */
export function hasMockTokens(text: string): boolean {
  FAKER_TOKEN_REGEX.lastIndex = 0;
  return FAKER_TOKEN_REGEX.test(text);
}
