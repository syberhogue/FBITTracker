import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

export function Badge({ children, tone='gray' }: { children: ReactNode; tone?: 'blue'|'orange'|'green'|'red'|'yellow'|'gray' }) {
  const colors={blue:'bg-blue-100 text-[#003C71]',orange:'bg-orange-100 text-[#B45309]',green:'bg-emerald-100 text-emerald-800',red:'bg-red-100 text-red-700',yellow:'bg-amber-100 text-amber-800',gray:'bg-slate-100 text-slate-600'};
  return <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide ${colors[tone]}`}>{children}</span>;
}

export function Modal({ title, children, onClose, danger=false }: { title:string; children:ReactNode; onClose():void; danger?:boolean }) {
  const panel=useRef<HTMLDivElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement;panel.current?.focus();const onKey=(event:KeyboardEvent)=>event.key==='Escape'&&onClose();document.addEventListener('keydown',onKey);return()=>{document.removeEventListener('keydown',onKey);previous?.focus();};},[onClose]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(e)=>e.target===e.currentTarget&&onClose()}>
    <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
      <div className={`sticky top-0 z-10 flex items-center justify-between px-6 py-4 text-white ${danger?'bg-red-700':'bg-[#003C71]'}`}><div className="flex items-center gap-2">{danger&&<AlertTriangle size={18}/>}<h2 className="font-extrabold">{title}</h2></div><button onClick={onClose} className="rounded p-1 hover:bg-white/10" aria-label="Close dialog"><X size={20}/></button></div>
      {children}
    </div>
  </div>;
}

export function EmptyState({ title, body }: { title:string; body:string }) { return <div className="py-12 text-center"><p className="font-bold text-slate-700">{title}</p><p className="mt-1 text-xs text-slate-500">{body}</p></div>; }

export function PageTitle({ eyebrow, title, body, actions }: { eyebrow?:string; title:string; body?:string; actions?:ReactNode }) { return <header className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div>{eyebrow&&<p className="mb-1 text-[10px] font-black uppercase tracking-[.22em] text-[#EA7600]">{eyebrow}</p>}<h1 className="text-2xl font-black tracking-tight text-slate-950 md:text-3xl">{title}</h1>{body&&<p className="mt-1 max-w-3xl text-sm text-slate-500">{body}</p>}</div>{actions}</header>; }
