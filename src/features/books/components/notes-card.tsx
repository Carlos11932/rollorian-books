import { getTranslations } from 'next-intl/server';

interface NotesCardProps {
  notes: string;
}

export async function NotesCard({ notes }: NotesCardProps) {
  const t = await getTranslations('book');

  return (
    <section
      className="rounded-[var(--radius-xl)] border border-outline-variant/30 p-6"
      style={{ backdropFilter: "blur(20px)", background: "rgba(255,255,255,0.04)" }}
      aria-label="Personal notes"
    >
      <h2
        className="text-xs font-bold uppercase tracking-widest text-on-surface/40 mb-3"
        style={{ fontFamily: "var(--font-headline)" }}
      >
        {t('notes')}
      </h2>
      <p className="text-sm text-on-surface/80 leading-relaxed whitespace-pre-wrap">{notes}</p>
    </section>
  );
}
