import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Player } from '../types';
import { Flame, Shield, Users } from 'lucide-react';

interface FootballPitchProps {
  players: Player[];
  teamAName: string;
  teamBName: string;
  activePlayerId: string;
  onSelectTeam: (team: 'A' | 'B' | null) => void;
  matchType?: '5v5' | '7v7' | '11v11';
}

export default function FootballPitch({
  players,
  teamAName,
  teamBName,
  activePlayerId,
  onSelectTeam,
  matchType,
}: FootballPitchProps) {
  // Categorize players
  const teamAPlayers = players.filter((p) => p.team === 'A');
  const teamBPlayers = players.filter((p) => p.team === 'B');
  const benchedPlayers = players.filter((p) => p.team === null);

  // Form positions dynamically based on matchType and player index
  const getFormationCoords = (index: number, total: number, isTeamA: boolean) => {
    if (total === 0) return { x: 0, y: 0 };

    const type = matchType || '11v11';

    // Formations mappings: [X percentage (0-100), Y percentage (0-100)] for Team A (left)
    // Team B coordinates are calculated as (100 - X, Y) to mirror properly across halfway line
    let coords = { x: 25, y: 50 }; // Default middle fallback

    if (type === '5v5') {
      // 5-a-side layout (1-2-1-1 diamond formation)
      const positions5v5 = [
        { x: 10, y: 50 }, // Goalkeeper
        { x: 22, y: 25 }, // Defender Left
        { x: 22, y: 75 }, // Defender Right
        { x: 34, y: 50 }, // Midfielder
        { x: 44, y: 50 }, // Forward
      ];
      coords = positions5v5[index % 5];
    } else if (type === '7v7') {
      // 7-a-side layout (1-3-2-1 tree formation)
      const positions7v7 = [
        { x: 10, y: 50 }, // Goalkeeper
        { x: 22, y: 20 }, // Defender Left
        { x: 22, y: 50 }, // Defender Center
        { x: 22, y: 80 }, // Defender Right
        { x: 35, y: 30 }, // Midfielder Left
        { x: 35, y: 70 }, // Midfielder Right
        { x: 44, y: 50 }, // Forward
      ];
      coords = positions7v7[index % 7];
    } else {
      // 11-a-side layout (1-4-3-3 attacking formation)
      const positions11v11 = [
        { x: 8,  y: 50 }, // Goalkeeper
        { x: 18, y: 15 }, // Defender Left Back
        { x: 18, y: 38 }, // Defender Center Left
        { x: 18, y: 62 }, // Defender Center Right
        { x: 18, y: 85 }, // Defender Right Back
        { x: 32, y: 25 }, // Midfielder Left
        { x: 32, y: 50 }, // Midfielder Center
        { x: 32, y: 75 }, // Midfielder Right
        { x: 44, y: 20 }, // Forward Left Wing
        { x: 44, y: 50 }, // Forward Center
        { x: 44, y: 80 }, // Forward Right Wing
      ];
      coords = positions11v11[index % 11];
    }

    if (!isTeamA) {
      return { x: 100 - coords.x, y: coords.y };
    }
    return coords;
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Tactical Stadium Pitch Container */}
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-[#0E1513] rounded-2xl border-2 border-pitch-700/50 shadow-2xl overflow-hidden shadow-neon-pitch/5">
        
        {/* Grass texture pattern / lines */}
        <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
          backgroundImage: 'repeating-linear-gradient(90deg, #10b981 0px, #10b981 40px, transparent 40px, transparent 80px)'
        }} />

        {/* Outer pitch border lines */}
        <div className="absolute inset-3 border border-emerald-500/25 pointer-events-none rounded-lg" />
        
        {/* Halfway Line */}
        <div className="absolute inset-y-3 left-1/2 border-l border-emerald-500/25 -translate-x-1/2 pointer-events-none" />
        
        {/* Center Circle */}
        <div className="absolute top-1/2 left-1/2 w-[24%] aspect-square rounded-full border border-emerald-500/25 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full bg-emerald-500/45 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

        {/* Penalty Box Left (Team A) */}
        <div className="absolute top-1/4 left-3 w-[15%] h-1/2 border border-emerald-500/25 border-l-0 pointer-events-none flex items-center justify-end">
          <div className="w-[40%] h-[50%] border border-emerald-500/25 border-l-0" />
        </div>
        <div className="absolute top-1/2 left-[18%] w-1.5 h-1.5 rounded-full bg-emerald-500/35 -translate-y-1/2 pointer-events-none" />

        {/* Penalty Box Right (Team B) */}
        <div className="absolute top-1/4 right-3 w-[15%] h-1/2 border border-emerald-500/25 border-r-0 pointer-events-none flex items-center justify-start">
          <div className="w-[40%] h-[50%] border border-emerald-500/25 border-r-0" />
        </div>
        <div className="absolute top-1/2 right-[18%] w-1.5 h-1.5 rounded-full bg-emerald-500/35 -translate-y-1/2 pointer-events-none" />

        {/* Interactive team selection triggers behind the pitch */}
        <div className="absolute inset-0 flex">
          {/* Join Team A Trigger zone */}
          <button 
            id="join-team-a-trigger"
            onClick={() => onSelectTeam('A')}
            className="w-1/2 h-full flex flex-col justify-start p-4 hover:bg-emerald-500/[0.02] active:bg-emerald-500/[0.04] transition-colors text-left group relative"
          >
            <div className="flex items-center gap-2 text-white/50 group-hover:text-neon-pitch transition-colors">
              <Shield className="w-4 h-4 text-emerald-500/80" />
              <span className="font-display font-bold uppercase text-xs tracking-wider">{teamAName || 'Team A'}</span>
            </div>
            <span className="text-[10px] text-gray-500 uppercase font-mono mt-1 group-hover:text-emerald-500/60 transition-colors">
              Click field to join
            </span>
          </button>

          {/* Join Team B Trigger zone */}
          <button 
            id="join-team-b-trigger"
            onClick={() => onSelectTeam('B')}
            className="w-1/2 h-full flex flex-col justify-start items-end p-4 hover:bg-emerald-500/[0.02] active:bg-emerald-500/[0.04] transition-colors text-right group relative"
          >
            <div className="flex items-center gap-2 text-white/50 group-hover:text-neon-pitch transition-colors">
              <span className="font-display font-bold uppercase text-xs tracking-wider">{teamBName || 'Team B'}</span>
              <Shield className="w-4 h-4 text-amber-500/80" />
            </div>
            <span className="text-[10px] text-gray-500 uppercase font-mono mt-1 group-hover:text-emerald-500/60 transition-colors">
              Click field to join
            </span>
          </button>
        </div>

        {/* Players Placed on the Pitch */}
        <AnimatePresence>
          {teamAPlayers.map((player, index) => {
            const coords = getFormationCoords(index, teamAPlayers.length, true);
            const isActive = player.id === activePlayerId;
            return (
              <motion.div
                key={player.id}
                initial={{ scale: 0, opacity: 0, y: 100 }}
                animate={{ scale: 1, opacity: 1, x: `${coords.x}%`, y: `${coords.y}%` }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 15, stiffness: 120 }}
                className="absolute -ml-6 -mt-6 flex flex-col items-center justify-center z-10 cursor-pointer pointer-events-none"
                style={{ left: 0, top: 0 }}
              >
                {/* Jersey Avatar */}
                <div className={`relative w-10 h-10 rounded-full flex items-center justify-center font-mono text-sm font-extrabold border-2 shadow-lg
                  ${isActive 
                    ? 'bg-emerald-500 border-neon-pitch text-pitch-950 scale-110 shadow-neon-pitch/30 animate-pulse' 
                    : 'bg-emerald-950/90 border-emerald-500/80 text-neon-pitch'
                  }`}
                >
                  {index + 1}
                  {isActive && (
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-neon-gold text-pitch-950 rounded-full flex items-center justify-center text-[8px] font-bold">
                      YOU
                    </div>
                  )}
                </div>
                {/* Name Tag */}
                <span className={`mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide shadow-md max-w-[80px] truncate
                  ${isActive 
                    ? 'bg-emerald-500 text-pitch-950 font-extrabold' 
                    : 'bg-pitch-950/90 border border-emerald-900/40 text-gray-200'
                  }`}
                >
                  {player.name}
                </span>
              </motion.div>
            );
          })}

          {teamBPlayers.map((player, index) => {
            const coords = getFormationCoords(index, teamBPlayers.length, false);
            const isActive = player.id === activePlayerId;
            return (
              <motion.div
                key={player.id}
                initial={{ scale: 0, opacity: 0, y: 100 }}
                animate={{ scale: 1, opacity: 1, x: `${coords.x}%`, y: `${coords.y}%` }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 15, stiffness: 120 }}
                className="absolute -ml-6 -mt-6 flex flex-col items-center justify-center z-10 cursor-pointer pointer-events-none"
                style={{ left: 0, top: 0 }}
              >
                {/* Jersey Avatar */}
                <div className={`relative w-10 h-10 rounded-full flex items-center justify-center font-mono text-sm font-extrabold border-2 shadow-lg
                  ${isActive 
                    ? 'bg-amber-500 border-neon-gold text-pitch-950 scale-110 shadow-neon-gold/30 animate-pulse' 
                    : 'bg-amber-950/90 border-amber-500/80 text-neon-gold'
                  }`}
                >
                  {index + 1}
                  {isActive && (
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-neon-pitch text-pitch-950 rounded-full flex items-center justify-center text-[8px] font-bold">
                      YOU
                    </div>
                  )}
                </div>
                {/* Name Tag */}
                <span className={`mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide shadow-md max-w-[80px] truncate
                  ${isActive 
                    ? 'bg-amber-500 text-pitch-950 font-extrabold' 
                    : 'bg-pitch-950/90 border border-amber-900/40 text-gray-200'
                  }`}
                >
                  {player.name}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Substitutes Bench / Unassigned Players */}
      <div className="glass-panel rounded-xl p-4 border border-pitch-700/50 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <h3 className="font-display font-semibold text-xs text-gray-400 uppercase tracking-wider">
              Lobby Substitutes & Bench ({benchedPlayers.length})
            </h3>
          </div>
          {benchedPlayers.some(p => p.id === activePlayerId) ? (
            <span className="text-[10px] font-mono text-neon-pitch uppercase animate-pulse">
              You are currently on the bench
            </span>
          ) : (
            <button
              id="bench-me-button"
              onClick={() => onSelectTeam(null)}
              className="text-[10px] font-mono font-bold text-gray-400 hover:text-white transition-colors bg-pitch-800 hover:bg-pitch-700 px-2.5 py-1 rounded border border-white/5 uppercase"
            >
              Move to Bench
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 min-h-8">
          <AnimatePresence>
            {benchedPlayers.length === 0 ? (
              <p className="text-xs text-gray-500 italic flex items-center gap-1.5 py-1">
                <Flame className="w-3.5 h-3.5 text-gray-600" />
                Everyone is on the pitch! Perfect deployment.
              </p>
            ) : (
              benchedPlayers.map((player) => {
                const isActive = player.id === activePlayerId;
                return (
                  <motion.div
                    key={player.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                      ${isActive 
                        ? 'bg-pitch-700 border-neon-pitch/50 text-white font-semibold shadow-inner shadow-neon-pitch/5' 
                        : 'bg-pitch-900/60 border-pitch-800 text-gray-300'
                      }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-neon-pitch animate-pulse' : 'bg-gray-600'}`} />
                    <span>{player.name}</span>
                    {isActive && (
                      <span className="text-[8px] uppercase font-mono px-1 bg-neon-pitch text-pitch-950 font-bold rounded">
                        You
                      </span>
                    )}
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
