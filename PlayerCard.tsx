import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Shield, Trophy } from 'lucide-react';
import { FootballPlayer } from '../types';

interface PlayerCardProps {
  player: FootballPlayer | null;
  customClass?: string;
}

export default function PlayerCard({ player, customClass = "" }: PlayerCardProps) {
  if (!player) {
    return (
      <div className={`aspect-[3/4] w-full max-w-[280px] rounded-3xl border-2 border-dashed border-white/10 bg-white/[0.01] flex flex-col items-center justify-center p-6 text-center ${customClass}`}>
        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-neutral-500 mb-4 animate-pulse">
          <Shield className="w-7 h-7" />
        </div>
        <p className="text-sm font-bold text-neutral-400 font-display uppercase tracking-wider">No Player Nominated</p>
        <p className="text-xs text-neutral-500 mt-1">Waiting for the Judge to select a player...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`relative aspect-[3/4] w-full max-w-[280px] rounded-3xl overflow-hidden border border-amber-500/30 bg-gradient-to-b from-[#1c1917] via-[#0c0a09] to-[#030201] shadow-2xl shadow-amber-500/5 flex flex-col group ${customClass}`}
    >
      {/* Glow Effects */}
      <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-amber-500/10 to-transparent pointer-events-none" />
      <div className="absolute -top-12 -left-12 w-24 h-24 bg-amber-500/20 blur-2xl pointer-events-none rounded-full" />
      <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-amber-500/10 blur-2xl pointer-events-none rounded-full" />

      {/* Futuristic Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none" 
        style={{ 
          backgroundImage: "linear-gradient(rgba(245, 158, 11, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(245, 158, 11, 0.1) 1px, transparent 1px)", 
          backgroundSize: "20px 20px" 
        }} 
      />

      {/* Silhouette Graphic Container */}
      <div className="flex-1 relative flex items-end justify-center pt-10 overflow-hidden">
        {/* Dynamic Glowing Halo behind player */}
        <div className="absolute bottom-1/4 w-32 h-32 rounded-full bg-gradient-to-tr from-amber-500/20 to-amber-600/5 blur-xl group-hover:scale-110 transition-transform duration-500" />
        
        {/* Sleek SVG Silhouette of a football player */}
        <svg 
          viewBox="0 0 100 100" 
          className="w-4/5 h-4/5 z-10 opacity-75 group-hover:scale-105 group-hover:opacity-85 transition-all duration-500"
          fill="url(#goldGradient)"
        >
          <defs>
            <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d97706" />
              <stop offset="50%" stopColor="#78350f" />
              <stop offset="100%" stopColor="#1e1b4b" />
            </linearGradient>
          </defs>
          {/* Detailed stylized footballer silhouette */}
          <path d="M50 15 C 53 15, 54 11, 51 9 C 48 7, 44 9, 46 12 C 47 14, 48 15, 50 15 Z 
                   M44 19 C 42 20, 39 21, 36 21 C 33 21, 30 23, 29 25 C 28 27, 30 29, 32 29 C 34 29, 37 26, 39 25 C 41 24, 42 22, 44 20 Z 
                   M53 17 C 50 17, 47 17, 45 18 L 41 24 L 38 31 L 40 45 L 34 56 C 33 58, 31 60, 27 63 C 24 65, 25 68, 28 67 C 32 66, 35 62, 37 59 L 41 52 L 44 58 L 41 71 L 38 84 C 37 87, 40 89, 42 87 C 44 85, 45 79, 46 75 L 48 64 L 54 62 L 61 74 C 63 77, 66 80, 71 81 C 74 82, 75 79, 72 78 C 68 76, 65 73, 63 69 L 57 57 L 55 46 C 56 42, 59 38, 62 34 C 65 30, 68 28, 72 27 C 75 26, 74 23, 71 23 C 67 23, 63 26, 59 30 C 56 33, 54 36, 53 40 L 51 30 L 53 17 Z" />
        </svg>

        {/* Small glowing soccer ball decoration */}
        <div className="absolute bottom-6 right-10 z-20 w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 to-amber-700 shadow-md shadow-amber-500/50 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-black/40 border border-amber-300/30" />
        </div>
      </div>

      {/* Premium Stats Box / Player Name Panel */}
      <div className="z-10 p-5 bg-[#0a0a0a]/90 border-t border-amber-500/20 backdrop-blur-md flex flex-col items-center">
        {/* Name Display */}
        <h3 className="text-base font-extrabold text-white text-center font-display tracking-tight leading-snug truncate w-full uppercase">
          {player.name}
        </h3>
        
        {/* Position Display */}
        <span className="text-[10px] font-black text-amber-500/90 tracking-[0.2em] font-mono mt-1 uppercase">
          {player.position}
        </span>
      </div>
    </motion.div>
  );
}
