import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Trophy, Landmark, Landmark as DollarSign, TrendingUp, HelpCircle, LogOut, Info } from 'lucide-react';
import { Lobby, MATCH_CONFIGS } from '../types';
import PlayerCard from './PlayerCard';
import TeamPlayersList from './TeamPlayersList';
import LineupCompleteScreen from './LineupCompleteScreen';

interface TeamAuctionRoomProps {
  lobby: Lobby;
  onLeave: () => void;
  playerId: string;
  showToast: (text: string, type: 'success' | 'error' | 'info') => void;
  onPlaceBid: (bidAmount: number) => Promise<void>;
  onLeaveAuction: () => Promise<void>;
  onPlaceHiddenBid?: (bidAmount: number) => Promise<void>;
}

export default function TeamAuctionRoom({
  lobby,
  onLeave,
  playerId,
  showToast,
  onPlaceBid,
  onLeaveAuction,
  onPlaceHiddenBid
}: TeamAuctionRoomProps) {
  // Identify current user's team affiliation
  const currentPlayer = lobby.players.find(p => p.id === playerId);
  const currentTeam = currentPlayer?.team; // 'A' or 'B'
  const isTeamA = currentTeam === 'A';
  const teamName = isTeamA ? lobby.teamAName : (currentTeam === 'B' ? lobby.teamBName : 'Bench Manager');
  const myBudget = currentTeam === 'A' ? (lobby.teamABudget ?? 500) : (lobby.teamBBudget ?? 500);

  // Local interaction helper states
  const [customBidVal, setCustomBidVal] = useState<string>('');
  const [bidWarning, setBidWarning] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // Reveal Animation States & Refs
  const lastFinishedActivePlayerName = useRef<string | null>(null);
  const [revealPhase, setRevealPhase] = useState<'none' | 'showing'>('none');
  const [revealData, setRevealData] = useState<{
    visiblePlayer: any;
    hiddenPlayer: any;
    winnerTeam: 'A' | 'B' | null;
  } | null>(null);

  useEffect(() => {
    if (lobby.auctionStatus === 'finished') {
      const activeName = lobby.activePlayer?.name || '';
      if (activeName && lastFinishedActivePlayerName.current !== activeName) {
        lastFinishedActivePlayerName.current = activeName;
        
        setRevealData({
          visiblePlayer: lobby.activePlayer,
          hiddenPlayer: lobby.hiddenPlayer,
          winnerTeam: lobby.winnerTeam || lobby.leadingTeam || null
        });
        
        setRevealPhase('showing');
        
        const timer = setTimeout(() => {
          setRevealPhase('none');
          setRevealData(null);
        }, 3000);
        
        return () => clearTimeout(timer);
      }
    } else if (lobby.auctionStatus === 'waiting') {
      lastFinishedActivePlayerName.current = null;
    }
  }, [lobby.auctionStatus, lobby.activePlayer?.name, lobby.hiddenPlayer?.name, lobby.winnerTeam, lobby.leadingTeam]);

  // Clear local interaction states when active player changes or auction status resets
  useEffect(() => {
    setCustomBidVal('');
    setBidWarning(null);
    setShowLeaveConfirm(false);
  }, [lobby.activePlayer?.name, lobby.auctionStatus]);

  const hasLeft = currentTeam === 'A' ? !!lobby.teamALeft : (currentTeam === 'B' ? !!lobby.teamBLeft : false);
  
  const myAttempts = isTeamA ? (lobby.teamAAttempts || []) : (lobby.teamBAttempts || []);
  const isAttemptsLimitReached = lobby.auctionMode === 'hidden' && myAttempts.length >= 3;
  const isBiddingDisabled = lobby.auctionStatus !== 'running' || hasLeft || !!lobby.winnerTeam || isAttemptsLimitReached || !!lobby.matchFinished;

  const handleLeaveAuctionClick = () => {
    if (lobby.auctionStatus !== 'running') {
      showToast("The auction is not currently running.", "error");
      return;
    }
    if (hasLeft) {
      showToast("You have already left this auction.", "info");
      return;
    }
    setShowLeaveConfirm(true);
  };

  const handleConfirmLeaveAuction = async () => {
    setShowLeaveConfirm(false);
    await onLeaveAuction();
  };

  const handleIncrementBid = (increment: number) => {
    if (isBiddingDisabled) {
      showToast("Bidding is disabled.", "error");
      return;
    }
    const baseAmount = lobby.auctionMode === 'hidden' 
      ? (myAttempts.length > 0 ? myAttempts[myAttempts.length - 1] : 0) 
      : (lobby.currentBid || 0);
    const nextBid = baseAmount + increment;
    if (nextBid <= 0) {
      setBidWarning("Bid must be greater than zero.");
      showToast("Bid must be greater than zero.", "error");
      return;
    }
    if (nextBid > myBudget) {
      setBidWarning("Insufficient budget.");
      showToast("Insufficient budget.", "error");
      return;
    }
    
    if (lobby.auctionMode === 'hidden') {
      onPlaceHiddenBid?.(nextBid);
    } else {
      onPlaceBid(nextBid);
    }
    setBidWarning(null);
  };

  const handleCustomBidSubmit = () => {
    if (isBiddingDisabled) {
      showToast("Bidding is disabled.", "error");
      return;
    }
    const enteredAmount = parseInt(customBidVal, 10);
    if (isNaN(enteredAmount) || enteredAmount <= 0) {
      setBidWarning("Please enter a valid positive bid amount.");
      return;
    }
    
    if (lobby.auctionMode === 'hidden') {
      if (enteredAmount > myBudget) {
        setBidWarning("Insufficient budget.");
        return;
      }
      setBidWarning(null);
      onPlaceHiddenBid?.(enteredAmount);
      setCustomBidVal('');
      return;
    }

    const currentHighBid = lobby.currentBid || 0;
    if (enteredAmount <= currentHighBid) {
      setBidWarning("Your bid must be higher than the current bid.");
      return;
    }
    if (enteredAmount > myBudget) {
      setBidWarning("Insufficient budget.");
      return;
    }
    // All checks passed, clear warnings and bid
    setBidWarning(null);
    onPlaceBid(enteredAmount);
    setCustomBidVal('');
  };

  const handlePlaceBidBtnClick = () => {
    if (customBidVal.trim() !== '') {
      handleCustomBidSubmit();
    } else {
      // Default to +5M bid if empty
      handleIncrementBid(5);
    }
  };

  const currentStatus = lobby.auctionStatus || 'waiting';

  let displayLabel = "Waiting";
  let displayColor = "text-amber-400 bg-amber-400/10 border-amber-500/20";
  let displayDesc = "Waiting for Judge to initiate the auction...";

  if (currentStatus === 'waiting') {
    displayLabel = "Waiting";
    displayColor = "text-amber-400 bg-amber-400/10 border-amber-500/20";
    displayDesc = "Waiting for Judge to nominate players...";
  } else if (lobby.tieDetected) {
    displayLabel = "Tie Detected";
    displayColor = "text-amber-400 bg-amber-400/10 border-amber-500/20 shadow-lg shadow-amber-500/5";
    displayDesc = "Both teams submitted the same bid! Waiting for Judge to resolve the tie...";
  } else if (lobby.auctionMode === 'hidden' && currentStatus === 'running') {
    displayLabel = "Hidden Auction";
    displayColor = "text-cyan-400 bg-cyan-400/10 border-cyan-500/20 shadow-lg shadow-cyan-500/5";
    displayDesc = "Hidden bidding is live! Submit up to 3 secret attempts.";
  } else if (currentStatus === 'running' && !lobby.winnerTeam) {
    displayLabel = "Live Auction";
    displayColor = "text-emerald-400 bg-emerald-400/10 border-emerald-500/20 shadow-lg shadow-emerald-500/5";
    displayDesc = "Bidding is live! Place your bids now.";
  } else if (currentStatus === 'running' && lobby.winnerTeam) {
    displayLabel = "Winner Decided";
    displayColor = "text-amber-400 bg-amber-400/10 border-amber-500/20 shadow-lg shadow-amber-500/5";
    displayDesc = "A team has left the auction. Waiting for the Judge to finish the auction.";
  } else if (currentStatus === 'finished') {
    displayLabel = "Finished";
    displayColor = "text-rose-400 bg-rose-400/10 border-rose-500/20";
    displayDesc = "Auction finished! Next player coming soon.";
  }

  if (lobby.matchFinished) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-6">
        <LineupCompleteScreen
          lobby={lobby}
          isJudge={false}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 flex flex-col space-y-6">
      
      {/* Dynamic Team Heading Shield banner */}
      <div className={`relative overflow-hidden p-6 rounded-3xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4
        ${isTeamA 
          ? 'bg-gradient-to-r from-emerald-950/45 via-[#0c0a09] to-black border-emerald-500/20 shadow-lg shadow-emerald-500/5' 
          : 'bg-gradient-to-r from-cyan-950/45 via-[#0c0a09] to-black border-cyan-500/20 shadow-lg shadow-cyan-500/5'}`}>
        
        {/* Glow behind shield */}
        <div className={`absolute -left-10 -top-10 w-32 h-32 blur-3xl rounded-full opacity-20 pointer-events-none
          ${isTeamA ? 'bg-emerald-500' : 'bg-cyan-500'}`} />

        <div className="flex items-center gap-4 relative z-10">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2
            ${isTeamA ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400'}`}>
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <span className={`text-[10px] uppercase font-mono font-bold tracking-widest
              ${isTeamA ? 'text-emerald-400' : 'text-cyan-400'}`}>
              Team Commander Screen
            </span>
            <h1 className="text-2xl font-black text-white font-display tracking-tight leading-none uppercase mt-0.5">
              {teamName}
            </h1>
          </div>
        </div>

        {/* Arena context details */}
        <div className="text-left sm:text-right font-mono text-xs text-neutral-400 space-y-0.5 relative z-10">
          <div>Arena: <strong className="text-white uppercase font-black">#{lobby.code}</strong></div>
          <div>Format: <span className="text-white font-semibold">{lobby.matchType || '11v11'}</span></div>
          <div className="text-emerald-400 font-bold">
            {lobby.matchFinished ? "MATCH COMPLETED" : `Round: ${lobby.currentRound ?? 1} / ${MATCH_CONFIGS[lobby.matchType || '11v11'].maxRounds}`}
          </div>
        </div>
      </div>

      {/* Main Interactive Board */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Premium Player Card display (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center gap-4 bg-white/[0.01] border border-white/5 rounded-3xl p-6 relative">
          <div className="text-center">
            <span className="text-[10px] uppercase font-mono tracking-widest text-amber-500 font-black">
              Current Nominee
            </span>
            <h3 className="text-xs text-neutral-500 mt-0.5">Target Player under Auction</h3>
          </div>

          <PlayerCard player={lobby.activePlayer || null} />
          
          <div className="flex items-center justify-center gap-1.5 px-3 py-1 rounded bg-white/5 border border-white/10 text-[9px] font-mono text-neutral-400 font-bold uppercase">
            <Info className="w-3.5 h-3.5 text-neutral-500" />
            <span>Hidden Player is concealed</span>
          </div>
        </div>

        {/* Right Side: Bid Station, Budgets and Actions (7 Cols) */}
        <div className="lg:col-span-7 space-y-6 flex flex-col justify-between">
          
          {/* Large display panels: Bid & Budget */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-extrabold text-white font-display tracking-tight uppercase">
                Draft Bid Station
              </h2>
              <div className={`px-3 py-0.5 rounded-full border text-[10px] font-bold uppercase flex items-center gap-1.5 ${displayColor}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                <span>{displayLabel}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* CURRENT BID / ATTEMPTS REMAINING CARD */}
              {lobby.auctionMode === 'hidden' ? (
                <div className="relative p-6 rounded-3xl bg-gradient-to-br from-white/[0.03] to-black border border-white/10 overflow-hidden flex flex-col justify-between h-36 shadow-lg">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] uppercase tracking-widest text-neutral-500 font-bold font-mono">
                      Attempts Remaining
                    </span>
                    <Trophy className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <span className="block text-3xl font-black text-cyan-400 font-mono tracking-tight">
                      {3 - myAttempts.length} / 3
                    </span>
                    <div className="text-[10px] text-neutral-500 font-bold uppercase font-mono mt-1">
                      Only most recent bid counts
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative p-6 rounded-3xl bg-gradient-to-br from-white/[0.03] to-black border border-white/10 overflow-hidden flex flex-col justify-between h-36 shadow-lg">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] uppercase tracking-widest text-neutral-500 font-bold font-mono">
                      Current High Bid
                    </span>
                    <Trophy className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    {lobby.currentBid && lobby.currentBid > 0 ? (
                      <span className="block text-3xl font-black text-amber-400 font-mono tracking-tight">
                        {lobby.currentBid}M
                      </span>
                    ) : (
                      <span className="block text-2xl font-black text-neutral-500 font-mono tracking-tight uppercase">
                        0M
                      </span>
                    )}
                    
                    {/* Leading / Winner Team Display */}
                    <div className="text-[11px] font-bold uppercase font-mono mt-1">
                      {lobby.winnerTeam ? (
                        <span className="text-emerald-400 font-extrabold tracking-wide">
                          Winner: {lobby.winnerTeam === 'A' ? lobby.teamAName : lobby.teamBName}
                        </span>
                      ) : (
                        <span className="text-neutral-400">
                          Leading: {lobby.leadingTeam ? (lobby.leadingTeam === 'A' ? lobby.teamAName : lobby.teamBName) : 'None'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* REMAINING BUDGET CARD */}
              <div className="relative p-6 rounded-3xl bg-gradient-to-br from-white/[0.03] to-black border border-white/10 overflow-hidden flex flex-col justify-between h-36 shadow-lg">
                <div className="flex justify-between items-start">
                  <span className="text-[9px] uppercase tracking-widest text-neutral-500 font-bold font-mono">
                    Remaining Budget
                  </span>
                  <Landmark className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <span id="team-remaining-budget-display" className="block text-3xl font-black text-emerald-400 font-mono tracking-tight">
                    {myBudget}M
                  </span>
                  <span className="text-[10px] text-neutral-500 font-bold uppercase font-mono">
                    of 500M starting
                  </span>
                </div>
              </div>
            </div>

            {/* Hidden Auction My Attempts History Row */}
            {lobby.auctionMode === 'hidden' && (
              <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl space-y-3">
                <span className="text-[9px] uppercase font-bold tracking-widest text-neutral-500 font-mono block">
                  Your Hidden Bids (Attempts)
                </span>
                <div className="grid grid-cols-3 gap-2.5">
                  {[1, 2, 3].map((num) => {
                    const bidVal = myAttempts[num - 1];
                    const isLast = num === myAttempts.length;
                    return (
                      <div 
                        key={num} 
                        className={`p-3 rounded-xl border text-center font-mono ${
                          bidVal 
                            ? (isLast ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 font-extrabold' : 'bg-white/5 border-white/10 text-neutral-400')
                            : 'bg-transparent border-white/5 text-neutral-600 border-dashed'
                        }`}
                      >
                        <span className="block text-[8px] uppercase text-neutral-500 font-bold">Attempt {num}</span>
                        <span className="block text-sm mt-0.5">{bidVal ? `${bidVal}M` : '—'}</span>
                        {isLast && <span className="block text-[8px] uppercase text-cyan-400 mt-0.5 font-bold">[ACTIVE]</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-xs text-neutral-400 leading-relaxed bg-white/[0.01] border border-white/5 p-3 rounded-2xl">
              <strong>Status info:</strong> {displayDesc}
            </p>
          </div>          {/* Bid Button Panels */}
          <div className="space-y-4 pt-6 border-t border-white/5">
            {lobby.matchFinished ? (
              <div id="match-finished-team-panel" className="p-6 rounded-3xl bg-white/[0.02] border border-cyan-500/20 space-y-4 text-center">
                <span className="text-xs uppercase font-mono tracking-widest text-cyan-400 font-bold block animate-pulse">
                  🏁 MATCH COMPLETED
                </span>
                <h3 className="text-lg font-black text-white font-display">Match Finished!</h3>
                <p className="text-xs text-neutral-400 leading-normal max-w-sm mx-auto">
                  Rosters are completely filled. The Judge is finalizing the arena, saving coordinates, or launching a new match.
                </p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-neutral-300 font-mono">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>Waiting for Judge...</span>
                </div>
              </div>
            ) : (
              <>
                {hasLeft && (
                  <div id="has-left-warning-banner" className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-center">
                    <p className="text-sm text-rose-400 font-extrabold uppercase font-mono tracking-wider animate-pulse">
                      ⚠️ You have left this auction.
                    </p>
                    <p className="text-[10px] text-neutral-400 mt-1">
                      You can no longer place any bids for this player.
                    </p>
                  </div>
                )}

                {isAttemptsLimitReached && lobby.auctionStatus === 'running' && (
                  <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-center">
                    <p className="text-sm text-cyan-400 font-extrabold uppercase font-mono tracking-wider animate-pulse">
                      ⏳ Waiting for the other team...
                    </p>
                    <p className="text-[10px] text-neutral-400 mt-1">
                      You have submitted all 3 attempts. Bidding controls are locked.
                    </p>
                  </div>
                )}

                <span className="text-[9px] uppercase font-bold tracking-widest text-neutral-500 font-mono block">
                  Bid Increments & Control Action Desk
                </span>

                {/* Quick increments */}
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    id="bid-plus-5-btn"
                    onClick={() => handleIncrementBid(5)}
                    disabled={isBiddingDisabled}
                    className={`py-3 border text-white font-mono font-black text-sm rounded-xl transition-all active:scale-95
                      ${isBiddingDisabled 
                        ? 'bg-neutral-900 border-white/5 text-neutral-600 cursor-not-allowed' 
                        : 'bg-white/5 hover:bg-white/10 border-white/10 cursor-pointer'
                      }`}
                  >
                    +5M
                  </button>
                  <button
                    id="bid-plus-10-btn"
                    onClick={() => handleIncrementBid(10)}
                    disabled={isBiddingDisabled}
                    className={`py-3 border text-white font-mono font-black text-sm rounded-xl transition-all active:scale-95
                      ${isBiddingDisabled 
                        ? 'bg-neutral-900 border-white/5 text-neutral-600 cursor-not-allowed' 
                        : 'bg-white/5 hover:bg-white/10 border-white/10 cursor-pointer'
                      }`}
                  >
                    +10M
                  </button>
                  <button
                    id="bid-plus-20-btn"
                    onClick={() => handleIncrementBid(20)}
                    disabled={isBiddingDisabled}
                    className={`py-3 border text-white font-mono font-black text-sm rounded-xl transition-all active:scale-95
                      ${isBiddingDisabled 
                        ? 'bg-neutral-900 border-white/5 text-neutral-600 cursor-not-allowed' 
                        : 'bg-white/5 hover:bg-white/10 border-white/10 cursor-pointer'
                      }`}
                  >
                    +20M
                  </button>
                </div>

                {/* Custom Bid Input & Place Bid */}
                <div className="space-y-2">
                  <div className="flex gap-2.5">
                    <div className="relative flex-1">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-500 font-mono">M</span>
                      <input
                        id="custom-bid-input"
                        type="number"
                        placeholder="Custom Bid (e.g. 85)..."
                        value={customBidVal}
                        disabled={isBiddingDisabled}
                        onChange={(e) => {
                          setCustomBidVal(e.target.value);
                          setBidWarning(null);
                        }}
                        className={`w-full bg-[#0a0a0a] border rounded-xl pl-9 pr-4 py-3.5 text-xs font-mono font-bold transition-all
                          ${isBiddingDisabled 
                            ? 'border-white/5 text-neutral-600 cursor-not-allowed bg-[#050505]' 
                            : 'border-white/10 text-white focus:outline-none focus:border-amber-500/50'
                          }`}
                      />
                    </div>

                    <button
                      id="custom-bid-trigger-btn"
                      onClick={handleCustomBidSubmit}
                      disabled={isBiddingDisabled}
                      className={`px-6 border font-bold text-xs uppercase tracking-wider rounded-xl transition-colors
                        ${isBiddingDisabled 
                          ? 'bg-neutral-900 border-white/5 text-neutral-600 cursor-not-allowed' 
                          : 'bg-white/5 hover:bg-white/10 border-white/10 cursor-pointer'
                        }`}
                    >
                      Custom Bid
                    </button>
                  </div>

                  {bidWarning && (
                    <p id="bid-warning-msg" className="text-xs text-rose-400 font-medium font-mono">
                      ⚠️ {bidWarning}
                    </p>
                  )}
                </div>

                {/* Primary Action Buttons: Place Bid & Leave */}
                {lobby.auctionMode === 'hidden' ? (
                  <button
                    id="place-bid-btn"
                    onClick={handlePlaceBidBtnClick}
                    disabled={isBiddingDisabled}
                    className={`w-full py-4 rounded-2xl font-extrabold text-sm uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2
                      ${isBiddingDisabled 
                        ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' 
                        : 'bg-white text-black hover:bg-neutral-200 cursor-pointer'
                      }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span>Submit Attempt ({3 - myAttempts.length} remaining)</span>
                  </button>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <button
                      id="place-bid-btn"
                      onClick={handlePlaceBidBtnClick}
                      disabled={isBiddingDisabled}
                      className={`py-4 rounded-2xl font-extrabold text-sm uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2
                        ${isBiddingDisabled 
                          ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' 
                          : 'bg-white text-black hover:bg-neutral-200 cursor-pointer'
                        }`}
                    >
                      <TrendingUp className="w-4 h-4" />
                      <span>Place Bid</span>
                    </button>

                    <button
                      id="leave-auction-btn"
                      onClick={handleLeaveAuctionClick}
                      disabled={hasLeft || !!lobby.winnerTeam || lobby.auctionStatus !== 'running'}
                      className={`py-4 rounded-2xl border font-bold text-sm uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2
                        ${(hasLeft || !!lobby.winnerTeam || lobby.auctionStatus !== 'running')
                          ? 'bg-neutral-900 border-white/5 text-neutral-600 cursor-not-allowed' 
                          : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-300 hover:text-white cursor-pointer'
                        }`}
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Leave Auction</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Humble Exit option for leaving the lobby room entirely */}
          <div className="pt-4 text-center">
            <button
              onClick={onLeave}
              className="text-[10px] font-mono text-neutral-600 hover:text-neutral-400 transition-colors uppercase tracking-widest cursor-pointer"
            >
              [Exit Draft Room Lobby]
            </button>
          </div>

        </div>

      </div>

      {/* Team Rosters & Assigned Players list */}
      <TeamPlayersList lobby={lobby} />

      {/* Leave Auction Confirmation Modal */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
                <HelpCircle className="w-6 h-6" />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-black text-white uppercase tracking-tight font-display leading-tight">
                  Are you sure you want to leave this auction?
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  You will permanently lose the chance to bid for this player.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="py-3 px-4 rounded-xl border border-white/10 text-neutral-300 hover:text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer bg-white/5 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmLeaveAuction}
                  className="py-3 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Leave Auction
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* 3-Second Full Screen Reveal Animation Overlay */}
        {revealPhase === 'showing' && revealData && (
          <motion.div
            key="reveal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-[#040404]/98 overflow-hidden backdrop-blur-md"
          >
            {/* Ambient cyber glow circles */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-emerald-500/20 to-cyan-500/10 blur-[150px] rounded-full pointer-events-none animate-pulse" />

            {(() => {
              const isWinner = currentTeam === revealData.winnerTeam;
              const playerToShow = isWinner ? revealData.visiblePlayer : revealData.hiddenPlayer;

              return (
                <div className="relative max-w-sm w-full text-center space-y-6 flex flex-col items-center">
                  
                  {isWinner ? (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', damping: 15 }}
                      className="space-y-2"
                    >
                      <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                        <Trophy className="w-8 h-8 animate-bounce" />
                      </div>
                      <h2 className="text-4xl font-black tracking-tight uppercase font-display text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-amber-300 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                        You Won
                      </h2>
                      <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
                        Fantastic bidding! Your team has successfully secured the signing of:
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', damping: 15 }}
                      className="space-y-2"
                    >
                      <div className="w-16 h-16 rounded-full bg-cyan-500/10 border-2 border-cyan-500/40 flex items-center justify-center mx-auto text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                        <Shield className="w-8 h-8 animate-pulse" />
                      </div>
                      <h2 className="text-3xl font-black tracking-tight uppercase font-display text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 drop-shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                        Hidden Player Revealed
                      </h2>
                      <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
                        You missed the active bid, but you've received the secret player:
                      </p>
                    </motion.div>
                  )}

                  {/* Player Card Showcase */}
                  <motion.div
                    initial={{ y: 50, scale: 0.9, opacity: 0 }}
                    animate={{ y: 0, scale: 1, opacity: 1 }}
                    transition={{ delay: 0.25, type: 'spring', damping: 12 }}
                    className="w-full relative py-2"
                  >
                    <div className={`absolute -inset-2.5 rounded-[2.5rem] blur-xl opacity-20 ${isWinner ? 'bg-emerald-500' : 'bg-cyan-500'}`} />
                    <div className="relative">
                      <PlayerCard player={playerToShow} />
                    </div>
                  </motion.div>

                  {/* Countdown Ticker */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 font-bold"
                  >
                    Updating pitch rosters...
                  </motion.div>

                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
