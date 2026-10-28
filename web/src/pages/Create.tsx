import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError, TAG_LABEL, type PlanUsage, type ShortTag, type TripInput, type Visibility } from '../api';
import { useApi } from '../useApi';
import { useAuth } from '../auth';
import { Icon } from '../components/Icons';
import { Photo } from '../components/Photo';
import { PhotoPicker } from '../components/PhotoPicker';

const TAGS: ShortTag[] = ['WEEKEND', 'ONE_NIGHT', 'LONG_DRIVE', 'DAY_TRIP'];
const VISIBILITY: { value: Visibility; label: string; hint: string }[] = [
  { value: 'PUBLIC', label: 'Public', hint: 'In feeds and on your profile' },
  { value: 'UNLISTED', label: 'Unlisted', hint: 'Only people with the link' },
  { value: 'PRIVATE', label: 'Private', hint: 'Only you' },
];

/** A photo waiting to be uploaded into a slot once the trip exists. */
interface Upload { file: File; role: 'COVER' | 'SECTION'; position: number }

export function Create() {
  const { signedIn, loading } = useAuth();
  const [params] = useSearchParams();
  const initial = params.get('type') === 'short' ? 'short' : params.get('type') === 'full' ? 'full' : 'pick';
  const [mode, setMode] = useState<'pick' | 'short' | 'full'>(initial);
  const plan = useApi(() => (signedIn ? api.myPlan() : Promise.resolve(null)), [signedIn]);

  if (loading) return null;
  if (!signedIn) return <Navigate to={`/signin?mode=join&next=${encodeURIComponent('/create')}`} replace />;

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
        {mode === 'full' && <FullForm maxSections={plan.data?.limits.fullTripSections ?? 3} />}
      </div>
    </div>
  );
}

/**
 * Creates the trip, uploads its photos one by one, then publishes. If something fails the trip stays a
 * private draft, and trying again reuses it and uploads only what's still missing.
 */
function useSave() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const created = useRef<{ id: number; slug: string } | null>(null);
  const uploaded = useRef(new Set<File>());

  async function save(input: TripInput, uploads: Upload[], publish: boolean) {
    setBusy(true);
    setError('');
    setFields({});
    try {
      if (!created.current) {
        setProgress('Saving…');
        const trip = await api.createTrip(input);
        created.current = { id: trip.id, slug: trip.slug };
      }
      const todo = uploads.filter((u) => !uploaded.current.has(u.file));
      for (const [i, u] of todo.entries()) {
        setProgress(`Uploading photo ${i + 1} of ${todo.length}…`);
        await api.uploadPhoto(created.current.id, u.file, u.role, u.position);
        uploaded.current.add(u.file);
      }
      if (publish) {
        setProgress('Publishing…');
        await api.publishTrip(created.current.id);
      }
      navigate(`/trips/${created.current.slug}`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Something went wrong. Try again.';
      setError(created.current ? `${msg}. Your story is saved as a private draft; press the button again to retry.` : msg);
      if (err instanceof ApiError) setFields(err.fields);
    } finally {
      setBusy(false);
      setProgress('');
    }
  }
  return { save, busy, progress, error, setError, fields };
}

