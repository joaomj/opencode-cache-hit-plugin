/** @jsxImportSource @opentui/solid */
import { Show, type JSX } from "solid-js"
import type { UiStrings } from "./i18n.ts"
import { formatTokenCount } from "./format-tokens.ts"
import { TuiMetricRow } from "./tui-panel/index.ts"
import type { PanelLayout, PanelPalette } from "./tui-panel/index.ts"
import type { SessionSnapshot } from "./types.ts"

export type TokenSnap = Pick<
  SessionSnapshot,
  "cacheRead" | "cacheWrite" | "input" | "output" | "reasoning"
>

export function TokenDetailRows(props: {
  pal: PanelPalette
  layout: PanelLayout
  t: UiStrings
  snap: TokenSnap
  children?: JSX.Element
}) {
  const tok = (n: number) => formatTokenCount(n)
  return (
    <>
      <Show when={props.snap.cacheRead > 0}>
        <TuiMetricRow
          pal={props.pal}
          layout={props.layout}
          label={props.t.read}
          value={tok(props.snap.cacheRead)}
          unit={props.t.tok}
        />
      </Show>
      <Show when={props.snap.cacheWrite > 0}>
        <TuiMetricRow
          pal={props.pal}
          layout={props.layout}
          label={props.t.write}
          value={tok(props.snap.cacheWrite)}
          unit={props.t.tok}
        />
      </Show>
      <TuiMetricRow
        pal={props.pal}
        layout={props.layout}
        label={props.t.miss}
        value={tok(props.snap.input)}
        unit={props.t.tok}
      />
      <TuiMetricRow
        pal={props.pal}
        layout={props.layout}
        label={props.t.out}
        value={tok(props.snap.output)}
        unit={props.t.tok}
      />
      <Show when={props.snap.reasoning > 0}>
        <TuiMetricRow
          pal={props.pal}
          layout={props.layout}
          label={props.t.reasoning}
          value={tok(props.snap.reasoning)}
          unit={props.t.tok}
        />
      </Show>
      {props.children}
    </>
  )
}
