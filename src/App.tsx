import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { useAuth } from './features/auth';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const TrackerPage = lazy(() => import('./pages/TrackerPage').then((module) => ({ default: module.TrackerPage })));
const UsersPage = lazy(() => import('./pages/AdminPages').then((module) => ({ default: module.UsersPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const LoginPage = lazy(() => import('./pages/AuthPages').then((module) => ({ default: module.LoginPage })));
const ForgotPasswordPage = lazy(() => import('./pages/AuthPages').then((module) => ({ default: module.ForgotPasswordPage })));
const AcceptInvitePage = lazy(() => import('./pages/AuthPages').then((module) => ({ default: module.AcceptInvitePage })));
const PublicSubmissionPage = lazy(() => import('./pages/PublicSubmissionPage').then((module) => ({ default: module.PublicSubmissionPage })));

function LoadingScreen() {
  return <div className="grid min-h-screen place-items-center bg-slate-50"><div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#EA7600]"/></div>;
}

function Protected() {
  const { profile, loading } = useAuth();
  if (loading) return <LoadingScreen/>;
  return profile ? <AppShell/> : <Navigate to="/login" replace/>;
}

export default function App() {
  return <Suspense fallback={<LoadingScreen/>}><Routes>
    <Route index element={<PublicSubmissionPage/>}/>
    <Route path="/login" element={<LoginPage/>}/>
    <Route path="/forgot-password" element={<ForgotPasswordPage/>}/>
    <Route path="/accept-invite" element={<AcceptInvitePage/>}/>
    <Route element={<Protected/>}>
      <Route path="dashboard" element={<DashboardPage/>}/>
      <Route path="settings" element={<SettingsPage/>}/>
      <Route path="trackers/:trackerId/:tab" element={<TrackerPage/>}/>
      <Route path="admin/users" element={<UsersPage/>}/>
      <Route path="admin/settings" element={<SettingsPage/>}/>
    </Route>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></Suspense>;
}
