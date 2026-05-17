import Editor, { type OnMount } from "@monaco-editor/react";
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
      value={value}
      onChange={handleChange}
      onMount={handleMount}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: "on",
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