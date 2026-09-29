// "ops board" make-it-fun background: a faux terminal dev-ops dashboard, reimagined as a
// live focus board. Pure CSS/markup (no canvas, no assets) and its own original content --
// it borrows the terminal aesthetic, not anyone's actual screen. Sits behind the timer,
// dimmed with a centre vignette so the clock stays readable.

// a small pixel mark, top-left. 1 = a filled teal cell.
const LOGO = [
  [1, 1, 1, 0, 0, 0],
  [1, 0, 0, 1, 0, 0],
  [1, 1, 1, 0, 1, 0],
  [1, 0, 1, 1, 0, 0],
  [1, 0, 0, 1, 1, 0],
  [1, 0, 0, 0, 1, 1],
];

const BOARD: { label: string; count: number; pct: number; tone: string }[] = [
  { label: "in focus", count: 4, pct: 62, tone: "g" },
  { label: "on break", count: 1, pct: 16, tone: "y" },
  { label: "queued", count: 5, pct: 74, tone: "b" },
  { label: "idle", count: 2, pct: 30, tone: "s" },
  { label: "done today", count: 11, pct: 88, tone: "g" },
];

const CREW: { name: string; tone: string; lines: { task: string; note: string; dim?: boolean }[] }[] = [
  {
    name: "you",
    tone: "g",
    lines: [
      { task: "deep work", note: "focusing" },
      { task: "#19 write the thing", note: "25:00" },
      { task: "editing draft.md", note: "in session", dim: true },
    ],
  },
  {
    name: "maya",
    tone: "g",
    lines: [{ task: "#11 read the paper", note: "focusing" }],
  },
  { name: "sid", tone: "s", lines: [{ task: "#12 inbox zero", note: "on break", dim: true }] },
];

const QUEUE: { id: string; task: string; note: string; tone: string }[] = [
  { id: "#13", task: "outline the deck", note: "up next", tone: "y" },
  { id: "#14", task: "reply to two emails", note: "queued", tone: "s" },
  { id: "#15", task: "20 min stretch", note: "queued", tone: "s" },
  { id: "#16", task: "review the PR", note: "needs a plan", tone: "s" },
  { id: "#18", task: "plan tomorrow", note: "queued", tone: "s" },
];

export function OpsBoard() {
  return (
    <div className="ops" aria-hidden="true">
      <div className="ops__inner">
        <header className="ops__head">
          <div className="ops__logo">
            {LOGO.flatMap((row, y) =>
              row.map((on, x) => <span key={`${x}-${y}`} className={on ? "ops__px ops__px--on" : "ops__px"} />),
            )}
          </div>
          <div className="ops__title">
            <span className="ops__name">pomo</span> <span className="ops__dim">focus/ops</span>
            <div className="ops__meta">
              <span className="ops__d ops__d--g" /> 4 focusing <span className="ops__d ops__d--y" /> 1 on break
            </div>
          </div>
          <span className="ops__clock">
            09:00<span className="ops__cursor">▊</span>
          </span>
        </header>

        <section className="ops__sec">
          <p className="ops__h">BOARD</p>
          <ul className="ops__board">
            {BOARD.map((r) => (
              <li key={r.label} className="ops__brow">
                <span className="ops__blabel">{r.label}</span>
                <span className="ops__track">
                  <span className={`ops__fill ops__fill--${r.tone}`} style={{ width: `${r.pct}%` }} />
                </span>
                <span className="ops__count">{r.count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="ops__sec">
          <p className="ops__h">WHO IS DOING WHAT</p>
          {CREW.map((c) => (
            <div key={c.name} className="ops__crew">
              <p className="ops__member">
                <span className={`ops__d ops__d--${c.tone}`} /> {c.name}
              </p>
              {c.lines.map((l, i) => (
                <p key={i} className={l.dim ? "ops__line ops__line--dim" : "ops__line"}>
                  <span className="ops__branch">{i === c.lines.length - 1 ? "└" : "├"}</span>
                  <span className={`ops__d ops__d--${c.tone}`} /> {l.task}
                  <span className="ops__note">{l.note}</span>
                </p>
              ))}
            </div>
          ))}
        </section>

        <section className="ops__sec">
          <p className="ops__h">QUEUE</p>
          <ul className="ops__queue">
            {QUEUE.map((q) => (
              <li key={q.id} className="ops__qrow">
                <span className="ops__qid">{q.id}</span>
                <span className="ops__qtask">{q.task}</span>
                <span className={`ops__note ops__note--${q.tone}`}>{q.note}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="ops__vignette" />
    </div>
  );
}
