import React from 'react';
import { Lobby, MATCH_CONFIGS } from '../types';
import { Shield, User } from 'lucide-react';

interface TeamPlayersListProps {
  lobby: Lobby;
}

export default function TeamPlayersList({ lobby }: TeamPlayersListProps) {
  const teamAPlayers = lobby.teamAPlayers || [];
  const teamBPlayers = lobby.teamBPlayers || [];
  const maxPlayers = MATCH_CONFIGS[lobby.matchType || '11v11'].maxPlayers;

  return (
    <div id="team-players-section" className="w-full bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 space-y-6">
      <div className="flex items-center gap-2.5 border-b border-white/5 pb-4">
        <Shield className="w-5 h-5 text-amber-400" />
        <h3 className="text-lg font-black text-white uppercase tracking-tight font-display">
          Team Rosters & Assigned Players
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Team A Roster */}
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-emerald-500/10 pb-2">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-emerald-400 uppercase tracking-wider font-mono">
                {lobby.teamAName || 'Team A'}
              </span>
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider font-mono mt-0.5">
                Budget: {lobby.teamABudget ?? 500}M
              </span>
            </div>
            <span className="text-xs font-mono text-neutral-500 font-bold">
              {teamAPlayers.length} / {maxPlayers} Players
            </span>
          </div>

          {teamAPlayers.length === 0 ? (
            <p className="text-xs text-neutral-600 italic font-mono py-2">
              No players assigned to this roster yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {teamAPlayers.map((player, idx) => (
                <li
                  key={`${player.name}-${idx}`}
                  className="flex justify-between items-center bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-white uppercase tracking-tight">
                      {player.name}
                    </span>
                  </div>
                  <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded uppercase font-mono">
                    {player.position}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Team B Roster */}
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-cyan-500/10 pb-2">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-cyan-400 uppercase tracking-wider font-mono">
                {lobby.teamBName || 'Team B'}
              </span>
              <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-wider font-mono mt-0.5">
                Budget: {lobby.teamBBudget ?? 500}M
              </span>
            </div>
            <span className="text-xs font-mono text-neutral-500 font-bold">
              {teamBPlayers.length} / {maxPlayers} Players
            </span>
          </div>

          {teamBPlayers.length === 0 ? (
            <p className="text-xs text-neutral-600 italic font-mono py-2">
              No players assigned to this roster yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {teamBPlayers.map((player, idx) => (
                <li
                  key={`${player.name}-${idx}`}
                  className="flex justify-between items-center bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-white uppercase tracking-tight">
                      {player.name}
                    </span>
                  </div>
                  <span className="text-[10px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-bold px-2 py-0.5 rounded uppercase font-mono">
                    {player.position}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
