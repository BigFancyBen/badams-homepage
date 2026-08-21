import { ACCENT } from "../data";

/** Presentational square used inside the checklist buttons. */
export function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="shrink-0 w-4 h-4 mt-0.5 flex items-center justify-center transition-colors"
      style={{
        border: `1px solid ${checked ? ACCENT : "rgba(255,255,255,0.18)"}`,
        backgroundColor: checked ? `${ACCENT}22` : "transparent",
      }}
    >
      {checked ? (
        <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none">
          <path
            d="M2 6.2 4.6 8.8 10 3.4"
            stroke={ACCENT}
            strokeWidth="1.8"
            strokeLinecap="square"
          />
        </svg>
      ) : null}
    </span>
  );
}
