import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { useRef } from "react";
import type * as Monaco from "monaco-editor";

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  language?: string;
}

export function MonacoEditor({
  value,
  onChange,
  readOnly = false,
  language = "json",
}: MonacoEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const handleBeforeMount: BeforeMount = (monaco) => {
    monaco.editor.defineTheme("siloscope-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#181818",
        "editor.foreground": "#c8c8c8",
        "editorLineNumber.foreground": "#858585",
        "editorLineNumber.activeForeground": "#c8c8c8",
        "editorCursor.foreground": "#c8c8c8",
        "editor.selectionBackground": "#3c3c3c",
        "editor.inactiveSelectionBackground": "#303030",
        "editor.lineHighlightBackground": "#1e1e1e",
        "editor.lineHighlightBorder": "#00000000",
        "editorGutter.background": "#181818",
        "editorIndentGuide.background1": "#303030",
        "editorIndentGuide.activeBackground1": "#3c3c3c",
        "scrollbarSlider.background": "#3c3c3c99",
        "scrollbarSlider.hoverBackground": "#85858566",
        "scrollbarSlider.activeBackground": "#85858599",
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
      theme="siloscope-dark"
      value={value}
      onChange={handleChange}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 14,
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
