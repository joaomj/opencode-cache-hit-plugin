/**
 * Reusable OpenCode TUI sidebar panel framework (visual-cache layout language).
 * Domain plugins compose: TuiPanel + sections + metric rows + optional Hit row.
 */

export {
  MIN_PANEL_WIDTH,
  DEFAULT_PANEL_WIDTH,
  PANEL_GUTTER,
  HEADER_PREFIX,
  visualWidth,
  visualPadEnd,
  truncateVisual,
  justifyRow,
  justifyEnds,
  computeHitBarWidth,
  separatorLine,
  sepAfterPrefix,
  padBeforeTitleSummary,
} from "./layout.ts"

export { buildPanelPalette, themeColorToHex, type PanelPalette } from "./palette.ts"

export {
  createPanelLayout,
  createSectionFold,
  type PanelLayout,
  type PanelLayoutOptions,
  type SectionFold,
} from "./use-panel-layout.ts"

export {
  TuiPanel,
  TuiPanelTitle,
  TuiTitleSummaryPad,
  TuiPanelSep,
  TuiPanelNoData,
  TuiSection,
  TuiMetricRow,
  TuiHitRow,
} from "./components.tsx"
