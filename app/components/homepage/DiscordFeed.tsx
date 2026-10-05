import Image from "next/image";

export interface DiscordEmbed {
  /** The colour of the bar down the embed's left edge. */
  color: string;
  lines: string[];
}

export interface DiscordMessage {
  /** Unique within a feed. */
  id: string;
  timestamp: string;
  image?: { src: string; alt: string; width: number; height: number };
  embed?: DiscordEmbed;
  /** The line the bot posts above the image, if any. */
  text?: string;
  /** Button labels drawn under the image. They are a picture of buttons, not buttons. */
  buttons?: string[];
}

interface DiscordFeedProps {
  botName: string;
  messages: DiscordMessage[];
  /** Cap the feed's height and let it scroll, for bots with a lot to say. */
  maxHeight?: string;
  /** Rendered width of each image in CSS pixels. */
  imageWidth?: number;
}

const BLURPLE = "#5865f2";

/** Discord's `**bold**`, and nothing else of its markdown. */
function renderMarkdown(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") ? (
      <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  );
}

/** Bot image posts dressed as a Discord channel. */
export function DiscordFeed({ botName, messages, maxHeight, imageWidth = 396 }: DiscordFeedProps) {
  return (
    <div
      className="flex flex-col gap-0.5 flex-1 overflow-y-auto"
      style={{ backgroundColor: "#313338", padding: "8px 0", maxHeight }}
      tabIndex={maxHeight ? 0 : undefined}
      role={maxHeight ? "region" : undefined}
      aria-label={maxHeight ? `${botName} messages` : undefined}
    >
      {messages.map((msg) => (
        <div key={msg.id} className="flex gap-2 px-3 py-1 hover:bg-[#2e3035]">
          {/* Avatar */}
          <div className="w-10 h-10 shrink-0 mt-0.5" style={{ backgroundColor: BLURPLE, borderRadius: "50%" }}>
            <svg viewBox="0 0 127.14 96.36" className="w-5 h-5 m-2.5" fill="white" aria-hidden="true">
              <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
            </svg>
          </div>
          {/* Message */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium" style={{ color: BLURPLE }}>{botName}</span>
              <span className="text-[9px] font-medium px-1 py-px" style={{ backgroundColor: BLURPLE, color: "white", borderRadius: "3px" }}>BOT</span>
              <span className="text-[10px] text-gray-500">{msg.timestamp}</span>
            </div>
            {msg.text && (
              <p className="text-xs text-[#dbdee1] mt-0.5 leading-snug whitespace-pre-line">{renderMarkdown(msg.text)}</p>
            )}
            {msg.embed && (
              <div
                className="mt-1 px-3 py-2 flex flex-col gap-1 text-xs text-[#dbdee1] leading-snug"
                style={{
                  backgroundColor: "#2b2d31",
                  borderLeft: `4px solid ${msg.embed.color}`,
                  borderRadius: "4px",
                  maxWidth: imageWidth,
                }}
              >
                {msg.embed.lines.map((line) => (
                  <p key={line}>{renderMarkdown(line)}</p>
                ))}
              </div>
            )}
            {msg.image && (
              <div className="mt-1">
                <Image
                  src={msg.image.src}
                  alt={msg.image.alt}
                  width={msg.image.width}
                  height={msg.image.height}
                  unoptimized
                  style={{ borderRadius: "8px", width: Math.min(imageWidth, msg.image.width), maxWidth: "100%", height: "auto" }}
                />
              </div>
            )}
            {msg.buttons && (
              <div className="flex flex-wrap gap-1.5 mt-1.5" aria-hidden="true">
                {msg.buttons.map((label) => (
                  <span
                    key={label}
                    className="px-3 py-1 text-[11px] font-medium text-white"
                    style={{ backgroundColor: "#4e5058", borderRadius: "3px" }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
