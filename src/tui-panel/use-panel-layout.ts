import { createEffect, createMemo, createSignal, type Accessor } from "solid-js"
import {
  DEFAULT_PANEL_WIDTH,
  justifyRow,
  MIN_PANEL_WIDTH,
  PANEL_GUTTER,
  separatorLine,
} from "./layout.ts"

export type PanelLayoutOptions = {
  border: Accessor<boolean>
}

/**
 * Measured sidebar width + row helpers.
 * Call once per panel instance (e.g. top of sidebar component), not per render branch.
 */
export function createPanelLayout(options: PanelLayoutOptions) {
  const [panelWidth, setPanelWidth] = createSignal(DEFAULT_PANEL_WIDTH)
  let boxEl: { width?: number } | undefined

  const gutter = createMemo(() => (options.border() ? PANEL_GUTTER : 0))
  const gauge = createMemo(() => Math.max(MIN_PANEL_WIDTH, panelWidth() - gutter()))
  const sep = createMemo(() => separatorLine(gauge()))

  const syncWidth = () => {
    const w = boxEl?.width
    if (typeof w === "number" && w > 0) {
      const next = Math.max(MIN_PANEL_WIDTH, w)
      setPanelWidth((prev) => (prev === next ? prev : next))
    }
  }

  createEffect(() => {
    options.border()
    syncWidth()
  })

  const row = (label: string, value: string, unit = "") => justifyRow(label, value, gauge(), unit)

  return {
    panelWidth,
    gutter,
    gauge,
    sep,
    row,
    syncWidth,
    get boxRef() {
      return boxEl
    },
    set boxRef(el: { width?: number } | undefined) {
      boxEl = el
    },
  }
}

export type PanelLayout = ReturnType<typeof createPanelLayout>

/** Independent fold state for a collapsible section. */
export function createSectionFold(initial = true) {
  const [open, setOpen] = createSignal(initial)
  return {
    open,
    setOpen,
    toggle: () => setOpen((o) => !o),
  }
}

export type SectionFold = ReturnType<typeof createSectionFold>
