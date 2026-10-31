import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError, TAG_LABEL, type PhotoRef, type PlanUsage, type ShortTag, type TripInput, type TripView, type Visibility } from '../api';
import { useApi } from '../useApi';
import { useAuth } from '../auth';
import { Icon } from '../components/Icons';
import { Photo } from '../components/Photo';
import { PhotoPicker } from '../components/PhotoPicker';
import { useAutosave } from '../useAutosave';
import { PlaceField } from '../components/PlaceField';
import { forgetAtlasPrefill, readAtlasPrefill, stashAtlasPrefill } from '../atlas';

const TAGS: ShortTag[] = ['WEEKEND', 'ONE_NIGHT', 'LONG_DRIVE', 'DAY_TRIP'];
const VISIBILITY: { value: Visibility; label: string; hint: string }[] = [
  { value: 'PUBLIC', label: 'Public', hint: 'In feeds and on your profile' },
  { value: 'UNLISTED', label: 'Unlisted', hint: 'Only people with the link' },
  { value: 'PRIVATE', label: 'Private', hint: 'Only you' },
];

/** A photo waiting to be uploaded into a slot once the trip exists. */
interface Upload { file: File; role: 'COVER' | 'SECTION'; position: number }

export function Create() {
  const { signedIn, loading, user } = useAuth();
  const [params] = useSearchParams();
  const initial = params.get('type') === 'short' ? 'short' : params.get('type') === 'full' ? 'full' : 'pick';
  const [mode, setMode] = useState<'pick' | 'short' | 'full'>(initial);
  const plan = useApi(() => (signedIn ? api.myPlan() : Promise.resolve(null)), [signedIn]);
  // A plan from BubDub's Atlas arrives after #atlas=; keep it through sign-in.
  useState(stashAtlasPrefill);
  const here = `/create${params.toString() ? `?${params.toString()}` : ''}`;

  if (loading) return null;
  if (!signedIn) return <Navigate to={`/signin?mode=join&next=${encodeURIComponent(here)}`} replace />;
  if (!user?.emailVerified) return <Navigate to={`/verify?next=${encodeURIComponent(here)}`} replace />;

  return (
    <div className="app" style={{ paddingBottom: 120 }}>
      <div className="topbar" style={{ padding: '12px 10px 4px' }}>
        {mode === 'pick'
          ? <Link to="/discover" className="icon-btn" aria-label="Close"><Icon.close /></Link>
          : <button type="button" className="icon-btn" aria-label="Back" onClick={() => setMode('pick')}><Icon.back /></button>}
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{mode === 'pick' ? 'Create' : mode === 'short' ? 'Short story' : 'Full trip'}</span>
        <span style={{ width: 44 }} />
      </div>

      <div style={{ padding: '0 20px' }}>
        {mode === 'pick' && (
          <>
            <h1 className="display rise" style={{ margin: '10px 0 6px', fontSize: 44 }}>What are we making today?</h1>
            <p style={{ margin: '0 0 22px', fontSize: 15, color: 'var(--ink-soft)' }}>Pick one. You can save a draft any time.</p>
            <button type="button" onClick={() => setMode('full')} className="lift rise" style={{ width: '100%', textAlign: 'left', border: 0, padding: 0, background: '#1C1B18', color: '#FBF8F2', borderRadius: 22, overflow: 'hidden', display: 'block', marginBottom: 14 }}>
              <div style={{ height: 170 }}><Photo scene="mountain" /></div>
              <div style={{ padding: '16px 18px 18px' }}>
                <span className="display" style={{ fontSize: 28, display: 'block' }}>A full trip</span>
                <span style={{ display: 'block', marginTop: 6, fontSize: 14, lineHeight: 1.5, color: '#CFC8BA' }}>A magazine issue. Cover photo, story sections with photos, favourite moments and a final note.</span>
              </div>
            </button>
            <button type="button" onClick={() => setMode('short')} className="lift rise" style={{ width: '100%', textAlign: 'left', border: '1px solid var(--ink)', padding: 0, background: 'var(--card)', color: 'var(--ink)', borderRadius: 22, overflow: 'hidden', display: 'flex' }}>
              <div style={{ flex: '0 0 120px', minHeight: 150 }}><Photo scene="road" /></div>
              <div style={{ padding: '16px 16px 18px' }}>
                <span className="display" style={{ fontSize: 26, display: 'block' }}>A short story</span>
                <span style={{ display: 'block', marginTop: 6, fontSize: 14, lineHeight: 1.5, color: 'var(--ink-soft)' }}>A weekend, a one-night stay or a long drive. A few photos with a line each.</span>
              </div>
            </button>
          </>
        )}
        {mode !== 'pick' && plan.data && <PlanNote usage={plan.data} />}
        {mode === 'short' && <ShortForm maxPhotos={plan.data?.limits.shortStoryPhotos ?? 4} />}
        {mode === 'full' && (plan.data || plan.error) && <FullForm maxSections={plan.data?.limits.fullTripSections ?? 3} />}
      </div>
    </div>
  );
}

