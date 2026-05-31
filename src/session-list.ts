export type SessionListEntry = { id: string; parentID?: string }

export function parseSessionListResponse(all: unknown): SessionListEntry[] {
  const list = Array.isArray(all) ? all : ((all as { data?: unknown })?.data ?? [])
  if (!Array.isArray(list)) return []
  return list as SessionListEntry[]
}

export function childSessionIdsForParent(list: SessionListEntry[], parentId: string): string[] {
  return list.filter((s) => s.parentID === parentId).map((s) => s.id)
}
