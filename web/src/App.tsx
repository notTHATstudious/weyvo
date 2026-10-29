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
import { SignIn } from './pages/SignIn';
import { Notifications } from './pages/Notifications';

// The saved theme is applied before first paint by the script in index.html; Settings changes it.
export function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/discover" element={<Discover />} />
      <Route path="/shorts" element={<ShortStories />} />
      <Route path="/trips/:slug" element={<Story />} />
      <Route path="/u/:handle" element={<Profile />} />
      <Route path="/create" element={<Create />} />
      <Route path="/places/:slug" element={<Destination />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
