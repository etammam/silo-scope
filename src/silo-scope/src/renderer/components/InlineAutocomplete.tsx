import React, { useCallback, useEffect, useRef, useState } from "react";
import { FAKER_FIELDS, FAKER_LOCALES } from "../mockTokens";

interface InlineAutocompleteProps {
  children: React.ReactElement<HTMLInputElement | HTMLTextAreaElement>;
  envVars?: string[];
}

type Suggestion = {
  label: string;
  insert: string;
  detail?: string;
  icon: "faker" | "env";
};

export function InlineAutocomplete({
  children,
  envVars = [],
}: InlineAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [replaceStart, setReplaceStart] = useState(0);
  const [replaceEnd, setReplaceEnd] = useState(0);

  const computeSuggestions = useCallback(
    (
      value: string,
      cursorPos: number,
    ): { suggestions: Suggestion[]; start: number; end: number } | null => {
      const before = value.slice(0, cursorPos);

      const localeMatch = /\{\{faker\.([a-zA-Z0-9_]+):$/.exec(before);
      if (localeMatch) {
        const field = localeMatch[1];
        return {
          suggestions: FAKER_LOCALES.map((locale) => ({
            label: `${locale}`,
            insert: `{{faker.${field}:${locale}}}`,
            detail: `${locale} locale`,
            icon: "faker" as const,
          })),
          start: before.lastIndexOf("{{"),
          end: cursorPos,
        };
      }

      const fieldMatch = /\{\{faker\.([a-zA-Z0-9_]*)$/.exec(before);
      if (fieldMatch) {
        const prefix = fieldMatch[1] ?? "";
        const base = before.lastIndexOf("{{");
        const suggs: Suggestion[] = FAKER_FIELDS.filter((f) =>
          f.startsWith(prefix),
        ).map((field) => ({
          label: field,
          insert: `{{faker.${field}}}`,
          detail: `faker.${field}`,
          icon: "faker" as const,
        }));

        if (FAKER_FIELDS.includes(prefix as (typeof FAKER_FIELDS)[number])) {
          for (const locale of FAKER_LOCALES) {
            suggs.push({
              label: `${prefix}:${locale}`,
              insert: `{{faker.${prefix}:${locale}}}`,
              detail: `${locale} locale`,
              icon: "faker" as const,
            });
          }
        }

        return {
          suggestions: suggs,
          start: base,
          end: cursorPos,
        };
      }

      const envSyntaxMatch = /\$\{env:([A-Za-z0-9_]*)$/.exec(before);
      if (envSyntaxMatch) {
        const prefix = envSyntaxMatch[1] ?? "";
        const base = before.lastIndexOf("${env:");
        const matches = envVars.filter((v) => v.startsWith(prefix));
        if (matches.length === 0) return null;
        return {
          suggestions: matches.map((v) => ({
            label: v,
            insert: `${v}}`,
            detail: "env",
            icon: "env" as const,
          })),
          start: base,
          end: cursorPos,
        };
      }

      const startMatch = /\{\{([a-zA-Z0-9_]*)$/.exec(before);
      if (startMatch) {
        const prefix = startMatch[1] ?? "";
        const base = before.lastIndexOf("{{");
        const suggs: Suggestion[] = [];

        if (prefix === "" || "faker".startsWith(prefix)) {
          suggs.push({
            label: "faker.",
            insert: `{{faker.`,
            detail: "mock data",
            icon: "faker" as const,
          });
        }

        if (prefix.startsWith("faker.")) {
          const fieldPrefix = prefix.slice("faker.".length);
          FAKER_FIELDS.filter((f) => f.startsWith(fieldPrefix)).forEach(
            (field) => {
              suggs.push({
                label: field,
                insert: `{{faker.${field}}}`,
                detail: `faker.${field}`,
                icon: "faker" as const,
              });
            },
          );
        }

        if (!prefix.startsWith("faker")) {
          envVars
            .filter((v) => v.startsWith(prefix))
            .forEach((v) => {
              suggs.push({
                label: v,
                insert: `{{${v}}}`,
                detail: "env",
                icon: "env" as const,
              });
            });
        }

        if (suggs.length === 0) return null;
        return {
          suggestions: suggs,
          start: base,
          end: cursorPos,
        };
      }

      return null;
    },
    [envVars],
  );

  const handleInput = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;

    const cursorPos = input.selectionStart ?? input.value.length;
    const result = computeSuggestions(input.value, cursorPos);

    if (result && result.suggestions.length > 0) {
      setSuggestions(result.suggestions);
      setReplaceStart(result.start);
      setReplaceEnd(result.end);
      setSelectedIndex(0);
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [computeSuggestions]);

  const applySuggestion = useCallback(
    (index: number) => {
      const input = inputRef.current;
      if (!input || !suggestions[index]) return;

      const before = input.value.slice(0, replaceStart);
      const after = input.value.slice(replaceEnd);
      let insert = suggestions[index].insert;

      let existingClose = 0;
      if (after.startsWith("}}")) existingClose = 2;
      else if (after.startsWith("}")) existingClose = 1;

      let insertClose = 0;
      for (let i = insert.length - 1; i >= 0 && insert[i] === "}"; i--) {
        insertClose++;
      }

      const overlap = Math.min(insertClose, existingClose);
      if (overlap > 0) {
        insert = insert.slice(0, insert.length - overlap);
      }

      const newValue = before + insert + after;

      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      if (valueSetter) {
        valueSetter.call(input, newValue);
      } else {
        input.value = newValue;
      }

      const event = new InputEvent("input", {
        bubbles: true,
        cancelable: false,
      });
      input.dispatchEvent(event);

      const cursorPos = replaceStart + insert.length;
      input.focus();
      input.setSelectionRange(cursorPos, cursorPos);

      setOpen(false);
    },
    [suggestions, replaceStart, replaceEnd],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!open) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((i) => (i + 1) % suggestions.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex(
          (i) => (i - 1 + suggestions.length) % suggestions.length,
        );
      } else if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        applySuggestion(selectedIndex);
      } else if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    },
    [open, suggestions.length, selectedIndex, applySuggestion],
  );

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const child = children as React.ReactElement<any>;
  const childRef = child.props.ref;
  const clonedChild = React.cloneElement(child, {
    ref: (el: HTMLInputElement | HTMLTextAreaElement | null) => {
      inputRef.current = el;
      if (typeof childRef === "function") childRef(el);
      else if (childRef && "current" in childRef) childRef.current = el;
    },
    onInput: (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      handleInput();
      child.props.onInput?.(e);
    },
    onKeyDown: (
      e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      handleKeyDown(e);
      child.props.onKeyDown?.(e);
    },
    onClick: (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      handleInput();
      child.props.onClick?.(e);
    },
  });

  return (
    <div ref={containerRef} className="inline-autocomplete">
      {clonedChild}
      {open && suggestions.length > 0 && (
        <div className="inline-autocomplete__dropdown" role="listbox">
          {suggestions.map((s, i) => (
            <button
              key={s.label + i}
              className={`inline-autocomplete__item ${i === selectedIndex ? "inline-autocomplete__item--selected" : ""}`}
              onClick={() => applySuggestion(i)}
              onMouseEnter={() => setSelectedIndex(i)}
              role="option"
              aria-selected={i === selectedIndex}
              type="button"
            >
              <span
                className={`inline-autocomplete__icon inline-autocomplete__icon--${s.icon}`}
                aria-hidden="true"
              >
                {s.icon === "faker" ? (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                ) : (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                )}
              </span>
              <span className="inline-autocomplete__label">{s.label}</span>
              {s.detail && (
                <span className="inline-autocomplete__detail">{s.detail}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
