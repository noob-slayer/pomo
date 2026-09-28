import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useClickAway } from "../hooks/useClickAway";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { resolveIdentityKey } from "../lib/identity";
import {
  connectLobbyChat,
  sendChatMessage,
  sendChatReaction,
  type LobbyChatMessage,
  type LobbyChatReaction,
} from "../lib/lobbySync";
import { playMessagePing } from "../lib/sound";
import { STICKERS, STICKERS_BY_ID, type Sticker } from "../lib/stickers";
import { GIPHY_ENABLED, isGiphyMediaUrl, type GiphySticker } from "../lib/giphy";
import { GiphyPicker } from "./GiphyPicker";

// how many messages to keep in memory -- this chat is ephemeral (no DB, see lobbySync.ts),
// so there's nothing to page through; an unbounded array would just grow for the life of
// the tab. The oldest drop off the top, same as a real chat window's scrollback limit.
const MAX_MESSAGES = 100;
const MAX_LEN = 500;

// a curated set rather than a full emoji library -- phones already have a full emoji keyboard,
// and a picker library would add ~200 KB to the bundle for what's mostly desktop polish
const EMOJIS = [
  "😊", "😂", "🥲", "😴", "🤯", "😤", "🥳", "😎",
  "🔥", "💪", "🎯", "✅", "🙌", "👏", "👍", "❤️",
  "☕", "🍅", "⏰", "📚", "💻", "🧠", "🌱", "✨",
];
// the quick-reaction row shown when you tap a message
const REACTIONS = ["👍", "🔥", "😂", "❤️", "👏", "🎯"];

// messageId -> emoji -> identityKeys who reacted
type ReactionMap = Record<string, Record<string, string[]>>;

function applyReaction(map: ReactionMap, r: LobbyChatReaction): ReactionMap {
  const forMsg = { ...(map[r.messageId] ?? {}) };
  const who = new Set(forMsg[r.emoji] ?? []);
  if (r.on) who.add(r.identityKey);
  else who.delete(r.identityKey);
  if (who.size) forMsg[r.emoji] = [...who];
  else delete forMsg[r.emoji];
  return { ...map, [r.messageId]: forMsg };
}

