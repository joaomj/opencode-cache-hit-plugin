import type { TimelineConfig } from "../plugin-config.ts"
import type { AssistantMessage } from "../types.ts"
import { buildCallRecords, mergeAndSortRecords } from "./records.ts"
import {
  appendTimelineRecord,
  localDateKey,
  purgeTimelineLogDir,
  resolveTimelineDir,
  timelineDailyLogPath,
} from "./writer.ts"
import type { LlmCallRecord } from "./types.ts"

export const TIMELINE_DEBOUNCE_MS = 500

export type TimelineCollector = {
  schedule: () => void
  resetForRootChange: () => void
  dispose: () => void
  memoryRecords: () => readonly LlmCallRecord[]
}

export function createTimelineCollector(opts: {
  config: TimelineConfig
  getRootSessionId: () => string
  getChildIds: () => readonly string[]
  getMessages: (sessionId: string) => readonly AssistantMessage[]
  /** Test hook: replace disk append */
  append?: (logPath: string, record: LlmCallRecord) => Promise<void>
}): TimelineCollector {
  if (!opts.config.enabled) {
    return {
      schedule: () => {},
      resetForRootChange: () => {},
      dispose: () => {},
      memoryRecords: () => [],
    }
  }

  const logsDir = resolveTimelineDir(opts.config)
  const rotation = {
    maxLinesPerFile: opts.config.maxLinesPerFile,
    rotateMaxBytes: opts.config.rotateMaxBytes,
    retainRotated: opts.config.retainRotated,
  }
  const append =
    opts.append ??
    ((path, rec) => appendTimelineRecord(path, rec, rotation))
  if (opts.config.maxAgeDays > 0 || opts.config.maxLogFiles > 0) {
    void purgeTimelineLogDir(logsDir, {
      maxAgeDays: opts.config.maxAgeDays,
      maxLogFiles: opts.config.maxLogFiles,
    })
  }
  const flushedKeys = new Set<string>()
  let activeDateKey = localDateKey()
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let memory: LlmCallRecord[] = []
  let collectGen = 0

  const ensureDateKey = () => {
    const today = localDateKey()
    if (today !== activeDateKey) {
      flushedKeys.clear()
      activeDateKey = today
    }
    return today
  }

  const clearDebounce = () => {
    if (debounceTimer !== undefined) clearTimeout(debounceTimer)
    debounceTimer = undefined
  }

  const shouldFlushToDisk = (rec: LlmCallRecord): boolean => {
    if (flushedKeys.has(rec.messageKey)) return false
    if (rec.isComplete) return true
    return opts.config.flushIncomplete
  }

  const flushRecords = async (records: LlmCallRecord[], rootId: string, gen: number) => {
    const logPath = timelineDailyLogPath(logsDir, ensureDateKey())
    for (const rec of records) {
      if (gen !== collectGen || opts.getRootSessionId() !== rootId) return
      if (!shouldFlushToDisk(rec)) continue
      flushedKeys.add(rec.messageKey)
      try {
        await append(logPath, rec)
      } catch {
        flushedKeys.delete(rec.messageKey)
      }
    }
  }

  const collectNow = () => {
    clearDebounce()
    const rootId = opts.getRootSessionId()
    if (!rootId) {
      memory = []
      return
    }
    const gen = collectGen
    const chunks: LlmCallRecord[][] = []
    const mainMsgs = opts.getMessages(rootId)
    if (mainMsgs.length) {
      chunks.push(
        buildCallRecords(rootId, rootId, "main", mainMsgs, {
          logSummaryMessages: opts.config.logSummaryMessages,
        }),
      )
    }
    for (const cid of opts.getChildIds()) {
      const msgs = opts.getMessages(cid)
      if (msgs.length) {
        chunks.push(
          buildCallRecords(cid, rootId, "child", msgs, {
            logSummaryMessages: opts.config.logSummaryMessages,
          }),
        )
      }
    }
    if (gen !== collectGen || opts.getRootSessionId() !== rootId) return
    memory = mergeAndSortRecords(chunks)
    const toFlush = memory.filter(shouldFlushToDisk)
    if (toFlush.length > 0) {
      queueMicrotask(() => flushRecords(toFlush, rootId, gen))
    }
  }

  const schedule = () => {
    clearDebounce()
    if (!opts.getRootSessionId()) return
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined
      collectNow()
    }, TIMELINE_DEBOUNCE_MS)
  }

  const resetForRootChange = () => {
    collectGen++
    clearDebounce()
    memory = []
  }

  const dispose = () => {
    collectGen++
    clearDebounce()
  }

  const memoryRecords = () => {
    const max = opts.config.maxMemoryRows
    if (memory.length <= max) return memory
    return memory.slice(-max)
  }

  return { schedule, resetForRootChange, dispose, memoryRecords }
}
