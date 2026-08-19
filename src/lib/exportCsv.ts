import type { Mode, PomoRecord } from "../types";

function escapeCsvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function historyToCsv(history: PomoRecord[], mode: Mode): string {
  const rows = [...history]
    .filter((r) => r.mode === mode)
    .sort((a, b) => a.completedAt - b.completedAt)
    .map((r) => [
      new Date(r.completedAt).toISOString(),
      r.phase,
      r.taskTitle ?? "",
      String(r.minutes),
      r.completed === false ? "false" : "true",
    ]);
  const header = ["completed_at", "phase", "task", "minutes", "completed"];
  return [header, ...rows].map((row) => row.map(escapeCsvField).join(",")).join("\n");
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
