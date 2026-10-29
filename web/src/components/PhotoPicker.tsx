import { useEffect, useId, useState, type ReactNode } from 'react';
import { photoProblem } from '../api';
import { Icon } from './Icons';

/**
 * Tap-to-choose photo slot with an instant local preview. Nothing uploads until the story is saved.
 * When editing, `existingUrl` shows the photo already on the story until it's replaced or removed.
 */
export function PhotoPicker({ file, existingUrl, onChange, label, height = 96, children }: {
  file: File | null; existingUrl?: string | null; onChange: (f: File | null) => void; label: string; height?: number; children?: ReactNode;
}) {
  const id = useId();
  const [local, setLocal] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!file) return setLocal(null);
    const url = URL.createObjectURL(file);
    setLocal(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const preview = local ?? existingUrl ?? null;

  return (
    <div style={{ position: 'relative' }}>
      <label htmlFor={id} style={{ display: 'block', position: 'relative', height, borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
        border: preview ? 0 : '1.5px dashed var(--muted)', background: preview ? 'var(--line)' : 'transparent' }}>
        {preview
          ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <span style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--muted)', fontSize: 12 }}>
              <Icon.plus /> {height > 120 && <span>{label}</span>}
            </span>}
        {children}
        <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{preview ? `Change ${label}` : `Choose ${label}`}</span>
      </label>
      <input id={id} type="file" accept="image/jpeg,image/png" style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          e.target.value = '';
          if (!f) return;
          const problem = photoProblem(f);
          setError(problem ?? '');
          if (!problem) onChange(f);
        }} />
      {preview && (
        <button type="button" aria-label={`Remove ${label}`} onClick={() => onChange(null)}
          style={{ position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: '50%', border: 0, background: 'rgba(0,0,0,.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon.close size={14} />
        </button>
      )}
      {error && <p role="alert" style={{ margin: '4px 0 0', fontSize: 12, color: '#B3261E' }}>{error}</p>}
    </div>
  );
}
