import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Book thickness from its page count, in px: thin novellas to thick tomes. */
export const thicknessOf = (pages: number | null) =>
  Math.round(Math.min(28, Math.max(12, (pages ?? 300) / 25)))

/**
 * A cover drawn as a book in 3D: turned slightly to show the page edges, with a spine
 * crease and a back cover. It straightens and lifts when the enclosing `group` is hovered
 * or focused. Motion is skipped with prefers-reduced-motion.
 */
export function Book3D({
  pages,
  children,
  className,
}: {
  pages: number | null
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('relative perspective-[1200px]', className)}>
      <div
        className="relative transform-3d [transform:rotateY(-32deg)] motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out group-hover:[transform:rotateY(-6deg)_translateY(-8px)] group-focus-visible:[transform:rotateY(-6deg)_translateY(-8px)]"
        style={{ '--t': `${thicknessOf(pages)}px` } as CSSProperties}
      >
        {/* Back cover, one thickness behind the front. */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-r-md rounded-l-sm bg-neutral-700 [transform:translateZ(calc(var(--t)*-1))] dark:bg-neutral-800"
        />
        {/* Page edges: a plane at the right edge, turned 90° into the depth. */}
        <span
          aria-hidden
          className="absolute top-[1.5%] left-[calc(100%-3px)] h-[97%] w-(--t) origin-left [transform:rotateY(90deg)] bg-[repeating-linear-gradient(90deg,#f5f3ee_0px,#f5f3ee_1px,#ddd8cc_2px,#f5f3ee_3px)] dark:bg-[repeating-linear-gradient(90deg,#c9c5bb_0px,#c9c5bb_1px,#9e9a90_2px,#c9c5bb_3px)]"
        />
        <div className="relative">
          {children}
          {/* Spine crease and a light sheen on the front cover. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-[8%] rounded-l-md bg-linear-to-r from-black/35 via-white/15 to-transparent"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-md bg-linear-to-br from-white/20 via-transparent to-black/10 opacity-60 motion-safe:transition-opacity motion-safe:duration-500 group-hover:opacity-100"
          />
        </div>
      </div>
      {/* Floor shadow: tighter and lighter as the book lifts. */}
      <span
        aria-hidden
        className="absolute inset-x-[8%] -bottom-2 h-3 rounded-[50%] bg-black/25 blur-md motion-safe:transition-all motion-safe:duration-500 group-hover:inset-x-[14%] group-hover:bg-black/15 dark:bg-black/60"
      />
    </div>
  )
}
