import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { ApiError } from "./api";

/**
 * Spam-only moderation for user-written content (chat, bounties, hidden money).
 *
 * Two layers:
 *  1. A cheap heuristic that catches obvious link spam, scam bait and keyboard mashing.
 *  2. Claude, when ANTHROPIC_API_KEY is set, for anything the heuristic lets through.
 *
 * The bar is deliberately low: only spam, scams and bot junk get removed. Rude,
 * weird or low-effort posts are allowed; mods handle the rest by hand.
 */

export type ModKind = "chat" | "bounty" | "drop";
export type ModResult = { ok: true } | { ok: false; reason: string };

const MODEL = process.env.MODERATION_MODEL || "claude-opus-5-5";
const URL_RE = /(https?:\/\/|www\.)[^\s]+|[a-z0-9-]+\.(com|net|org|io|xyz|app|gg|me|link|site|top|club|pro|finance|lol)\b/gi;
const SCAM_RE =
  /\b(free\s+(sol|crypto|airdrop|money)|claim\s+(your\s+)?airdrop|double\s+your|guaranteed\s+(profit|returns?)|send\s+\d*\s*sol\s+(to|and)|dm\s+me\s+(for|to)|telegram|whatsapp|t\.me\/|seed\s+phrase|private\s+key|recovery\s+phrase|connect\s+(your\s+)?wallet\s+(at|on|here)|giveaway|100x|pump\s*(it|this)?|casino|onlyfans|escort|viagra|crypto\s+signals?)\b/i;

/** Fast, deterministic checks. Returns a reason if the text is obviously spam. */
export function heuristicSpam(kind: ModKind, text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const urls = t.match(URL_RE) ?? [];
  if (kind === "chat" && urls.length >= 1) return "links aren't allowed in chat";
  if (urls.length >= 3) return "too many links";
  if (SCAM_RE.test(t)) return "looks like a scam or promo";
  // Keyboard mashing / repeated characters ("aaaaaaaaaaaa", "!!!!!!!!!!!!")
  if (/(.)\1{11,}/.test(t)) return "repeated characters";
  // Same short token repeated many times ("buy buy buy buy buy buy")
  const words = t.toLowerCase().split(/\s+/);
  if (words.length >= 8) {
    const counts = new Map<string, number>();
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
    const top = Math.max(...counts.values());
    if (top / words.length > 0.6) return "repeated words";
  }
  // Shouting + emoji wall
  const letters = t.replace(/[^a-z]/gi, "");
  const upper = letters.replace(/[^A-Z]/g, "");
  const emoji = (t.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  if (letters.length > 30 && upper.length / letters.length > 0.9 && emoji >= 5) return "spammy formatting";
  if (emoji > 25) return "emoji wall";
  return null;
}

const SYSTEM = `You are the spam filter for "Drops", a game where people hide SOL (Solana) on a real-world map for strangers to find, and post bounties (do a thing on video, get paid in SOL). You see one piece of user-written content and decide ONLY whether it is spam.

Flag as spam ONLY:
- advertising, promotions, referral or affiliate pushes, token shilling, "follow me" / "join my group" posts
- scams and phishing: fake airdrops, "send SOL to receive", seed-phrase or wallet-connect bait, impersonating staff
- bot-generated junk, gibberish, keyboard mashing, copy-pasted repeats
- bounties or drops that are clearly not real tasks or places and exist only to carry a link, handle or pitch

Do NOT flag: profanity, rudeness, slang, crypto talk, mentions of SOL amounts, low-effort or silly posts, non-English text, weird but genuine tasks, dares, or anything that is just a normal human talking. When unsure, allow it.

Reply with JSON only, no prose: {"spam": true|false, "reason": "<at most 8 words, empty string if not spam>"}`;

let client: Anthropic | null = null;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic({ timeout: 8_000, maxRetries: 1 });
  return client;
}

/** Ask Claude. Fails open (allows the content) on any API problem so a hiccup never blocks real users. */
export async function aiSpam(kind: ModKind, text: string): Promise<string | null> {
  const c = anthropic();
  if (!c) return null;
  const label = kind === "chat" ? "Chat message" : kind === "bounty" ? "Bounty post (title, description, area)" : "Hidden-money post (title, area)";
  try {
    const res = await c.messages.create({
      model: MODEL,
      max_tokens: 1500,
      output_config: { effort: "low" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `${label}:\n<content>\n${text.slice(0, 4000)}\n</content>` }],
    });
    const out = res.content.find((b) => b.type === "text")?.text ?? "";
    const m = out.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]) as { spam?: unknown; reason?: unknown };
    if (parsed.spam === true) return typeof parsed.reason === "string" && parsed.reason ? parsed.reason : "flagged as spam";
    return null;
  } catch (e) {
    if (e instanceof Anthropic.APIError) console.warn(`[moderate] API error ${e.status}: ${e.message}`);
    else console.warn("[moderate] failed:", e);
    return null;
  }
}

export async function moderate(kind: ModKind, text: string): Promise<ModResult> {
  const h = heuristicSpam(kind, text);
  if (h) return { ok: false, reason: h };
  const ai = await aiSpam(kind, text);
  if (ai) return { ok: false, reason: ai };
  return { ok: true };
}

/** Throws a 400 the client shows as "Removed by the spam filter: …". */
export async function assertNotSpam(kind: ModKind, text: string) {
  const r = await moderate(kind, text);
  if (!r.ok) throw new ApiError(400, `Removed by the spam filter: ${r.reason}`);
}

/** Whether AI moderation is live (for the mod panel / README). */
export function aiModerationEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
