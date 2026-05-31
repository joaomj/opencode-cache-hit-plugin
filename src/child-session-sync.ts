import { childSessionIdsForParent, parseSessionListResponse } from "./session-list.ts"
import type { OpenCodeTuiApi } from "./types.ts"

/** Debounce for session.list after foreign-session message.updated (streaming fires often). */
export const CHILD_LIST_DEBOUNCE_MS = 200

/** Pass `api.client.session`, never `api.client`. */
export type ChildSessionListClient = OpenCodeTuiApi["client"]["session"]

/**
 * Keeps child session ids in sync with session.list for a single parent session.
 * - Parent change: invalidate in-flight work, clear ids, list immediately.
 * - Foreign message.updated: debounced list (source of truth; no append-only).
 */
export function createChildSessionSync(opts: {
  client: ChildSessionListClient
  getDirectory: () => string
  getParentId: () => string
  setChildIds: (ids: string[]) => void
  onSynced?: () => void
  debounceMs?: number
}) {
  let listGen = 0
  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  const clearDebounce = () => {
    if (debounceTimer !== undefined) clearTimeout(debounceTimer)
    debounceTimer = undefined
  }

  const loadChildren = () => {
    clearDebounce()
    const parentId = opts.getParentId()
    if (!parentId) {
      opts.setChildIds([])
      return
    }
    const gen = listGen
    const directory = opts.getDirectory()
    opts.client
      .list({ query: { directory } })
      .then(
        (all) => {
          if (gen !== listGen || opts.getParentId() !== parentId) return
          opts.setChildIds(childSessionIdsForParent(parseSessionListResponse(all), parentId))
          opts.onSynced?.()
        },
        () => {
          if (gen !== listGen || opts.getParentId() !== parentId) return
          opts.setChildIds([])
        },
      )
  }

  const scheduleLoad = () => {
    clearDebounce()
    if (!opts.getParentId()) return
    const ms = opts.debounceMs ?? CHILD_LIST_DEBOUNCE_MS
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined
      loadChildren()
    }, ms)
  }

  /** Call when the sidebar parent session id changes. */
  const resetForParentChange = () => {
    listGen++
    clearDebounce()
    opts.setChildIds([])
  }

  /** message.updated on a session other than the current parent. */
  const onForeignSessionActivity = (sessionId: string | undefined) => {
    const parentId = opts.getParentId()
    if (!parentId || !sessionId || sessionId === parentId) return
    scheduleLoad()
  }

  const dispose = () => {
    listGen++
    clearDebounce()
  }

  return {
    loadChildren,
    scheduleLoad,
    resetForParentChange,
    onForeignSessionActivity,
    dispose,
    /** Test hook: current generation token. */
    _generation: () => listGen,
  }
}
