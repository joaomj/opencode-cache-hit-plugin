import { appendFile, mkdir, readdir, stat, unlink } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import type { TimelineConfig } from "../plugin-config.ts"
import type { LlmCallRecord } from "./types.ts"
import { rotateFileBySize, trimFileToMaxLines } from "./rotation.ts"

export const DEFAULT_TIMELINE_DIR = join(homedir(), ".local", "share", "opencode", "logs", "cache-hit")
export const TIMELINE_FILE_PREFIX = "timeline"

export type TimelineWriteOptions = Pick<
  TimelineConfig,
  "maxLinesPerFile" | "rotateMaxBytes" | "retainRotated"
>

export function resolveTimelineDir(config: TimelineConfig): string {
  const raw = (config.dir ?? "").trim()
  if (!raw) return DEFAULT_TIMELINE_DIR
  return raw.startsWith("~/") ? join(homedir(), raw.slice(2)) : raw
}

/** Local calendar day `YYYY-MM-DD` for daily log files. */
export function localDateKey(ms = Date.now()): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Active daily log: `logs/timeline-2026-05-31.jsonl`; rolls to `.jsonl.1` when over size. */
export function timelineDailyLogPath(logsDir: string, dateKey: string): string {
  return join(logsDir, `${TIMELINE_FILE_PREFIX}-${dateKey}.jsonl`)
}

export function serializeRecord(record: LlmCallRecord): string {
  return JSON.stringify(record) + "\n"
}

const TIMELINE_FILE_RE = /^timeline-\d{4}-\d{2}-\d{2}\.jsonl(\.\d+)?$/

/** Parsed daily log name: `roll` 0 = active file, `.1`…`.N` = older backups. */
export function parseTimelineLogBasename(name: string): { dateKey: string; roll: number } | null {
  const m = /^timeline-(\d{4}-\d{2}-\d{2})\.jsonl(?:\.(\d+))?$/.exec(name)
  if (!m) return null
  return { dateKey: m[1], roll: m[2] ? Number.parseInt(m[2], 10) : 0 }
}

/** Sort key for purge: oldest calendar day first, then highest backup index. */
export function compareTimelineLogsForPurge(aPath: string, bPath: string): number {
  const a = parseTimelineLogBasename(aPath.split(/[/\\]/).pop() ?? "")
  const b = parseTimelineLogBasename(bPath.split(/[/\\]/).pop() ?? "")
  if (!a || !b) return 0
  if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey)
  return b.roll - a.roll
}

async function listTimelineLogFiles(logsDir: string): Promise<{ path: string; mtimeMs: number }[]> {
  let names: string[]
  try {
    names = await readdir(logsDir)
  } catch {
    return []
  }
  const entries: { path: string; mtimeMs: number }[] = []
  for (const name of names) {
    if (!TIMELINE_FILE_RE.test(name)) continue
    const path = join(logsDir, name)
    try {
      entries.push({ path, mtimeMs: (await stat(path)).mtimeMs })
    } catch {
      /* ignore */
    }
  }
  return entries
}

/** Delete `timeline-*.jsonl*` older than `maxAgeDays` (by mtime). */
export async function purgeTimelineLogsOlderThan(
  logsDir: string,
  maxAgeDays: number,
): Promise<void> {
  if (maxAgeDays <= 0) return
  const cutoff = Date.now() - maxAgeDays * 86_400_000
  for (const { path, mtimeMs } of await listTimelineLogFiles(logsDir)) {
    if (mtimeMs < cutoff) await unlink(path).catch(() => {})
  }
}

/** Keep at most `maxLogFiles` timeline files; delete earliest logs (date, then backup roll). */
export async function purgeTimelineLogsOverCount(
  logsDir: string,
  maxLogFiles: number,
): Promise<void> {
  if (maxLogFiles <= 0) return
  const entries = await listTimelineLogFiles(logsDir)
  if (entries.length <= maxLogFiles) return
  entries.sort((a, b) => {
    const byLog = compareTimelineLogsForPurge(a.path, b.path)
    if (byLog !== 0) return byLog
    return a.mtimeMs - b.mtimeMs
  })
  const remove = entries.length - maxLogFiles
  for (let i = 0; i < remove; i++) {
    await unlink(entries[i].path).catch(() => {})
  }
}

/** Age purge first, then enforce total file cap. */
export async function purgeTimelineLogDir(
  logsDir: string,
  opts: { maxAgeDays: number; maxLogFiles: number },
): Promise<void> {
  await purgeTimelineLogsOlderThan(logsDir, opts.maxAgeDays)
  await purgeTimelineLogsOverCount(logsDir, opts.maxLogFiles)
}

export async function appendTimelineRecord(
  logPath: string,
  record: LlmCallRecord,
  rotation?: TimelineWriteOptions,
): Promise<void> {
  await mkdir(dirname(logPath), { recursive: true })
  const maxLines = rotation?.maxLinesPerFile ?? 0
  const maxBytes = rotation?.rotateMaxBytes ?? 0
  const retain = rotation?.retainRotated ?? 5

  if (maxBytes > 0) {
    await rotateFileBySize(logPath, maxBytes, retain)
  }
  await appendFile(logPath, serializeRecord(record), "utf8")
  if (maxLines > 0) {
    await trimFileToMaxLines(logPath, maxLines)
  }
}
