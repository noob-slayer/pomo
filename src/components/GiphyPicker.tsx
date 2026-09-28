import { useEffect, useState } from "react";
import { fetchStickers, type GiphySticker } from "../lib/giphy";

// one-tap searches for the moods a focus lobby actually wants
const QUICK = ["let's go", "you got this", "focus", "tired", "this is fine", "celebrate", "bollywood", "the office"];

// the "memes" tab: GIPHY sticker search. Trending until you type; a tap sends straight away.
export function GiphyPicker({ onPick }: { onPick: (sticker: GiphySticker) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GiphySticker[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    // debounced, and the previous request aborted, so typing doesn't fire a search per key
    const id = window.setTimeout(() => {
      fetchStickers(query, controller.signal)
        .then((stickers) => {
          setResults(stickers);
          setStatus("ready");
        })
        .catch((err: unknown) => {
          if ((err as Error).name !== "AbortError") setStatus("error");
        });
    }, 350);
    return () => {
      window.clearTimeout(id);
      controller.abort();
    };
  }, [query]);

  return (
    <div className="giphy-picker" role="dialog" aria-label="sticker search">
      <input
        className="giphy-picker__search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="search stickers — movies, memes, celebs"
        maxLength={50}
        aria-label="search stickers"
      />
      <div className="giphy-picker__chips">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            className={query === q ? "giphy-picker__chip giphy-picker__chip--active" : "giphy-picker__chip"}
            onClick={() => setQuery(q)}
          >
            {q}
          </button>
        ))}
      </div>
      <div className="giphy-picker__grid">
        {status === "error" ? (
          <p className="giphy-picker__note">couldn't reach GIPHY — try again in a moment</p>
        ) : status === "ready" && results.length === 0 ? (
          <p className="giphy-picker__note">no stickers for "{query}"</p>
        ) : (
          results.map((s) => (
            <button key={s.id} type="button" className="giphy-picker__item" onClick={() => onPick(s)} title={s.title}>
              <img src={s.previewUrl} alt={s.title} loading="lazy" />
            </button>
          ))
        )}
      </div>
      <p className="giphy-picker__attribution">Powered by GIPHY</p>
    </div>
  );
}
