import {
  FAKER_TOKEN_REGEX,
  findMockTokens,
  hasMockTokens,
  substituteMockTokens,
} from "@/renderer/mockTokens";
import { describe, expect, it } from "vitest";

describe("mockTokens", () => {
  describe("findMockTokens", () => {
    it("finds simple faker tokens without locale", () => {
      const text = '{"name": "{{faker.firstName}}"}';
      const matches = findMockTokens(text);
      expect(matches).toHaveLength(1);
      expect(matches[0].field).toBe("firstName");
      expect(matches[0].locale).toBeNull();
      expect(matches[0].raw).toBe("{{faker.firstName}}");
    });

    it("finds faker tokens with locale modifier", () => {
      const text = '{"name": "{{faker.firstName:fr}}"}';
      const matches = findMockTokens(text);
      expect(matches).toHaveLength(1);
      expect(matches[0].field).toBe("firstName");
      expect(matches[0].locale).toBe("fr");
      expect(matches[0].raw).toBe("{{faker.firstName:fr}}");
    });

    it("finds multiple tokens in the same text", () => {
      const text = "{{faker.firstName}} {{faker.lastName:de}} {{faker.uuid}}";
      const matches = findMockTokens(text);
      expect(matches).toHaveLength(3);
      expect(matches[0].field).toBe("firstName");
      expect(matches[1].field).toBe("lastName");
      expect(matches[1].locale).toBe("de");
      expect(matches[2].field).toBe("uuid");
    });

    it("returns empty array when no tokens are present", () => {
      expect(findMockTokens('{"name": "Alice"}')).toEqual([]);
    });

    it("ignores invalid token syntax", () => {
      expect(findMockTokens("{{firstName}}")).toEqual([]);
      expect(findMockTokens("${faker.firstName}")).toEqual([]);
      expect(findMockTokens("{{faker.123}}")).toEqual([]);
    });

    it("captures correct character ranges", () => {
      const text = "a{{faker.number}}b";
      const matches = findMockTokens(text);
      expect(matches).toHaveLength(1);
      expect(matches[0].start).toBe(1);
      expect(matches[0].end).toBe(17);
      expect(text.slice(matches[0].start, matches[0].end)).toBe(
        "{{faker.number}}",
      );
    });
  });

  describe("substituteMockTokens", () => {
    it("replaces a firstName token with a non-empty string", () => {
      const result = substituteMockTokens("{{faker.firstName}}");
      expect(result).not.toBe("{{faker.firstName}}");
      expect(result.length).toBeGreaterThan(0);
    });

    it("replaces a lastName token with a non-empty string", () => {
      const result = substituteMockTokens("{{faker.lastName}}");
      expect(result).not.toBe("{{faker.lastName}}");
      expect(result.length).toBeGreaterThan(0);
    });

    it("replaces uuid token with a UUID-like string", () => {
      const result = substituteMockTokens("{{faker.uuid}}");
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("replaces number token with a numeric string", () => {
      const result = substituteMockTokens("{{faker.number}}");
      expect(result).toMatch(/^\d+$/);
    });

    it("replaces boolean token with true or false", () => {
      const result = substituteMockTokens("{{faker.boolean}}");
      expect(["true", "false"]).toContain(result);
    });

    it("replaces email token with an email-like string", () => {
      const result = substituteMockTokens("{{faker.email}}");
      expect(result).toContain("@");
      expect(result).not.toBe("{{faker.email}}");
    });

    it("replaces multiple tokens in the same text", () => {
      const result = substituteMockTokens(
        "{{faker.firstName}} {{faker.lastName}}",
      );
      expect(result).not.toContain("{{faker.firstName}}");
      expect(result).not.toContain("{{faker.lastName}}");
      expect(result).toContain(" ");
    });

    it("handles tokens with supported locale modifiers", () => {
      const result = substituteMockTokens("{{faker.city:fr}}");
      expect(result).not.toBe("{{faker.city:fr}}");
      expect(result.length).toBeGreaterThan(0);
    });

    it("falls back to English for unsupported locales", () => {
      const result = substituteMockTokens("{{faker.firstName:xx}}");
      expect(result).not.toBe("{{faker.firstName:xx}}");
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toBe("");
    });

    it("does not modify text without faker tokens", () => {
      const text = '{"name": "Alice", "age": 30}';
      expect(substituteMockTokens(text)).toBe(text);
    });

    it("produces different values on successive calls (randomization)", () => {
      const results = new Set<string>();
      for (let i = 0; i < 20; i++) {
        results.add(substituteMockTokens("{{faker.number}}"));
      }
      expect(results.size).toBeGreaterThan(1);
    });

    it("replaces nested JSON payload tokens correctly", () => {
      const text =
        '{"user":"{{faker.firstName}}","id":"{{faker.uuid}}","active":{{faker.boolean}}}';
      const result = substituteMockTokens(text);
      expect(result).not.toContain("{{faker.firstName}}");
      expect(result).not.toContain("{{faker.uuid}}");
      expect(result).not.toContain("{{faker.boolean}}");
      expect(result).toContain('"user":"');
      expect(result).toContain('"id":"');
      expect(result).toMatch(/"active":(true|false)/);
    });

    it("replaces grain key tokens correctly", () => {
      const result = substituteMockTokens("user-{{faker.uuid}}");
      expect(result).toMatch(/^user-[0-9a-f]{8}-/);
    });

    it("handles fullName token", () => {
      const result = substituteMockTokens("{{faker.fullName}}");
      expect(result).not.toBe("{{faker.fullName}}");
      expect(result).toContain(" ");
    });

    it("handles date token with ISO format", () => {
      const result = substituteMockTokens("{{faker.date}}");
      expect(result).not.toBe("{{faker.date}}");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("handles phone token with a realistic phone format", () => {
      const result = substituteMockTokens("{{faker.phone}}");
      expect(result).not.toBe("{{faker.phone}}");
      expect(result.length).toBeGreaterThan(0);
      expect(result).toMatch(/\d/);
    });

    it("handles ip token with an IP address", () => {
      const result = substituteMockTokens("{{faker.ip}}");
      expect(result).not.toBe("{{faker.ip}}");
      expect(result.length).toBeGreaterThan(0);
      expect(result).toMatch(/^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+$/i);
    });

    it("handles url token with https prefix", () => {
      const result = substituteMockTokens("{{faker.url}}");
      expect(result).toMatch(/^https:\/\/www\.\w+/);
    });

    it("handles streetAddress token with leading number", () => {
      const result = substituteMockTokens("{{faker.streetAddress}}");
      expect(result).toMatch(/^\d+\s/);
    });

    it("handles zipCode token with a realistic postal code", () => {
      const result = substituteMockTokens("{{faker.zipCode}}");
      expect(result).not.toBe("{{faker.zipCode}}");
      expect(result.length).toBeGreaterThan(0);
      expect(result).toMatch(/\d/);
    });
  });

  describe("hasMockTokens", () => {
    it("returns true when faker tokens exist", () => {
      expect(hasMockTokens("{{faker.firstName}}")).toBe(true);
      expect(hasMockTokens("{{faker.number:fr}}")).toBe(true);
    });

    it("returns false when no faker tokens exist", () => {
      expect(hasMockTokens('{"name": "Alice"}')).toBe(false);
      expect(hasMockTokens("{{KEY}}")).toBe(false);
      expect(hasMockTokens("${env:VAR}")).toBe(false);
    });
  });

  describe("FAKER_TOKEN_REGEX edge cases", () => {
    it("does not match env-style tokens", () => {
      const text = "{{API_URL}} ${env:HOST}";
      FAKER_TOKEN_REGEX.lastIndex = 0;
      expect(FAKER_TOKEN_REGEX.exec(text)).toBeNull();
    });

    it("matches only lowercase locale codes", () => {
      expect(findMockTokens("{{faker.firstName:FR}}")).toHaveLength(0);
      expect(findMockTokens("{{faker.firstName:Fr}}")).toHaveLength(0);
    });

    it("matches tokens with underscores in field names", () => {
      const matches = findMockTokens("{{faker.job_title}}");
      expect(matches).toHaveLength(1);
      expect(matches[0].field).toBe("job_title");
    });
  });
});
