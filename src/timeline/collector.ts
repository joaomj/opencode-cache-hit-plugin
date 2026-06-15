import type { TimelineConfig } from "../plugin-config.ts"
import type { AssistantMessage } from "../types.ts"
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
  handlePart: (messageID: string, partType: string, startTime: number) => void
  resetForRootChange: () => void
  dispose: () => void
  memoryRecords: () => readonly LlmCallRecord[]
}

export function createTimelineCollector(opts: {
  config: TimelineConfig
  getRootSessionId: () => string
  getChildIds: () => readonly string[]
  /** Test hook: replace disk append */
  append?: (logPath: string, record: LlmCallRecord) => Promise<void>
}): TimelineCollector {
  if (!opts.config.enabled) {
    return {
      handleMessage: () => {},
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

  let activeDateKey = localDateKey()
  let memory: LlmCallRecord[] = []
  let disposed = false
  const firstPartTime = new Map<string, number>()

  const ensureDateKey = () => {
    const today = localDateKey()
    if (today !== activeDateKey) {
      activeDateKey = today
    }
    return today
  }

  const handlePart = (messageID: string, partType: string, startTime: number) => {
    if (disposed) return
    if (partType === "text" && !firstPartTime.has(messageID)) {
      firstPartTime.set(messageID, startTime)
    }
  }

  const handleMessage = (sessionID: string, msg: AssistantMessage) => {
    if (disposed) return
    const rootId = opts.getRootSessionId()
    if (!rootId) return

    let scope: "main" | "child"
    if (sessionID === rootId) {
      scope = "main"
    } else if (opts.getChildIds().includes(sessionID)) {
      scope = "child"
    } else {
      return
    }

    if (msg.role !== "assistant") return
    if (!opts.config.logSummaryMessages && msg.summary === true) return

    const msgID = msg.id ?? msg.messageID ?? ""
    const rec = assistantMessageToRecord(msg, sessionID, rootId, scope, Date.now(), firstPartTime.get(msgID))
    if (!rec) return
    if (!opts.config.flushIncomplete && !rec.isComplete) return

    const logPath = timelineDailyLogPath(logsDir, ensureDateKey())
    void append(logPath, rec).catch(() => {})

    memory.push(rec)
    const max = opts.config.maxMemoryRows
    while (memory.length > max) memory.shift()

    if (rec.isComplete) {
      firstPartTime.delete(msgID)
    }
  }

  return {
    handleMessage,
    handlePart,
    resetForRootChange: () => {
      memory = []
      firstPartTime.clear()
    },
    dispose: () => {
      disposed = true
      memory = []
      firstPartTime.clear()
    },
    memoryRecords: () => {
      const max = opts.config.maxMemoryRows
      if (memory.length <= max) return memory
      return memory.slice(-max)
    },
  }
}
