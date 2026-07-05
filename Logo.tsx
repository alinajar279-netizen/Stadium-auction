import React from 'react';
import { Trophy } from 'lucide-react';

export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  const glowSizes = {
    sm: 'blur-[2px]',
    md: 'blur-[4px]',
    lg: 'blur-[8px]',
  };

  return (
    <div className="flex items-center gap-3 font-display select-none">
      <div className="relative flex items-center justify-center">
        {/* Glowing aura */}
        <div className={`absolute inset-0 rounded-xl bg-neon-pitch/30 opacity-75 ${glowSizes[size]} animate-pulse`} />
        
        {/* Shield Icon container */}
        <div className="relative glass-panel rounded-xl p-2 border border-neon-pitch/30 bg-pitch-900/80">
          <Trophy className={`${iconSizes[size]} text-neon-pitch`} />
        </div>
      </div>
      
      <div className="flex flex-col">
        <h1 className={`${textSizes[size]} font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-100 to-neon-pitch`}>
          STADIUM<span className="text-neon-pitch">.</span>
        </h1>
        <span className="text-[10px] uppercase tracking-[0.3em] font-mono text-neon-gold/80 -mt-1 font-bold">
          Draft Arena
        </span>
      </div>
    </div>
  );
}
