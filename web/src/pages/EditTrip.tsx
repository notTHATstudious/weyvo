import { Link, Navigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Icon } from '../components/Icons';
import { Empty, Loading } from '../components/States';
import { useApi } from '../useApi';
import { FullForm, ShortForm } from './Create';

/** Edit an existing story. Only its author gets past the loader; everyone else sees "not available". */
export function EditTrip() {
  const { slug = '' } = useParams();
  const { signedIn, loading: authLoading } = useAuth();
  const trip = useApi(() => api.trip(slug), [slug]);
  const plan = useApi(() => (signedIn ? api.myPlan() : Promise.resolve(null)), [signedIn]);

  if (authLoading) return null;
  if (!signedIn) return <Navigate to={`/signin?next=${encodeURIComponent(`/trips/${slug}/edit`)}`} replace />;
  if (trip.loading || plan.loading) return <div className="app" style={{ padding: 20 }}><Loading /></div>;
  if (!trip.data || !trip.data.owner) {
    return <div className="app" style={{ padding: 20 }}><Empty title="You can't edit this story" body="Only its author can edit it." cta={{ to: '/discover', label: 'Back to Discover' }} /></div>;
  }

  const t = trip.data;
  const limits = plan.data?.limits;
  return (
    <div className="app" style={{ paddingBottom: 120 }}>
      <div className="topbar" style={{ padding: '12px 10px 4px' }}>
        <Link to={`/trips/${t.slug}`} className="icon-btn" aria-label="Cancel editing"><Icon.close /></Link>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{t.kind === 'SHORT' ? 'Short story' : 'Full trip'} · editing</span>
        <span style={{ width: 44 }} />
      </div>
      <div style={{ padding: '0 20px' }}>
        {t.kind === 'SHORT'
          ? <ShortForm existing={t} maxPhotos={Math.max(limits?.shortStoryPhotos ?? 4, t.sections.length)} />
          : <FullForm existing={t} maxSections={Math.max(limits?.fullTripSections ?? 3, t.sections.length)} />}
      </div>
    </div>
  );
}
