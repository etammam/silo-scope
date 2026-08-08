import { useEffect, useRef, useState } from "react";
import { FAKER_FIELDS, FAKER_LOCALES } from "../mockTokens";

interface TokenPickerProps {
  targetRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
}

export function TokenPicker({ targetRef }: TokenPickerProps) {
  const [open, setOpen] = useState(false);
  const [localeFilter, setLocaleFilter] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setLocaleFilter(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function insertToken(token: string) {
    const input = targetRef.current;
    if (!input) return;

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const before = input.value.slice(0, start);
    const after = input.value.slice(end);
    const nextValue = before + token + after;
    input.value = nextValue;

    const event = new Event("input", { bubbles: true });
    input.dispatchEvent(event);

    input.focus();
    const cursorPos = start + token.length;
    input.setSelectionRange(cursorPos, cursorPos);

    setOpen(false);
    setLocaleFilter(null);
  }

  return (
    <div className="token-picker">
      <button
        ref={buttonRef}
        aria-label="Insert mock token"
        aria-expanded={open}
        className="token-picker__trigger"
        onClick={() => setOpen((o) => !o)}
        title="Insert mock token"
        type="button"
      >
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
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {open && (
        <div ref={popoverRef} className="token-picker__popover" role="menu">
          {localeFilter ? (
            <>
              <div className="token-picker__back">
                <button
                  className="token-picker__back-button"
                  onClick={() => setLocaleFilter(null)}
                  type="button"
                >
                  ← Back to fields
                </button>
                <span className="token-picker__field-label">
                  {localeFilter}
                </span>
              </div>
              <div className="token-picker__grid">
                {FAKER_LOCALES.map((locale: string) => (
                  <button
                    key={locale}
                    className="token-picker__item"
                    onClick={() =>
                      insertToken(`{{faker.${localeFilter}:${locale}}}`)
                    }
                    role="menuitem"
                    title={`Locale: ${locale}`}
                    type="button"
                  >
                    <span className="token-picker__item-name">{locale}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="token-picker__header">
                <strong>Mock Tokens</strong>
                <span>Click to insert at cursor</span>
              </div>
              <div className="token-picker__grid">
                {FAKER_FIELDS.map((field: string) => (
                  <button
                    key={field}
                    className="token-picker__item"
                    onClick={() => insertToken(`{{faker.${field}}}`)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setLocaleFilter(field);
                    }}
                    role="menuitem"
                    title={`${field} (right-click for locales)`}
                    type="button"
                  >
                    <span className="token-picker__item-name">{field}</span>
                  </button>
                ))}
              </div>
              <div className="token-picker__hint">
                Right-click a field to pick a locale
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
