import { useState } from 'react';
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

export function Premium() {
  const { user, loading } = useAuth();
  const plans = useApi(() => api.billingPlans(), []);
  const usage = useApi(() => (user ? api.myPlan() : Promise.resolve(null)), [user?.id]);
  const [current, setCurrent] = useState<PlanUsage | null>(null);
  const [busy, setBusy] = useState<Period | null>(null);
  const [error, setError] = useState('');
  const [paid, setPaid] = useState(false);

  if (loading) return null;
  if (!user) return <Navigate to="/signin?next=/premium" replace />;
  if (plans.loading || usage.loading) return <div className="app" style={{ padding: 20 }}><Loading /></div>;

  const me = current ?? usage.data;
  const p = plans.data;

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
              setPaid(true);
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
    <div className="app" style={{ paddingBottom: 40 }}>
      <div className="topbar" style={{ padding: '12px 10px 4px' }}>
        <Link to="/settings" className="icon-btn" aria-label="Back"><Icon.back /></Link>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Premium</span>
        <span style={{ width: 44 }} />
      </div>
      <div style={{ padding: '0 20px' }}>
        <h1 className="display rise" style={{ margin: '12px 0 6px', fontSize: 42 }}>More room for your stories.</h1>
        <p style={{ margin: '0 0 18px', fontSize: 15, color: 'var(--ink-soft)' }}>Premium lifts the limits. Pay once for a month or a year; it doesn't renew on its own.</p>

        {me && <CurrentPlan usage={me} paid={paid} />}
        {p && <Compare free={p.free} premium={p.premium} />}

        {p && !p.available && <p role="status" className="paper-card" style={{ fontSize: 14 }}>Payments aren't set up on this server yet.</p>}
        {p?.available && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 18 }}>
            {p.options.map((o) => (
              <button key={o.period} type="button" onClick={() => buy(o.period)} disabled={busy !== null}
                className={o.period === 'YEAR' ? 'btn btn-primary' : 'btn btn-outline'}
                style={{ minHeight: 76, flexDirection: 'column', gap: 2, borderRadius: 18, opacity: busy && busy !== o.period ? 0.5 : 1 }}>
                <span className="display" style={{ fontSize: 24 }}>{rupees(o.amountPaise)}</span>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{busy === o.period ? 'Opening…' : o.label}{o.period === 'YEAR' ? ' · best value' : ''}</span>
              </button>
            ))}
          </div>
        )}
        {error && <p role="alert" style={{ margin: '12px 0 0', fontSize: 14, color: '#B3261E' }}>{error}</p>}
        <p style={{ margin: '18px 0 0', fontSize: 12, color: 'var(--muted)' }}>
          Payments are handled by Razorpay. Weyvo never sees your card or UPI details. Prices include taxes where applicable.
        </p>
      </div>
    </div>
  );
}

function CurrentPlan({ usage, paid }: { usage: PlanUsage; paid: boolean }) {
  const premium = usage.plan === 'PREMIUM';
  const until = usage.premiumUntil ? new Date(usage.premiumUntil).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  return (
    <div className="paper-card" style={{ marginBottom: 16, border: premium ? '2px solid var(--gold)' : undefined }} role={paid ? 'status' : undefined}>
      {paid && <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--green)' }}>Payment confirmed. Welcome to Premium.</p>}
      <p style={{ margin: 0, fontSize: 14 }}>
        You're on <strong>{premium ? 'Premium' : 'Free'}</strong>{premium && until ? ` until ${until}` : ''}.
        {premium ? ' Buying again adds more time.' : ''}
      </p>
    </div>
  );
}

function Compare({ free, premium }: { free: PlanLimits; premium: PlanLimits }) {
  const n = (v: number) => (v === 0 ? 'Unlimited' : String(v));
  const rows: [string, string, string][] = [
    ['Story sections in a full trip', n(free.fullTripSections), n(premium.fullTripSections)],
    ['Photos in a short story', n(free.shortStoryPhotos), n(premium.shortStoryPhotos)],
    ['Photos in total', n(free.totalPhotos), n(premium.totalPhotos)],
    ['Uploads per hour', n(free.uploadsPerHour), n(premium.uploadsPerHour)],
  ];
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 12 }}>
          <th scope="col" style={{ padding: '8px 0', fontWeight: 500 }}></th>
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

