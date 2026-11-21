import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type Stop, type TripView } from '../api';
import { useAuth } from '../auth';
import { useApi } from '../useApi';
import { useIssueFonts } from '../issueFonts';
import { Loading } from '../components/States';
import '../styles/print.css';

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/**
 * A trip as a printed magazine: A4 pages (cover, contents, a chapter per section, places, closing page), in the
 * issue's layout. The phone or computer's own "Save as PDF" makes the file, so the server does nothing extra.
 * Premium owners can print; everyone else sees the preview.
 */
export function IssuePrint() {
  const { slug = '' } = useParams();
  const { user } = useAuth();
  const { data: trip, loading } = useApi(() => api.trip(slug), [slug, user?.id]);
  const plan = useApi(() => (user ? api.myPlan() : Promise.resolve(null)), [user?.id]);
  const [preparing, setPreparing] = useState(false);
  useIssueFonts();

  if (loading && !trip) return <div style={{ padding: 40 }}><Loading /></div>;
  if (!trip || trip.kind !== 'FULL' || !trip.owner) {
    return (
      <div className="app" style={{ padding: 24, textAlign: 'center' }}>
        <p className="display" style={{ fontSize: 26, marginTop: 60 }}>Only the author can print this issue</p>
        <Link to={trip ? `/trips/${trip.slug}` : '/discover'} className="btn btn-primary" style={{ marginTop: 16 }}>Back</Link>
      </div>
    );
  }

  const canPrint = !!plan.data?.limits.printIssues;
  const pages = buildPages(trip);

  async function print() {
    setPreparing(true);
    // Wait for every photo (and the fonts) so nothing prints half-loaded.
    await Promise.all([...document.querySelectorAll<HTMLImageElement>('.print-root img')].map((img) =>
      img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = () => r(null); })));
    await document.fonts?.ready;
    setPreparing(false);
    window.print();
  }

  return (
    <div className={`print-root issue--${(trip.layout ?? 'CLASSIC').toLowerCase()}`}>
      <div className="print-toolbar">
        <Link to={`/trips/${trip.slug}`} className="print-back" aria-label="Back to the story">←</Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong>Print issue</strong>
          <span>{pages.length} pages · A4 · {(trip.layout ?? 'CLASSIC').toLowerCase()} layout</span>
        </div>
        {canPrint ? (
          <button type="button" className="print-go" onClick={print} disabled={preparing}>{preparing ? 'Preparing…' : 'Save as PDF'}</button>
        ) : (
          <Link to="/premium" className="print-go">Premium</Link>
        )}
      </div>
      <p className="print-tip">
        {canPrint
          ? 'In the print window choose “Save as PDF”. If colours look missing, turn on “Background graphics”.'
          : 'This is a preview. Printing your issues is part of Premium.'}
      </p>

      <div className="print-pages">
        {pages.map((page, i) => (
          <article key={i} className={`pp pp-${page.kind}`}>
            {page.render(i + 1, pages.length)}
          </article>
        ))}
      </div>
    </div>
  );
}

type Page = { kind: string; render: (n: number, total: number) => React.ReactNode };

