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
  handlePart: (messageID: string, partType: string, startTime: number, source?: "server" | "client") => void
  /** Get read-only view of first part times (messageID → timestamp). */
  getFirstPartTime: () => ReadonlyMap<string, number>
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
  const firstPartSource = new Map<string, "server" | "client">()

  const ensureDateKey = () => {
    const today = localDateKey()
    if (today !== activeDateKey) {
      activeDateKey = today
    }
    return today
  }

  const handlePart = (messageID: string, partType: string, startTime: number, source: "server" | "client" = "server") => {
    if (disposed) return
    if (partType !== "text") return
    
    const existing = firstPartTime.get(messageID)
    const existingSource = firstPartSource.get(messageID)
    
    // 优先使用服务器端 TTFT（不含网络延迟）
    if (existing !== undefined && existingSource === "server") {
      return // 已有服务器端 TTFT，忽略客户端 TTFT
    }
    
    // 如果已有客户端 TTFT，但新来的是服务器端 TTFT，则替换
    if (existing !== undefined && existingSource === "client" && source === "server") {
      firstPartTime.set(messageID, startTime)
      firstPartSource.set(messageID, source)
      return
    }
    
    // 首次设置
    if (existing === undefined) {
      firstPartTime.set(messageID, startTime)
      firstPartSource.set(messageID, source)
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
    const rec = assistantMessageToRecord(msg, sessionID, rootId, scope, Date.now(), firstPartTime.get(msgID), firstPartSource.get(msgID))
    if (!rec) return
    if (!opts.config.flushIncomplete && !rec.isComplete) return

    const logPath = timelineDailyLogPath(logsDir, ensureDateKey())
    void append(logPath, rec).catch(() => {})

    memory.push(rec)
    const max = opts.config.maxMemoryRows
    while (memory.length > max) memory.shift()

    if (rec.isComplete) {
      // Don't delete firstPartTime here - use-cache-hit-metrics needs it for display
      // It will be cleaned up by resetForRootChange or dispose
    }
  }

  return {
    handleMessage,
    handlePart,
    getFirstPartTime: () => firstPartTime,
    resetForRootChange: () => {
      memory = []
      firstPartTime.clear()
      firstPartSource.clear()
    },
    dispose: () => {
      disposed = true
      memory = []
      firstPartTime.clear()
      firstPartSource.clear()
    },
    memoryRecords: () => {
      const max = opts.config.maxMemoryRows
      if (memory.length <= max) return memory
      return memory.slice(-max)
    },
  }
}
