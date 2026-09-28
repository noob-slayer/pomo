import type { ThemeColors } from "./themes";
import { formatDuration } from "./durations";

// Share cards are drawn onto a 1080x1920 canvas -- WhatsApp Status is a 9:16 story, and
// Status only accepts an image or video (there's no way to post text or a link to it from
// the web), so the card itself has to carry the message. Links on a Status image aren't
// tappable, which is why every card prints its URL as big, readable text.
export const CARD_W = 1080;
export const CARD_H = 1920;

const FONT = 'calibri, "segoe ui", -apple-system, system-ui, sans-serif';
const MONO = '"sf mono", consolas, ui-monospace, menlo, monospace';

export type CardKind = "today" | "week" | "receipt" | "badge" | "lobby";

export interface TodayCard {
  kind: "today";
  minutes: number;
  sessions: number;
  streak: number;
}
export interface WeekCard {
  kind: "week";
  days: { label: string; minutes: number; isToday: boolean }[];
  totalMinutes: number;
  best: { label: string; minutes: number } | null;
}
export interface ReceiptCard {
  kind: "receipt";
  items: { title: string; count: number; minutes: number }[];
  totalMinutes: number;
  sessions: number;
}
export interface BadgeCard {
  kind: "badge";
  label: string;
  description: string;
  emoji: string;
}
export interface LobbyCard {
  kind: "lobby";
  lobbyName: string;
  focusing: string[];
}
export type CardData = TodayCard | WeekCard | ReceiptCard | BadgeCard | LobbyCard;

export interface CardContext {
  theme: ThemeColors;
  name: string;
  link: string; // printed on the card, so keep it short (no protocol)
  date: Date;
}

// one icon per badge id -- the app's badge grid uses a single trophy glyph, but a share card
// needs something that reads at a glance on a phone screen
export const BADGE_EMOJI: Record<string, string> = {
  "first-pomo": "🍅",
  "getting-started": "🌱",
  "half-century": "🏅",
  century: "💯",
  "deep-work": "🧠",
  marathon: "🏃",
  "on-a-roll": "🔥",
  unstoppable: "⚡",
  "iron-will": "🛡️",
  "early-bird": "🌅",
  "night-owl": "🦉",
  "weekend-warrior": "🏖️",
  "10-hours": "⏳",
  "50-hours": "🏆",
  "100-hours": "👑",
};

function font(size: number, weight: number | string = 400, family = FONT): string {
  return `${weight} ${size}px ${family}`;
}

// shrink a single line until it fits -- a long duration or lobby name shouldn't run off
function fitSize(ctx: CanvasRenderingContext2D, text: string, maxW: number, start: number, weight: number, family = FONT): number {
  let size = start;
  ctx.font = font(size, weight, family);
  while (size > 24 && ctx.measureText(text).width > maxW) {
    size -= 4;
    ctx.font = font(size, weight, family);
  }
  return size;
}

// greedy word wrap, centered; returns the y after the last line
function wrapCentered(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number): number {
  const words = text.split(/\s+/);
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      y += lineH;
      line = w;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
  return y + lineH;
}

