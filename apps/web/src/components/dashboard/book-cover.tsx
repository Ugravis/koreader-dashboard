'use client'

import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { API_URL } from '@/lib/api'
import { findCover, isbnCoverUrl } from '@/lib/covers'
import { cn } from '@/lib/utils'

type Props = {
  md5: string
  title: string
  authors: string | null
  isbn: string | null
  coverUrl: string | null
  className?: string
}

type Stage = 'device' | 'isbn' | 'search'

/** Cover sent by the device, then ISBN cover, then title + author search, then the initial. */
export function BookCover({ md5, title, authors, isbn, coverUrl, className }: Props) {
  const [stage, setStage] = useState<Stage>(coverUrl ? 'device' : isbn ? 'isbn' : 'search')
  const [found, setFound] = useState<string | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (stage !== 'search') return
    let active = true
    findCover({ md5, title, authors }).then((url) => active && setFound(url))
    return () => {
      active = false
    }
  }, [stage, md5, title, authors])

  const src =
    stage === 'device' && coverUrl
      ? `${API_URL}${coverUrl}`
      : stage === 'isbn' && isbn
        ? isbnCoverUrl(isbn)
        : failed
          ? null
          : found
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
    // Remote cover (API or Open Library): plain <img>, no Next image optimization needed.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      className={cn(box, 'bg-muted object-cover')}
      // Miss: device cover, then ISBN, then the search, then the initial.
      onError={() =>
        stage === 'device'
          ? setStage(isbn ? 'isbn' : 'search')
          : stage === 'isbn'
            ? setStage('search')
            : setFailed(true)
      }
    />
  )
}