function ShortForm({ maxPhotos }: { maxPhotos: number }) {
  const [tag, setTag] = useState<ShortTag>('LONG_DRIVE');
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [items, setItems] = useState<{ caption: string; file: File | null }[]>([{ caption: '', file: null }]);
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC');
  const { save, busy, progress, error, setError, fields } = useSave();

  function submit(e: FormEvent, publish = true) {
    e.preventDefault();
    if (items.some((it) => it.file && !it.caption.trim())) return setError('Add a line for each photo');
    const kept = items.filter((it) => it.caption.trim());
    const input: TripInput = { kind: 'SHORT', shortTag: tag, title, place, visibility, sections: kept.map((it) => ({ body: it.caption })) };
    const uploads = kept.flatMap((it, position) => (it.file ? [{ file: it.file, role: 'SECTION' as const, position }] : []));
    save(input, uploads, publish);
  }

  const update = (i: number, patch: Partial<{ caption: string; file: File | null }>) =>
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <form onSubmit={submit}>
      <h1 className="display rise" style={{ margin: '6px 0 18px', fontSize: 36 }}>New short story</h1>
      <p className="field-label">What kind of escape?</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {TAGS.map((t) => (
          <button key={t} type="button" className="pill gold" aria-pressed={tag === t} onClick={() => setTag(t)} style={{ minHeight: 44, fontSize: 14 }}>{TAG_LABEL[t]}</button>
        ))}
      </div>
      <TextField id="st" label="Title" value={title} onChange={setTitle} max={60} error={fields.title} placeholder="Sunday drive to Lonavala" display />
      <TextField id="sp" label="Where" value={place} onChange={setPlace} max={120} error={fields.place} placeholder="Lonavala, Maharashtra" />

      <p className="field-label" style={{ marginTop: 4 }}>Photos <span>· up to {maxPhotos}, with a line each. JPEG or PNG</span></p>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: '0 0 88px' }}>
            <PhotoPicker file={it.file} onChange={(file) => update(i, { file })} label={`photo ${i + 1}`} height={88} />
          </div>
          <label htmlFor={`cap${i}`} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Line for photo {i + 1}</label>
          <textarea id={`cap${i}`} className="input" rows={3} maxLength={140} value={it.caption} placeholder={i === 0 ? 'Left at 5 am, chai at every bend' : 'Another moment'}
            onChange={(e) => update(i, { caption: e.target.value })} style={{ flex: 1 }} />
        </div>
      ))}
      {items.length < maxPhotos && (
        <button type="button" className="pill" onClick={() => setItems((xs) => [...xs, { caption: '', file: null }])} style={{ marginBottom: 18 }}><Icon.plus size={16} /> Add a photo</button>
      )}

      <VisibilityPicker value={visibility} onChange={setVisibility} />
      {error && <p role="alert" style={{ margin: '14px 0 0', fontSize: 14, color: '#B3261E' }}>{error}</p>}
      <FooterBar busy={busy} progress={progress} primary="Post short story" onDraft={(e) => submit(e, false)} />
    </form>
  );
}

