import { useState, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api, ApiError, type Period, type PlanLimits, type PlanUsage } from '../api';
import { useAuth } from '../auth';
import { Icon } from '../components/Icons';
import { Loading } from '../components/States';
import { useApi } from '../useApi';

// Razorpay's hosted checkout. Card and UPI details are entered there, never in Weyvo.
const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

interface RazorpayResponse { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, cb: (e: unknown) => void) => void };
  }
}

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = CHECKOUT_SRC;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load the payment window. Check your connection."));
    document.head.appendChild(s);
  });
}

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;
const unlimited = (v: number) => (v === 0 ? 'Unlimited' : String(v));
const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null);

export function Premium() {
  const { user, loading } = useAuth();
  const plans = useApi(() => api.billingPlans(), []);
  const usage = useApi(() => (user ? api.myPlan() : Promise.resolve(null)), [user?.id]);
  const [current, setCurrent] = useState<PlanUsage | null>(null);
  const [busy, setBusy] = useState<Period | null>(null);
  const [error, setError] = useState('');
  const [celebrate, setCelebrate] = useState(false);

  if (loading) return null;
  if (!user) return <Navigate to="/signin?next=/premium" replace />;
  if (plans.loading || usage.loading) return <div className="app" style={{ padding: 20 }}><Loading /></div>;

  const me = current ?? usage.data;
  const p = plans.data;
  const isPremium = me?.plan === 'PREMIUM';

  async function buy(period: Period) {
    if (!user?.emailVerified) return setError('Verify your email first, then come back to upgrade.');
    setBusy(period);
    setError('');
    try {
      await loadCheckout();
      const order = await api.createOrder(period);
      await new Promise<void>((resolve, reject) => {
        const checkout = new window.Razorpay!({
          key: order.keyId,
          order_id: order.orderId,
          amount: order.amountPaise,
          currency: order.currency,
          name: 'Weyvo',
          description: period === 'MONTH' ? 'Premium · 1 month' : 'Premium · 1 year',
          prefill: { name: user!.displayName },
          theme: { color: '#1F4D3A' },
          handler: async (r: RazorpayResponse) => {
            try {
              setCurrent(await api.verifyPayment(r.razorpay_order_id, r.razorpay_payment_id, r.razorpay_signature));
              setCelebrate(true);
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: { ondismiss: () => resolve() },
        });
        checkout.on('payment.failed', () => reject(new Error('The payment didn’t go through. You haven’t been charged.')));
        checkout.open();
      });
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="app" style={{ paddingBottom: 48 }}>
      {celebrate && me && p && <Welcome until={formatDate(me.premiumUntil)} limits={p.premium} onClose={() => setCelebrate(false)} />}

      <div className="topbar" style={{ padding: '12px 10px 4px' }}>
        <Link to="/settings" className="icon-btn" aria-label="Back"><Icon.back /></Link>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Premium</span>
        <span style={{ width: 44 }} />
      </div>

      <div style={{ padding: '0 20px' }}>
        <section style={{ background: 'var(--green)', color: 'var(--on-green)', borderRadius: 24, padding: '26px 22px', margin: '8px 0 20px' }}>
          <p className="eyebrow" style={{ color: 'var(--gold)' }}>Weyvo Premium</p>
          <h1 className="display rise" style={{ margin: '8px 0 0', fontSize: 40 }}>More room for every journey.</h1>
          <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.5, opacity: 0.92 }}>
            Bigger stories, unlimited photos and a badge on your profile. Pay once; it never renews on its own.
          </p>
          {me && (
            <p style={{ margin: '14px 0 0', fontSize: 13, fontWeight: 600 }}>
              {isPremium ? `You're Premium${me.premiumUntil ? ` until ${formatDate(me.premiumUntil)}` : ''}. Buying again adds more time.` : "You're on Free."}
            </p>
          )}
        </section>

        {p && (
          <>
            <h2 className="display" style={{ margin: '0 0 12px', fontSize: 26 }}>What you get</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              <Perk icon={<Icon.plus />} title={`${unlimited(p.premium.fullTripSections)} story sections`} body={`Tell the whole trip. Free has ${p.free.fullTripSections}.`} />
              <Perk icon={<Icon.play />} title={`${unlimited(p.premium.shortStoryPhotos)} photos per short story`} body={`Weekends deserve more than ${p.free.shortStoryPhotos}.`} />
              <Perk icon={<Icon.pin />} title={`${unlimited(p.premium.totalPhotos)} photos in total`} body={p.free.totalPhotos ? `Free keeps ${p.free.totalPhotos}.` : 'No cap on your archive.'} />
              <Perk icon={<Icon.share />} title={`${unlimited(p.premium.uploadsPerHour)} uploads an hour`} body="Post a whole trip in one sitting." />
              <Perk icon={<Icon.user />} title="Premium badge" body="A small gold mark on your profile." />
              <Perk icon={<Icon.bookmark />} title="Magazine themes" body="Extra layouts for your issues." soon />
              <Perk icon={<Icon.compass />} title="Print-ready PDF" body="Turn a trip into a printable issue." soon />
              <Perk icon={<Icon.bell />} title="Early access" body="Try new features before everyone else." soon />
            </div>

            <h2 className="display" style={{ margin: '28px 0 6px', fontSize: 26 }}>Free vs Premium</h2>
            <Compare free={p.free} premium={p.premium} />

            <h2 className="display" style={{ margin: '28px 0 12px', fontSize: 26 }}>Choose your plan</h2>
            {!p.available && <p role="status" className="paper-card" style={{ fontSize: 14 }}>Payments aren't set up on this server yet.</p>}
            {p.available && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                {p.options.map((o) => (
                  <button key={o.period} type="button" onClick={() => buy(o.period)} disabled={busy !== null}
                    className={o.period === 'YEAR' ? 'btn btn-primary' : 'btn btn-outline'}
                    style={{ minHeight: 84, flexDirection: 'column', gap: 2, borderRadius: 18, opacity: busy && busy !== o.period ? 0.5 : 1 }}>
                    <span className="display" style={{ fontSize: 26 }}>{rupees(o.amountPaise)}</span>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{busy === o.period ? 'Opening…' : o.label}{o.period === 'YEAR' ? ' · best value' : ''}</span>
                  </button>
                ))}
              </div>
            )}
            {error && <p role="alert" style={{ margin: '12px 0 0', fontSize: 14, color: '#B3261E' }}>{error}</p>}

            <h2 className="display" style={{ margin: '28px 0 8px', fontSize: 26 }}>Questions</h2>
            <Faq q="Does it renew automatically?" a="No. You pay once for a month or a year. Buy again whenever you like; it adds to the time you have left." />
            <Faq q="What happens when it ends?" a="You go back to Free limits. Every story and photo you posted stays exactly where it is." />
            <Faq q="Is my payment safe?" a="Payments are handled by Razorpay. Weyvo never sees your card or UPI details." />
          </>
        )}
      </div>
    </div>
  );
}

function Perk({ icon, title, body, soon }: { icon: ReactNode; title: string; body: string; soon?: boolean }) {
  return (
    <div className="paper-card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', opacity: soon ? 0.75 : 1 }}>
      <span aria-hidden="true" style={{ flex: '0 0 40px', height: 40, borderRadius: 12, background: soon ? 'var(--line)' : 'var(--chip-gold-bg)', color: 'var(--chip-gold-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
      <span>
        <strong style={{ display: 'block', fontSize: 15 }}>{title}{soon && <span className="tag" style={{ marginLeft: 6, fontSize: 10, background: 'var(--line)' }}>Coming soon</span>}</strong>
        <span style={{ display: 'block', marginTop: 2, fontSize: 13, color: 'var(--ink-soft)' }}>{body}</span>
      </span>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="paper-card" style={{ marginBottom: 8 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 15 }}>{q}</summary>
      <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--ink-soft)' }}>{a}</p>
    </details>
  );
}

function Compare({ free, premium }: { free: PlanLimits; premium: PlanLimits }) {
  const rows: [string, string, string][] = [
    ['Story sections in a full trip', unlimited(free.fullTripSections), unlimited(premium.fullTripSections)],
    ['Photos in a short story', unlimited(free.shortStoryPhotos), unlimited(premium.shortStoryPhotos)],
    ['Photos in total', unlimited(free.totalPhotos), unlimited(premium.totalPhotos)],
    ['Uploads per hour', unlimited(free.uploadsPerHour), unlimited(premium.uploadsPerHour)],
    ['Reactions, follows, questions, map', '✓', '✓'],
    ['Premium badge', '—', '✓'],
  ];
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 12 }}>
          <th scope="col" style={{ padding: '8px 0', fontWeight: 500 }}><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Feature</span></th>
          <th scope="col" style={{ padding: '8px 6px', fontWeight: 500 }}>Free</th>
          <th scope="col" style={{ padding: '8px 0', fontWeight: 700, color: 'var(--ink)' }}>Premium</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, f, pr]) => (
          <tr key={label} style={{ borderTop: '1px solid var(--line)' }}>
            <th scope="row" style={{ padding: '10px 0', textAlign: 'left', fontWeight: 400 }}>{label}</th>
            <td style={{ padding: '10px 6px' }}>{f}</td>
            <td style={{ padding: '10px 0', fontWeight: 600 }}>{pr}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const CONFETTI_COLORS = ['#E3A23B', '#1F4D3A', '#F1E3C4', '#C97B4A', '#4C8C9A'];

/** Full-screen welcome after payment. CSS-only confetti: no images, no libraries. */
function Welcome({ until, limits, onClose }: { until: string | null; limits: PlanLimits; onClose: () => void }) {
  const pieces = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="welcome-title"
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--green)', color: 'var(--on-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 24 }}>
      {pieces.map((i) => (
        <span key={i} aria-hidden="true" className="confetti"
          style={{ left: `${(i * 41) % 100}%`, background: CONFETTI_COLORS[i % CONFETTI_COLORS.length], animationDelay: `${(i % 8) * 0.12}s`,
            animationDuration: `${2.4 + (i % 5) * 0.35}s`, width: i % 3 ? 8 : 12, height: i % 3 ? 14 : 8, borderRadius: i % 4 === 0 ? '50%' : 2 }} />
      ))}
      <div className="rise" style={{ position: 'relative', maxWidth: 420, textAlign: 'center' }}>
        <div aria-hidden="true" className="badge-pop" style={{ width: 84, height: 84, margin: '0 auto 18px', borderRadius: '50%', background: 'var(--gold)', color: '#1C1B18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon.check size={40} />
        </div>
        <p className="eyebrow" style={{ color: 'var(--gold)' }}>Payment confirmed</p>
        <h2 id="welcome-title" className="display" style={{ margin: '10px 0 0', fontSize: 44 }}>Congratulations, you're Premium!</h2>
        <p style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.5, opacity: 0.92 }}>
          {until ? `Your Premium runs until ${until}.` : 'Your Premium is active.'} You now have {unlimited(limits.fullTripSections).toLowerCase()} sections per trip,
          {' '}{unlimited(limits.shortStoryPhotos).toLowerCase()} photos per short story and {unlimited(limits.totalPhotos).toLowerCase()} photos in total.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
          <Link to="/create" className="btn" style={{ background: 'var(--card)', color: 'var(--ink)' }}>Create a story</Link>
          <button type="button" className="btn" onClick={onClose} style={{ background: 'transparent', color: 'var(--on-green)', border: '1px solid currentColor' }}>Back to Premium</button>
        </div>
      </div>
    </div>
  );
}