/**
 * Saves a story. New: create, upload photos one by one, then publish; if something fails the story stays a
 * private draft and trying again reuses it. Editing: update the text, delete removed photos, upload new ones.
 */
function useSave(existing?: TripView, onSaved?: () => void) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const created = useRef<{ id: number; slug: string } | null>(existing ? { id: existing.id, slug: existing.slug } : null);
  const uploaded = useRef(new Set<File>());
  const deleted = useRef(new Set<number>());

  async function save(input: TripInput, uploads: Upload[], removals: number[], publish: boolean) {
    setBusy(true);
    setError('');
    setFields({});
    try {
      setProgress('Saving…');
      if (existing) {
        await api.updateTrip(existing.id, input);
      } else if (!created.current) {
        const trip = await api.createTrip(input);
        created.current = { id: trip.id, slug: trip.slug };
      } else {
        // An earlier try already made the draft: send what's on screen now, so fixes count.
        await api.updateTrip(created.current.id, input);
      }
      const id = created.current!.id;
      for (const photoId of removals.filter((p) => !deleted.current.has(p))) {
        // Removing a section's text already removes its photo on the server; "not found" is fine here.
        await api.deletePhoto(id, photoId).catch((err) => { if (!(err instanceof ApiError && err.status === 404)) throw err; });
        deleted.current.add(photoId);
      }
      // Two at a time: quicker than one by one, gentle enough on a phone connection.
      const todo = uploads.filter((u) => !uploaded.current.has(u.file));
      let done = 0;
      const queue = [...todo];
      setProgress(`Uploading photos 0 of ${todo.length}…`);
      const worker = async () => {
        for (let u = queue.shift(); u; u = queue.shift()) {
          await api.uploadPhoto(id, u.file, u.role, u.position);
          uploaded.current.add(u.file);
          setProgress(`Uploading photos ${++done} of ${todo.length}…`);
        }
      };
      await Promise.all([worker(), worker()]);
      if (publish && existing?.status !== 'PUBLISHED') {
        setProgress('Publishing…');
        await api.publishTrip(id);
      }
      onSaved?.();
      navigate(`/trips/${created.current!.slug}`);
    } catch (err) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      const msg = offline
        ? "You're offline. Your writing is kept on this phone; publish when you're back online"
        : err instanceof ApiError ? err.message : 'Something went wrong. Try again';
      const draftNote = !existing && created.current ? '. It is saved as a private draft for now.' : '.';
      setError(msg + draftNote);
      if (err instanceof ApiError) setFields(err.fields);
    } finally {
      setBusy(false);
      setProgress('');
    }
  }
  /** Shows what's missing and takes the writer straight to it. */
  function needs(fieldId: string, message: string) {
    setError(message);
    const el = document.getElementById(fieldId);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => el?.focus({ preventScroll: true }), 350);
  }
  return { save, busy, progress, error, setError, fields, needs };
}

/** A photo slot: a new file to upload, or the photo already on the story (editing). */
interface Slot { file: File | null; existing: PhotoRef | null }
const emptySlot = (): Slot => ({ file: null, existing: null });
/** Clearing a slot drops both; choosing a file replaces the existing photo on save. */
const pick = (file: File | null): Partial<Slot> => (file ? { file } : { file: null, existing: null });
/** Existing photos whose slot was cleared (and not replaced) are deleted on save. */
function removedPhotos(original: (PhotoRef | null)[], now: Slot[]) {
  const kept = new Set(now.map((s) => (s.file ? null : s.existing?.id)).filter(Boolean));
  return original.filter((p): p is PhotoRef => !!p && !kept.has(p.id) && !now.some((s) => s.file && s.existing?.id === p.id)).map((p) => p.id);
}

