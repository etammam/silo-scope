import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useEffect, useRef, useState } from "react";
import { FAKER_FIELDS, FAKER_LOCALES, hasMockTokens } from "../mockTokens";

type AppTheme = "dark" | "light" | "vscode-dark" | "vscode-light";

function mapToMonacoTheme(theme: AppTheme): string {
  return `siloscope-${theme}`;
}

const registeredCompletionLanguages = new Set<string>();

const completionEnvVarsRef: { current: string[] } = { current: [] };

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  language?: "json" | "csharp" | "text" | string;
  theme?: AppTheme;
  fontFamily?: string;
  fontSize?: number;
  markers?: Monaco.editor.IMarkerData[];
  decorations?: Array<{
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
    key?: string;
    className?: string;
  }>;
  envVars?: string[];
}

export function MonacoEditor({
  value,
  onChange,
  readOnly = false,
  language = "json",
  theme = "dark",
  fontFamily,
  fontSize,
  markers,
  decorations,
  envVars,
}: MonacoEditorProps) {
  completionEnvVarsRef.current = envVars ?? [];
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const decorationIdsRef = useRef<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const model = editor.getModel();
    if (!model) return;

    monaco.editor.setModelMarkers(model, "env-validation", markers ?? []);
  }, [markers, mounted]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const deltaDecorations: Monaco.editor.IModelDeltaDecoration[] =
      decorations?.map((d) => {
        const isMock = d.className === "mock-token";
        return {
          range: new monaco.Range(
            d.startLineNumber,
            d.startColumn,
            d.endLineNumber,
            d.endColumn,
          ),
          options: {
            inlineClassName: d.className ?? "env-token-valid",
            overviewRuler: {
              color: isMock ? "#d97706" : "#4ec9b0",
              position: monaco.editor.OverviewRulerLane.Center,
            },
          },
        };
      }) ?? [];

    decorationIdsRef.current = editor.deltaDecorations(
      decorationIdsRef.current,
      deltaDecorations,
    );
  }, [decorations, mounted]);

  const handleBeforeMount: BeforeMount = (monaco) => {
    monacoRef.current = monaco;

    const provideCompletions: Monaco.languages.CompletionItemProvider["provideCompletionItems"] =
      (model, position) => {
        const lineContent = model.getLineContent(position.lineNumber);
        const textBeforeCursor = lineContent.slice(0, position.column - 1);
        const textAfterCursor = lineContent.slice(position.column - 1);

        let closeCount = 0;
        if (textAfterCursor.startsWith("}}")) closeCount = 2;
        else if (textAfterCursor.startsWith("}")) closeCount = 1;
        const needClose = (n: number) =>
          "}".repeat(Math.max(0, n - closeCount));
        const localeMatch = /\{\{faker\.([a-zA-Z0-9_]+):$/.exec(
          textBeforeCursor,
        );
        if (localeMatch) {
          const rangeEnd = position.column + closeCount;
          const range = new monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            rangeEnd,
          );
          const suggestions: Monaco.languages.CompletionItem[] =
            FAKER_LOCALES.map((locale) => ({
              label: `${locale}`,
              kind: monaco.languages.CompletionItemKind.Value,
              insertText: `${locale}${needClose(2)}`,
              detail: `${locale} locale`,
              documentation: `Locale: ${locale}`,
              range,
            }));
          return { suggestions };
        }

        const fieldMatch = /\{\{faker\.([a-zA-Z0-9_]*)$/.exec(textBeforeCursor);
        if (fieldMatch) {
          const prefix = fieldMatch[1] ?? "";
          const rangeEnd = position.column + closeCount;
          const range = new monaco.Range(
            position.lineNumber,
            position.column - prefix.length,
            position.lineNumber,
            rangeEnd,
          );

          const suggestions: Monaco.languages.CompletionItem[] =
            FAKER_FIELDS.filter((f) => f.startsWith(prefix)).map((field) => ({
              label: field,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: `${field}${needClose(2)}`,
              detail: `faker.${field}`,
              documentation: `Generate a random ${field}.\nAdd ":locale" for localization (e.g. :fr, :de).`,
              range,
            }));

          if (FAKER_FIELDS.includes(prefix as (typeof FAKER_FIELDS)[number])) {
            for (const locale of FAKER_LOCALES) {
              suggestions.push({
                label: `${prefix}:${locale}`,
                kind: monaco.languages.CompletionItemKind.Value,
                insertText: `${prefix}:${locale}${needClose(2)}`,
                detail: `${locale} locale`,
                documentation: `Locale: ${locale}`,
                range,
              });
            }
          }

          return { suggestions };
        }

        const startMatch = /\{\{([a-zA-Z0-9_]*)$/.exec(textBeforeCursor);
        if (startMatch) {
          const prefix = startMatch[1] ?? "";
          const rangeEnd = position.column + closeCount;
          const range = new monaco.Range(
            position.lineNumber,
            position.column - prefix.length,
            position.lineNumber,
            rangeEnd,
          );

          const suggestions: Monaco.languages.CompletionItem[] = [];

          if (prefix === "" || "faker".startsWith(prefix)) {
            suggestions.push({
              label: `faker.`,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: `faker.`,
              detail: `mock data`,
              documentation: `Start typing faker.fieldName for mock data generation.`,
              range,
            });
          }

          if (prefix.startsWith("faker.")) {
            const fieldPrefix = prefix.slice("faker.".length);
            const fieldRange = new monaco.Range(
              position.lineNumber,
              position.column - fieldPrefix.length,
              position.lineNumber,
              rangeEnd,
            );
            FAKER_FIELDS.filter((f) => f.startsWith(fieldPrefix)).forEach(
              (field) => {
                suggestions.push({
                  label: field,
                  kind: monaco.languages.CompletionItemKind.Function,
                  insertText: `faker.${field}${needClose(2)}`,
                  detail: `faker.${field}`,
                  documentation: `Generate a random ${field}.\nAdd ":locale" for localization (e.g. :fr, :de).`,
                  range: fieldRange,
                });
              },
            );
          } else {
            for (const envVar of completionEnvVarsRef.current) {
              if (envVar.startsWith(prefix)) {
                suggestions.push({
                  label: envVar,
                  kind: monaco.languages.CompletionItemKind.Variable,
                  insertText: `${envVar}${needClose(2)}`,
                  detail: `env var`,
                  documentation: `Environment variable: ${envVar}`,
                  range,
                });
              }
            }
          }

          return { suggestions };
        }

        return { suggestions: [] };
      };

    if (!registeredCompletionLanguages.has("json")) {
      registeredCompletionLanguages.add("json");
      monaco.languages.registerCompletionItemProvider("json", {
        triggerCharacters: ["{", ":", "."],
        provideCompletionItems: provideCompletions,
      });
    }
    if (!registeredCompletionLanguages.has("text")) {
      registeredCompletionLanguages.add("text");
      monaco.languages.registerCompletionItemProvider("text", {
        triggerCharacters: ["{", ":", "."],
        provideCompletionItems: provideCompletions,
      });
    }

    monaco.editor.defineTheme("siloscope-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#101010",
        "editor.foreground": "#d0d0d0",
        "editorLineNumber.foreground": "#8a8a8a",
        "editorLineNumber.activeForeground": "#d0d0d0",
        "editorCursor.foreground": "#d0d0d0",
        "editor.selectionBackground": "#3a3a3a",
        "editor.inactiveSelectionBackground": "#2a2a2a",
        "editor.lineHighlightBackground": "#171717",
        "editor.lineHighlightBorder": "#00000000",
        "editorGutter.background": "#101010",
        "editorIndentGuide.background1": "#2a2a2a",
        "editorIndentGuide.activeBackground1": "#3a3a3a",
        "scrollbarSlider.background": "#3a3a3a99",
        "scrollbarSlider.hoverBackground": "#8a8a8a66",
        "scrollbarSlider.activeBackground": "#8a8a8a99",
      },
    });
    monaco.editor.defineTheme("siloscope-light", {
      base: "vs",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#f7f7f6",
        "editor.foreground": "#30302f",
        "editorLineNumber.foreground": "#737371",
        "editorLineNumber.activeForeground": "#30302f",
        "editorCursor.foreground": "#30302f",
        "editor.selectionBackground": "#d7d7d5",
        "editor.inactiveSelectionBackground": "#e8e8e7",
        "editor.lineHighlightBackground": "#efefee",
        "editor.lineHighlightBorder": "#00000000",
        "editorGutter.background": "#f7f7f6",
        "editorIndentGuide.background1": "#d7d7d5",
        "editorIndentGuide.activeBackground1": "#737371",
        "scrollbarSlider.background": "#bdbdbb99",
        "scrollbarSlider.hoverBackground": "#73737166",
        "scrollbarSlider.activeBackground": "#73737199",
      },
    });
    monaco.editor.defineTheme("siloscope-vscode-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#1F1F1F",
        "editor.foreground": "#CCCCCC",
        "editor.inactiveSelectionBackground": "#3A3D41",
        "editor.selectionHighlightBackground": "#ADD6FF26",
        "editorLineNumber.foreground": "#6E7681",
        "editorLineNumber.activeForeground": "#CCCCCC",
        "editorGutter.background": "#1F1F1F",
        "editorIndentGuide.background1": "#404040",
        "editorIndentGuide.activeBackground1": "#707070",
        "editorOverviewRuler.border": "#010409",
        focusBorder: "#0078D4",
      },
    });
    monaco.editor.defineTheme("siloscope-vscode-light", {
      base: "vs",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#FFFFFF",
        "editor.foreground": "#3B3B3B",
        "editor.inactiveSelectionBackground": "#E5EBF1",
        "editor.selectionHighlightBackground": "#ADD6FF80",
        "editorLineNumber.foreground": "#6E7681",
        "editorLineNumber.activeForeground": "#171184",
        "editorGutter.background": "#FFFFFF",
        "editorIndentGuide.background1": "#D3D3D3",
        "editorIndentGuide.activeBackground1": "#939393",
        "editorOverviewRuler.border": "#E5E5E5",
        focusBorder: "#005FB8",
      },
    });
  };

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setMounted(true);

    const model = editor.getModel();
    if (!model) return;

    let markerTimeout: ReturnType<typeof setTimeout>;

    const disposable = model.onDidChangeContent((e) => {
      for (const change of e.changes) {
        const text = change.text;
        const line = change.range.startLineNumber;
        const col = change.range.startColumn;

        let shouldClose = false;
        if (text === "{{") {
          shouldClose = true;
        } else if (text === "{" && col > 1) {
          const prevChar = model.getValueInRange({
            startLineNumber: line,
            startColumn: col - 1,
            endLineNumber: line,
            endColumn: col,
          });
          if (prevChar === "{") {
            if (col > 2) {
              const prevPrevChar = model.getValueInRange({
                startLineNumber: line,
                startColumn: col - 2,
                endLineNumber: line,
                endColumn: col - 1,
              });
              if (prevPrevChar !== "{") {
                shouldClose = true;
              }
            } else {
              shouldClose = true;
            }
          }
        }

        if (shouldClose) {
          const textAfter = model.getValueInRange({
            startLineNumber: line,
            startColumn: col + text.length,
            endLineNumber: line,
            endColumn: col + text.length + 2,
          });
          let existingClose = 0;
          if (textAfter.startsWith("}}")) existingClose = 2;
          else if (textAfter.startsWith("}")) existingClose = 1;
          const neededClose = 2 - existingClose;
          if (neededClose > 0) {
            editor.executeEdits("auto-close-brackets", [
              {
                range: new monaco.Range(
                  line,
                  col + text.length,
                  line,
                  col + text.length,
                ),
                text: "}".repeat(neededClose),
              },
            ]);
            editor.setPosition(new monaco.Position(line, col + text.length));
          }
        }
      }

      clearTimeout(markerTimeout);
      markerTimeout = setTimeout(() => {
        if (hasMockTokens(model.getValue())) {
          monaco.editor.setModelMarkers(model, "json", []);
        }
      }, 100);
    });

    if (hasMockTokens(model.getValue())) {
      monaco.editor.setModelMarkers(model, "json", []);
    }

    editor.onDidDispose(() => {
      clearTimeout(markerTimeout);
      disposable.dispose();
    });
  };

  const handleChange = (newValue: string | undefined) => {
    onChange(newValue ?? "");
  };

  return (
    <Editor
      height="100%"
      language={language}
      theme={mapToMonacoTheme(theme)}
      value={value}
      onChange={handleChange}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: fontSize ?? 14,
        fontFamily: fontFamily,
        lineNumbers: "on",
        lineDecorationsWidth: 8,
        lineNumbersMinChars: 3,
        overviewRulerLanes: 0,
        folding: false,
        glyphMargin: false,
        renderLineHighlight: "line",
        hideCursorInOverviewRuler: true,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: "on",
        formatOnPaste: true,
        formatOnType: true,
        hover: { enabled: false },
        quickSuggestions: { other: true, comments: false, strings: true },
        parameterHints: { enabled: false },
        suggest: { showIcons: true, showStatusBar: false },
      }}
    />
  );
}
