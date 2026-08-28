import type { ToolTimingTracker } from "../tool-timing.ts"
import type { TimelineConfig } from "../plugin-config.ts"
import type { AssistantMessage } from "../types.ts"
import type { VisibleTextTiming } from "../first-part-time.ts"
import { assistantMessageToRecord } from "./records.ts"
import {
  appendTimelineRecord,
  localDateKey,
  purgeTimelineLogDir,
  resolveTimelineDir,
  timelineDailyLogPath,
} from "./writer.ts"
import type { LlmCallRecord } from "./types.ts"

export type TimelineCollector = {
  /** Process a single message from a message.updated event. */
  handleMessage: (sessionID: string, msg: AssistantMessage) => void
  reset: () => void
  dispose: () => void
  memoryRecords: () => readonly LlmCallRecord[]
}

export function createTimelineCollector(opts: {
  getConfig: () => TimelineConfig
  getSessionId: () => string
  toolTiming: ToolTimingTracker
  textTiming?: (messageID: string) => VisibleTextTiming | undefined
  /** Test hook: replace disk append */
  append?: (logPath: string, record: LlmCallRecord, config: TimelineConfig) => Promise<void>
}): TimelineCollector {
  const toolTiming = opts.toolTiming
  const defaultAppend = opts.append ?? ((path: string, record: LlmCallRecord, cfg: TimelineConfig) =>
    appendTimelineRecord(path, record, {
      maxLinesPerFile: cfg.maxLinesPerFile,
      rotateMaxBytes: cfg.rotateMaxBytes,
      retainRotated: cfg.retainRotated,
    }))

  let activeDateKey = localDateKey()
  let memory: LlmCallRecord[] = []
  let disposed = false
  let purgeDone = false

  const ensureDateKey = () => {
    const today = localDateKey()
    if (today !== activeDateKey) {
      activeDateKey = today
    }
    return today
  }

  const maybePurge = (config: TimelineConfig) => {
    if (purgeDone) return
    if (config.maxAgeDays <= 0 && config.maxLogFiles <= 0) return
    purgeDone = true
    void purgeTimelineLogDir(resolveTimelineDir(config), {
      maxAgeDays: config.maxAgeDays,
      maxLogFiles: config.maxLogFiles,
    })
  }

  const handleMessage = (sessionID: string, msg: AssistantMessage) => {
    if (disposed) return
    const config = opts.getConfig()
    if (!config.enabled) return

    if (sessionID !== opts.getSessionId()) return

    if (msg.role !== "assistant") return
    if (!config.logSummaryMessages && msg.summary === true) return

    maybePurge(config)

    const msgID = msg.id ?? msg.messageID ?? ""
    const rec = assistantMessageToRecord(
      msg,
      sessionID,
      Date.now(),
      toolTiming.getDurations(msgID),
      opts.textTiming?.(msgID),
    )
    if (!rec) return
    if (!config.flushIncomplete && !rec.isComplete) return
    // Skip records with invalid timestamps (e.g. uninitialised epoch 1970)
    if (rec.created.startsWith("1970")) return

    const logsDir = resolveTimelineDir(config)
    const logPath = timelineDailyLogPath(logsDir, ensureDateKey())
    void defaultAppend(logPath, rec, config).catch(() => {})

    memory.push(rec)
    const max = config.maxMemoryRows
    while (memory.length > max) memory.shift()
  }

  return {
    handleMessage,
    reset: () => {
      memory = []
    },
    dispose: () => {
      disposed = true
      memory = []
    },
    memoryRecords: () => {
      const max = opts.getConfig().maxMemoryRows
      if (memory.length <= max) return memory
      return memory.slice(-max)
    },
  }
}
