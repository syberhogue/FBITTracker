import { ArrowRight, CheckCircle2, LockKeyhole, Mail } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth';

function AuthFrame({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-2">
      <aside className="hidden bg-[#003C71] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#EA7600] text-xl font-black">OT</div>
          <div><p className="text-2xl font-black">OntarioTech</p><p className="text-xs font-black uppercase tracking-[.2em] text-[#EA7600]">FBIT Tracker</p></div>
        </div>
        <div><p className="max-w-xl text-4xl font-black leading-tight">One clear view of every academic milestone.</p><p className="mt-4 max-w-lg text-blue-200">Secure operations, grade benchmarking, and submission visibility for the Faculty of Business and Information Technology.</p></div>
        <p className="text-xs text-blue-300">Ontario Tech University · Faculty administration</p>
      </aside>
      <main className="flex items-center justify-center p-6"><div className="w-full max-w-md"><div className="mb-8 lg:hidden"><div className="inline-grid h-10 w-10 place-items-center rounded-lg bg-[#EA7600] font-black text-white">OT</div></div><p className="text-[10px] font-black uppercase tracking-[.22em] text-[#EA7600]">Secure faculty access</p><h1 className="mt-2 text-3xl font-black text-slate-950">{title}</h1><p className="mt-2 text-sm text-slate-500">{body}</p><div className="card mt-7 p-6">{children}</div></div></main>
    </div>
  );
}

export function LoginPage() {
  const { profile, signIn } = useAuth();
  const [email, setEmail] = useState('morgan.ellis@ontariotechu.ca');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  if (profile) return <Navigate to="/dashboard" replace />;
  return <AuthFrame title="Welcome back" body="Sign in with your invited Ontario Tech account.">
    <form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); setError(''); try { await signIn(email, password); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Sign in failed.'); } }}>
      <label><span className="label">Email</span><div className="relative"><Mail className="absolute left-3 top-3 text-slate-400" size={17}/><input className="field pl-10" type="email" required value={email} onChange={(event) => setEmail(event.target.value)}/></div></label>
      <label><span className="label">Password</span><div className="relative"><LockKeyhole className="absolute left-3 top-3 text-slate-400" size={17}/><input className="field pl-10" type="password" required value={password} onChange={(event) => setPassword(event.target.value)}/></div></label>
      {error && <p className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}
      <button className="btn-orange w-full gap-2">Sign in <ArrowRight size={15}/></button>
      <button type="button" className="w-full text-xs font-bold text-[#003C71] hover:underline" onClick={() => navigate('/forgot-password')}>Forgot password?</button>
    </form>
  </AuthFrame>;
}

export function ForgotPasswordPage() {
  const { requestReset } = useAuth(); const [email, setEmail] = useState(''); const [sent, setSent] = useState(false);
  return <AuthFrame title="Reset your password" body="We will send instructions if an invited account matches this email.">
    {sent ? <div className="text-center"><CheckCircle2 className="mx-auto text-emerald-600" size={38}/><p className="mt-3 text-sm font-bold">Check your inbox for a secure reset link.</p></div> : <form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); await requestReset(email); setSent(true); }}><label><span className="label">Email</span><input className="field" type="email" required value={email} onChange={(event) => setEmail(event.target.value)}/></label><button className="btn-primary w-full">Send reset link</button></form>}
  </AuthFrame>;
}

export function AcceptInvitePage() {
  const { setPassword } = useAuth(); const [password, setPasswordValue] = useState(''); const [done, setDone] = useState(false); const navigate = useNavigate();
  return <AuthFrame title="Finish account setup" body="Choose a password for your invited FBIT Tracker account.">
    {done ? <button className="btn-primary w-full" onClick={() => navigate('/dashboard')}>Continue to dashboard</button> : <form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); await setPassword(password); setDone(true); }}><label><span className="label">New password</span><input className="field" type="password" minLength={12} required value={password} onChange={(event) => setPasswordValue(event.target.value)}/><span className="mt-1 block text-[10px] text-slate-500">Use at least 12 characters.</span></label><button className="btn-orange w-full">Set password</button></form>}
  </AuthFrame>;
}