function spaced(text: string): string {
  return text.toUpperCase().split("").join(" ");
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

function mmss(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:00` : `${m}:00`;
}

function drawFrame(ctx: CanvasRenderingContext2D, c: CardContext, cta: string): void {
  const { theme } = c;
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // a soft glow in the top-right so the flat theme colour doesn't read as a blank slide
  const glow = ctx.createRadialGradient(CARD_W * 0.85, 120, 40, CARD_W * 0.85, 120, 900);
  glow.addColorStop(0, "rgba(255,255,255,0.10)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = theme.ink;
  ctx.textAlign = "left";
  ctx.font = font(60, 700);
  ctx.fillText("pomo", 90, 170);
  ctx.fillStyle = theme.inkMuted;
  ctx.textAlign = "right";
  ctx.font = font(38);
  ctx.fillText(
    c.date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }).toLowerCase(),
    CARD_W - 90,
    165,
  );

  // footer: the call to action and the link, as large as legibility on a phone allows
  ctx.textAlign = "center";
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(180, 1580);
  ctx.lineTo(CARD_W - 180, 1580);
  ctx.stroke();
  ctx.fillStyle = theme.inkMuted;
  ctx.font = font(46);
  ctx.fillText(cta, CARD_W / 2, 1670);
  ctx.fillStyle = theme.ink;
  const linkSize = fitSize(ctx, c.link, CARD_W - 160, 64, 700);
  ctx.font = font(linkSize, 700);
  ctx.fillText(c.link, CARD_W / 2, 1760);
  ctx.fillStyle = theme.inkMuted;
  ctx.font = font(32);
  ctx.fillText("free focus timer · work & personal", CARD_W / 2, 1840);
}

function drawToday(ctx: CanvasRenderingContext2D, d: TodayCard, c: CardContext): void {
  drawFrame(ctx, c, "come focus with me");
  const { theme } = c;
  const cx = CARD_W / 2;
  ctx.textAlign = "center";
  ctx.fillStyle = theme.inkMuted;
  ctx.font = font(44, 600);
  ctx.fillText(spaced("today"), cx, 540);

  const dur = formatDuration(d.minutes);
  ctx.fillStyle = theme.ink;
  const size = fitSize(ctx, dur, CARD_W - 140, 260, 700);
  ctx.font = font(size, 700);
  ctx.fillText(dur, cx, 830);

  ctx.font = font(68);
  ctx.fillText(d.minutes > 0 ? "focused 🍅" : "starting my focus day 🍅", cx, 960);

  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(300, 1060);
  ctx.lineTo(CARD_W - 300, 1060);
  ctx.stroke();

  ctx.fillStyle = theme.ink;
  ctx.font = font(58);
  ctx.fillText(`${d.sessions} ${d.sessions === 1 ? "session" : "sessions"}`, cx, 1180);
  if (d.streak > 1) ctx.fillText(`🔥 ${d.streak}-day streak`, cx, 1275);

  ctx.fillStyle = theme.inkMuted;
  ctx.font = font(46, "italic 400");
  ctx.fillText(`— ${c.name}`, cx, 1440);
}

function drawWeek(ctx: CanvasRenderingContext2D, d: WeekCard, c: CardContext): void {
  drawFrame(ctx, c, "focus with me this week");
  const { theme } = c;
  const cx = CARD_W / 2;
  ctx.textAlign = "center";
  ctx.fillStyle = theme.inkMuted;
  ctx.font = font(44, 600);
  ctx.fillText(spaced("this week"), cx, 470);

  ctx.fillStyle = theme.ink;
  const total = formatDuration(d.totalMinutes);
  ctx.font = font(fitSize(ctx, total, CARD_W - 160, 210, 700), 700);
  ctx.fillText(total, cx, 700);
  ctx.font = font(56);
  ctx.fillText("focused", cx, 790);

  // 7 bars, oldest -> today; today's bar at full ink, the rest softened
  const max = Math.max(1, ...d.days.map((x) => x.minutes));
  const barW = 86;
  const gap = (CARD_W - 240 - barW * 7) / 6;
  const baseY = 1290;
  const maxH = 360;
  d.days.forEach((day, i) => {
    const x = 120 + i * (barW + gap);
    const h = day.minutes > 0 ? Math.max(14, (day.minutes / max) * maxH) : 6;
    ctx.fillStyle = day.isToday ? theme.ink : theme.inkMuted;
    ctx.globalAlpha = day.isToday ? 1 : 0.55;
    ctx.beginPath();
    // roundRect is missing on older iOS Safari -- square bars are fine there
    if (typeof ctx.roundRect === "function") ctx.roundRect(x, baseY - h, barW, h, 14);
    else ctx.rect(x, baseY - h, barW, h);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.inkMuted;
    ctx.font = font(38);
    ctx.fillText(day.label, x + barW / 2, baseY + 60);
    if (day.minutes > 0) {
      ctx.fillStyle = theme.ink;
      ctx.font = font(30);
      ctx.fillText(formatDuration(day.minutes), x + barW / 2, baseY - h - 18);
    }
  });

  if (d.best) {
    ctx.fillStyle = theme.ink;
    ctx.font = font(46);
    ctx.fillText(`best day: ${d.best.label} · ${formatDuration(d.best.minutes)}`, cx, 1470);
  }
}

function drawReceipt(ctx: CanvasRenderingContext2D, d: ReceiptCard, c: CardContext): void {
  drawFrame(ctx, c, "get your own receipt");
  const paperX = 150;
  const paperW = CARD_W - 300;
  const rows = d.items.slice(0, 7);
  // lay out first so the paper hugs its content -- header + item rows (+ "more"/empty line)
  // + totals block + barcode -- then centre that paper between the header and footer
  const itemLines = rows.length + (d.items.length > rows.length || rows.length === 0 ? 1 : 0);
  const paperH = 360 + itemLines * 72 + 80 + 60 + 70 + 40 + 80 + 50;
  const top = Math.max(250, Math.round((260 + 1540 - paperH) / 2));
  const bottom = Math.min(1520, top + paperH);

  // paper with a torn zigzag bottom edge
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = "#fbf8f2";
  ctx.beginPath();
  ctx.moveTo(paperX, top);
  ctx.lineTo(paperX + paperW, top);
  ctx.lineTo(paperX + paperW, bottom);
  const teeth = 18;
  const tw = paperW / teeth;
  for (let i = teeth; i > 0; i--) {
    ctx.lineTo(paperX + (i - 0.5) * tw, bottom + 22);
    ctx.lineTo(paperX + (i - 1) * tw, bottom);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const ink = "#241f1b";
  const muted = "#7a716a";
  const left = paperX + 60;
  const right = paperX + paperW - 60;
  const cx = CARD_W / 2;
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.font = font(56, 700, MONO);
  ctx.fillText("POMO FOCUS CO.", cx, top + 110);
  ctx.fillStyle = muted;
  ctx.font = font(32, 400, MONO);
  ctx.fillText("focus receipt", cx, top + 165);
  ctx.fillText(
    c.date.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).toLowerCase(),
    cx,
    top + 215,
  );

  const dash = (y: number) => {
    ctx.fillStyle = muted;
    ctx.font = font(32, 400, MONO);
    ctx.textAlign = "center";
    ctx.fillText("- ".repeat(19).trim(), cx, y);
  };
  dash(top + 280);

  let y = top + 360;
  ctx.font = font(36, 400, MONO);
  for (const item of rows) {
    ctx.fillStyle = ink;
    ctx.textAlign = "left";
    ctx.fillText(truncate(ctx, `${item.count}× ${item.title}`, paperW - 330), left, y);
    ctx.textAlign = "right";
    ctx.fillText(mmss(item.minutes), right, y);
    y += 72;
  }
  if (d.items.length > rows.length) {
    ctx.fillStyle = muted;
    ctx.textAlign = "left";
    ctx.fillText(`+ ${d.items.length - rows.length} more`, left, y);
    y += 72;
  }
  if (rows.length === 0) {
    ctx.fillStyle = muted;
    ctx.textAlign = "center";
    ctx.fillText("no sessions yet — soon!", cx, y);
    y += 72;
  }

  dash(y);
  y += 80;
  ctx.fillStyle = ink;
  ctx.font = font(46, 700, MONO);
  ctx.textAlign = "left";
  ctx.fillText("TOTAL", left, y);
  ctx.textAlign = "right";
  ctx.fillText(formatDuration(d.totalMinutes), right, y);
  y += 60;
  ctx.font = font(34, 400, MONO);
  ctx.fillStyle = muted;
  ctx.textAlign = "left";
  ctx.fillText("SESSIONS", left, y);
  ctx.textAlign = "right";
  ctx.fillText(String(d.sessions), right, y);
  y += 70;
  ctx.textAlign = "center";
  ctx.fillText("THANK YOU FOR FOCUSING", cx, y);

  // decorative barcode, seeded from the total so the same day draws the same code
  let seed = d.totalMinutes * 7919 + d.sessions * 104729 + 1;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  let bx = left + 40;
  const by = y + 40;
  ctx.fillStyle = ink;
  while (bx < right - 40) {
    const w = 2 + Math.floor(rand() * 7);
    ctx.fillRect(bx, by, w, 80);
    bx += w + 3 + Math.floor(rand() * 6);
  }
}

function drawBadge(ctx: CanvasRenderingContext2D, d: BadgeCard, c: CardContext): void {
  drawFrame(ctx, c, "earn yours on pomo");
  const { theme } = c;
  const cx = CARD_W / 2;
  ctx.textAlign = "center";
  ctx.fillStyle = theme.inkMuted;
  ctx.font = font(44, 600);
  ctx.fillText(spaced("badge unlocked"), cx, 460);

  // medallion
  const cy = 800;
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.beginPath();
  ctx.arc(cx, cy, 250, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, 250, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 215, 0, Math.PI * 2);
  ctx.stroke();
  ctx.textBaseline = "middle";
  ctx.font = font(230);
  // colour emoji inherit fillStyle's alpha in Chrome -- draw with an opaque fill or the
  // glyph comes out as faint as the medallion behind it
  ctx.fillStyle = "#000";
  ctx.fillText(d.emoji, cx, cy + 10);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = theme.ink;
  ctx.font = font(fitSize(ctx, d.label, CARD_W - 160, 104, 700), 700);
  ctx.fillText(d.label, cx, 1170);
  ctx.fillStyle = theme.inkMuted;
  ctx.font = font(48);
  const after = wrapCentered(ctx, d.description, cx, 1260, CARD_W - 240, 62);
  ctx.font = font(40, "italic 400");
  ctx.fillText(`earned by ${c.name}`, cx, Math.max(after + 50, 1420));
}

function drawLobby(ctx: CanvasRenderingContext2D, d: LobbyCard, c: CardContext): void {
  drawFrame(ctx, c, "tap the link to join");
  const { theme } = c;
  const cx = CARD_W / 2;
  const n = d.focusing.length;
  const shown = d.focusing.slice(0, 6);
  const rowsH = (shown.length + (n > shown.length ? 1 : 0)) * 92;
  // centre the whole block between the header and the footer rule, so a lobby with one or
  // two people doesn't leave a big empty gap in the middle of the story
  const blockH = 170 + 170 + 110 + (n > 0 ? rowsH : 120);
  let y = Math.max(440, 330 + (1540 - 330 - blockH) / 2 + 40);

  ctx.textAlign = "center";
  ctx.fillStyle = theme.inkMuted;
  ctx.font = font(44, 600);
  ctx.fillText(spaced("join me in"), cx, y);
  y += 180;

  ctx.fillStyle = theme.ink;
  ctx.font = font(fitSize(ctx, d.lobbyName, CARD_W - 160, 132, 700), 700);
  ctx.fillText(d.lobbyName, cx, y);
  y += 140;

  ctx.font = font(56);
  const status = n === 0 ? "come focus with us" : n === 1 ? "focusing right now" : `${n} of us focusing right now`;
  ctx.fillText(status, cx, y);
  y += 140;

  if (n === 0) {
    ctx.fillStyle = theme.inkMuted;
    ctx.font = font(46);
    ctx.fillText("each on your own timer, together", cx, y);
    return;
  }
  // live roster: green dot + name, like the lobby summary -- centred as a column
  ctx.font = font(54);
  const widest = Math.max(...shown.map((p) => ctx.measureText(p).width), 200);
  const rowX = Math.max(160, cx - Math.min(widest, CARD_W - 360) / 2 + 20);
  ctx.textAlign = "left";
  shown.forEach((person, i) => {
    const ry = y + i * 92;
    ctx.fillStyle = "#3fae5a";
    ctx.beginPath();
    ctx.arc(rowX - 42, ry - 18, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.ink;
    ctx.fillText(truncate(ctx, person, CARD_W - rowX - 120), rowX, ry);
  });
  if (n > shown.length) {
    ctx.fillStyle = theme.inkMuted;
    ctx.fillText(`+ ${n - shown.length} more`, rowX, y + shown.length * 92);
  }
}

export function renderCard(canvas: HTMLCanvasElement, data: CardData, c: CardContext): void {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (data.kind === "today") drawToday(ctx, data, c);
  else if (data.kind === "week") drawWeek(ctx, data, c);
  else if (data.kind === "receipt") drawReceipt(ctx, data, c);
  else if (data.kind === "badge") drawBadge(ctx, data, c);
  else drawLobby(ctx, data, c);
}

// the pre-filled WhatsApp text for each card (sent as-is via wa.me, or as the caption when
// the image goes through the share sheet)
export function cardMessage(data: CardData, fullLink: string): string {
  switch (data.kind) {
    case "today":
      return `🍅 I focused ${formatDuration(data.minutes)} today on pomo${
        data.streak > 1 ? ` — ${data.streak}-day streak 🔥` : ""
      }. Come focus with me → ${fullLink}`;
    case "week":
      return `📊 ${formatDuration(data.totalMinutes)} of focus this week on pomo. Join me → ${fullLink}`;
    case "receipt":
      return `🧾 Today's focus receipt: ${formatDuration(data.totalMinutes)} across ${data.sessions} ${
        data.sessions === 1 ? "session" : "sessions"
      }. Focus with me → ${fullLink}`;
    case "badge":
      return `🏅 Just unlocked "${data.label}" on pomo — ${data.description}. Join me → ${fullLink}`;
    case "lobby":
      if (data.focusing.length > 1)
        return `👥 ${data.focusing.length} of us are focusing in "${data.lobbyName}" on pomo right now — hop in → ${fullLink}`;
      if (data.focusing.length === 1)
        return `👥 I'm focusing in "${data.lobbyName}" on pomo right now — join me → ${fullLink}`;
      return `👥 Come focus with me in "${data.lobbyName}" on pomo → ${fullLink}`;
  }
}
