export type Block =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "code"; lang: string; code: string }
  | { kind: "note"; text: string };

export interface Decision {
  id: string;
  title: string;
  body: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
}

export interface ChecklistGroup {
  id: string;
  title: string;
  blurb: string;
  items: ChecklistItem[];
}

export interface Constraint {
  limit: string;
  value: string;
  meaning: string;
}

export interface Phase {
  id: string;
  number: string;
  title: string;
  tagline: string;
  optional?: boolean;
  /** Already implemented in scrandle-worker / app/api/scrandle. */
  shipped?: boolean;
  blocks: Block[];
}

export interface SectionLink {
  id: string;
  label: string;
}
