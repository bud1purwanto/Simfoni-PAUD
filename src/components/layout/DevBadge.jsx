import React from 'react';
import { Terminal } from 'lucide-react';

export default function DevBadge() {
  const isDev = import.meta.env.VITE_APP_ENV !== 'production';

  if (!isDev) return null;

  return (
    <div className="fixed bottom-24 md:bottom-4 right-4 z-40 pointer-events-none select-none">
      <div className="bg-amber-400/90 text-amber-950 backdrop-blur-sm border border-amber-500/30 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md flex items-center space-x-1.5 uppercase tracking-wider">
        <Terminal className="w-3 h-3 text-amber-900" />
        <span>DEV ENVIRONMENT</span>
      </div>
    </div>
  );
}

