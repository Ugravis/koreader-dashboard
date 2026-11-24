'use client'

import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { findCover } from '@/lib/covers'

type Props = { md5: string; title: string; authors: string | null }

export function BookCover({ md5, title, authors }: Props) {
  const [src, setSrc] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    let active = true
    findCover({ md5, title, authors }).then((url) => active && setSrc(url))
    return () => {
      active = false
    }
  }, [md5, title, authors])

  const box = 'aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-md sm:w-16'
  if (src === undefined) return <Skeleton className={box} />
  if (src === null) {
    return (
      <div
        className={`${box} flex items-center justify-center bg-muted text-xl font-semibold text-muted-foreground`}
        aria-hidden
      >
        {title.trim().charAt(0).toUpperCase() || '?'}
      </div>
    )
  }
  return (
    // Remote cover from Open Library: plain <img>, no Next image optimization needed.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      className={`${box} bg-muted object-cover`}
      onError={() => setSrc(null)}
    />
  )
}
