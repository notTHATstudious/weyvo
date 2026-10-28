import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icons';
import { Photo } from '../components/Photo';
import type { ShortTag } from '../mocks/data';

const TAGS: ShortTag[] = ['Weekend', 'One night', 'Long drive', 'Day trip'];
const STEPS = ['Cover', 'Photos', 'Story', 'Who sees it', 'Preview'];

export function Create() {
  const [mode, setMode] = useState<'pick' | 'short' | 'full'>('pick');
  const [tag, setTag] = useState<ShortTag>('Long drive');
  const [title, setTitle] = useState('');
  const navigate = useNavigate();

  return (
    <div className="app" style={{ paddingBottom: 120 }}>
      <div className="topbar" style={{ padding: '12px 10px 4px' }}>
        {mode === 'pick'
          ? <Link to="/discover" className="icon-btn" aria-label="Close"><Icon.close /></Link>
          : <button type="button" className="icon-btn" aria-label="Back" onClick={() => setMode('pick')}><Icon.back /></button>}
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{mode === 'pick' ? 'Create' : mode === 'short' ? 'Short story' : 'Full trip · Step 1 of 5'}</span>
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
                <span style={{ display: 'block', marginTop: 6, fontSize: 14, lineHeight: 1.5, color: '#CFC8BA' }}>A magazine issue. Cover, up to 12 photos, story sections and favourite moments.</span>
              </div>
            </button>
            <button type="button" onClick={() => setMode('short')} className="lift rise" style={{ width: '100%', textAlign: 'left', border: '1px solid var(--ink)', padding: 0, background: 'var(--card)', color: 'var(--ink)', borderRadius: 22, overflow: 'hidden', display: 'flex' }}>
              <div style={{ flex: '0 0 120px', minHeight: 150 }}><Photo scene="road" /></div>
              <div style={{ padding: '16px 16px 18px' }}>
                <span className="display" style={{ fontSize: 26, display: 'block' }}>A short story</span>
                <span style={{ display: 'block', marginTop: 6, fontSize: 14, lineHeight: 1.5, color: 'var(--ink-soft)' }}>A weekend, a one-night stay or a long drive. 1–4 photos and a line or two.</span>
              </div>
            </button>
          </>
        )}

        {mode === 'short' && (
          <form onSubmit={(e) => { e.preventDefault(); navigate('/shorts'); }}>
            <h1 className="display rise" style={{ margin: '6px 0 18px', fontSize: 36 }}>New short story</h1>
            <p className="field-label">What kind of escape?</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {TAGS.map((t) => (
                <button key={t} type="button" className="pill gold" aria-pressed={tag === t} onClick={() => setTag(t)} style={{ minHeight: 44, fontSize: 14 }}>{t}</button>
              ))}
            </div>
            <p className="field-label">Photos <span>· up to 4</span></p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 20 }}>
              <div style={{ height: 96, borderRadius: 12, overflow: 'hidden' }}><Photo scene="road" /></div>
              <button type="button" aria-label="Add photo" style={{ height: 96, borderRadius: 12, border: '1.5px dashed var(--muted)', background: 'transparent', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon.plus /></button>
            </div>
            <label htmlFor="st" className="field-label">Title</label>
            <input id="st" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Sunday drive to Lonavala" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, marginBottom: 14 }} />
            <label htmlFor="sp" className="field-label">Where</label>
            <input id="sp" className="input" placeholder="Lonavala, Maharashtra" style={{ marginBottom: 14 }} />
            <label htmlFor="sc" className="field-label">One line about it <span>· 140 characters</span></label>
            <textarea id="sc" className="input" rows={2} maxLength={140} placeholder="Left at 5 am, chai at every bend" />
            <div className="paper-card" style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14 }}>Who can see it</span><span style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)' }}>Public</span>
            </div>
            <FooterBar primary="Post short story" />
          </form>
        )}

        {mode === 'full' && (
          <form onSubmit={(e) => e.preventDefault()}>
            <div style={{ display: 'flex', gap: 6, margin: '6px 0 18px' }}>
              {STEPS.map((s, i) => (
                <div key={s} style={{ flex: 1 }}>
                  <span style={{ display: 'block', height: 4, borderRadius: 2, background: i === 0 ? 'var(--green)' : 'var(--line-strong)' }} />
                  <span style={{ display: 'block', marginTop: 6, fontSize: 10, color: i === 0 ? 'var(--ink)' : 'var(--muted)' }}>{s}</span>
                </div>
              ))}
            </div>
            <h1 className="display rise" style={{ margin: '0 0 4px', fontSize: 36 }}>Start with the cover</h1>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--ink-soft)' }}>This is how your issue appears in feeds and on your shelf.</p>
            <div className="cover" style={{ height: 260, borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
              <Photo scene="sea" />
              <div className="cover-overlay" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase' }}><span>Weyvo</span><span>Issue 08</span></div>
                <p className="display" style={{ margin: 0, fontSize: 32 }}>{title || 'Your trip title'}</p>
              </div>
            </div>
            <label htmlFor="ft" className="field-label">Trip title <span>· {title.length} / 60</span></label>
            <input id="ft" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="The beach we had to ourselves" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, marginBottom: 14 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <div><label htmlFor="fd" className="field-label">Destination</label><input id="fd" className="input" placeholder="Gokarna" /></div>
              <div><label htmlFor="fw" className="field-label">When</label><input id="fw" className="input" placeholder="12–15 Aug 2026" /></div>
            </div>
            <label htmlFor="fi" className="field-label" style={{ marginTop: 14 }}>Introduction <span>· 250 characters</span></label>
            <textarea id="fi" className="input" rows={3} maxLength={250} placeholder="Set the scene in two sentences" />
            <FooterBar primary="Next: photos" />
          </form>
        )}
      </div>
    </div>
  );
}

function FooterBar({ primary }: { primary: string }) {
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'var(--paper)', borderTop: '1px solid var(--line)' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '12px 20px 20px', display: 'flex', gap: 10 }}>
        <button type="button" className="btn btn-outline">Save draft</button>
        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{primary}</button>
      </div>
    </div>
  );
}
