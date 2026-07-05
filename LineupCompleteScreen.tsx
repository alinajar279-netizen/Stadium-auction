import React from 'react';
import { motion } from 'motion/react';
import { Check, RefreshCw, LogOut, Shield, Award } from 'lucide-react';
import { Lobby, MATCH_CONFIGS, FootballPlayer } from '../types';

interface PositionedPlayer {
  player: FootballPlayer;
  x: number;
  y: number;
}

interface LineupCompleteScreenProps {
  lobby: Lobby;
  isJudge: boolean;
  onCopyTeams?: () => void;
  onNewMatch?: () => void;
  onLeave?: () => void;
  copied?: boolean;
  isLoading?: boolean;
}

// Positioning logic to map players to realistic, non-overlapping coordinates on a vertical football pitch
const getVerticalPitchPlayers = (players: FootballPlayer[]): PositionedPlayer[] => {
  const result: PositionedPlayer[] = [];

  // Categorize into rows based on positions
  const gks: FootballPlayer[] = [];
  const defs: FootballPlayer[] = [];
  const mids: FootballPlayer[] = [];
  const atts: FootballPlayer[] = [];

  players.forEach(p => {
    const rawPos = p.position.toUpperCase();
    if (rawPos.includes('GK')) {
      gks.push(p);
    } else if (rawPos.includes('CB') || rawPos.includes('LB') || rawPos.includes('RB')) {
      defs.push(p);
    } else if (
      rawPos.includes('CM') ||
      rawPos.includes('DM') ||
      rawPos.includes('AM') ||
      rawPos.includes('LM') ||
      rawPos.includes('RM') ||
      rawPos.includes('MID')
    ) {
      mids.push(p);
    } else {
      // Striker, Center Forward, Wings, etc.
      atts.push(p);
    }
  });

  // Sorting columns left-to-right (LB/LM/LW on the left, CB/CM/ST in middle, RB/RM/RW on right)
  const getColWeight = (pos: string): number => {
    const p = pos.toUpperCase();
    if (p.includes('LB') || p.includes('LW') || p.includes('LM')) return 1;
    if (p.includes('RB') || p.includes('RW') || p.includes('RM')) return 3;
    return 2; // Central positions
  };

  const sortByPosition = (a: FootballPlayer, b: FootballPlayer) => {
    return getColWeight(a.position) - getColWeight(b.position);
  };

  defs.sort(sortByPosition);
  mids.sort(sortByPosition);
  atts.sort(sortByPosition);

  // Position assigner helper
  const assignPositions = (list: FootballPlayer[], y: number) => {
    const count = list.length;
    if (count === 0) return;

    list.forEach((p, idx) => {
      let x = 50;
      if (count === 1) {
        x = 50;
      } else if (count === 2) {
        x = idx === 0 ? 30 : 70;
      } else if (count === 3) {
        x = idx === 0 ? 20 : idx === 1 ? 50 : 80;
      } else if (count === 4) {
        x = idx === 0 ? 15 : idx === 1 ? 38 : idx === 2 ? 62 : 85;
      } else {
        // Safe spreading for higher counts
        x = 12 + (idx * 76) / (count - 1);
      }
      result.push({ player: p, x, y });
    });
  };

  // Vertical bands
  assignPositions(gks, 86);
  assignPositions(defs, 66);
  assignPositions(mids, 44);
  assignPositions(atts, 20);

  return result;
};

