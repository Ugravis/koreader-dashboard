'use client'

import { type FocusEvent, type MouseEvent, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** What a chart mark shows on hover or focus: a title and labelled values. */
export type Tip = { title: string; rows: { label: string; value: string }[] }

export const tipLabel = (tip: Tip) =>
  [tip.title, ...tip.rows.map((r) => `${r.label}: ${r.value}`)].join(', ')

type Anchor = { key: string; tip: Tip; x: number; top: number; bottom: number }

const GAP = 8
const MARGIN = 8

/**
 * Hover and focus tooltip for chart marks. Rendered in a portal with fixed positioning,
 * so cards with `overflow-hidden` and scrolling charts never clip it. `bind` returns the
 * props of a mark; `active` is the key of the hovered mark.
 */
export function useChartTooltip() {
  const [anchor, setAnchor] = useState<Anchor | null>(null)

  const show = (target: Element, key: string, tip: Tip, child: boolean) => {
    const el = (child && target.firstElementChild) || target
    const r = el.getBoundingClientRect()
    setAnchor({ key, tip, x: r.left + r.width / 2, top: r.top, bottom: r.bottom })
  }
  const hide = () => setAnchor(null)

  /** `focusable: false` for dense grids; `anchorChild` places the tip on the first child. */
  const bind = (
    key: string,
    tip: Tip,
    { focusable = true, anchorChild = false }: { focusable?: boolean; anchorChild?: boolean } = {},
  ) => ({
    'aria-label': tipLabel(tip),
    tabIndex: focusable ? 0 : undefined,
    onMouseEnter: (e: MouseEvent<Element>) => show(e.currentTarget, key, tip, anchorChild),
    onMouseLeave: hide,
    onFocus: (e: FocusEvent<Element>) => show(e.currentTarget, key, tip, anchorChild),
    onBlur: hide,
  })

  const layer =
    anchor && typeof document !== 'undefined'
      ? createPortal(<TooltipBox anchor={anchor} />, document.body)
      : null

  return { bind, layer, active: anchor?.key ?? null }
}

function TooltipBox({ anchor }: { anchor: Anchor }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  // Measure, then keep the box inside the viewport: above the mark, else below.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const left = Math.min(
      Math.max(anchor.x - width / 2, MARGIN),
      window.innerWidth - width - MARGIN,
    )
    const above = anchor.top - height - GAP
    setPos({ left, top: above >= MARGIN ? above : anchor.bottom + GAP })
  }, [anchor])

  return (
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none fixed z-50 max-w-72 min-w-32 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95"
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}
    >
      <p className="mb-1 font-medium">{anchor.tip.title}</p>
      <dl className="flex flex-col gap-0.5">
        {anchor.tip.rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-4">
            <dt className="truncate text-muted-foreground">{r.label}</dt>
            <dd className="shrink-0 font-medium tabular-nums">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
