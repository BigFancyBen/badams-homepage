"use client";

import { useState } from "react";

interface CodeBlockProps {
  code: string;
  lang: string;
  maxHeight?: string;
}

export function CodeBlock({ code, lang, maxHeight }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  return (
    <div
      className="relative"
      style={{
        background: "rgba(0,0,0,0.4)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
          {lang}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 transition-colors"
          style={{
            color: copied ? "#a3be8c" : "#9ca3af",
            border: `1px solid ${copied ? "#a3be8c40" : "rgba(255,255,255,0.08)"}`,
            backgroundColor: copied ? "#a3be8c12" : "rgba(255,255,255,0.02)",
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className="overflow-auto p-4 text-xs leading-relaxed scrandle-scroll"
        style={{ maxHeight }}
      >
        <code className="font-mono text-gray-300">{code}</code>
      </pre>
    </div>
  );
}
