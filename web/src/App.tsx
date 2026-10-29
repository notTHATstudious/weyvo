import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Discover } from './pages/Discover';
import { ShortStories } from './pages/ShortStories';
import { Story } from './pages/Story';
import { Profile } from './pages/Profile';
import { Create } from './pages/Create';
import { Destination } from './pages/Destination';
import { Settings } from './pages/Settings';
import { Admin } from './pages/Admin';
import { SignIn } from './pages/SignIn';
import { Notifications } from './pages/Notifications';
import { VerifyEmail } from './pages/VerifyEmail';
import { ForgotPassword } from './pages/ForgotPassword';
import { VerifyBanner } from './components/VerifyBanner';
import { EditTrip } from './pages/EditTrip';
import { Premium } from './pages/Premium';
import { Legal } from './pages/Legal';
import { Places } from './pages/Places';

// The saved theme is applied before first paint by the script in index.html; Settings changes it.
export function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
    <VerifyBanner />
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
    </>
  );
}
