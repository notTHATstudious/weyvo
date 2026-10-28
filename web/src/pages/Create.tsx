import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError, TAG_LABEL, type ShortTag, type TripInput, type Visibility } from '../api';
import { useAuth } from '../auth';
import { Icon } from '../components/Icons';
import { Photo } from '../components/Photo';

const TAGS: ShortTag[] = ['WEEKEND', 'ONE_NIGHT', 'LONG_DRIVE', 'DAY_TRIP'];
const VISIBILITY: { value: Visibility; label: string; hint: string }[] = [
  { value: 'PUBLIC', label: 'Public', hint: 'In feeds and on your profile' },
  { value: 'UNLISTED', label: 'Unlisted', hint: 'Only people with the link' },
  { value: 'PRIVATE', label: 'Private', hint: 'Only you' },
];

export function Create() {
  const { signedIn, loading } = useAuth();
  const [params] = useSearchParams();
  const initial = params.get('type') === 'short' ? 'short' : params.get('type') === 'full' ? 'full' : 'pick';
  const [mode, setMode] = useState<'pick' | 'short' | 'full'>(initial);

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
                <span style={{ display: 'block', marginTop: 6, fontSize: 14, lineHeight: 1.5, color: '#CFC8BA' }}>A magazine issue. Intro, up to 3 story sections, favourite moments and a final note.</span>
              </div>
            </button>
            <button type="button" onClick={() => setMode('short')} className="lift rise" style={{ width: '100%', textAlign: 'left', border: '1px solid var(--ink)', padding: 0, background: 'var(--card)', color: 'var(--ink)', borderRadius: 22, overflow: 'hidden', display: 'flex' }}>
              <div style={{ flex: '0 0 120px', minHeight: 150 }}><Photo scene="road" /></div>
              <div style={{ padding: '16px 16px 18px' }}>
                <span className="display" style={{ fontSize: 26, display: 'block' }}>A short story</span>
                <span style={{ display: 'block', marginTop: 6, fontSize: 14, lineHeight: 1.5, color: 'var(--ink-soft)' }}>A weekend, a one-night stay or a long drive. Up to 4 photo captions.</span>
              </div>
            </button>
          </>
        )}
        {mode === 'short' && <ShortForm />}
        {mode === 'full' && <FullForm />}
      </div>
    </div>
  );
}