function FullForm({ maxSections }: { maxSections: number }) {
  const [f, setF] = useState({ title: '', place: '', startDate: '', endDate: '', intro: '', finalNote: '' });
  const [cover, setCover] = useState<File | null>(null);
  const [sections, setSections] = useState([{ heading: '', body: '', photoCaption: '', file: null as File | null }]);
  const [moments, setMoments] = useState(['', '', '']);
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC');
  const { save, busy, progress, error, setError, fields } = useSave();
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  function submit(e: FormEvent, publish = true) {
    e.preventDefault();
    const orphan = sections.findIndex((s) => s.file && !s.body.trim());
    if (orphan >= 0) return setError(`Write the story for section ${orphan + 1}, or remove its photo`);
    const kept = sections.filter((s) => s.body.trim());
    const input: TripInput = {
      kind: 'FULL', title: f.title, place: f.place, visibility,
      startDate: f.startDate || null, endDate: f.endDate || null, intro: f.intro || null, finalNote: f.finalNote || null,
      sections: kept.map((s) => ({ heading: s.heading || null, body: s.body, photoCaption: s.photoCaption || null })),
      moments: moments.map((m) => m.trim()).filter(Boolean),
    };
    const uploads: Upload[] = [
      ...(cover ? [{ file: cover, role: 'COVER' as const, position: 0 }] : []),
      ...kept.flatMap((s, position) => (s.file ? [{ file: s.file, role: 'SECTION' as const, position }] : [])),
    ];
    save(input, uploads, publish);
  }

  const updateSection = (i: number, patch: Partial<(typeof sections)[number]>) =>
    setSections((ss) => ss.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <form onSubmit={submit}>
      <h1 className="display rise" style={{ margin: '6px 0 4px', fontSize: 36 }}>Your next issue</h1>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--ink-soft)' }}>Tap the cover to choose a photo. This is how it appears in feeds and on your shelf.</p>
      <div style={{ marginBottom: 16 }}>
        <PhotoPicker file={cover} onChange={setCover} label="cover photo" height={240}>
          <div className="cover-overlay" style={{ padding: 16, color: '#fff', pointerEvents: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase' }}><span>Weyvo</span><span>{f.place || 'Destination'}</span></div>
            <p className="display" style={{ margin: 0, fontSize: 30 }}>{f.title || 'Your trip title'}</p>
          </div>
        </PhotoPicker>
      </div>

      <TextField id="ft" label={`Trip title · ${f.title.length} / 60`} value={f.title} onChange={set('title')} max={60} error={fields.title} placeholder="The beach we had to ourselves" display />
      <TextField id="fd" label="Destination" value={f.place} onChange={set('place')} max={120} error={fields.place} placeholder="Gokarna, Karnataka" />
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
            <PhotoPicker file={s.file} onChange={(file) => updateSection(i, { file })} label={`section ${i + 1} photo`} height={160} />
          </div>
          <TextField id={`c${i}`} label="Photo caption (optional)" value={s.photoCaption} onChange={(v) => updateSection(i, { photoCaption: v })} max={120} placeholder="Chandratal at dawn" />
        </div>
      ))}
      {sections.length < maxSections && (
        <button type="button" className="pill" onClick={() => setSections((ss) => [...ss, { heading: '', body: '', photoCaption: '', file: null }])} style={{ marginBottom: 18 }}><Icon.plus size={16} /> Add a section</button>
      )}

      <p className="eyebrow" style={{ margin: '8px 0 10px', fontWeight: 600 }}>Favourite moments · up to 3</p>
      {moments.map((m, i) => (
        <TextField key={i} id={`m${i}`} label={`Moment ${i + 1}`} value={m} onChange={(v) => setMoments((ms) => ms.map((x, j) => (j === i ? v : x)))} max={120} placeholder={['Butter tea at the monastery', 'The truck that rescued us', 'Dawn at the lake'][i]} />
      ))}
      <TextField id="fn" label="Final note · 200 characters" value={f.finalNote} onChange={set('finalNote')} max={200} error={fields.finalNote} placeholder="Go before the road gets paved." />

      <VisibilityPicker value={visibility} onChange={setVisibility} />
      {error && <p role="alert" style={{ margin: '14px 0 0', fontSize: 14, color: '#B3261E' }}>{error}</p>}
      <FooterBar busy={busy} progress={progress} primary="Publish" onDraft={(e) => submit(e, false)} />
    </form>
  );
}

/** Plan and photo usage, so limits never come as a surprise at upload time. */
function PlanNote({ usage }: { usage: PlanUsage }) {
  const total = usage.limits.totalPhotos;
  const left = total > 0 ? Math.max(0, total - usage.photosUsed) : null;
  return (
    <p className="paper-card" style={{ margin: '4px 0 16px', fontSize: 13, color: 'var(--ink-soft)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      <span><strong style={{ color: 'var(--ink)' }}>{usage.plan === 'PREMIUM' ? 'Premium' : 'Free'} plan</strong></span>
      <span>{total > 0 ? `${usage.photosUsed} of ${total} photos used${left === 0 ? ' · limit reached' : ''}` : `${usage.photosUsed} photos · unlimited`}</span>
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
    <div style={{ marginBottom: 14 }}>
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

function FooterBar({ primary, busy, progress, onDraft }: { primary: string; busy: boolean; progress: string; onDraft: (e: FormEvent) => void }) {
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'var(--paper)', borderTop: '1px solid var(--line)', zIndex: 10 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '12px 20px 20px', display: 'flex', gap: 10 }}>
        <button type="button" className="btn btn-outline" disabled={busy} onClick={onDraft}>Save draft</button>
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ flex: 1, opacity: busy ? 0.7 : 1 }} aria-live="polite">{busy ? progress || 'Saving…' : primary}</button>
      </div>
    </div>
  );
}