// generated per message purely for react keys + de-duping our own echo; not a DB id
function messageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function LobbyChat() {
  const { identityUserId } = useAuth();
  const { personaName, currentLobby } = useSettings();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<LobbyChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [unread, setUnread] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"emoji" | "stickers" | "memes">("emoji");
  // the emoji/sticker panel closes on any tap outside it (messages, elsewhere on the page) so
  // it never sits over the conversation; tapping emojis inside it keeps it open for several
  const pickerRef = useRef<HTMLDivElement>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  useClickAway(pickerRef, (e) => {
    // the 😊 toggle handles its own open/close -- don't let click-away race it
    if (emojiBtnRef.current?.contains(e?.target as Node)) return;
    setPickerOpen(false);
  }, pickerOpen);
  const [reactFor, setReactFor] = useState<string | null>(null);
  const [reactions, setReactions] = useState<ReactionMap>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // read inside the channel callback without re-subscribing every time `open` flips
  const openRef = useRef(open);
  openRef.current = open;

  const identityKey = resolveIdentityKey(identityUserId);
  const displayName = personaName || "guest";
  const lobbyId = currentLobby?.id ?? null;

  // one subscription per lobby -- reset everything when the lobby changes so messages from
  // a previous lobby never bleed into a new one
  useEffect(() => {
    if (!lobbyId) return;
    setMessages([]);
    setUnread(0);
    setReactions({});
    const channel = connectLobbyChat(
      lobbyId,
      (message) => {
        setMessages((prev) => [...prev, message].slice(-MAX_MESSAGES));
        // incoming messages are always from someone else (the channel is self:false), so a
        // soft ping every time is right -- our own sends go through send() and never here
        playMessagePing();
        if (!openRef.current) setUnread((n) => n + 1);
      },
      (reaction) => setReactions((prev) => applyReaction(prev, reaction)),
    );
    channelRef.current = channel;
    return () => {
      channel?.unsubscribe();
      channelRef.current = null;
    };
  }, [lobbyId]);

  // the quick-reaction bar closes on any tap that isn't on it or on a message bubble --
  // otherwise it lingers over the conversation after you've moved on
  useEffect(() => {
    if (!reactFor) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (el?.closest(".lobby-chat__react-bar, .lobby-chat__text, .lobby-chat__sticker, .lobby-chat__giphy")) return;
      setReactFor(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [reactFor]);

  // autoscroll to the newest message while the panel is open
  useLayoutEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  if (!currentLobby) return null;

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next) {
        setUnread(0);
        // focus the input once the panel has rendered
        requestAnimationFrame(() => inputRef.current?.focus());
      }
      return next;
    });
  };

  const send = () => {
    const text = draft.trim().slice(0, MAX_LEN);
    if (!text || !channelRef.current) return;
    const message: LobbyChatMessage = { id: messageId(), identityKey, personaName: displayName, text, at: Date.now() };
    // append locally -- the channel is self:false, so our own message never comes back to us
    setMessages((prev) => [...prev, message].slice(-MAX_MESSAGES));
    sendChatMessage(channelRef.current, message);
    setDraft("");
    setPickerOpen(false);
  };

  // stickers send straight away, like in WhatsApp -- they aren't inserted into the draft
  const sendSticker = (s: Sticker) => {
    if (!channelRef.current) return;
    const message: LobbyChatMessage = {
      id: messageId(),
      identityKey,
      personaName: displayName,
      text: `${s.emoji} ${s.text}`,
      sticker: s.id,
      at: Date.now(),
    };
    setMessages((prev) => [...prev, message].slice(-MAX_MESSAGES));
    sendChatMessage(channelRef.current, message);
    setPickerOpen(false);
  };

  const sendGiphy = (g: GiphySticker) => {
    if (!channelRef.current) return;
    const message: LobbyChatMessage = {
      id: messageId(),
      identityKey,
      personaName: displayName,
      text: g.title,
      giphy: { url: g.url, width: g.width, height: g.height },
      at: Date.now(),
    };
    setMessages((prev) => [...prev, message].slice(-MAX_MESSAGES));
    sendChatMessage(channelRef.current, message);
    setPickerOpen(false);
  };

  // insert at the cursor rather than always appending, so an emoji can go mid-sentence
  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    const next = (draft.slice(0, start) + emoji + draft.slice(end)).slice(0, MAX_LEN);
    setDraft(next);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + emoji.length;
      el?.setSelectionRange(pos, pos);
    });
  };

  const toggleReaction = (messageId: string, emoji: string) => {
    const mineAlready = reactions[messageId]?.[emoji]?.includes(identityKey) ?? false;
    const reaction: LobbyChatReaction = { messageId, emoji, identityKey, on: !mineAlready };
    // apply locally too -- self:false means our own broadcast never comes back
    setReactions((prev) => applyReaction(prev, reaction));
    if (channelRef.current) sendChatReaction(channelRef.current, reaction);
    setReactFor(null);
  };

  return (
    <div className={open ? "lobby-chat lobby-chat--open" : "lobby-chat"}>
      {open && (
        <div className="lobby-chat__panel" role="log" aria-label="lobby chat">
          <div className="lobby-chat__head">
            <span className="lobby-chat__title">{currentLobby.name} · chat</span>
            <button type="button" className="lobby-chat__close" onClick={toggle} aria-label="close chat">
              ×
            </button>
          </div>
          <div className="lobby-chat__messages" ref={listRef}>
            {messages.length === 0 ? (
              <p className="lobby-chat__empty">
                say hi — messages are live only, seen by whoever's in the lobby right now
              </p>
            ) : (
              messages.map((m) => {
                const mine = m.identityKey === identityKey;
                const msgReactions = Object.entries(reactions[m.id] ?? {});
                const sticker = m.sticker ? STICKERS_BY_ID[m.sticker] : undefined;
                const giphy = m.giphy && isGiphyMediaUrl(m.giphy.url) ? m.giphy : undefined;
                return (
                  <div key={m.id} className={mine ? "lobby-chat__msg lobby-chat__msg--mine" : "lobby-chat__msg"}>
                    {!mine && <span className="lobby-chat__from">{m.personaName}</span>}
                    {giphy ? (
                      <button
                        type="button"
                        className="lobby-chat__giphy"
                        onClick={() => setReactFor((cur) => (cur === m.id ? null : m.id))}
                        title="tap to react"
                        aria-label={`sticker: ${m.text}`}
                      >
                        <img
                          src={giphy.url}
                          alt={m.text}
                          loading="lazy"
                          style={{ aspectRatio: `${giphy.width} / ${giphy.height}` }}
                        />
                      </button>
                    ) : sticker ? (
                      <button
                        type="button"
                        className="lobby-chat__sticker"
                        style={{ background: sticker.bg, color: sticker.ink }}
                        onClick={() => setReactFor((cur) => (cur === m.id ? null : m.id))}
                        title="tap to react"
                        aria-label={`sticker: ${sticker.text}`}
                      >
                        <span className="lobby-chat__sticker-emoji">{sticker.emoji}</span>
                        <span className="lobby-chat__sticker-text">{sticker.text}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="lobby-chat__text"
                        onClick={() => setReactFor((cur) => (cur === m.id ? null : m.id))}
                        title="tap to react"
                      >
                        {m.text}
                      </button>
                    )}
                    {reactFor === m.id && (
                      <div className="lobby-chat__react-bar" role="group" aria-label="react">
                        {REACTIONS.map((e) => (
                          <button key={e} type="button" onClick={() => toggleReaction(m.id, e)}>
                            {e}
                          </button>
                        ))}
                      </div>
                    )}
                    {msgReactions.length > 0 && (
                      <div className="lobby-chat__reactions">
                        {msgReactions.map(([e, who]) => (
                          <button
                            key={e}
                            type="button"
                            className={
                              who.includes(identityKey)
                                ? "lobby-chat__reaction lobby-chat__reaction--mine"
                                : "lobby-chat__reaction"
                            }
                            onClick={() => toggleReaction(m.id, e)}
                          >
                            {e} {who.length}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          {pickerOpen && (
            <div className="lobby-chat__picker-wrap" ref={pickerRef}>
              <div className="lobby-chat__picker-tabs" role="tablist">
                {(GIPHY_ENABLED ? (["emoji", "stickers", "memes"] as const) : (["emoji", "stickers"] as const)).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={pickerTab === t}
                    className={pickerTab === t ? "lobby-chat__picker-tab lobby-chat__picker-tab--active" : "lobby-chat__picker-tab"}
                    onClick={() => setPickerTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {pickerTab === "memes" && GIPHY_ENABLED ? (
                <GiphyPicker onPick={sendGiphy} />
              ) : pickerTab === "emoji" ? (
                <div className="lobby-chat__picker" role="dialog" aria-label="emoji">
                  {EMOJIS.map((e) => (
                    <button key={e} type="button" onClick={() => insertEmoji(e)}>
                      {e}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="lobby-chat__stickers" role="dialog" aria-label="stickers">
                  {STICKERS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="lobby-chat__sticker lobby-chat__sticker--mini"
                      style={{ background: s.bg, color: s.ink }}
                      onClick={() => sendSticker(s)}
                      title={`send "${s.text}"`}
                    >
                      <span className="lobby-chat__sticker-emoji">{s.emoji}</span>
                      <span className="lobby-chat__sticker-text">{s.text}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="lobby-chat__compose">
            <button
              ref={emojiBtnRef}
              type="button"
              className="lobby-chat__emoji-btn"
              onClick={() => setPickerOpen((v) => !v)}
              aria-expanded={pickerOpen}
              aria-label="emoji"
            >
              😊
            </button>
            <input
              ref={inputRef}
              className="lobby-chat__input"
              value={draft}
              maxLength={MAX_LEN}
              placeholder="message the lobby…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <button type="button" className="lobby-chat__send" onClick={send} disabled={!draft.trim()}>
              send
            </button>
          </div>
        </div>
      )}
      <button type="button" className="lobby-chat__toggle" onClick={toggle} aria-expanded={open}>
        chat
        {!open && unread > 0 && <span className="lobby-chat__badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
    </div>
  );
}
