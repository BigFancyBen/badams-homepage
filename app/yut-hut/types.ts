export type Block =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "code"; lang: string; code: string }
  | { kind: "note"; text: string }
  | { kind: "table"; columns: string[]; rows: string[][] };

export interface RuleSection {
  id: string;
  /** Short label for the contents rail. */
  label: string;
  title: string;
  lede?: string;
  /** Pill shown beside the heading, e.g. "arrives at Founding I". */
  badge?: string;
  blocks: Block[];
}
