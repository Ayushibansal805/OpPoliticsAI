import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { LoadingState } from './components/ui';
import { useAuth } from './contexts/AuthContext';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage, SignupPage } from './pages/AuthPages';
import { DashboardPage, PredictionsPage } from './pages/DashboardPage';
import { HistoryPage } from './pages/HistoryPage';
import { ModelCenterPage } from './pages/ModelCenterPage';
import { ResolutionPage } from './pages/ResolutionPage';
import { SettingsPage } from './pages/SettingsPage';

function ProtectedRoute() {
  const { user, loading } = useAuth(); const location = useLocation();
  if (loading) return <div className="full-page-state"><LoadingState label="Restoring your session" /></div>;
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

function NotFound() { return <div className="full-page-state"><h1>Page not found</h1><p>The workspace route you requested does not exist.</p><Navigate to="/" replace /></div>; }

export default function App() {
  return <BrowserRouter><Routes><Route path="/" element={<LandingPage />} /><Route path="/login" element={<LoginPage />} /><Route path="/signup" element={<SignupPage />} /><Route element={<ProtectedRoute />}><Route path="/app" element={<AppShell />}><Route index element={<DashboardPage />} /><Route path="predictions" element={<PredictionsPage />} /><Route path="resolution-time" element={<ResolutionPage />} /><Route path="models" element={<ModelCenterPage />} /><Route path="history" element={<HistoryPage />} /><Route path="analytics" element={<AnalyticsPage />} /><Route path="settings" element={<SettingsPage />} /><Route path="operational-risk" element={<ComingSoonPage />} /><Route path="workload-forecasting" element={<ComingSoonPage />} /></Route></Route><Route path="*" element={<NotFound />} /></Routes></BrowserRouter>;
}
