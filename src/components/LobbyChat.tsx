import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { resolveIdentityKey } from "../lib/identity";
import { connectLobbyChat, sendChatMessage, type LobbyChatMessage } from "../lib/lobbySync";
import { playMessagePing } from "../lib/sound";

// how many messages to keep in memory -- this chat is ephemeral (no DB, see lobbySync.ts),
// so there's nothing to page through; an unbounded array would just grow for the life of
// the tab. The oldest drop off the top, same as a real chat window's scrollback limit.
const MAX_MESSAGES = 100;
const MAX_LEN = 500;

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
    const channel = connectLobbyChat(lobbyId, (message) => {
      setMessages((prev) => [...prev, message].slice(-MAX_MESSAGES));
      // incoming messages are always from someone else (the channel is self:false), so a
      // soft ping every time is right -- our own sends go through send() and never here
      playMessagePing();
      if (!openRef.current) setUnread((n) => n + 1);
    });
    channelRef.current = channel;
    return () => {
      channel?.unsubscribe();
      channelRef.current = null;
    };
  }, [lobbyId]);

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
                return (
                  <div key={m.id} className={mine ? "lobby-chat__msg lobby-chat__msg--mine" : "lobby-chat__msg"}>
                    {!mine && <span className="lobby-chat__from">{m.personaName}</span>}
                    <span className="lobby-chat__text">{m.text}</span>
                  </div>
                );
              })
            )}
          </div>
          <div className="lobby-chat__compose">
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
