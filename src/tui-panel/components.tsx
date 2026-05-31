/** @jsxImportSource @opentui/solid */
import { Show, type JSX } from "solid-js"
import { padBeforeTitleSummary, sepAfterPrefix, visualWidth } from "./layout.ts"
import type { PanelLayout } from "./use-panel-layout.ts"
import type { PanelPalette } from "./palette.ts"

export function TuiPanel(props: {
  pal: PanelPalette
  border: boolean
  layout: PanelLayout
  children: JSX.Element
}) {
  const bindRef = (el: { width?: number } | undefined) => {
    props.layout.boxRef = el
  }
  return (
    <box
      ref={bindRef}
      onSizeChange={props.layout.syncWidth}
      border={props.border}
      {...(props.border ? { borderColor: props.pal.border } : {})}
      paddingTop={0}
      paddingBottom={0}
      paddingLeft={props.border ? 2 : 0}
      paddingRight={props.border ? 2 : 0}
      flexDirection="column"
      gap={0}
      width="100%"
    >
      {props.children}
    </box>
  )
}

export function TuiPanelTitle(props: {
  pal: PanelPalette
  layout: PanelLayout
  open: boolean
  onToggle: () => void
  title: string
  version?: string
  collapsed?: JSX.Element
}) {
  return (
    <text onMouseUp={props.onToggle}>
      <span style={{ fg: props.pal.muted }}>{props.open ? "\u25bc " : "\u25b6 "}</span>
      <span style={{ fg: props.pal.primary }}>
        <b>{props.title}</b>
        <Show when={props.open && props.version}>
          <span style={{ fg: props.pal.muted }}> (v{props.version})</span>
        </Show>
      </span>
      <Show when={!props.open && props.collapsed}>{props.collapsed}</Show>
    </text>
  )
}

export function TuiTitleSummaryPad(props: {
  layout: PanelLayout
  titleWidth: number
  summaryWidth: number
  children: JSX.Element
}) {
  const spaces = () =>
    padBeforeTitleSummary(
      props.layout.panelWidth(),
      props.layout.gutter(),
      props.titleWidth,
      props.summaryWidth,
    )
  return (
    <span>
      {" ".repeat(spaces())}
      {props.children}
    </span>
  )
}

export function TuiPanelSep(props: { pal: PanelPalette; layout: PanelLayout }) {
  return <text fg={props.pal.muted}>{props.layout.sep()}</text>
}

export function TuiPanelNoData(props: {
  pal: PanelPalette
  layout: PanelLayout
  message: string
}) {
  return (
    <>
      <TuiPanelSep pal={props.pal} layout={props.layout} />
      <text>
        <span style={{ fg: props.pal.muted }}>{"> "}</span>
        <span style={{ fg: props.pal.muted }}>{props.message}</span>
      </text>
    </>
  )
}

export function TuiSection(props: {
  pal: PanelPalette
  layout: PanelLayout
  open: boolean
  title: string
  suffix?: string
  onToggle: () => void
  children: JSX.Element
}) {
  const prefix = () =>
    `${props.open ? "\u25bc " : "\u25b6 "}${props.title}${props.suffix ?? ""}`
  return (
    <>
      <text onMouseUp={props.onToggle}>
        <span style={{ fg: props.pal.muted }}>{props.open ? "\u25bc " : "\u25b6 "}</span>
        <span style={{ fg: props.pal.primary }}>
          <b>{props.title}</b>
        </span>
        <Show when={props.suffix}>
          <span style={{ fg: props.pal.muted }}>{props.suffix}</span>
        </Show>
        <span style={{ fg: props.pal.muted }}>
          {sepAfterPrefix(prefix(), props.layout.gauge())}
        </span>
      </text>
      <Show when={props.open}>{props.children}</Show>
    </>
  )
}

export function TuiMetricRow(props: {
  pal: PanelPalette
  layout: PanelLayout
  label: string
  value: string
  unit?: string
  fg?: string
}) {
  const fg = props.fg ?? props.pal.muted
  return (
    <text fg={fg}>
      {props.layout.row(props.label, props.value, props.unit ?? "")}
    </text>
  )
}

export function TuiHitRow(props: {
  label: string
  bar: string
  pct: string
  barColor: string
  textColor: string
  trend?: { text: string; color: string }
}) {
  return (
    <text>
      <span style={{ fg: props.textColor }}>{props.label} </span>
      <span style={{ fg: props.barColor }}>[{props.bar}] </span>
      <span style={{ fg: props.textColor }}>{props.pct}</span>
      <Show when={props.trend}>
        <span style={{ fg: props.trend!.color }}> {props.trend!.text}</span>
      </Show>
    </text>
  )
}
