import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Eye, EyeOff, Play, Power, Shield, Users, RefreshCw, LogOut, Check, AlertTriangle } from 'lucide-react';
import { Lobby, FootballPlayer, MATCH_CONFIGS } from '../types';
import { POPULAR_PLAYERS } from '../data/players';
import PlayerCard from './PlayerCard';
import TeamPlayersList from './TeamPlayersList';
import LineupCompleteScreen from './LineupCompleteScreen';

interface JudgeAuctionRoomProps {
  lobby: Lobby;
  onUpdatePlayers: (active: FootballPlayer | null, hidden: FootballPlayer | null) => Promise<void>;
  onSetAuctionStatus: (status: 'waiting' | 'running' | 'finished', auctionMode?: 'public' | 'hidden') => Promise<void>;
  onLeave: () => void;
  isLoading: boolean;
  onRevealHiddenResults?: () => Promise<void>;
  onResolveHiddenTie?: (action: 'restart' | 'manual', manualWinner?: 'A' | 'B') => Promise<void>;
  onNewMatch?: () => Promise<void>;
}

export default function JudgeAuctionRoom({
  lobby,
  onUpdatePlayers,
  onSetAuctionStatus,
  onLeave,
  isLoading,
  onRevealHiddenResults,
  onResolveHiddenTie,
  onNewMatch
}: JudgeAuctionRoomProps) {
  // Mode toggle state: 'public' | 'hidden'
  const [selectedMode, setSelectedMode] = useState<'public' | 'hidden'>('public');
  const [copied, setCopied] = useState(false);

  const handleCopyTeams = () => {
    const teamAPlayers = lobby.teamAPlayers || [];
    const teamBPlayers = lobby.teamBPlayers || [];
    
    let text = `🏆 DRAFT FINAL ROSTERS 🏆\n\n`;
    text += `⚽ ${lobby.teamAName} ⚽\n`;
    if (teamAPlayers.length === 0) text += `(No players drafted)\n`;
    else teamAPlayers.forEach((p, i) => { text += `${i+1}. ${p.name} (${p.position})\n`; });
    
    text += `\n⚽ ${lobby.teamBName} ⚽\n`;
    if (teamBPlayers.length === 0) text += `(No players drafted)\n`;
    else teamBPlayers.forEach((p, i) => { text += `${i+1}. ${p.name} (${p.position})\n`; });
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Autocomplete state for Visible search
  const [visibleSearchQuery, setVisibleSearchQuery] = useState(lobby.activePlayer?.name || '');
  const [showVisibleSuggestions, setShowVisibleSuggestions] = useState(false);
  const visibleRef = useRef<HTMLDivElement>(null);

  // Autocomplete state for Hidden search
  const [hiddenSearchQuery, setHiddenSearchQuery] = useState(lobby.hiddenPlayer?.name || '');
  const [showHiddenSuggestions, setShowHiddenSuggestions] = useState(false);
  const hiddenRef = useRef<HTMLDivElement>(null);

  // Sync state if lobby updates from outside (e.g. initial load or state refresh)
  useEffect(() => {
    if (lobby.activePlayer) {
      setVisibleSearchQuery(lobby.activePlayer.name);
    } else {
      setVisibleSearchQuery('');
    }
  }, [lobby.activePlayer?.name]);

  useEffect(() => {
    if (lobby.hiddenPlayer) {
      setHiddenSearchQuery(lobby.hiddenPlayer.name);
    } else {
      setHiddenSearchQuery('');
    }
  }, [lobby.hiddenPlayer?.name]);

  // Click outside to close suggestion dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (visibleRef.current && !visibleRef.current.contains(event.target as Node)) {
        setShowVisibleSuggestions(false);
      }
      if (hiddenRef.current && !hiddenRef.current.contains(event.target as Node)) {
        setShowHiddenSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const isPlayerUsed = (name: string): boolean => {
    const cleanName = name.trim().toLowerCase();
    
    // Check currently active / nominated players
    if (lobby.activePlayer && lobby.activePlayer.name.toLowerCase() === cleanName) {
      return true;
    }
    if (lobby.hiddenPlayer && lobby.hiddenPlayer.name.toLowerCase() === cleanName) {
      return true;
    }
    
    // Check if already in Team A or Team B rosters
    if (lobby.teamAPlayers && lobby.teamAPlayers.some(p => p.name.toLowerCase() === cleanName)) {
      return true;
    }
    if (lobby.teamBPlayers && lobby.teamBPlayers.some(p => p.name.toLowerCase() === cleanName)) {
      return true;
    }
    
    // Check history (all previously nominated and finished/won/skipped players)
    if (lobby.history && lobby.history.some(h => 
      (h.visiblePlayer && h.visiblePlayer.name.toLowerCase() === cleanName) ||
      (h.hiddenPlayer && h.hiddenPlayer.name.toLowerCase() === cleanName)
    )) {
      return true;
    }
    
    return false;
  };

  // Filter recommendations (fast, case-insensitive, ignores used players)
  const visibleSuggestions = POPULAR_PLAYERS.filter(p =>
    p.name.toLowerCase().includes(visibleSearchQuery.toLowerCase()) &&
    !isPlayerUsed(p.name)
  ).slice(0, 5);

  const hiddenSuggestions = POPULAR_PLAYERS.filter(p =>
    p.name.toLowerCase().includes(hiddenSearchQuery.toLowerCase()) &&
    !isPlayerUsed(p.name)
  ).slice(0, 5);

  // Nomination trigger
  const handleSelectVisible = async (player: FootballPlayer | null) => {
    setShowVisibleSuggestions(false);
    if (player) {
      if (isPlayerUsed(player.name)) {
        setVisibleSearchQuery(lobby.activePlayer?.name || '');
        return;
      }
      setVisibleSearchQuery(player.name);
    } else {
      setVisibleSearchQuery('');
    }
    await onUpdatePlayers(player, lobby.hiddenPlayer || null);
  };

  const handleSelectHidden = async (player: FootballPlayer | null) => {
    setShowHiddenSuggestions(false);
    if (player) {
      if (isPlayerUsed(player.name)) {
        setHiddenSearchQuery(lobby.hiddenPlayer?.name || '');
        return;
      }
      setHiddenSearchQuery(player.name);
    } else {
      setHiddenSearchQuery('');
    }
    await onUpdatePlayers(lobby.activePlayer || null, player);
  };

  // Custom nomination on typing enter or search blur
  const handleCustomVisibleEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visibleSearchQuery.trim()) {
      await handleSelectVisible(null);
      return;
    }
    // Check if matches an existing popular player
    const matched = POPULAR_PLAYERS.find(p => p.name.toLowerCase() === visibleSearchQuery.trim().toLowerCase());
    if (matched && isPlayerUsed(matched.name)) {
      setVisibleSearchQuery(lobby.activePlayer?.name || '');
      return;
    }
    const nominated = matched || { name: visibleSearchQuery.trim(), position: "Forward" };
    await handleSelectVisible(nominated);
  };

  const handleCustomHiddenEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hiddenSearchQuery.trim()) {
      await handleSelectHidden(null);
      return;
    }
    // Check if matches an existing popular player
    const matched = POPULAR_PLAYERS.find(p => p.name.toLowerCase() === hiddenSearchQuery.trim().toLowerCase());
    if (matched && isPlayerUsed(matched.name)) {
      setHiddenSearchQuery(lobby.hiddenPlayer?.name || '');
      return;
    }
    const nominated = matched || { name: hiddenSearchQuery.trim(), position: "Forward" };
    await handleSelectHidden(nominated);
  };

  // Status mapping for the 4 distinct states
  const currentStatus = lobby.auctionStatus || 'waiting';

  let displayLabel = "Waiting";
  let displayColor = "text-amber-400 bg-amber-400/10 border-amber-500/20";
  let displayGlow = "bg-amber-400";
  let displayDesc = "Waiting for players to be nominated.";

  if (currentStatus === 'waiting') {
    displayLabel = "Waiting";
    displayColor = "text-amber-400 bg-amber-400/10 border-amber-500/20";
    displayGlow = "bg-amber-400";
    displayDesc = "Judge is selecting players. Teams cannot bid.";
  } else if (currentStatus === 'running' && !lobby.winnerTeam) {
    if (lobby.auctionMode === 'hidden') {
      displayLabel = "Hidden Auction";
      displayColor = "text-cyan-400 bg-cyan-400/10 border-cyan-500/20 shadow-lg shadow-cyan-500/5";
      displayGlow = "bg-cyan-500 animate-pulse";
      displayDesc = "Secret blind bidding in progress. Awaiting team submissions.";
    } else {
      displayLabel = "Live Auction";
      displayColor = "text-emerald-400 bg-emerald-400/10 border-emerald-500/20 shadow-lg shadow-emerald-500/5";
      displayGlow = "bg-emerald-500 animate-pulse";
      displayDesc = "Teams may bid.";
    }
  } else if (currentStatus === 'running' && lobby.winnerTeam) {
    displayLabel = "Winner Decided";
    displayColor = "text-amber-400 bg-amber-400/10 border-amber-500/20 shadow-lg shadow-amber-500/5";
    displayGlow = "bg-amber-400 animate-pulse";
    displayDesc = "A team has left. Waiting for Judge to click Finish.";
  } else if (currentStatus === 'finished') {
    displayLabel = "Finished";
    displayColor = "text-rose-400 bg-rose-400/10 border-rose-500/20";
    displayGlow = "bg-rose-500";
    displayDesc = "Auction completed. Waiting for Judge to start next auction.";
  }

  if (lobby.matchFinished) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-6">
        <LineupCompleteScreen
          lobby={lobby}
          isJudge={true}
          onCopyTeams={handleCopyTeams}
          onNewMatch={onNewMatch}
          onLeave={onLeave}
          copied={copied}
          isLoading={isLoading}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 flex flex-col space-y-6">
      
      {/* Header Info Dashboard Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white/[0.02] border border-white/5 p-5 rounded-3xl">
        {/* Arena Summary */}
        <div className="flex flex-col justify-center">
          <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-neutral-500">Arena Coordinates</span>
          <span className="text-xl font-mono font-black text-white tracking-widest flex items-center gap-2 mt-0.5">
            #{lobby.code}
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          </span>
          <p className="text-xs text-neutral-400 mt-1">
            Format: <span className="text-white font-semibold">{lobby.matchType || '11v11'}</span>
          </p>
        </div>

        {/* Draft Round Status */}
        <div className="flex flex-col justify-center border-l border-white/5 pl-0 md:pl-6">
          <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-neutral-500">Draft Progression</span>
          <span className="text-lg font-mono font-black text-white mt-1 uppercase">
            {lobby.matchFinished ? "MATCH COMPLETED" : `Round: ${lobby.currentRound ?? 1} / ${MATCH_CONFIGS[lobby.matchType || '11v11'].maxRounds}`}
          </span>
          <p className="text-xs text-neutral-400 mt-1">
            Limit: <strong className="text-neutral-300">{MATCH_CONFIGS[lobby.matchType || '11v11'].maxPlayers} Players max</strong>
          </p>
        </div>

        {/* Budgets & Competitors */}
        <div className="grid grid-cols-2 gap-4 border-l border-white/5 pl-0 md:pl-6">
          {/* Team A stats */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 relative overflow-hidden">
            <div className="absolute right-2 top-2 w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="block text-[8px] uppercase tracking-wider text-neutral-400 font-mono font-bold truncate">
              {lobby.teamAName}
            </span>
            <span className="block text-base font-black text-white font-mono mt-0.5">
              {lobby.teamABudget ?? 500}M <span className="text-[8px] text-neutral-500 font-normal">budget</span>
            </span>
          </div>

          {/* Team B stats */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 relative overflow-hidden">
            <div className="absolute right-2 top-2 w-1.5 h-1.5 rounded-full bg-cyan-500" />
            <span className="block text-[8px] uppercase tracking-wider text-neutral-400 font-mono font-bold truncate">
              {lobby.teamBName}
            </span>
            <span className="block text-base font-black text-white font-mono mt-0.5">
              {lobby.teamBBudget ?? 500}M <span className="text-[8px] text-neutral-500 font-normal">budget</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Interactive Workstation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Hand: Controls & Nominations (7 Cols) */}
        <div className="lg:col-span-7 space-y-6 flex flex-col justify-between">
          
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-extrabold text-white font-display tracking-tight uppercase">
                Judge Command Desk
              </h2>
              {/* Dynamic Status Indicator */}
              <div className={`px-3 py-1 rounded-full border text-xs font-semibold flex items-center gap-1.5 ${displayColor}`}>
                <span className={`w-2 h-2 rounded-full ${displayGlow}`} />
                <span>Status: {displayLabel}</span>
              </div>
            </div>

            {/* 1. Large Search Box: Visible Player */}
            <div ref={visibleRef} className="space-y-2 relative">
              <div className="flex justify-between items-center">
                <label className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> Visible Auction Player
                </label>
                {lobby.activePlayer && currentStatus === 'waiting' && (
                  <button
                    onClick={() => handleSelectVisible(null)}
                    className="text-[10px] uppercase font-mono text-neutral-500 hover:text-white transition-colors cursor-pointer"
                  >
                    [Clear Nomination]
                  </button>
                )}
              </div>

              <form onSubmit={handleCustomVisibleEnter} className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  placeholder={currentStatus === 'waiting' ? "Search and Nominate a player (e.g. Haaland)..." : "Player nomination locked"}
                  value={visibleSearchQuery}
                  onChange={(e) => {
                    setVisibleSearchQuery(e.target.value);
                    setShowVisibleSuggestions(true);
                  }}
                  onFocus={() => setShowVisibleSuggestions(true)}
                  disabled={currentStatus !== 'waiting' || isLoading}
                  className="w-full bg-white/[0.02] border border-white/10 rounded-2xl pl-11 pr-24 py-4 text-sm font-medium focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.04] transition-all text-white disabled:opacity-40 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={currentStatus !== 'waiting' || isLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Set Visible
                </button>
              </form>

              {/* Suggestions Overlay */}
              <AnimatePresence>
                {showVisibleSuggestions && visibleSearchQuery.trim() && visibleSuggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute z-30 left-0 right-0 top-[calc(100%+4px)] bg-[#111111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden divide-y divide-white/5"
                  >
                    {visibleSuggestions.map((player) => (
                      <button
                        key={player.name}
                        type="button"
                        onClick={() => handleSelectVisible(player)}
                        className="w-full text-left px-5 py-3.5 hover:bg-white/5 transition-colors flex justify-between items-center cursor-pointer group"
                      >
                        <div>
                          <span className="block text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                            {player.name}
                          </span>
                          <span className="block text-[10px] text-neutral-500 uppercase font-mono mt-0.5">
                            {player.position}
                          </span>
                        </div>
                        <Check className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 2. Large Search Box: Hidden Player */}
            <div ref={hiddenRef} className="space-y-2 relative">
              <div className="flex justify-between items-center">
                <label className="text-[10px] uppercase font-bold tracking-widest text-cyan-400 flex items-center gap-1.5">
                  <EyeOff className="w-3.5 h-3.5" /> Hidden Player <span className="text-[8px] text-neutral-500 font-normal font-mono lowercase border border-white/5 px-1.5 py-0.5 rounded bg-white/5 ml-1.5">[Judge Only View]</span>
                </label>
                {lobby.hiddenPlayer && currentStatus === 'waiting' && (
                  <button
                    onClick={() => handleSelectHidden(null)}
                    className="text-[10px] uppercase font-mono text-neutral-500 hover:text-white transition-colors cursor-pointer"
                  >
                    [Clear Secret]
                  </button>
                )}
              </div>

              <form onSubmit={handleCustomHiddenEnter} className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  placeholder={currentStatus === 'waiting' ? "Search and Lock in a secret player..." : "Hidden nomination locked"}
                  value={hiddenSearchQuery}
                  onChange={(e) => {
                    setHiddenSearchQuery(e.target.value);
                    setShowHiddenSuggestions(true);
                  }}
                  onFocus={() => setShowHiddenSuggestions(true)}
                  disabled={currentStatus !== 'waiting' || isLoading}
                  className="w-full bg-white/[0.02] border border-white/10 rounded-2xl pl-11 pr-24 py-4 text-sm font-medium focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.04] transition-all text-white disabled:opacity-40 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={currentStatus !== 'waiting' || isLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Set Hidden
                </button>
              </form>

              {/* Suggestions Overlay */}
              <AnimatePresence>
                {showHiddenSuggestions && hiddenSearchQuery.trim() && hiddenSuggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute z-30 left-0 right-0 top-[calc(100%+4px)] bg-[#111111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden divide-y divide-white/5"
                  >
                    {hiddenSuggestions.map((player) => (
                      <button
                        key={player.name}
                        type="button"
                        onClick={() => handleSelectHidden(player)}
                        className="w-full text-left px-5 py-3.5 hover:bg-white/5 transition-colors flex justify-between items-center cursor-pointer group"
                      >
                        <div>
                          <span className="block text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">
                            {player.name}
                          </span>
                          <span className="block text-[10px] text-neutral-500 uppercase font-mono mt-0.5">
                            {player.position}
                          </span>
                        </div>
                        <Check className="w-4 h-4 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Action Trigger Buttons Section */}
          <div className="space-y-4 pt-6 border-t border-white/5">
            {/* Start Auction Mode Selection */}
            {currentStatus === 'waiting' && (
              <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl space-y-3">
                <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 font-mono block">
                  Select Auction Mode
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedMode('public')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedMode === 'public'
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-white shadow-md'
                        : 'bg-transparent border-white/5 text-neutral-500 hover:border-white/10'
                    }`}
                  >
                    <span className="block text-xs font-bold uppercase">Public Auction</span>
                    <span className="block text-[9px] text-neutral-400 mt-0.5 leading-tight">Live bids, standard incremental process.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMode('hidden')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedMode === 'hidden'
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-white shadow-md'
                        : 'bg-transparent border-white/5 text-neutral-500 hover:border-white/10'
                    }`}
                  >
                    <span className="block text-xs font-bold uppercase">Hidden Auction</span>
                    <span className="block text-[9px] text-neutral-400 mt-0.5 leading-tight">Secret blind bidding. 3 attempts max.</span>
                  </button>
                </div>

                {selectedMode === 'hidden' && !lobby.hiddenPlayer && (
                  <p className="text-[10px] text-cyan-400 font-medium font-mono leading-tight">
                    ℹ️ A Hidden Player must also be nominated below to start a Hidden Auction.
                  </p>
                )}
              </div>
            )}

            {/* Tie Detected Resolution Widget */}
            {lobby.tieDetected && (
              <div className="p-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-4 shadow-xl">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-sm font-black text-white uppercase tracking-tight font-display">
                      Tie Detected!
                    </h4>
                    <p className="text-[11px] text-neutral-400">
                      Both teams submitted the exact same final bid.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1.5 text-left">
                  <button
                    onClick={() => onResolveHiddenTie?.('restart')}
                    disabled={isLoading}
                    className="py-3 px-4 rounded-xl border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer bg-transparent active:scale-95"
                  >
                    🔄 Restart Auction
                  </button>
                  <div className="flex flex-col gap-2">
                    <span className="text-[9px] uppercase font-mono text-neutral-500 font-bold">
                      Pick Winner Manually:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => onResolveHiddenTie?.('manual', 'A')}
                        disabled={isLoading}
                        className="py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[10px] uppercase tracking-wider rounded-lg transition-transform active:scale-95 cursor-pointer"
                      >
                        {lobby.teamAName}
                      </button>
                      <button
                        onClick={() => onResolveHiddenTie?.('manual', 'B')}
                        disabled={isLoading}
                        className="py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-[10px] uppercase tracking-wider rounded-lg transition-transform active:scale-95 cursor-pointer"
                      >
                        {lobby.teamBName}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {lobby.matchFinished ? (
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-emerald-500/20 space-y-4">
                  <div className="text-center space-y-1">
                    <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-400 font-bold block">
                      🏆 MATCH COMPLETED
                    </span>
                    <h3 className="text-base font-extrabold text-white font-display">Final Rosters Decided!</h3>
                    <p className="text-xs text-neutral-400">All draft rounds are fully completed.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <button
                      id="copy-teams-btn"
                      onClick={handleCopyTeams}
                      className="w-full py-3.5 px-4 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>{copied ? 'Teams Copied!' : 'Copy Teams'}</span>
                    </button>

                    {onNewMatch && (
                      <button
                        id="new-match-btn"
                        onClick={onNewMatch}
                        disabled={isLoading}
                        className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>New Match</span>
                      </button>
                    )}

                    <button
                      id="exit-lobby-btn"
                      onClick={onLeave}
                      className="w-full py-3.5 px-4 bg-white/5 hover:bg-white/10 border border-white/5 text-neutral-400 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Exit Lobby</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Start Auction Button */}
                  {currentStatus === 'waiting' && (
                    <button
                      onClick={() => onSetAuctionStatus('running', selectedMode)}
                      disabled={isLoading || !lobby.activePlayer || (selectedMode === 'hidden' && !lobby.hiddenPlayer)}
                      className={`w-full py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer active:scale-95 border
                        ${(lobby.activePlayer && (selectedMode === 'public' || lobby.hiddenPlayer))
                          ? (selectedMode === 'hidden' ? 'bg-cyan-500 text-black hover:bg-cyan-400 border-cyan-500/20 shadow-lg shadow-cyan-500/10' : 'bg-emerald-500 text-black hover:bg-emerald-400 border-emerald-500/20 shadow-lg shadow-emerald-500/10') 
                          : 'bg-white/5 text-neutral-500 border-white/5 cursor-not-allowed'
                        }`}
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Start {selectedMode === 'hidden' ? 'Hidden' : 'Public'} Auction</span>
                    </button>
                  )}

                  {/* End Auction Button (Manually decider during Live Auction) */}
                  {currentStatus === 'running' && !lobby.winnerTeam && (
                    <button
                      id="end-auction-btn"
                      onClick={() => {
                        if (lobby.auctionMode === 'hidden') {
                          onRevealHiddenResults?.();
                        } else {
                          onSetAuctionStatus('finished');
                        }
                      }}
                      disabled={isLoading}
                      className={`w-full py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 border cursor-pointer active:scale-95
                        ${lobby.auctionMode === 'hidden'
                          ? 'bg-cyan-500 text-black hover:bg-cyan-400 border-cyan-500/20 shadow-lg shadow-cyan-500/10'
                          : 'bg-rose-500 text-white hover:bg-rose-400 border-rose-500/20 shadow-lg shadow-rose-500/10'
                        }`}
                    >
                      {lobby.auctionMode === 'hidden' ? <Eye className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                      <span>{lobby.auctionMode === 'hidden' ? 'Reveal Results' : 'End Auction'}</span>
                    </button>
                  )}

                  {/* Finish Auction Button (Winner Decided) */}
                  {currentStatus === 'running' && !!lobby.winnerTeam && (
                    <button
                      id="finish-auction-btn"
                      onClick={() => onSetAuctionStatus('finished')}
                      disabled={isLoading}
                      className="w-full py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 border bg-amber-400 hover:bg-amber-300 text-black border-amber-500/20 shadow-lg shadow-amber-500/10 cursor-pointer active:scale-95"
                    >
                      <Check className="w-4 h-4" />
                      <span>Finish Auction</span>
                    </button>
                  )}

                  {/* Start Next Auction Button (Finished state) */}
                  {currentStatus === 'finished' && (
                    <button
                      id="start-next-auction-btn"
                      onClick={() => onSetAuctionStatus('waiting')}
                      disabled={isLoading}
                      className="w-full py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 border bg-emerald-500 hover:bg-emerald-400 text-black border-emerald-500/20 shadow-lg shadow-emerald-500/10 cursor-pointer active:scale-95"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Start Next Auction</span>
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Tactical instruction alerts */}
            {!lobby.activePlayer && (
              <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/10 text-[10px] text-neutral-400 leading-normal">
                ⚠️ <strong>Nomination required:</strong> Set a "Visible Auction Player" in the search box above to enable the <strong>Start Auction</strong> launcher.
              </div>
            )}

            {/* Leave button to escape session */}
            <button
              onClick={onLeave}
              className="text-xs text-neutral-500 hover:text-white transition-colors flex items-center gap-1.5 justify-center py-2.5 w-full uppercase tracking-wider font-mono"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Leave Arena</span>
            </button>
          </div>

        </div>

        {/* Right Hand: Interactive Visualizers (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="w-full flex flex-col items-center justify-center gap-6 py-4 bg-white/[0.01] border border-white/5 rounded-3xl p-6">
            
            <div className="text-center space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-widest text-amber-500 font-bold">
                Stadium Live Screen
              </span>
              <h3 className="text-sm font-bold text-neutral-300">Selected Visual Assets</h3>
            </div>

            {/* Current Live Bid Display for Judge */}
            {lobby.auctionMode === 'hidden' ? (
              <div className="w-full bg-white/5 border border-white/5 rounded-2xl p-5 flex flex-col space-y-4">
                <div className="text-center">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-400 font-bold block">
                    🔒 Hidden Auction Progress
                  </span>
                  <span className="text-[10px] text-neutral-400">Bid values are secret</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-center">
                    <span className="text-[10px] uppercase font-mono text-neutral-400 font-semibold block">{lobby.teamAName}</span>
                    <span className="text-xl font-mono font-black text-white block mt-1">
                      {lobby.teamAAttemptsCount ?? 0} / 3
                    </span>
                    <span className="text-[9px] text-neutral-500 font-medium">Attempts</span>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-center">
                    <span className="text-[10px] uppercase font-mono text-neutral-400 font-semibold block">{lobby.teamBName}</span>
                    <span className="text-xl font-mono font-black text-white block mt-1">
                      {lobby.teamBAttemptsCount ?? 0} / 3
                    </span>
                    <span className="text-[9px] text-neutral-500 font-medium">Attempts</span>
                  </div>
                </div>

                {lobby.auctionStatus === 'running' && !lobby.tieDetected && (
                  <button
                    onClick={onRevealHiddenResults}
                    disabled={isLoading}
                    className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Reveal Results</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-1">
                <span className="text-[9px] uppercase tracking-widest text-neutral-400 font-mono font-bold">
                  Current Live Bid
                </span>
                <div className="text-2xl font-black text-amber-400 font-mono">
                  {lobby.currentBid && lobby.currentBid > 0 ? `${lobby.currentBid}M` : '0M'}
                </div>
                <div className="text-[11px] font-bold uppercase font-mono">
                  {lobby.leadingTeam ? (
                    <span className="text-neutral-300">
                      Leading: <span className={lobby.leadingTeam === 'A' ? 'text-emerald-400' : 'text-cyan-400'}>{lobby.leadingTeam === 'A' ? lobby.teamAName : lobby.teamBName}</span>
                    </span>
                  ) : (
                    <span className="text-neutral-500">No active bids yet</span>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row lg:flex-col gap-6 justify-center w-full max-w-[280px]">
              {/* Active player on display */}
              <div className="space-y-1.5 w-full">
                <span className="text-[9px] uppercase tracking-wider font-mono text-neutral-400 font-bold block text-center">
                  🌐 Broadcast Display
                </span>
                <PlayerCard player={lobby.activePlayer || null} />
              </div>
            </div>

          </div>

          {/* JUDGE HISTORY PANEL */}
          <div className="w-full bg-white/[0.01] border border-white/5 rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <span className="text-xs uppercase font-mono tracking-widest text-amber-500 font-bold">
                📜 Draft History Record
              </span>
              <span className="text-[10px] font-mono text-neutral-500 font-bold bg-white/5 px-2 py-0.5 rounded">
                {(lobby.history || []).length} rounds
              </span>
            </div>

            {(!lobby.history || lobby.history.length === 0) ? (
              <p className="text-xs text-neutral-600 italic font-mono py-2 text-center">
                No completed draft rounds yet.
              </p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {lobby.history.map((item, idx) => {
                  const winnerName = item.winningTeam === 'A' ? lobby.teamAName : lobby.teamBName;
                  const winnerColor = item.winningTeam === 'A' ? 'text-emerald-400' : 'text-cyan-400';
                  const winnerBg = item.winningTeam === 'A' ? 'bg-emerald-500/10' : 'bg-cyan-500/10';
                  const winnerBorder = item.winningTeam === 'A' ? 'border-emerald-500/20' : 'border-cyan-500/20';

                  return (
                    <div
                      key={idx}
                      className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2.5"
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-mono text-[10px] text-neutral-500 font-bold">
                          ROUND {idx + 1}
                        </span>
                        <div className={`px-2 py-0.5 rounded text-[9px] font-bold border ${winnerColor} ${winnerBg} ${winnerBorder}`}>
                          Winner: {winnerName} • {item.winningBid}M
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-white/[0.03]">
                        <div className="space-y-0.5">
                          <span className="text-[9px] uppercase font-mono text-neutral-500 block">
                            Visible Drafted
                          </span>
                          <span className="font-bold text-white uppercase truncate block">
                            {item.visiblePlayer.name}
                          </span>
                          <span className="text-[9px] font-mono text-emerald-400 font-medium uppercase block">
                            {item.visiblePlayer.position}
                          </span>
                        </div>
                        <div className="space-y-0.5 border-l border-white/5 pl-2">
                          <span className="text-[9px] uppercase font-mono text-neutral-500 block">
                            Hidden Drafted
                          </span>
                          <span className="font-bold text-neutral-300 uppercase truncate block">
                            {item.hiddenPlayer.name}
                          </span>
                          <span className="text-[9px] font-mono text-cyan-400 font-medium uppercase block">
                            {item.hiddenPlayer.position}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Team Players assigned to each roster */}
      <div className="mt-6">
        <TeamPlayersList lobby={lobby} />
      </div>

    </div>
  );
}