/** Saves a trip, publishes it unless saving a draft, and opens it. */
function useSave() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});

  async function save(input: TripInput, publish: boolean) {
    setBusy(true);
    setError('');
    setFields({});
    try {
      const created = await api.createTrip(input);
      const trip = publish ? await api.publishTrip(created.id) : created;
      navigate(`/trips/${trip.slug}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
      if (err instanceof ApiError) setFields(err.fields);
    } finally {
      setBusy(false);
    }
  }
  return { save, busy, error, fields };
}

function ShortForm() {
  const [tag, setTag] = useState<ShortTag>('LONG_DRIVE');
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [captions, setCaptions] = useState(['']);
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC');
  const { save, busy, error, fields } = useSave();

  const input = (): TripInput => ({
    kind: 'SHORT', shortTag: tag, title, place, visibility,
    sections: captions.filter((c) => c.trim()).map((body) => ({ body })),
  });

  function submit(e: FormEvent, publish = true) {
    e.preventDefault();
    save(input(), publish);
  }

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

      <p className="field-label" style={{ marginTop: 4 }}>Photos and captions <span>· up to 4. Photo upload is coming soon</span></p>
      {captions.map((c, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: '0 0 64px', height: 64, borderRadius: 12, overflow: 'hidden' }}><Photo scene={(['road', 'forest', 'sea', 'mountain'] as const)[i]} /></div>
          <label htmlFor={`cap${i}`} className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Caption {i + 1}</label>
          <textarea id={`cap${i}`} className="input" rows={2} maxLength={140} value={c} placeholder={i === 0 ? 'Left at 5 am, chai at every bend' : 'Another moment'}
            onChange={(e) => setCaptions((cs) => cs.map((x, j) => (j === i ? e.target.value : x)))} style={{ flex: 1 }} />
        </div>
      ))}
      {captions.length < 4 && (
        <button type="button" className="pill" onClick={() => setCaptions((cs) => [...cs, ''])} style={{ marginBottom: 18 }}><Icon.plus size={16} /> Add a photo caption</button>
      )}

      <VisibilityPicker value={visibility} onChange={setVisibility} />
      {error && <p role="alert" style={{ margin: '14px 0 0', fontSize: 14, color: '#B3261E' }}>{error}</p>}
      <FooterBar busy={busy} primary="Post short story" onDraft={(e) => submit(e, false)} />
    </form>
  );
}

function FullForm() {
  const [f, setF] = useState({ title: '', place: '', startDate: '', endDate: '', intro: '', finalNote: '' });
  const [sections, setSections] = useState([{ heading: '', body: '', photoCaption: '' }]);
  const [moments, setMoments] = useState(['', '', '']);
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC');
  const { save, busy, error, fields } = useSave();
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const input = (): TripInput => ({
    kind: 'FULL', title: f.title, place: f.place, visibility,
    startDate: f.startDate || null, endDate: f.endDate || null, intro: f.intro || null, finalNote: f.finalNote || null,
    sections: sections.filter((s) => s.body.trim()).map((s) => ({ heading: s.heading || null, body: s.body, photoCaption: s.photoCaption || null })),
    moments: moments.map((m) => m.trim()).filter(Boolean),
  });

  function submit(e: FormEvent, publish = true) {
    e.preventDefault();
    save(input(), publish);
  }

  const updateSection = (i: number, k: 'heading' | 'body' | 'photoCaption', v: string) =>
    setSections((ss) => ss.map((s, j) => (j === i ? { ...s, [k]: v } : s)));

  return (
    <form onSubmit={submit}>
      <h1 className="display rise" style={{ margin: '6px 0 4px', fontSize: 36 }}>Your next issue</h1>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--ink-soft)' }}>This is how it appears in feeds and on your shelf.</p>
      <div className="cover" style={{ height: 220, borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
        <Photo scene="sea" />
        <div className="cover-overlay" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase' }}><span>Weyvo</span><span>{f.place || 'Destination'}</span></div>
          <p className="display" style={{ margin: 0, fontSize: 30 }}>{f.title || 'Your trip title'}</p>
        </div>
      </div>

      <TextField id="ft" label={`Trip title · ${f.title.length} / 60`} value={f.title} onChange={set('title')} max={60} error={fields.title} placeholder="The beach we had to ourselves" display />
      <TextField id="fd" label="Destination" value={f.place} onChange={set('place')} max={120} error={fields.place} placeholder="Gokarna, Karnataka" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <TextField id="fs" label="From" type="date" value={f.startDate} onChange={set('startDate')} />
        <TextField id="fe" label="To" type="date" value={f.endDate} onChange={set('endDate')} />
      </div>
      <TextField id="fi" label="Introduction · 250 characters" value={f.intro} onChange={set('intro')} max={250} error={fields.intro} placeholder="Set the scene in two sentences" multiline />

      <p className="eyebrow" style={{ margin: '18px 0 10px', fontWeight: 600 }}>Story sections · up to 3</p>
      {sections.map((s, i) => (
        <div key={i} className="paper-card" style={{ marginBottom: 12 }}>
          <TextField id={`h${i}`} label={`Section ${i + 1} heading`} value={s.heading} onChange={(v) => updateSection(i, 'heading', v)} max={60} placeholder="The road in" />
          <TextField id={`b${i}`} label="Story · 500 characters" value={s.body} onChange={(v) => updateSection(i, 'body', v)} max={500} placeholder="What happened, what it felt like" multiline />
          <TextField id={`c${i}`} label="Photo caption (optional)" value={s.photoCaption} onChange={(v) => updateSection(i, 'photoCaption', v)} max={120} placeholder="Chandratal at dawn" />
        </div>
      ))}
      {sections.length < 3 && (
        <button type="button" className="pill" onClick={() => setSections((ss) => [...ss, { heading: '', body: '', photoCaption: '' }])} style={{ marginBottom: 18 }}><Icon.plus size={16} /> Add a section</button>
      )}

      <p className="eyebrow" style={{ margin: '8px 0 10px', fontWeight: 600 }}>Favourite moments · up to 3</p>
      {moments.map((m, i) => (
        <TextField key={i} id={`m${i}`} label={`Moment ${i + 1}`} value={m} onChange={(v) => setMoments((ms) => ms.map((x, j) => (j === i ? v : x)))} max={120} placeholder={['Butter tea at the monastery', 'The truck that rescued us', 'Dawn at the lake'][i]} />
      ))}
      <TextField id="fn" label="Final note · 200 characters" value={f.finalNote} onChange={set('finalNote')} max={200} error={fields.finalNote} placeholder="Go before the road gets paved." />

      <VisibilityPicker value={visibility} onChange={setVisibility} />
      {error && <p role="alert" style={{ margin: '14px 0 0', fontSize: 14, color: '#B3261E' }}>{error}</p>}
      <FooterBar busy={busy} primary="Publish" onDraft={(e) => submit(e, false)} />
    </form>
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

function FooterBar({ primary, busy, onDraft }: { primary: string; busy: boolean; onDraft: (e: FormEvent) => void }) {
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'var(--paper)', borderTop: '1px solid var(--line)', zIndex: 10 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '12px 20px 20px', display: 'flex', gap: 10 }}>
        <button type="button" className="btn btn-outline" disabled={busy} onClick={onDraft}>Save draft</button>
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ flex: 1, opacity: busy ? 0.7 : 1 }}>{busy ? 'Saving…' : primary}</button>
      </div>
    </div>
  );
}
