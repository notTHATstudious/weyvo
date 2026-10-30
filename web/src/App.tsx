import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Discover } from './pages/Discover';
import { VerifyBanner } from './components/VerifyBanner';
import { WakeBanner } from './components/WakeBanner';

/** Loads a page's code only when it's first opened, so the first visit downloads less. */
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(() => load().then((m) => ({ default: m[name] })));
}

const ShortStories = page(() => import('./pages/ShortStories'), 'ShortStories');
const Story = page(() => import('./pages/Story'), 'Story');
const Profile = page(() => import('./pages/Profile'), 'Profile');
const Create = page(() => import('./pages/Create'), 'Create');
const Destination = page(() => import('./pages/Destination'), 'Destination');
const Settings = page(() => import('./pages/Settings'), 'Settings');
const Admin = page(() => import('./pages/Admin'), 'Admin');
const SignIn = page(() => import('./pages/SignIn'), 'SignIn');
const Notifications = page(() => import('./pages/Notifications'), 'Notifications');
const VerifyEmail = page(() => import('./pages/VerifyEmail'), 'VerifyEmail');
const ForgotPassword = page(() => import('./pages/ForgotPassword'), 'ForgotPassword');
const EditTrip = page(() => import('./pages/EditTrip'), 'EditTrip');
const Premium = page(() => import('./pages/Premium'), 'Premium');
const Legal = page(() => import('./pages/Legal'), 'Legal');
const Places = page(() => import('./pages/Places'), 'Places');

// The saved theme is applied before first paint by the script in index.html; Settings changes it.
export function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
    <VerifyBanner />
    <WakeBanner />
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/shorts" element={<ShortStories />} />
        <Route path="/trips/:slug" element={<Story />} />
        <Route path="/trips/:slug/edit" element={<EditTrip />} />
        <Route path="/u/:handle" element={<Profile />} />
        <Route path="/create" element={<Create />} />
        <Route path="/places" element={<Places />} />
        <Route path="/places/:slug" element={<Destination />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/verify" element={<VerifyEmail />} />
        <Route path="/forgot" element={<ForgotPassword />} />
        <Route path="/premium" element={<Premium />} />
        <Route path="/legal/:page" element={<Legal />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
    </>
  );
}
