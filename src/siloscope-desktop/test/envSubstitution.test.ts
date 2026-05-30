import { describe, expect, it } from "vitest";
import { extractEnvTokens, substituteEnvTokens, findMissingTokens, classifyTokens } from "@/renderer/envSubstitution";

describe("envSubstitution", () => {
  describe("extractEnvTokens", () => {
    it("extracts unique token keys from ${env:KEY} syntax", () => {
      const text = '{"url": "${env:API_URL}", "key": "${env:API_KEY}"}';
      expect(extractEnvTokens(text)).toEqual(["API_URL", "API_KEY"]);
    });

    it("extracts unique token keys from {{KEY}} syntax", () => {
      const text = '{"url": "{{API_URL}}", "key": "{{API_KEY}}"}';
      expect(extractEnvTokens(text)).toEqual(["API_URL", "API_KEY"]);
    });

    it("extracts tokens from mixed syntaxes", () => {
      const text = '"${env:HOST}" and "{{PORT}}"';
      expect(extractEnvTokens(text)).toEqual(["HOST", "PORT"]);
    });

    it("returns empty array when no tokens are present", () => {
      expect(extractEnvTokens('{"url": "http://localhost"}')).toEqual([]);
    });

    it("deduplicates repeated tokens", () => {
      const text = '"{{HOST}}" and "{{HOST}}"';
      expect(extractEnvTokens(text)).toEqual(["HOST"]);
    });
  });

  describe("substituteEnvTokens", () => {
    it("replaces ${env:KEY} tokens with their mapped values", () => {
      const text = '{"url": "${env:API_URL}"}';
      const result = substituteEnvTokens(text, { API_URL: "https://api.example.com" });
      expect(result).toBe('{"url": "https://api.example.com"}');
    });

    it("replaces {{KEY}} tokens with their mapped values", () => {
      const text = '{"url": "{{API_URL}}"}';
      const result = substituteEnvTokens(text, { API_URL: "https://api.example.com" });
      expect(result).toBe('{"url": "https://api.example.com"}');
    });

    it("leaves unmatched tokens unchanged", () => {
      const text = '{"url": "{{MISSING}}", "key": "${env:MISSING}"}';
      const result = substituteEnvTokens(text, {});
      expect(result).toBe('{"url": "{{MISSING}}", "key": "${env:MISSING}"}');
    });

    it("handles multiple tokens in the same text", () => {
      const text = '${env:A} and {{B}}';
      const result = substituteEnvTokens(text, { A: "1", B: "2" });
      expect(result).toBe("1 and 2");
    });
  });

  describe("findMissingTokens", () => {
    it("returns keys that are not present in the variables map", () => {
      const text = '{"url": "${env:API_URL}", "key": "{{API_KEY}}"}';
      const missing = findMissingTokens(text, { API_URL: "http://localhost" });
      expect(missing).toEqual(["API_KEY"]);
    });

    it("returns empty array when all tokens are resolved", () => {
      const text = '{"url": "{{API_URL}}"}';
      const missing = findMissingTokens(text, { API_URL: "http://localhost" });
      expect(missing).toEqual([]);
    });

    it("returns empty array when there are no tokens", () => {
      expect(findMissingTokens('{"url": "http://localhost"}', {})).toEqual([]);
    });
  });

  describe("classifyTokens", () => {
    it("classifies valid and missing tokens correctly", () => {
      const text = '{"url": "{{API_URL}}", "key": "{{API_KEY}}", "host": "${env:HOST}"}';
      const result = classifyTokens(text, { API_URL: "https://example.com", HOST: "localhost" });

      expect(result.valid.map((t) => t.key)).toEqual(["API_URL", "HOST"]);
      expect(result.missing.map((t) => t.key)).toEqual(["API_KEY"]);
    });

    it("captures correct character ranges for tokens", () => {
      const text = '{"a": "{{A}}", "b": "{{B}}"}';
      const result = classifyTokens(text, { A: "1" });

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].key).toBe("A");
      expect(text.slice(result.valid[0].start, result.valid[0].end)).toBe("{{A}}");

      expect(result.missing).toHaveLength(1);
      expect(result.missing[0].key).toBe("B");
      expect(text.slice(result.missing[0].start, result.missing[0].end)).toBe("{{B}}");
    });
  });
});
