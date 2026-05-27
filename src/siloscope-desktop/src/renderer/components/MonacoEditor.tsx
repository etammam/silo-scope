import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import type * as Monaco from "monaco-editor";

type AppTheme = "dark" | "light" | "vscode-dark" | "vscode-light";

function mapToMonacoTheme(theme: AppTheme): string {
  return `siloscope-${theme}`;
}

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
    key: string;
  }>;
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
}: MonacoEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const decorationIdsRef = useRef<string[]>([]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const model = editor.getModel();
    if (!model) return;

    monaco.editor.setModelMarkers(model, "env-validation", markers ?? []);
  }, [markers]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const deltaDecorations: Monaco.editor.IModelDeltaDecoration[] =
      decorations?.map((d) => ({
        range: new monaco.Range(
          d.startLineNumber,
          d.startColumn,
          d.endLineNumber,
          d.endColumn,
        ),
        options: {
          inlineClassName: "env-token-valid",
          overviewRuler: {
            color: "#4ec9b0",
            position: monaco.editor.OverviewRulerLane.Center,
          },
        },
      })) ?? [];

    decorationIdsRef.current = editor.deltaDecorations(
      decorationIdsRef.current,
      deltaDecorations,
    );
  }, [decorations]);

  const handleBeforeMount: BeforeMount = (monaco) => {
    monacoRef.current = monaco;
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
        "focusBorder": "#0078D4",
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
        "focusBorder": "#005FB8",
      },
    });
  };

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
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
        quickSuggestions: false,
        parameterHints: { enabled: false },
        suggest: { showIcons: false, showStatusBar: false },
      }}
    />
  );
}
