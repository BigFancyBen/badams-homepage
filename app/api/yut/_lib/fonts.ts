import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ImageResponse } from "next/og";

type ImageOptions = NonNullable<ConstructorParameters<typeof ImageResponse>[1]>;
export type YutFonts = NonNullable<ImageOptions["fonts"]>;

/** Where every font and sprite lives, and the prefix each path below carries. */
const ASSETS = "app/api/yut/_assets/";

/**
 * The file on disk for one of the paths below.
 *
 * The folder is spelled out in the `join` rather than left inside the
 * argument: a path the bundler cannot see the start of is one it has to
 * assume could be anywhere, and it answers that by packing the whole project
 * — source, /public and all — into every route that calls this. A path that
 * somehow is not under the folder resolves inside it anyway, to nothing.
 */
function assetFile(relative: string): string {
  const name = relative.startsWith(ASSETS) ? relative.slice(ASSETS.length) : relative;
  return join(process.cwd(), "app", "api", "yut", "_assets", name.replace(/\.\.+/g, "."));
}

/**
 * The paths are spelled out as literals rather than built from a list so
 * Next's file tracer sees each one; `outputFileTracingIncludes` in
 * next.config.ts is the belt to these braces.
 */
function loadFont(relative: string): Promise<ArrayBuffer> {
  return readFile(assetFile(relative)).then((buf) => {
    const out = new ArrayBuffer(buf.byteLength);
    new Uint8Array(out).set(buf);
    return out;
  });
}

let cached: Promise<YutFonts> | null = null;

async function load(): Promise<YutFonts> {
  const [uf, chatBold, chat, npc] = await Promise.all([
    loadFont("app/api/yut/_assets/fonts/runescape_uf.ttf"),
    loadFont("app/api/yut/_assets/fonts/runescape_chat_bold.ttf"),
    loadFont("app/api/yut/_assets/fonts/runescape_chat.ttf"),
    loadFont("app/api/yut/_assets/fonts/runescape_npc_chat.ttf"),
  ]);
  return [
    { name: "RuneScape", data: uf, weight: 400, style: "normal" },
    { name: "RuneScape Bold", data: chatBold, weight: 400, style: "normal" },
    { name: "RuneScape Chat", data: chat, weight: 400, style: "normal" },
    { name: "RuneScape NPC", data: npc, weight: 400, style: "normal" },
  ];
}

/** The `fonts` array for ImageResponse. Read from disk once per instance. */
export function yutFonts(): Promise<YutFonts> {
  if (!cached) cached = load();
  return cached;
}
