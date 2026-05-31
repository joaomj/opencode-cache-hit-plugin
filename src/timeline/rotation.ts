import { readFile, rename, stat, unlink, writeFile } from "node:fs/promises"

/** Keep only the last `maxLines` non-empty lines (in-place rewrite). */
export async function trimFileToMaxLines(logPath: string, maxLines: number): Promise<void> {
  if (maxLines <= 0) return
  let text: string
  try {
    text = await readFile(logPath, "utf8")
  } catch {
    return
  }
  const lines = text.split("\n").filter((line) => line.length > 0)
  if (lines.length <= maxLines) return
  await writeFile(logPath, lines.slice(-maxLines).join("\n") + "\n", "utf8")
}

/**
 * Size-based roll: `file` → `file.1` → `file.2` … keep at most `retainRotated` backups.
 * Current active file is removed by rename; caller appends to a new empty `file`.
 */
export async function rotateFileBySize(
  logPath: string,
  maxBytes: number,
  retainRotated: number,
): Promise<void> {
  if (maxBytes <= 0) return
  let size = 0
  try {
    size = (await stat(logPath)).size
  } catch {
    return
  }
  if (size < maxBytes) return

  const retain = Math.max(0, Math.floor(retainRotated))
  if (retain === 0) {
    await unlink(logPath).catch(() => {})
    return
  }

  const oldest = `${logPath}.${retain}`
  await unlink(oldest).catch(() => {})
  for (let i = retain - 1; i >= 1; i--) {
    await rename(`${logPath}.${i}`, `${logPath}.${i + 1}`).catch(() => {})
  }
  await rename(logPath, `${logPath}.1`)
}