export function ShortForm({ maxPhotos, existing }: { maxPhotos: number; existing?: TripView }) {
  const [tag, setTag] = useState<ShortTag>(existing?.shortTag ?? 'LONG_DRIVE');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [place, setPlace] = useState(existing?.place ?? '');
  const original = existing?.sections.map((s) => s.photo) ?? [];
  const [items, setItems] = useState<({ caption: string } & Slot)[]>(
    existing?.sections.length ? existing.sections.map((s) => ({ caption: s.body, file: null, existing: s.photo })) : [{ caption: '', ...emptySlot() }]);
  const [visibility, setVisibility] = useState<Visibility>(existing?.visibility ?? 'PUBLIC');
  const draft = useAutosave(`short:${existing?.id ?? 'new'}`, { tag, title, place, visibility, captions: items.map((it) => it.caption) });
  const { save, busy, progress, error, fields, needs } = useSave(existing, draft.clear);

  function restore() {
    const d = draft.accept();
    if (!d) return;
    setTag(d.tag); setTitle(d.title); setPlace(d.place); setVisibility(d.visibility);
    setItems((xs) => d.captions.map((caption, i) => ({ ...(xs[i] ?? { caption: '', ...emptySlot() }), caption })));
  }

  function submit(e: FormEvent, publish = true) {
    e.preventDefault();
    const blank = items.findIndex((it) => !it.caption.trim());
    if (blank >= 0 && (items.length > 1 || items[blank].file || items[blank].existing)) return needs(`cap${blank}`, `Add a line for photo ${blank + 1}, or remove it.`);
    if (publish && !items.some((it) => it.caption.trim())) return needs('cap0', 'Add a photo with a line before posting. Save draft works without one.');
    const input: TripInput = { kind: 'SHORT', shortTag: tag, title, place, visibility, sections: items.filter((it) => it.caption.trim()).map((it) => ({ body: it.caption })) };
    const uploads = items.flatMap((it, position) => (it.file ? [{ file: it.file, role: 'SECTION' as const, position }] : []));
    save(input, uploads, removedPhotos(original, items), publish);
  }

  const update = (i: number, patch: Partial<{ caption: string } & Slot>) =>
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <form onSubmit={submit}>
      <h1 className="display rise" style={{ margin: '6px 0 18px', fontSize: 36 }}>{existing ? 'Edit short story' : 'New short story'}</h1>
      {draft.offer && <DraftOffer savedAt={draft.offer.savedAt} onRestore={restore} onDiscard={draft.discard} />}
      <p className="field-label">What kind of escape?</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {TAGS.map((t) => (
          <button key={t} type="button" className="pill gold" aria-pressed={tag === t} onClick={() => setTag(t)} style={{ minHeight: 44, fontSize: 14 }}>{TAG_LABEL[t]}</button>
        ))}
      </div>
      <TextField id="st" label="Title" value={title} onChange={setTitle} max={60} error={fields.title} placeholder="Sunday drive to Lonavala" display />
      <PlaceField id="sp" label="Where" value={place} onChange={setPlace} error={fields.place} placeholder="Lonavala, Maharashtra" />

      <p className="field-label" style={{ marginTop: 4 }}>Photos <span>· up to {maxPhotos}, with a line each. JPEG or PNG</span></p>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: '0 0 88px' }}>
            <PhotoPicker file={it.file} existingUrl={it.existing?.thumbUrl} onChange={(file) => update(i, pick(file))} label={`photo ${i + 1}`} height={88} />
          </div>
          <label htmlFor={`cap${i}`} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Line for photo {i + 1}</label>
          <textarea id={`cap${i}`} className="input" rows={3} maxLength={140} value={it.caption} placeholder={i === 0 ? 'Left at 5 am, chai at every bend' : 'Another moment'}
            onChange={(e) => update(i, { caption: e.target.value })} style={{ flex: 1 }} />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {items.length < maxPhotos && (
          <button type="button" className="pill" onClick={() => setItems((xs) => [...xs, { caption: '', ...emptySlot() }])}><Icon.plus size={16} /> Add a photo</button>
        )}
        {items.length > 1 && (
          <button type="button" className="pill" onClick={() => setItems((xs) => xs.slice(0, -1))}>Remove last</button>
        )}
      </div>

      <VisibilityPicker value={visibility} onChange={setVisibility} />
      {error && <p role="alert" style={{ margin: '14px 0 0', fontSize: 14, color: '#B3261E' }}>{error}</p>}
      <FooterBar busy={busy} progress={progress} existing={existing} primary="Post short story" onDraft={(e) => submit(e, false)} />
    </form>
  );
}