export default function LineupCompleteScreen({
  lobby,
  isJudge,
  onCopyTeams,
  onNewMatch,
  onLeave,
  copied = false,
  isLoading = false,
}: LineupCompleteScreenProps) {
  const matchType = lobby.matchType || '11v11';
  const config = MATCH_CONFIGS[matchType];
  const maxPlayers = config.maxPlayers;

  const teamAPlayers = lobby.teamAPlayers || [];
  const teamBPlayers = lobby.teamBPlayers || [];

  const positionedTeamA = getVerticalPitchPlayers(teamAPlayers);
  const positionedTeamB = getVerticalPitchPlayers(teamBPlayers);

  return (
    <div className="w-full flex flex-col space-y-6" id="lineup-complete-screen">
      
      {/* Visual State Announcement Banner */}
      <div className="p-6 rounded-3xl bg-emerald-500/[0.02] border border-emerald-500/20 text-center relative overflow-hidden">
        {/* Decorative corner glow */}
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold uppercase tracking-wider mb-2 animate-pulse">
          <Award className="w-3.5 h-3.5" />
          <span>Lineup Complete</span>
        </div>
        <h2 className="text-xl md:text-2xl font-black text-white font-display tracking-tight uppercase">
          Draft Complete & Rosters Locked
        </h2>
        <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
          Both teams have reached the required limit of {maxPlayers} players. No additional nominations or bidding are allowed.
        </p>
      </div>

      {/* Two Mini Pitches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        
        {/* Team A Pitch Card */}
        <div className="flex flex-col bg-white/[0.01] border border-white/5 p-4 rounded-3xl" id="team-a-pitch-container">
          {/* Header above pitch */}
          <div className="flex justify-between items-end mb-3">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500">Team A</span>
              <h4 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-500" />
                <span>{lobby.teamAName}</span>
              </h4>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500 block">Budget</span>
              <span className="text-sm font-mono font-bold text-emerald-400">{lobby.teamABudget ?? 500}M</span>
            </div>
          </div>
          <div className="text-xs text-neutral-400 font-mono mb-3">
            Players count: <strong className="text-white">{teamAPlayers.length} / {maxPlayers}</strong>
          </div>

          {/* Vertical Pitch */}
          <div className="relative w-full aspect-[3/4] bg-[#0E1513] rounded-2xl border border-emerald-500/15 overflow-hidden">
            {/* Grass texture pattern */}
            <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
              backgroundImage: 'repeating-linear-gradient(0deg, #10b981 0px, #10b981 30px, transparent 30px, transparent 60px)'
            }} />

            {/* Pitch Lines */}
            <div className="absolute inset-4 border border-emerald-500/15 pointer-events-none rounded" />
            
            {/* Center Halfway Line */}
            <div className="absolute inset-x-4 top-1/2 border-t border-emerald-500/15 -translate-y-1/2 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 w-[24%] aspect-square rounded-full border border-emerald-500/15 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full bg-emerald-500/30 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

            {/* Opponent's Penalty Box (Top) */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[55%] h-[16%] border border-emerald-500/15 border-t-0 pointer-events-none flex items-end justify-center">
              <div className="w-[50%] h-[40%] border border-emerald-500/15 border-t-0" />
            </div>

            {/* Own Penalty Box (Bottom) */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[55%] h-[16%] border border-emerald-500/15 border-b-0 pointer-events-none flex items-start justify-center">
              <div className="w-[50%] h-[40%] border border-emerald-500/15 border-b-0" />
            </div>

            {/* Team A Players Placed on Pitch */}
            {positionedTeamA.map((posPlayer, idx) => (
              <motion.div
                key={`${posPlayer.player.name}-${idx}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', delay: idx * 0.04 }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
                style={{ left: `${posPlayer.x}%`, top: `${posPlayer.y}%` }}
              >
                {/* Minimalist Player Card */}
                <div className="bg-[#0b0f0e]/95 backdrop-blur-xs border border-emerald-500/20 px-2 py-1 rounded-lg text-center shadow-lg w-[85px] sm:w-[100px] hover:border-emerald-400 transition-colors">
                  <span className="block text-[8px] sm:text-[9px] font-extrabold font-mono text-emerald-400 leading-none tracking-wider uppercase">
                    {posPlayer.player.position}
                  </span>
                  <span className="block text-[9px] sm:text-[10px] font-black text-gray-100 tracking-wide truncate mt-0.5">
                    {posPlayer.player.name}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Team B Pitch Card */}
        <div className="flex flex-col bg-white/[0.01] border border-white/5 p-4 rounded-3xl" id="team-b-pitch-container">
          {/* Header above pitch */}
          <div className="flex justify-between items-end mb-3">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500">Team B</span>
              <h4 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-cyan-500" />
                <span>{lobby.teamBName}</span>
              </h4>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500 block">Budget</span>
              <span className="text-sm font-mono font-bold text-cyan-400">{lobby.teamBBudget ?? 500}M</span>
            </div>
          </div>
          <div className="text-xs text-neutral-400 font-mono mb-3">
            Players count: <strong className="text-white">{teamBPlayers.length} / {maxPlayers}</strong>
          </div>

          {/* Vertical Pitch */}
          <div className="relative w-full aspect-[3/4] bg-[#0E1513] rounded-2xl border border-cyan-500/15 overflow-hidden">
            {/* Grass texture pattern */}
            <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
              backgroundImage: 'repeating-linear-gradient(0deg, #06b6d4 0px, #06b6d4 30px, transparent 30px, transparent 60px)'
            }} />

            {/* Pitch Lines */}
            <div className="absolute inset-4 border border-cyan-500/15 pointer-events-none rounded" />
            
            {/* Center Halfway Line */}
            <div className="absolute inset-x-4 top-1/2 border-t border-cyan-500/15 -translate-y-1/2 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 w-[24%] aspect-square rounded-full border border-cyan-500/15 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full bg-cyan-500/30 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

            {/* Opponent's Penalty Box (Top) */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[55%] h-[16%] border border-cyan-500/15 border-t-0 pointer-events-none flex items-end justify-center">
              <div className="w-[50%] h-[40%] border border-cyan-500/15 border-t-0" />
            </div>

            {/* Own Penalty Box (Bottom) */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[55%] h-[16%] border border-cyan-500/15 border-b-0 pointer-events-none flex items-start justify-center">
              <div className="w-[50%] h-[40%] border border-cyan-500/15 border-b-0" />
            </div>

            {/* Team B Players Placed on Pitch */}
            {positionedTeamB.map((posPlayer, idx) => (
              <motion.div
                key={`${posPlayer.player.name}-${idx}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', delay: idx * 0.04 }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
                style={{ left: `${posPlayer.x}%`, top: `${posPlayer.y}%` }}
              >
                {/* Minimalist Player Card */}
                <div className="bg-[#090e11]/95 backdrop-blur-xs border border-cyan-500/20 px-2 py-1 rounded-lg text-center shadow-lg w-[85px] sm:w-[100px] hover:border-cyan-400 transition-colors">
                  <span className="block text-[8px] sm:text-[9px] font-extrabold font-mono text-cyan-400 leading-none tracking-wider uppercase">
                    {posPlayer.player.position}
                  </span>
                  <span className="block text-[9px] sm:text-[10px] font-black text-gray-100 tracking-wide truncate mt-0.5">
                    {posPlayer.player.name}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

      </div>

      {/* Available Actions Footer */}
      <div className="pt-4 border-t border-white/5" id="lineup-actions-footer">
        {isJudge ? (
          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col sm:flex-row gap-3 items-center">
            <div className="text-left flex-1">
              <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-400 font-bold block">
                Judge Controls
              </span>
              <p className="text-xs text-neutral-400 mt-0.5">
                Manage final draft outputs, begin a new match layout, or return to the welcome desk.
              </p>
            </div>
            
            <div className="flex flex-wrap w-full sm:w-auto gap-2">
              <button
                id="copy-teams-btn-lineup"
                onClick={onCopyTeams}
                className="py-3 px-5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
              >
                <Check className="w-4 h-4" />
                <span>{copied ? 'Copied!' : 'Copy Teams'}</span>
              </button>

              {onNewMatch && (
                <button
                  id="new-match-btn-lineup"
                  onClick={onNewMatch}
                  disabled={isLoading}
                  className="py-3 px-5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-none disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>New Match</span>
                </button>
              )}

              {onLeave && (
                <button
                  id="exit-lobby-btn-lineup"
                  onClick={onLeave}
                  className="py-3 px-5 bg-white/5 hover:bg-white/10 border border-white/5 text-neutral-400 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Exit Lobby</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-center flex flex-col items-center justify-center gap-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-neutral-300 font-mono">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>Waiting for Judge...</span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Rosters are beautifully filled. View completed lineups above and wait for the Judge to take action.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
