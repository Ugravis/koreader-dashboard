'use client'

import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { api, type Annotation, type Book } from '@/lib/api'
import { playPageTurn } from '@/lib/page-sound'
import { authorLine } from '@/lib/reading'
import { cn } from '@/lib/utils'
import { BookPage, type PageSide, sentencePool } from './book-page'

/** Book thickness from its page count, in px: thin novellas to thick tomes. */
export const thicknessOf = (pages: number | null) =>
  Math.round(Math.min(28, Math.max(12, (pages ?? 300) / 25)))

/** Drag pixels for the first unit (opening the cover, one leaf); farther drags speed up. */
const PX_PER_UNIT = 70
/** Movement below this is a click (opens the book page), above it a drag. */
const DRAG_PX = 6
/** Momentum after a fling: velocity kept per 16 ms frame. */
const FRICTION = 0.94
const MAX_TILT = 40
/** Pages: a bit smaller than the boards, as in a real book (percent of the cover). */
const PAGE_W = 97

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
/** Pixels to units, accelerating: a long drag runs through a thick book. */
const units = (px: number) =>
  Math.sign(px) * (Math.abs(px) / PX_PER_UNIT) * (1 + (Math.abs(px) / 320) ** 2)
/** Rest point: the cover open or closed, a leaf fully turned. */
const snap = Math.round

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 .45 0 0 0 0 .4 0 0 0 0 .32 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

type Drag = {
  x: number
  y: number
  p0: number
  moved: boolean
  samples: { t: number; p: number }[]
}

/**
 * A book in 3D, built as a closed volume (boards, page block with its three edges, spine)
 * so no tilt shows a hole. Hover lifts it. Press and drag left to open it and turn the
 * pages up to the last one, right to turn back and close it, up or down to tilt it;
 * a fling keeps the pages turning. Arrow keys, Home and End do the same from the
 * keyboard. Only the visible pages are drawn, whatever the length of the book.
 */