function buildPages(t: TripView): Page[] {
  const issueDate = new Date(t.publishedAt ?? Date.now()).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const dates = dateRange(t.startDate, t.endDate);
  const days = t.startDate && t.endDate ? Math.round((+new Date(t.endDate) - +new Date(t.startDate)) / 86_400_000) + 1 : null;
  const placeChunks: Stop[][] = [];
  for (let i = 0; i < t.stops.length; i += 4) placeChunks.push(t.stops.slice(i, i + 4));
  const pages: Page[] = [];
  // A closing strip of up to four photos from the trip.
  const strip = [...t.stops.map((s) => s.photos[0]), ...t.sections.map((s) => s.photo)].filter((p): p is NonNullable<typeof p> => !!p).slice(0, 4);

  const footer = (n: number) => (
    <footer className="pp-foot"><span>WEYVO · {t.title}</span><span>{String(n).padStart(2, '0')}</span></footer>
  );

  // Cover
  pages.push({ kind: 'cover', render: () => (
    <>
      {t.cover ? <img className="pp-bleed" src={t.cover.url} alt="" /> : <div className="pp-bleed pp-blank" />}
      <div className="pp-cover-shade" />
      <header className="pp-mast">
        <span className="pp-mast-word">WEYVO</span>
        <span className="pp-mast-line">The travel issue · {issueDate} · No. {String(t.id).padStart(4, '0')}</span>
      </header>
      <ul className="pp-coverlines">
        {t.stops.length > 0 && <li><b>{t.stops.length}</b> places to see</li>}
        {t.sections.length > 0 && <li><b>{t.sections.length}</b> {t.sections.length === 1 ? 'chapter' : 'chapters'}</li>}
        {t.moments.length > 0 && <li>Favourite moments</li>}
      </ul>
      <div className="pp-cover-text">
        <p className="pp-kicker">{t.place}</p>
        <h1 className="pp-cover-title">{t.title}</h1>
        <p className="pp-byline">by {t.author.displayName}{dates ? ` · ${dates}` : ''}</p>
      </div>
    </>
  ) });

  // Contents
  let page = 3;
  const entries = t.sections.map((s, i) => ({ label: s.heading || `Chapter ${NUMERALS[i] ?? i + 1}`, numeral: NUMERALS[i] ?? String(i + 1), page: page++ }));
  const placesPage = placeChunks.length ? page : null;
  page += placeChunks.length;
  const closingPage = page;
  pages.push({ kind: 'contents', render: (n) => (
    <>
      <div className="pp-pad">
        <p className="pp-label">In this issue</p>
        <h2 className="pp-h2">{t.title}</h2>
        <ol className="pp-toc">
          {entries.map((e) => <li key={e.numeral}><span className="pp-toc-num">{e.numeral}</span><span className="pp-toc-name">{e.label}</span><span className="pp-toc-page">{e.page}</span></li>)}
          {placesPage && <li><span className="pp-toc-num">✦</span><span className="pp-toc-name">Places in this issue</span><span className="pp-toc-page">{placesPage}</span></li>}
          <li><span className="pp-toc-num">✦</span><span className="pp-toc-name">Moments &amp; end credits</span><span className="pp-toc-page">{closingPage}</span></li>
        </ol>
        <div className="pp-facts">
          <div><span>Where</span><b>{t.place}</b></div>
          {dates && <div><span>When</span><b>{dates}</b></div>}
          {days && <div><span>Days</span><b>{days}</b></div>}
          <div><span>Traveller</span><b>{t.author.displayName}</b></div>
        </div>
        {t.finalNote && <blockquote className="pp-pull">“{t.finalNote}”</blockquote>}
      </div>
      {footer(n)}
    </>
  ) });

  // One chapter per section
  t.sections.forEach((s, i) => pages.push({ kind: `chapter ${i % 2 ? 'flip' : ''}`, render: (n) => (
    <>
      {s.photo && (
        <figure className="pp-chapter-photo">
          <img src={s.photo.url} alt="" />
          {s.photoCaption && <figcaption>{s.photoCaption}</figcaption>}
        </figure>
      )}
      <div className={`pp-pad pp-chapter-text ${s.photo ? '' : 'no-photo'}`}>
        <span className="pp-ghost" aria-hidden="true">{NUMERALS[i] ?? i + 1}</span>
        <p className="pp-label">Chapter {NUMERALS[i] ?? i + 1}</p>
        {s.heading && <h2 className="pp-h2">{s.heading}</h2>}
        <p className="pp-body">{s.body}</p>
      </div>
      {footer(n)}
    </>
  ) }));

  // Places, four to a page
  placeChunks.forEach((chunk, c) => pages.push({ kind: 'places', render: (n) => (
    <>
      <div className="pp-pad">
        <p className="pp-label">Places in this issue{placeChunks.length > 1 ? ` · ${c + 1}/${placeChunks.length}` : ''}</p>
        <h2 className="pp-h2">{t.stops.length} stops in {t.place.split(',')[0]}</h2>
        <div className="pp-place-grid">
          {chunk.map((s, i) => (
            <div key={i} className="pp-place">
              <div className="pp-place-photo">
                {s.photos[0] ? <img src={s.photos[0].url} alt="" /> : <div className="pp-blank" />}
                <span className="pp-place-num">{String(c * 4 + i + 1).padStart(2, '0')}</span>
              </div>
              <h3>{s.place.split(',')[0]}</h3>
              {s.note && <p>{s.note}</p>}
              {s.photos.length > 1 && (
                <div className="pp-place-thumbs">{s.photos.slice(1).map((p) => <img key={p.id} src={p.thumbUrl ?? p.url} alt="" />)}</div>
              )}
            </div>
          ))}
        </div>
      </div>
      {footer(n)}
    </>
  ) }));

  // Closing: favourite moments, end credits, colophon
  pages.push({ kind: 'closing', render: (n) => (
    <>
      <div className="pp-pad">
        {t.moments.length > 0 && (
          <>
            <p className="pp-label">Favourite moments</p>
            <ol className="pp-moments">{t.moments.map((m, i) => <li key={i}><span>{String(i + 1).padStart(2, '0')}</span>{m}</li>)}</ol>
          </>
        )}
        {t.finalNote && (
          <>
            <p className="pp-label" style={{ marginTop: '8cqw' }}>End credits</p>
            <p className="pp-credits">“{t.finalNote}”</p>
          </>
        )}
        {strip.length > 1 && (
          <div className="pp-strip" style={{ gridTemplateColumns: `repeat(${strip.length}, minmax(0, 1fr))` }}>
            {strip.map((p) => <img key={p.id} src={p.thumbUrl ?? p.url} alt="" />)}
          </div>
        )}
        <div className="pp-colophon">
          <span className="pp-mast-word small">WEYVO</span>
          <p>Written and photographed by <b>{t.author.displayName}</b> (@{t.author.username}).</p>
          <p>Read it online at weyvo-web.onrender.com/trips/{t.slug}</p>
          <p>Printed {new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>
      {footer(n)}
    </>
  ) });

  return pages;
}

function dateRange(start: string | null, end: string | null) {
  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return start ? fmt(start) : null;
}
