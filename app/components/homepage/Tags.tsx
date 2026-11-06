export const ACCENT = "#81a1c1";

export function Tags({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="px-1.5 py-0.5 text-[10px]"
          style={{
            color: ACCENT,
            borderWidth: 1,
            borderColor: `${ACCENT}30`,
            backgroundColor: `${ACCENT}12`,
          }}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
