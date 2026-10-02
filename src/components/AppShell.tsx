import { BarChart3, BookOpenCheck, ChevronRight, GraduationCap, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth';
import { useData } from '../features/data';
import { demoMode } from '../lib/supabase';

export function AppShell(){
  const {profile,signOut}=useAuth();const{trackers,error}=useData();const[open,setOpen]=useState(false);
  const navClass=({isActive}:{isActive:boolean})=>`flex items-center gap-3 border-r-4 px-6 py-3 text-sm font-bold transition ${isActive?'border-[#EA7600] bg-blue-800/90 text-white':'border-transparent text-blue-100 hover:bg-blue-900/60 hover:text-white'}`;
  const side=<div className="flex h-full flex-col bg-[#003C71] text-white">
    <div className="border-b border-blue-800/80 p-6"><div className="flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#EA7600] text-lg font-black shadow">OT</div><div><div className="text-xl font-black leading-none">OntarioTech</div><div className="mt-1 text-[10px] font-extrabold uppercase tracking-[.16em] text-[#EA7600]">FBIT Tracker</div></div></div></div>
    <nav className="flex-1 overflow-y-auto py-4" aria-label="Primary navigation"><NavLink to="/dashboard" end className={navClass} onClick={()=>setOpen(false)}><LayoutDashboard size={19} className="text-[#EA7600]"/>Dashboard Overview</NavLink>
      <NavLink to="/graduates" className={navClass} onClick={()=>setOpen(false)}><GraduationCap size={19} className="text-[#EA7600]"/>MSc student tracker</NavLink>
      <NavLink to="/curriculum" className={navClass} onClick={()=>setOpen(false)}><BookOpenCheck size={19} className="text-[#EA7600]"/>Curriculum Change Tracker</NavLink>
      <div className="px-6 pb-2 pt-6 text-[9px] font-black uppercase tracking-[.2em] text-blue-300">Active process trackers</div>
      <div className="space-y-1 px-3">{trackers.map((t)=><NavLink key={t.id} to={`/trackers/${t.id}/timeline`} onClick={()=>setOpen(false)} className={({isActive})=>`flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold ${isActive?'bg-blue-800 text-white':'text-blue-100 hover:bg-blue-900/60'}`}><span className={`h-2 w-2 shrink-0 rounded-full ${t.type==='grade-submission'?'bg-[#EA7600]':'bg-blue-300'}`}/><span className="truncate">{t.title}</span><ChevronRight size={13} className="ml-auto shrink-0 opacity-50"/></NavLink>)}</div>
      <div className="mt-6 border-t border-blue-800/60 pt-4"><NavLink to="/settings" className={navClass} onClick={()=>setOpen(false)}><Settings size={18}/>Templates & settings</NavLink>{profile?.role==='dean'&&<NavLink to="/admin/users" className={navClass} onClick={()=>setOpen(false)}><ShieldCheck size={18}/>User administration</NavLink>}</div>
    </nav>
    <div className="border-t border-blue-800 bg-blue-950/30 p-4"><div className="mb-3 flex items-center gap-3"><div className="grid h-8 w-8 place-items-center rounded-full bg-blue-100 text-xs font-black text-[#003C71]">{profile?.fullName.split(' ').map(x=>x[0]).slice(-2).join('')}</div><div className="min-w-0"><p className="truncate text-xs font-bold">{profile?.fullName}</p><p className="truncate text-[10px] capitalize text-blue-300">{profile?.role.replaceAll('_',' ')}</p></div></div><button className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-700 py-2 text-xs font-bold text-blue-100 hover:bg-blue-900" onClick={()=>void signOut()}><LogOut size={14}/>Sign out</button></div>
  </div>;
  return <div className="flex h-screen overflow-hidden bg-slate-50"><aside className="hidden w-64 shrink-0 shadow-xl md:block">{side}</aside>{open&&<div className="fixed inset-0 z-40 md:hidden"><button className="absolute inset-0 bg-slate-950/60" onClick={()=>setOpen(false)} aria-label="Close menu"/><aside className="relative h-full w-72 shadow-2xl">{side}</aside></div>}
    <div className="flex min-w-0 flex-1 flex-col"><header className="flex h-14 shrink-0 items-center justify-between bg-[#003C71] px-4 text-white shadow md:hidden"><div className="flex items-center gap-2"><div className="grid h-7 w-7 place-items-center rounded bg-[#EA7600] text-xs font-black">OT</div><b className="text-sm">FBIT Tracker</b></div><button onClick={()=>setOpen(!open)} aria-label="Open navigation">{open?<X/>:<Menu/>}</button></header>
      {demoMode&&<div className="flex shrink-0 items-center justify-center gap-2 bg-amber-100 px-3 py-1.5 text-[11px] font-bold text-amber-900"><BarChart3 size={13}/>Demo mode · fictional data · connect `.env.local` to use Supabase</div>}
      {error&&<div className="bg-red-100 px-4 py-2 text-center text-xs font-bold text-red-800">Data could not be refreshed: {error}</div>}
      <main className="min-w-0 flex-1 overflow-y-auto"><Outlet/></main></div>
  </div>;
}
