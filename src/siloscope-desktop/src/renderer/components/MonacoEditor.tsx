import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { useRef } from "react";
import type * as Monaco from "monaco-editor";

type AppTheme = "dark" | "light" | "vscode-dark" | "vscode-light";

function mapToMonacoTheme(theme: AppTheme): "dark" | "light" {
  if (theme.startsWith("vscode")) {
    return theme === "vscode-light" ? "light" : "dark";
  }
  return theme as "dark" | "light";
}

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  language?: "json" | "csharp" | "text" | string;
  theme?: AppTheme;
  fontFamily?: string;
  fontSize?: number;
}

export function MonacoEditor({
  value,
  onChange,
  readOnly = false,
  language = "json",
  theme = "dark",
  fontFamily,
  fontSize,
}: MonacoEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const handleBeforeMount: BeforeMount = (monaco) => {
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
      theme={mapToMonacoTheme(theme) === "light" ? "siloscope-light" : "siloscope-dark"}
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
      }}
    />
  );
}
