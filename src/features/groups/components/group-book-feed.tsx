'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Button } from '@/features/shared/components/button';

interface MemberRating {
  userId: string;
  userName: string | null;
  rating: number | null;
  status: string;
}

interface GroupBook {
  book: {
    id: string;
    title: string;
    authors: string[];
    coverUrl: string | null;
    publisher: string | null;
    publishedDate: string | null;
  };
  memberRatings: MemberRating[];
}

interface GroupBookFeedProps {
  groupId: string;
  initialBooks: GroupBook[];
  initialNextCursor: string | null;
}

export function GroupBookFeed({ groupId, initialBooks, initialNextCursor }: GroupBookFeedProps) {
  const t = useTranslations('groups');
  const tCommon = useTranslations('common');
  const [books, setBooks] = useState<GroupBook[]>(initialBooks);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (!nextCursor || loading) return;
    setLoading(true);

    try {
      const url = new URL(`/api/groups/${groupId}/books`, window.location.origin);
      url.searchParams.set('cursor', nextCursor);
      const res = await fetch(url.toString());

      if (res.ok) {
        const data = (await res.json()) as { books: GroupBook[]; nextCursor: string | null };
        setBooks((prev) => [...prev, ...data.books]);
        setNextCursor(data.nextCursor);
      }
    } finally {
      setLoading(false);
    }
  }

  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <span
          className="material-symbols-outlined text-on-surface-variant/40"
          style={{ fontSize: '64px' }}
        >
          menu_book
        </span>
        <p className="text-lg font-medium text-on-surface-variant">{t('noBooks')}</p>
        <p className="text-sm text-outline">{t('noBooksDescription')}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4">
        {books.map(({ book, memberRatings }) => (
          <div
            key={book.id}
            className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-4 flex gap-4"
            style={{ backdropFilter: 'blur(16px)' }}
          >
            {/* Book cover */}
            <div className="shrink-0 w-16 h-24 rounded-lg overflow-hidden bg-surface-container-high relative">
              {book.coverUrl != null ? (
                <Image
                  src={book.coverUrl}
                  alt={book.title}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span
                    className="material-symbols-outlined text-on-surface-variant/40"
                    style={{ fontSize: '28px' }}
                  >
                    menu_book
                  </span>
                </div>
              )}
            </div>

            {/* Book info */}
            <div className="flex-1 grid gap-2 min-w-0">
              <div>
                <p className="font-semibold text-on-surface truncate" title={book.title}>
                  {book.title}
                </p>
                <p className="text-sm text-muted truncate">
                  {book.authors.length > 0 ? book.authors.join(', ') : tCommon('unknownAuthor')}
                </p>
              </div>

              {/* Member ratings */}
              {memberRatings.length > 0 && (
                <div className="grid gap-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                    {t('memberRatings')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {memberRatings.map((mr) => (
                      <span
                        key={mr.userId}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high text-xs text-on-surface"
                      >
                        <span className="font-medium">{mr.userName ?? mr.userId}</span>
                        {mr.rating != null ? (
                          <>
                            <span className="text-muted">·</span>
                            <span className="flex items-center gap-0.5 text-secondary">
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: '12px' }}
                              >
                                star
                              </span>
                              {mr.rating}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-muted">·</span>
                            <span className="text-muted">{tCommon('notRated')}</span>
                          </>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {nextCursor != null && (
        <div className="flex justify-center">
          <Button variant="secondary" loading={loading} onClick={() => void loadMore()}>
            {t('loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
