import React from 'react';
import { Terminal } from 'lucide-react';

export default function DevBadge() {
  const isDev = import.meta.env.VITE_APP_ENV !== 'production';

  if (!isDev) return null;

  return (
    <div className="fixed top-16 right-3 z-20 pointer-events-none select-none opacity-85 hover:opacity-100 transition">
      <div className="bg-amber-400/90 text-amber-950 backdrop-blur-sm border border-amber-500/40 text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm flex items-center space-x-1 uppercase tracking-wider">
        <Terminal className="w-2.5 h-2.5 text-amber-900" />
        <span>DEV ENV</span>
      </div>
    </div>
  );
}

