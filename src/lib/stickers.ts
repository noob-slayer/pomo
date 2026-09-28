// Motivational chat stickers. Drawn with CSS (gradient card + emoji + caption) rather than
// shipped as image files: crisp at any size, theme-independent, and ~nothing in the bundle.
// A sticker message still carries plain `text`, so a client that doesn't know an id (older
// build, or a sticker later removed) just shows the caption as a normal message.
export interface Sticker {
  id: string;
  text: string;
  emoji: string;
  bg: string; // CSS background (gradient)
  ink: string; // caption colour
}

export const STICKERS: Sticker[] = [
  { id: "killing-it", text: "you're killing it", emoji: "🔥", bg: "linear-gradient(135deg,#ff6a3d,#ff2e63)", ink: "#fff" },
  { id: "you-can", text: "you can do it", emoji: "💪", bg: "linear-gradient(135deg,#7b61ff,#2ec5ff)", ink: "#fff" },
  { id: "glory", text: "work for the glory", emoji: "🏆", bg: "linear-gradient(135deg,#f7b733,#fc4a1a)", ink: "#fff" },
  { id: "one-more", text: "one more pomo", emoji: "🍅", bg: "linear-gradient(135deg,#ff5f6d,#c31432)", ink: "#fff" },
  { id: "locked-in", text: "locked in", emoji: "🔒", bg: "linear-gradient(135deg,#232526,#4b4f55)", ink: "#f5c542" },
  { id: "beast-mode", text: "beast mode", emoji: "🦾", bg: "linear-gradient(135deg,#11998e,#38ef7d)", ink: "#fff" },
  { id: "lets-go", text: "let's gooo", emoji: "🙌", bg: "linear-gradient(135deg,#f953c6,#b91d73)", ink: "#fff" },
  { id: "proud", text: "proud of you", emoji: "🥹", bg: "linear-gradient(135deg,#ffafbd,#ffc3a0)", ink: "#5a1a2b" },
  { id: "keep-going", text: "keep going", emoji: "🚀", bg: "linear-gradient(135deg,#4568dc,#b06ab3)", ink: "#fff" },
  { id: "no-zero", text: "no zero days", emoji: "✅", bg: "linear-gradient(135deg,#00b09b,#96c93d)", ink: "#fff" },
  { id: "deep-work", text: "deep work mode", emoji: "🧠", bg: "linear-gradient(135deg,#0f2027,#2c5364)", ink: "#9be7ff" },
  { id: "legends", text: "legends focus", emoji: "👑", bg: "linear-gradient(135deg,#8e2de2,#4a00e0)", ink: "#ffd86b" },
  { id: "almost", text: "almost there", emoji: "🏁", bg: "linear-gradient(135deg,#f12711,#f5af19)", ink: "#fff" },
  { id: "streak", text: "don't break the streak", emoji: "🔗", bg: "linear-gradient(135deg,#ee0979,#ff6a00)", ink: "#fff" },
  { id: "hydrate", text: "hydrate & dominate", emoji: "💧", bg: "linear-gradient(135deg,#36d1dc,#5b86e5)", ink: "#fff" },
  { id: "grind", text: "grind now, shine later", emoji: "✨", bg: "linear-gradient(135deg,#c471f5,#fa71cd)", ink: "#fff" },
  { id: "future-you", text: "future you says thanks", emoji: "🙏", bg: "linear-gradient(135deg,#43cea2,#185a9d)", ink: "#fff" },
  { id: "focus-flex", text: "focus. finish. flex.", emoji: "💎", bg: "linear-gradient(135deg,#1d2b64,#f8cdda)", ink: "#fff" },
];

export const STICKERS_BY_ID: Record<string, Sticker> = Object.fromEntries(STICKERS.map((s) => [s.id, s]));
