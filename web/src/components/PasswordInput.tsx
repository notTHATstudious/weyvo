import { useState, type CSSProperties, type InputHTMLAttributes } from 'react';

/** A password field with an eye button to show or hide what's typed. */
export function PasswordInput({ style, wrapStyle, ...input }: InputHTMLAttributes<HTMLInputElement> & { wrapStyle?: CSSProperties }) {
  const [shown, setShown] = useState(false);
  return (
    <div style={{ position: 'relative', ...wrapStyle }}>
      <input {...input} className="input" type={shown ? 'text' : 'password'} autoCapitalize="none" autoCorrect="off" spellCheck={false}
        style={{ paddingRight: 52, ...style }} />
      <button type="button" onClick={() => setShown((s) => !s)} aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown}
        style={{ position: 'absolute', top: 0, right: 2, height: '100%', width: 48, border: 0, background: 'transparent', color: 'var(--muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {shown && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </div>
  );
}