export function Book3D({
  book,
  children,
  className,
}: {
  book: Book
  children: ReactNode
  className?: string
}) {
  const T = thicknessOf(book.pages)
  const total = Math.max(8, book.pages ?? 300)
  const leaves = Math.ceil(total / 2)
  const maxP = 1 + leaves
  const worn = book.status === 'complete'
  const authors = authorLine(book)

  const [p, setP] = useState(0)
  const [tilt, setTilt] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [notes, setNotes] = useState<Annotation[] | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const suppressClick = useRef(false)
  const motion = useRef({ p: 0, tilt: 0, v: 0, target: null as number | null, frame: 0, last: 0 })
  const pool = useMemo(() => sentencePool(book), [book])

  /** Moves the book to position `next`, with a rustle when a leaf lands. */
  function apply(next: number, nextTilt = motion.current.tilt) {
    const m = motion.current
    const before = Math.floor(m.p - 1)
    m.p = clamp(next, 0, maxP)
    m.tilt = nextTilt
    if (m.p > 1 && Math.floor(m.p - 1) !== before) playPageTurn()
    setP(m.p)
    setTilt(m.tilt)
  }

  /** One loop for fling momentum, easing to a target and the tilt settling back. */
  function run() {
    const m = motion.current
    cancelAnimationFrame(m.frame)
    m.last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(48, now - m.last)
      m.last = now
      let next = m.p
      if (m.v !== 0) {
        next += m.v * dt
        m.v *= FRICTION ** (dt / 16)
        if (Math.abs(m.v) < 0.0008 || next <= 0 || next >= maxP) {
          m.v = 0
          m.target = snap(clamp(next, 0, maxP))
        }
      } else if (m.target !== null) {
        next += (m.target - next) * Math.min(1, dt / 70)
        if (Math.abs(m.target - next) < 0.003) {
          next = m.target
          m.target = null
        }
      }
      const nextTilt = Math.abs(m.tilt) < 0.1 ? 0 : m.tilt * 0.85 ** (dt / 16)
      apply(next, nextTilt)
      if (m.v !== 0 || m.target !== null || nextTilt !== 0) m.frame = requestAnimationFrame(step)
    }
    m.frame = requestAnimationFrame(step)
  }

  function goTo(target: number) {
    motion.current.v = 0
    motion.current.target = clamp(target, 0, maxP)
    run()
  }

  // Highlights shown on their pages, fetched the first time the book is opened.
  useEffect(() => {
    if (p <= 0 || notes) return
    let alive = true
    api
      .getBook(book.id)
      .then((r) => alive && setNotes(r.annotations))
      .catch(() => alive && setNotes([]))
    return () => {
      alive = false
    }
  }, [p, notes, book.id])

  // Keyboard on the enclosing link; a click elsewhere closes the book.
  useEffect(() => {
    const link = root.current?.closest('a')
    const onKey = (e: KeyboardEvent) => {
      const at = motion.current.target ?? motion.current.p
      const moves: Record<string, number> = {
        ArrowLeft: Math.floor(at + 1e-6) + 1,
        ArrowRight: Math.ceil(at - 1e-6) - 1,
        Home: 0,
        Escape: 0,
        End: maxP,
      }
      const target = moves[e.key]
      if (target === undefined || (e.key === 'Escape' && at === 0)) return
      e.preventDefault()
      goTo(target)
    }
    const onOutside = (e: globalThis.PointerEvent) => {
      if (motion.current.p > 0 && !root.current?.contains(e.target as Node)) goTo(0)
    }
    // The link itself is draggable: a native drag would cancel the pointer events.
    const noDrag = (e: DragEvent) => e.preventDefault()
    link?.setAttribute('draggable', 'false')
    link?.addEventListener('dragstart', noDrag)
    link?.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onOutside)
    const m = motion.current
    return () => {
      link?.removeEventListener('dragstart', noDrag)
      link?.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onOutside)
      cancelAnimationFrame(m.frame)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- goTo only reads refs and maxP.
  }, [maxP])

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    const m = motion.current
    cancelAnimationFrame(m.frame)
    m.v = 0
    m.target = null
    drag.current = { x: e.clientX, y: e.clientY, p0: m.p, moved: false, samples: [] }
    suppressClick.current = false
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved) {
      if (Math.hypot(dx, dy) < DRAG_PX) return
      d.moved = true
      e.currentTarget.setPointerCapture(e.pointerId)
      setDragging(true)
    }
    // Left turns forward, right turns back.
    const next = clamp(d.p0 + units(-dx), 0, maxP)
    const now = performance.now()
    d.samples = [...d.samples.filter((s) => now - s.t < 100), { t: now, p: next }]
    apply(next, clamp(-dy * 0.35, -MAX_TILT, MAX_TILT))
  }

  function onPointerUp() {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (!d.moved) {
      // A press without drag: settle anything left half-way.
      if (motion.current.p % 1 !== 0) goTo(snap(motion.current.p))
      return
    }
    suppressClick.current = true
    setDragging(false)
    const first = d.samples[0]
    const last = d.samples.at(-1)
    const span = first && last ? last.t - first.t : 0
    const m = motion.current
    m.v = span > 10 ? (last!.p - first!.p) / span : 0
    m.target = m.v === 0 ? snap(m.p) : null
    run()
  }

  // A drag ends with a click on the link: swallow it.
  function onClickCapture(e: MouseEvent) {
    if (!suppressClick.current) return
    suppressClick.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  const engaged = dragging || p > 0 || tilt !== 0
  const open = clamp(p, 0, 1)
  const turned = clamp(p - 1, 0, leaves)
  const k = Math.min(Math.floor(turned), leaves)
  const turn = k < leaves ? turned - k : 0
  const hR = T * (1 - k / leaves)
  const hL = T - hR
  // A stack holding any page keeps at least 1px, so its top page always shows.
  const dR = Math.max(hR, 1)
  const dL = Math.max(hL, 1)
  const readUpTo = book.progress * leaves
  // Share of each stack already read, measured from its top (current page) down.
  const readRight = k < leaves ? clamp((readUpTo - k) / (leaves - k), 0, 1) : 0
  const readLeft = k > 0 ? clamp(readUpTo / k, 0, 1) : 0
  const ribbonSpread = Math.floor(clamp(Math.round(book.progress * total), 1, total) / 2)
  const page = (n: number, side: PageSide, ribbon = false) =>
    n > total ? (
      <span className="absolute inset-0 bg-[#fbf8f1] dark:bg-[#e6e1d5]" />
    ) : (
      <BookPage
        book={book}
        authors={authors}
        page={n}
        total={total}
        side={side}
        pool={pool}
        notes={notes ?? []}
        ribbon={ribbon}
      />
    )

  const bodyStyle = {
    '--t': `${T}px`,
    ...(engaged && {
      transform: `translateX(${50 * open}%) translateY(-8px) scale(${1 + 0.45 * open}) rotateX(${18 * open + tilt}deg) rotateY(${-6 + 6 * open}deg)`,
    }),
  } as CSSProperties

  return (
    <div
      ref={root}
      className={cn(
        'relative touch-pan-y perspective-[1400px] select-none',
        engaged && 'z-30',
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
      onDragStart={(e) => e.preventDefault()}
    >
      <div
        className={cn(
          'relative origin-left transform-3d',
          !engaged &&
            '[transform:rotateY(-32deg)] group-hover:[transform:translateY(-8px)_rotateY(-6deg)] group-focus-visible:[transform:translateY(-8px)_rotateY(-6deg)] motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out',
        )}
        style={bodyStyle}
      >
        {/* Back board, and its endpaper seen once the last page is turned. */}
        <Plane
          z={-T - 0.6}
          className="rounded-l-sm rounded-r-md bg-neutral-700 dark:bg-neutral-800"
        />
        <Plane z={-T - 0.3} className="rounded-l-sm rounded-r-md bg-[#e9e2d0] dark:bg-[#bdb6a5]" />

        {/* Spine, closing the left side while the book is shut. */}
        {open < 0.5 && (
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 origin-left [transform:rotateY(90deg)] rounded-sm bg-neutral-800"
            style={{ width: T }}
          />
        )}

        {/* Unread pages, on the right. */}
        {k < leaves && (
          <Stack side="right" depth={dR} top={-T + dR} worn={[0, readRight]}>
            {p > 0 && page(turn > 0 ? 2 * k + 3 : 2 * k + 1, 'right', ribbonSpread === k)}
          </Stack>
        )}
        {/* Read pages, on the left, lying on the open front board. */}
        {open === 1 && k > 0 && (
          <Stack side="left" depth={dL} top={-T + dL} worn={[1 - readLeft, 1]}>
            {page(2 * k, 'left')}
          </Stack>
        )}

        {/* The leaf being turned, lifted from the right stack to the left one. */}
        {turn > 0 && (
          <span
            aria-hidden
            className="absolute top-[1%] left-0 h-[98%] origin-left transform-3d"
            style={{
              width: `${PAGE_W}%`,
              transform: `translateZ(${-T + dR + (dL - dR) * turn + 0.5}px) rotateY(${-180 * turn}deg)`,
            }}
          >
            <span className="absolute inset-0 backface-hidden">
              {page(2 * k + 1, 'right')}
              <Shade amount={turn} />
            </span>
            <span className="absolute inset-0 [transform:rotateY(180deg)] backface-hidden">
              {page(2 * k + 2, 'left')}
              <Shade amount={1 - turn} />
            </span>
          </span>
        )}

        {/* Front board, hinged on the spine; it lands flat, level with the back board. */}
        <div
          className="relative origin-left transform-3d"
          style={{
            transform: `translateZ(${-T * open + 0.6 * (1 - open)}px) rotateY(${-180 * open}deg)`,
          }}
        >
          <div
            className={cn('relative backface-hidden', worn && '[filter:sepia(.18)_saturate(.9)]')}
          >
            {children}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-[8%] rounded-l-md bg-linear-to-r from-black/35 via-white/15 to-transparent"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-md bg-linear-to-br from-white/20 via-transparent to-black/10 opacity-60 group-hover:opacity-100 motion-safe:transition-opacity motion-safe:duration-500"
            />
            {/* Patina of a finished book: grain and rubbed corners. */}
            {worn && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-md opacity-70 mix-blend-multiply"
                style={{
                  backgroundImage: `radial-gradient(circle at 100% 0, rgba(255,250,235,.55), transparent 14%), radial-gradient(circle at 100% 100%, rgba(255,250,235,.5), transparent 14%), ${NOISE}`,
                }}
              />
            )}
          </div>
          {/* Inside of the front board: endpaper. */}
          <span
            aria-hidden
            className="absolute inset-0 rounded-l-md rounded-r-sm bg-[#e9e2d0] [transform:rotateY(180deg)] backface-hidden dark:bg-[#bdb6a5]"
          />
        </div>

        {/* Ribbon bookmark hanging below a book in progress. */}
        {!engaged && book.progress > 0 && book.progress < 1 && (
          <span
            aria-hidden
            className="absolute -bottom-[7%] left-[22%] h-[9%] w-[5%] bg-chart-8 [clip-path:polygon(0_0,100%_0,100%_100%,50%_85%,0_100%)]"
            style={{ transform: `translateZ(${-T / 2}px)` }}
          />
        )}
      </div>
      {/* Floor shadow: tighter and lighter as the book lifts. */}
      {!engaged && (
        <span
          aria-hidden
          className="absolute inset-x-[8%] -bottom-2 h-3 rounded-[50%] bg-black/25 blur-md group-hover:inset-x-[14%] group-hover:bg-black/15 motion-safe:transition-all motion-safe:duration-500 dark:bg-black/60"
        />
      )}
    </div>
  )
}

function Plane({ z, className }: { z: number; className: string }) {
  return (
    <span
      aria-hidden
      className={cn('absolute inset-0', className)}
      style={{ transform: `translateZ(${z}px)` }}
    />
  )
}

/** Light falling on a turning leaf: darkest when it stands upright. */
function Shade({ amount }: { amount: number }) {
  return (
    <span
      className="pointer-events-none absolute inset-0 bg-linear-to-r from-black/30 to-black/5"
      style={{ opacity: Math.sin(amount * Math.PI) * 0.9 }}
    />
  )
}

/**
 * Paper edge: page lines along the depth; the read part (`worn`, from-to fractions of
 * the depth from the top face down) slightly yellowed.
 */
function edge(direction: string, [from, to]: [number, number]) {
  const c = 'rgba(214,196,150,.55)'
  const worn = `linear-gradient(${direction}, transparent ${from * 100}%, ${c} ${from * 100}%, ${c} ${to * 100}%, transparent ${to * 100}%)`
  const lines = `repeating-linear-gradient(${direction}, #f7f4ec 0px, #f7f4ec 1px, #dcd6c8 1.6px, #f7f4ec 2.2px)`
  return `${worn}, ${lines}`
}

/**
 * A block of pages: its top face (`children`, the current page) and its three outer
 * edges, `depth` px thick, top face at z = `top`. The left stack mirrors the right one.
 */
function Stack({
  side,
  depth,
  top,
  worn,
  children,
}: {
  side: PageSide
  depth: number
  top: number
  worn: [number, number]
  children?: ReactNode
}) {
  const right = side === 'right'
  const x = right ? '0%' : `-${PAGE_W}%`
  const face = 'absolute dark:brightness-90'
  return (
    <>
      <span
        aria-hidden
        className="absolute top-[1%] h-[98%]"
        style={{ left: x, width: `${PAGE_W}%`, transform: `translateZ(${top}px)` }}
      >
        {children ?? <span className="absolute inset-0 bg-[#fbf8f1]" />}
      </span>
      {/* Fore edge. */}
      <span
        aria-hidden
        className={cn(face, 'top-[1%] h-[98%]', right ? 'origin-left' : 'origin-right')}
        style={{
          left: right ? `${PAGE_W}%` : `calc(-${PAGE_W}% - ${depth}px)`,
          width: depth,
          transform: `translateZ(${top}px) rotateY(${right ? 90 : -90}deg)`,
          background: edge(right ? 'to right' : 'to left', worn),
        }}
      />
      {/* Top and bottom edges. */}
      <span
        aria-hidden
        className={cn(face, 'top-[1%] origin-top')}
        style={{
          left: x,
          width: `${PAGE_W}%`,
          height: depth,
          transform: `translateZ(${top}px) rotateX(-90deg)`,
          background: edge('to bottom', worn),
        }}
      />
      <span
        aria-hidden
        className={cn(face, 'bottom-[1%] origin-bottom')}
        style={{
          left: x,
          width: `${PAGE_W}%`,
          height: depth,
          transform: `translateZ(${top}px) rotateX(90deg)`,
          background: edge('to top', worn),
        }}
      />
    </>
  )
}
