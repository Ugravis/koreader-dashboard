'use client'

import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { findCover, isbnCoverUrl } from '@/lib/covers'
import { cn } from '@/lib/utils'

type Props = {
  md5: string
  title: string
  authors: string | null
  isbn: string | null
  className?: string
}

/** ISBN cover, then title + author search, then the title's initial. */
export function BookCover({ md5, title, authors, isbn, className }: Props) {
  const [useIsbn, setUseIsbn] = useState(Boolean(isbn))
  const [found, setFound] = useState<string | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (useIsbn) return
    let active = true
    findCover({ md5, title, authors }).then((url) => active && setFound(url))
    return () => {
      active = false
    }
  }, [useIsbn, md5, title, authors])

  const src = useIsbn && isbn ? isbnCoverUrl(isbn) : failed ? null : found
  const box = cn('aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-md sm:w-16', className)
  if (src === undefined) return <Skeleton className={box} />
  if (src === null) {
    return (
      <div
        className={cn(
          box,
          'flex items-center justify-center bg-muted text-xl font-semibold text-muted-foreground',
        )}
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
      className={cn(box, 'bg-muted object-cover')}
      // ISBN miss: fall back to the search, then to the initial.
      onError={() => (useIsbn ? setUseIsbn(false) : setFailed(true))}
    />
  )
}