export function FullForm({ maxSections, existing }: { maxSections: number; existing?: TripView }) {
  // Started from a BubDub's Atlas plan: its title, place, dates and days become the first draft.
  const [atlas] = useState(() => (existing ? null : readAtlasPrefill()));
  const [f, setF] = useState({
    title: existing?.title ?? atlas?.title ?? '', place: existing?.place ?? atlas?.place ?? '',
    startDate: existing?.startDate ?? atlas?.start ?? '', endDate: existing?.endDate ?? atlas?.end ?? '',
    intro: existing?.intro ?? atlas?.intro ?? '', finalNote: existing?.finalNote ?? '' });
  const [cover, setCover] = useState<Slot>({ file: null, existing: existing?.cover ?? null });
  const original = [existing?.cover ?? null, ...(existing?.sections.map((s) => s.photo) ?? [])];
  const [sections, setSections] = useState<({ heading: string; body: string; photoCaption: string } & Slot)[]>(
    existing?.sections.length
      ? existing.sections.map((s) => ({ heading: s.heading ?? '', body: s.body, photoCaption: s.photoCaption ?? '', file: null, existing: s.photo }))
      : atlas?.sections.length
        ? atlas.sections.slice(0, maxSections).map((x) => ({ heading: x.heading, body: x.body, photoCaption: '', ...emptySlot() }))
        : [{ heading: '', body: '', photoCaption: '', ...emptySlot() }]);
  const [moments, setMoments] = useState(() => [...(existing?.moments ?? []), '', '', ''].slice(0, 3));
  const [visibility, setVisibility] = useState<Visibility>(existing?.visibility ?? 'PUBLIC');
  useEffect(() => { if (atlas) forgetAtlasPrefill(); }, [atlas]);
  const fromAtlas = atlas ? { days: atlas.sections.length, kept: Math.min(atlas.sections.length, maxSections) } : null;
  const draft = useAutosave(`full:${existing?.id ?? 'new'}`, {
    f, visibility, moments, sections: sections.map(({ heading, body, photoCaption }) => ({ heading, body, photoCaption })) });
  const { save, busy, progress, error, fields, needs } = useSave(existing, draft.clear);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  function restore() {
    const d = draft.accept();
    if (!d) return;
    setF(d.f); setVisibility(d.visibility); setMoments(d.moments);
    setSections((ss) => d.sections.map((text, i) => ({ ...(ss[i] ?? { heading: '', body: '', photoCaption: '', ...emptySlot() }), ...text })));
  }

  function submit(e: FormEvent, publish = true) {
    e.preventDefault();
    const blank = sections.findIndex((s) => !s.body.trim());
    if (blank >= 0 && (sections.length > 1 || sections[blank].file || sections[blank].existing)) {
      return needs(`b${blank}`, `Write the story for section ${blank + 1}, or remove it.`);
    }
    if (publish && !sections.some((s) => s.body.trim())) {
      return needs('b0', 'Write at least one story section before publishing. Save draft works without one.');
    }
    const input: TripInput = {
      kind: 'FULL', title: f.title, place: f.place, visibility,
      startDate: f.startDate || null, endDate: f.endDate || null, intro: f.intro || null, finalNote: f.finalNote || null,
      sections: sections.filter((s) => s.body.trim()).map((s) => ({ heading: s.heading || null, body: s.body, photoCaption: s.photoCaption || null })),
      moments: moments.map((m) => m.trim()).filter(Boolean),
    };
    const uploads: Upload[] = [
      ...(cover.file ? [{ file: cover.file, role: 'COVER' as const, position: 0 }] : []),
      ...sections.flatMap((s, position) => (s.file ? [{ file: s.file, role: 'SECTION' as const, position }] : [])),
    ];
    save(input, uploads, removedPhotos(original, [cover, ...sections]), publish);
  }

  const updateSection = (i: number, patch: Partial<(typeof sections)[number]>) =>
    setSections((ss) => ss.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <form onSubmit={submit}>
      <h1 className="display rise" style={{ margin: '6px 0 4px', fontSize: 36 }}>{existing ? 'Edit your issue' : 'Your next issue'}</h1>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--ink-soft)' }}>Tap the cover to choose a photo. This is how it appears in feeds and on your shelf.</p>
      {draft.offer && <DraftOffer savedAt={draft.offer.savedAt} onRestore={restore} onDiscard={draft.discard} />}
      {fromAtlas && (
        <div role="status" className="paper-card" style={{ marginBottom: 16, padding: '12px 14px', borderLeft: '4px solid var(--green)' }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Started from your BubDub's Atlas plan</p>
          <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--ink-soft)' }}>
            Swap the plan notes for what really happened, and add your photos.
            {fromAtlas.kept < fromAtlas.days && ` Your plan has ${fromAtlas.days} days; the first ${fromAtlas.kept} fit your plan's sections.`}
          </p>
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <PhotoPicker file={cover.file} existingUrl={cover.existing?.url} onChange={(file) => setCover((c) => ({ ...c, ...pick(file) }))} label="cover photo" height={240}>
          <div className="cover-overlay" style={{ padding: 16, color: '#fff', pointerEvents: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase' }}><span>Weyvo</span><span>{f.place || 'Destination'}</span></div>
            <p className="display" style={{ margin: 0, fontSize: 30 }}>{f.title || 'Your trip title'}</p>
          </div>
        </PhotoPicker>
      </div>

      <TextField id="ft" label={`Trip title · ${f.title.length} / 60`} value={f.title} onChange={set('title')} max={60} error={fields.title} placeholder="The beach we had to ourselves" display />
      <PlaceField id="fd" label="Destination" value={f.place} onChange={set('place')} error={fields.place} placeholder="Gokarna, Karnataka" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <TextField id="fs" label="From" type="date" value={f.startDate} onChange={set('startDate')} />
        <TextField id="fe" label="To" type="date" value={f.endDate} onChange={set('endDate')} />
      </div>
      <TextField id="fi" label="Introduction · 250 characters" value={f.intro} onChange={set('intro')} max={250} error={fields.intro} placeholder="Set the scene in two sentences" multiline />

      <p className="eyebrow" style={{ margin: '18px 0 10px', fontWeight: 600 }}>Story sections · up to {maxSections}</p>
      {sections.map((s, i) => (
        <div key={i} className="paper-card" style={{ marginBottom: 12 }}>
          <TextField id={`h${i}`} label={`Section ${i + 1} heading`} value={s.heading} onChange={(v) => updateSection(i, { heading: v })} max={60} placeholder="The road in" />
          <TextField id={`b${i}`} label="Story · 500 characters" value={s.body} onChange={(v) => updateSection(i, { body: v })} max={500} placeholder="What happened, what it felt like" multiline />
          <p className="field-label">Photo <span>· optional</span></p>
          <div style={{ marginBottom: 10 }}>
            <PhotoPicker file={s.file} existingUrl={s.existing?.url} onChange={(file) => updateSection(i, pick(file))} label={`section ${i + 1} photo`} height={160} />
          </div>
          <TextField id={`c${i}`} label="Photo caption (optional)" value={s.photoCaption} onChange={(v) => updateSection(i, { photoCaption: v })} max={120} placeholder="Chandratal at dawn" />
          {i === sections.length - 1 && sections.length > 1 && (
            <button type="button" className="pill" onClick={() => setSections((ss) => ss.slice(0, -1))}>Remove this section</button>
          )}
        </div>
      ))}
      {sections.length < maxSections && (
        <button type="button" className="pill" onClick={() => setSections((ss) => [...ss, { heading: '', body: '', photoCaption: '', ...emptySlot() }])} style={{ marginBottom: 18 }}><Icon.plus size={16} /> Add a section</button>
      )}

      <p className="eyebrow" style={{ margin: '8px 0 10px', fontWeight: 600 }}>Favourite moments · up to 3</p>
      {moments.map((m, i) => (
        <TextField key={i} id={`m${i}`} label={`Moment ${i + 1}`} value={m} onChange={(v) => setMoments((ms) => ms.map((x, j) => (j === i ? v : x)))} max={120} placeholder={['Butter tea at the monastery', 'The truck that rescued us', 'Dawn at the lake'][i]} />
      ))}
      <TextField id="fn" label="Final note · 200 characters" value={f.finalNote} onChange={set('finalNote')} max={200} error={fields.finalNote} placeholder="Go before the road gets paved." />

      <VisibilityPicker value={visibility} onChange={setVisibility} />
      {error && <p role="alert" style={{ margin: '14px 0 0', fontSize: 14, color: '#B3261E' }}>{error}</p>}
      <FooterBar busy={busy} progress={progress} existing={existing} primary="Publish" onDraft={(e) => submit(e, false)} />
    </form>
  );
}

/** Offers back text kept from an unfinished story on this device. */
function DraftOffer({ savedAt, onRestore, onDiscard }: { savedAt: number; onRestore: () => void; onDiscard: () => void }) {
  return (
    <div role="status" className="paper-card" style={{ marginBottom: 16, padding: '12px 14px', borderLeft: '4px solid var(--gold)' }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>You have unsaved writing from {new Date(savedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
      <p style={{ margin: '4px 0 10px', fontSize: 13, color: 'var(--ink-soft)' }}>The text is kept on this device; photos need choosing again.</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-primary" style={{ minHeight: 38 }} onClick={onRestore}>Restore</button>
        <button type="button" className="btn btn-outline" style={{ minHeight: 38 }} onClick={onDiscard}>Discard</button>
      </div>
    </div>
  );
}

/** Plan and photo usage, so limits never come as a surprise at upload time. */
function PlanNote({ usage }: { usage: PlanUsage }) {
  const total = usage.limits.totalPhotos;
  const left = total > 0 ? Math.max(0, total - usage.photosUsed) : null;
  return (
    <p className="paper-card" style={{ margin: '4px 0 16px', fontSize: 13, color: 'var(--ink-soft)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      <span><strong style={{ color: 'var(--ink)' }}>{usage.plan === 'PREMIUM' ? 'Premium' : 'Free'} plan</strong></span>
      <span>
        {total > 0 ? `${usage.photosUsed} of ${total} photos used${left === 0 ? ' · limit reached' : ''}` : `${usage.photosUsed} photos · unlimited`}
        {usage.plan === 'FREE' && <> · <Link to="/premium" style={{ fontWeight: 600 }}>Go Premium</Link></>}
      </span>
    </p>
  );
}

function TextField(props: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  max?: number; error?: string; placeholder?: string; type?: string; multiline?: boolean; display?: boolean;
}) {
  const { id, label, value, onChange, max, error, placeholder, type = 'text', multiline, display } = props;
  const style = { ...(display ? { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20 } : {}), ...(error ? { borderColor: '#B3261E' } : {}) };
  return (
    <div style={{ marginBottom: 14, minWidth: 0 }}>
      <label htmlFor={id} className="field-label">{label}</label>
      {multiline
        ? <textarea id={id} className="input" rows={3} maxLength={max} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={style} aria-invalid={!!error} />
        : <input id={id} className="input" type={type} maxLength={max} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={style} aria-invalid={!!error} />}
      {error && <p style={{ margin: '6px 2px 0', fontSize: 13, color: '#B3261E' }}>{error}</p>}
    </div>
  );
}

function VisibilityPicker({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: '8px 0 0' }}>
      <legend className="field-label">Who can see it</legend>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {VISIBILITY.map((v) => (
          <label key={v.value} className="paper-card" style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', outline: value === v.value ? '2px solid var(--green)' : undefined }}>
            <input type="radio" name="visibility" value={v.value} checked={value === v.value} onChange={() => onChange(v.value)} />
            <span style={{ flex: 1 }}><strong style={{ fontSize: 14 }}>{v.label}</strong><span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>{v.hint}</span></span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function FooterBar({ primary, busy, progress, existing, onDraft }: {
  primary: string; busy: boolean; progress: string; existing?: TripView; onDraft: (e: FormEvent) => void;
}) {
  const published = existing?.status === 'PUBLISHED';
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, paddingBottom: 'env(safe-area-inset-bottom)', background: 'var(--paper)', borderTop: '1px solid var(--line)', zIndex: 10 }}>
      <div style={{ maxWidth: 'var(--app-w)', margin: '0 auto', padding: '12px 20px 20px', display: 'flex', gap: 10 }}>
        {!published && <button type="button" className="btn btn-outline" disabled={busy} onClick={onDraft}>Save draft</button>}
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ flex: 1, opacity: busy ? 0.7 : 1 }} aria-live="polite">
          {busy ? progress || 'Saving…' : published ? 'Save changes' : primary}
        </button>
      </div>
    </div>
  );
}
