import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Users, 
  Copy, 
  Share2, 
  ArrowRight, 
  Shield, 
  User, 
  Sparkles, 
  ChevronRight, 
  Globe, 
  Lock, 
  Plus, 
  RefreshCw, 
  Flame, 
  Compass, 
  Monitor, 
  TrendingUp, 
  Settings, 
  Check, 
  LogOut,
  AlertTriangle
} from 'lucide-react';
import Logo from './components/Logo';
import FootballPitch from './components/FootballPitch';
import Toast, { ToastMessage } from './components/ui/Toast';
import { Lobby, Player, FootballPlayer, MATCH_CONFIGS } from './types';
import PlayerCard from './components/PlayerCard';
import JudgeAuctionRoom from './components/JudgeAuctionRoom';
import TeamAuctionRoom from './components/TeamAuctionRoom';

export default function App() {
  // Navigation state: 'landing' | 'create-lobby' | 'waiting-room' | 'auction-room'
  const [view, setView] = useState<'landing' | 'create-lobby' | 'waiting-room' | 'auction-room'>('landing');
  
  // Lobby state
  const [currentLobby, setCurrentLobby] = useState<Lobby | null>(null);
  const [publicLobbies, setPublicLobbies] = useState<any[]>([]);
  const [isLobbyPrivate, setIsLobbyPrivate] = useState<boolean>(true);
  
  // Player session state (Stored in localStorage for persistence)
  const [playerId, setPlayerId] = useState<string>(() => {
    const saved = localStorage.getItem('stadium_player_id');
    if (saved) return saved;
    const newId = 'player_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('stadium_player_id', newId);
    return newId;
  });
  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem('stadium_player_name') || '';
  });
  const [isJudge, setIsJudge] = useState<boolean>(() => {
    return localStorage.getItem('stadium_is_judge') === 'true';
  });

  // Creation forms
  const [formJudgeName, setFormJudgeName] = useState('');
  const [formTeamAName, setFormTeamAName] = useState('Red Devils FC');
  const [formTeamBName, setFormTeamBName] = useState('Blue Knights');
  const [matchType, setMatchType] = useState<'5v5' | '7v7' | '11v11'>('11v11');
  
  // Joining inputs
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [targetedLobbyCode, setTargetedLobbyCode] = useState<string | null>(null);

  // General app state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showGameStartModal, setShowGameStartModal] = useState(false);

  // Refs for polling
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Reconnection and connection status states
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('connected');
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  // Add a toast helper
  const showToast = React.useCallback((text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToasts((prev) => {
      // Prevent duplicate toast messages from appearing repeatedly
      if (prev.some((t) => t.text === text)) {
        return prev;
      }
      
      const id = Math.random().toString(36).substring(2, 9);
      const nextToasts = [...prev, { id, text, type }];
      
      // Maximum visible toasts at the same time is 3. If a 4th appears, remove the oldest one.
      if (nextToasts.length > 3) {
        return nextToasts.slice(-3);
      }
      return nextToasts;
    });
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch and Join Lobby directly (No player name prompt)
  const handleFetchAndJoinLobby = async (code: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/lobby/${code}`);
      if (res.ok) {
        const lobby: Lobby = await res.json();
        setCurrentLobby(lobby);
        setIsJudge(false);
        localStorage.setItem('stadium_is_judge', 'false');
        setView('waiting-room');
        setTargetedLobbyCode(code);
        showToast(`Connected to Lobby #${code}!`, "success");
      } else {
        const err = await res.json();
        showToast(err.error || "Lobby not found. Double-check code.", "error");
      }
    } catch (err) {
      showToast("Server connection error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Reconnect to an existing active session automatically on mount or refresh
  const handleAutoReconnect = async (code: string, pId: string, role: string | null, isJdg: boolean) => {
    setIsLoading(true);
    setConnectionStatus('reconnecting');
    try {
      const res = await fetch(`/api/lobby/${code}/reconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: pId,
          role,
          isJudge: isJdg
        })
      });

      if (res.ok) {
        const data = await res.json();
        const lobby: Lobby = data.lobby;
        setCurrentLobby(lobby);
        setIsJudge(data.isJudge);
        localStorage.setItem('stadium_is_judge', data.isJudge ? 'true' : 'false');
        
        // Restore player name
        const savedName = localStorage.getItem('stadium_player_name');
        if (savedName) {
          setPlayerName(savedName);
        } else {
          const defaultName = data.isJudge ? lobby.judgeName : (role === 'A' ? lobby.teamAName : lobby.teamBName);
          setPlayerName(defaultName);
          localStorage.setItem('stadium_player_name', defaultName);
        }

        // Direct return to correct screen
        if (lobby.status === 'active') {
          setView('auction-room');
        } else {
          setView('waiting-room');
        }

        setTargetedLobbyCode(code);
        setConnectionStatus('connected');
        showToast("Session restored! Return to your match.", "success");
      } else {
        // Clear stale local storage to allow fresh joins
        localStorage.removeItem('stadium_lobby_code');
        localStorage.removeItem('stadium_role');
        setConnectionStatus('disconnected');
        const err = await res.json();
        showToast(err.error || "Could not restore previous session.", "error");
      }
    } catch (err) {
      console.error("Auto-reconnection failed", err);
      setConnectionStatus('disconnected');
    } finally {
      setIsLoading(false);
    }
  };

  // Deep linking and automatic session recovery on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get('lobby');
    
    const savedLobbyCode = localStorage.getItem('stadium_lobby_code');
    const savedPlayerId = localStorage.getItem('stadium_player_id');
    const savedRole = localStorage.getItem('stadium_role');
    const savedIsJudge = localStorage.getItem('stadium_is_judge') === 'true';

    if (codeFromUrl) {
      const sanitizedCode = codeFromUrl.toUpperCase();
      if (savedLobbyCode === sanitizedCode && savedPlayerId) {
        handleAutoReconnect(savedLobbyCode, savedPlayerId, savedRole, savedIsJudge);
      } else {
        setTargetedLobbyCode(sanitizedCode);
        setJoinCodeInput(sanitizedCode);
        handleFetchAndJoinLobby(sanitizedCode);
      }
    } else {
      if (savedLobbyCode && savedPlayerId) {
        handleAutoReconnect(savedLobbyCode, savedPlayerId, savedRole, savedIsJudge);
      }
    }
    fetchPublicLobbies();
  }, []);

  // Fetch Public Lobbies
  const fetchPublicLobbies = async () => {
    try {
      const res = await fetch('/api/public-lobbies');
      if (res.ok) {
        const data = await res.json();
        setPublicLobbies(data);
      }
    } catch (err) {
      console.error("Failed to fetch public lobbies", err);
    }
  };

  // Poll current lobby status when in waiting room or auction room
  useEffect(() => {
    if ((view === 'waiting-room' || view === 'auction-room') && currentLobby) {
      // Fetch immediately
      fetchLobbyStatus(currentLobby.code);

      // Setup interval
      pollingRef.current = setInterval(() => {
        fetchLobbyStatus(currentLobby.code);
      }, 1500);
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [view, currentLobby?.code]);

  // Listen for browser online/offline status
  useEffect(() => {
    const handleOnline = () => setConnectionStatus('connected');
    const handleOffline = () => setConnectionStatus('disconnected');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchLobbyStatus = async (code: string) => {
    try {
      const res = await fetch(`/api/lobby/${code}?playerId=${playerId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentLobby(data);
        setConnectionStatus('connected');
        setConsecutiveFailures(0);
        if (data.status === 'active' && view === 'waiting-room') {
          setView('auction-room');
        }
      } else if (res.status === 404) {
        showToast("Lobby was closed or expired.", "error");
        handleLeaveLobby();
      } else {
        setConsecutiveFailures((prev) => {
          const next = prev + 1;
          if (next >= 3) {
            setConnectionStatus('disconnected');
          } else {
            setConnectionStatus('reconnecting');
          }
          return next;
        });
      }
    } catch (err) {
      console.error("Error polling lobby status", err);
      setConsecutiveFailures((prev) => {
        const next = prev + 1;
        if (next >= 3) {
          setConnectionStatus('disconnected');
        } else {
          setConnectionStatus('reconnecting');
        }
        return next;
      });
    }
  };

  // Create Lobby (Judge role)
  const handleCreateLobby = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formJudgeName.trim()) {
      showToast("Please enter a Judge name", "error");
      return;
    }
    if (!formTeamAName.trim() || !formTeamBName.trim()) {
      showToast("Please provide names for both Teams", "error");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/lobby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          judgeName: formJudgeName,
          teamAName: formTeamAName,
          teamBName: formTeamBName,
          isPrivate: isLobbyPrivate,
          judgeId: playerId,
          matchType,
        }),
      });

      if (res.ok) {
        const lobby: Lobby = await res.json();
        
        // Save states
        localStorage.setItem('stadium_player_name', formJudgeName.trim());
        localStorage.setItem('stadium_is_judge', 'true');
        localStorage.setItem('stadium_lobby_code', lobby.code);
        localStorage.setItem('stadium_role', 'judge');
        setPlayerName(formJudgeName.trim());
        setIsJudge(true);
        setCurrentLobby(lobby);
        setView('waiting-room');
        showToast("Lobby created successfully!", "success");
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to create lobby", "error");
      }
    } catch (err) {
      showToast("Server connection error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Player claims a team (joins lobby under Team A or B)
  const handleClaimTeam = async (team: 'A' | 'B') => {
    if (!currentLobby) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/lobby/${currentLobby.code}/claim-team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          team,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentLobby(data.lobby);
        
        // Save states
        localStorage.setItem('stadium_player_name', data.player.name);
        localStorage.setItem('stadium_is_judge', 'false');
        localStorage.setItem('stadium_lobby_code', data.lobby.code);
        localStorage.setItem('stadium_role', team);
        setPlayerName(data.player.name);
        setIsJudge(false);

        showToast(`Successfully claimed ${team === 'A' ? data.lobby.teamAName : data.lobby.teamBName}!`, "success");
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to claim team", "error");
      }
    } catch (err) {
      showToast("Server connection error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Team Selection Toggle/Select
  const handleSelectTeam = async (team: 'A' | 'B' | null) => {
    if (!currentLobby) return;
    
    try {
      const res = await fetch(`/api/lobby/${currentLobby.code}/select-team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          team,
        }),
      });

      if (res.ok) {
        const updatedLobby = await res.json();
        setCurrentLobby(updatedLobby);
        const teamLabel = team === 'A' ? currentLobby.teamAName : team === 'B' ? currentLobby.teamBName : 'Bench';
        showToast(`Moved to ${teamLabel}`, "info");
      } else {
        const err = await res.json();
        showToast(err.error || "Could not select team", "error");
      }
    } catch (err) {
      showToast("Connection issue", "error");
    }
  };

  // Leave Lobby
  const handleLeaveLobby = async () => {
    if (currentLobby) {
      try {
        await fetch(`/api/lobby/${currentLobby.code}/leave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId }),
        });
      } catch (e) {
        // Silent fail
      }
    }
    localStorage.removeItem('stadium_lobby_code');
    localStorage.removeItem('stadium_role');
    localStorage.removeItem('stadium_is_judge');
    setCurrentLobby(null);
    setView('landing');
    setTargetedLobbyCode(null);
  };

  // Copy shareable link to clipboard
  const handleCopyLink = () => {
    if (!currentLobby) return;
    const url = `${window.location.origin}?lobby=${currentLobby.code}`;
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    showToast("Share link copied!", "success");
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Start the actual Draft on the backend so all connected clients transition!
  const handleStartAuction = async () => {
    if (!currentLobby) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/lobby/${currentLobby.code}/start-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId })
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentLobby(updated);
        setView('auction-room');
        showToast("Arena draft is live! Step into your workspace.", "success");
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to launch draft", "error");
      }
    } catch (e) {
      showToast("Server connection error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Update nominated visible and hidden players
  const handleUpdatePlayers = async (active: FootballPlayer | null, hidden: FootballPlayer | null) => {
    if (!currentLobby) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/lobby/${currentLobby.code}/nominate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activePlayer: active, hiddenPlayer: hidden, playerId }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentLobby(updated);
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to nominate player", "error");
      }
    } catch (e) {
      showToast("Connection issue", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Change auction active state (waiting, running, finished)
  const handleSetAuctionStatus = async (status: 'waiting' | 'running' | 'finished', auctionMode?: 'public' | 'hidden') => {
    if (!currentLobby) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/lobby/${currentLobby.code}/set-auction-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, playerId, auctionMode }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentLobby(updated);
        if (status === 'running') {
          showToast(`Auction is now LIVE (${auctionMode === 'hidden' ? 'Hidden' : 'Public'} mode)!`, "success");
        } else if (status === 'finished') {
          showToast("Auction ended successfully.", "success");
        } else if (status === 'waiting') {
          showToast("Next auction round initialized.", "success");
        }
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to update auction status", "error");
      }
    } catch (e) {
      showToast("Connection issue", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Place a hidden auction bid attempt
  const handlePlaceHiddenBid = async (bidAmount: number) => {
    if (!currentLobby) return;

    const currentPlayer = currentLobby.players.find(p => p.id === playerId);
    if (!currentPlayer || !currentPlayer.team) {
      showToast("Only active team players can place bids.", "error");
      return;
    }

    try {
      const res = await fetch(`/api/lobby/${currentLobby.code}/place-hidden-bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: currentPlayer.team, bidAmount, playerId }),
      });

      if (res.ok) {
        const updated = await res.json();
        setCurrentLobby(updated);
        showToast("Bid attempt successfully submitted!", "success");
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to submit bid attempt", "error");
      }
    } catch (e) {
      showToast("Connection issue, please try again", "error");
    }
  };

  // Manually reveal hidden auction results
  const handleRevealHiddenResults = async () => {
    if (!currentLobby) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/lobby/${currentLobby.code}/reveal-hidden`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId })
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentLobby(updated);
        showToast("Hidden auction results revealed!", "success");
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to reveal results", "error");
      }
    } catch (e) {
      showToast("Connection issue", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Resolve a hidden auction tie
  const handleResolveHiddenTie = async (action: 'restart' | 'manual', manualWinner?: 'A' | 'B') => {
    if (!currentLobby) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/lobby/${currentLobby.code}/resolve-hidden-tie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, action, manualWinner })
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentLobby(updated);
        if (action === 'restart') {
          showToast("Hidden auction restarted! Place new bids.", "success");
        } else {
          showToast("Tie resolved and player assigned!", "success");
        }
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to resolve tie", "error");
      }
    } catch (e) {
      showToast("Connection issue", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Place a live auction bid
  const handlePlaceBid = async (bidAmount: number) => {
    if (!currentLobby) return;

    const currentPlayer = currentLobby.players.find(p => p.id === playerId);
    if (!currentPlayer || !currentPlayer.team) {
      showToast("Only active team players can place bids.", "error");
      return;
    }

    try {
      const res = await fetch(`/api/lobby/${currentLobby.code}/place-bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: currentPlayer.team, bidAmount }),
      });

      if (res.ok) {
        const updated = await res.json();
        setCurrentLobby(updated);
        showToast(`Bid of ${bidAmount}M successfully placed!`, "success");
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to place bid", "error");
      }
    } catch (e) {
      showToast("Connection issue, please try again", "error");
    }
  };

  // Leave active auction
  const handleLeaveAuction = async () => {
    if (!currentLobby) return;

    const currentPlayer = currentLobby.players.find(p => p.id === playerId);
    if (!currentPlayer || !currentPlayer.team) {
      showToast("Only active team players can leave the auction.", "error");
      return;
    }

    try {
      const res = await fetch(`/api/lobby/${currentLobby.code}/leave-auction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: currentPlayer.team }),
      });

      if (res.ok) {
        const updated = await res.json();
        setCurrentLobby(updated);
        showToast("You have left this auction.", "info");
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to leave auction", "error");
      }
    } catch (e) {
      showToast("Connection issue, please try again", "error");
    }
  };

  return (
    <div className="relative min-h-screen bg-[#050505] text-[#E0E0E0] font-sans antialiased flex flex-col justify-between overflow-x-hidden">
      
      {/* Aesthetic grid overlay of the theme */}
      <div 
        className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" 
        style={{ 
          backgroundImage: "radial-gradient(#333 1px, transparent 1px)", 
          backgroundSize: "32px 32px" 
        }} 
      />

      {/* Decorative radial lighting */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-transparent blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-emerald-500/5 via-cyan-500/10 to-transparent blur-[120px] pointer-events-none rounded-full" />

      {/* 1. TOP HEADER NAVIGATION BAR */}
      <header className="z-10 w-full px-6 py-5 border-b border-white/5 bg-[#050505]/80 backdrop-blur-md">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="cursor-pointer" onClick={() => { if (view !== 'waiting-room') setView('landing'); }}>
            <Logo size="sm" />
          </div>

          <div className="flex items-center space-x-2">
            {/* Connection Status Indicator Badge */}
            <div id="connection-status-badge" className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-white/10 bg-white/5">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-emerald-500 animate-pulse' :
                connectionStatus === 'reconnecting' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
              }`} />
              <span className={`text-[9px] uppercase tracking-[0.15em] font-semibold font-mono ${
                connectionStatus === 'connected' ? 'text-emerald-400' :
                connectionStatus === 'reconnecting' ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {connectionStatus === 'connected' ? '🟢 Connected' :
                 connectionStatus === 'reconnecting' ? '🟠 Reconnecting...' : '🔴 Disconnected'}
              </span>
            </div>
            
            {view === 'waiting-room' && (
              <button 
                id="leave-lobby-btn"
                onClick={handleLeaveLobby}
                className="p-1.5 rounded-lg border border-white/10 hover:border-neon-crimson/50 hover:bg-neon-crimson/10 transition-all text-gray-400 hover:text-neon-crimson"
                title="Leave Lobby"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. MAIN MOBILE-FIRST CORE CONTENT */}
      <main className="z-10 flex-1 flex flex-col justify-center items-center w-full max-w-md mx-auto px-4 py-6">
        <AnimatePresence mode="wait">

          {/* STATE A: LANDING PAGE */}
          {view === 'landing' && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full flex flex-col space-y-6"
            >
              {/* High Polish Visual Hero */}
              <div className="text-center space-y-3 pt-4">
                <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tighter leading-none text-white font-display">
                  ELITE<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                    PITCH
                  </span>
                </h2>
                <p className="text-sm text-neutral-400 max-w-xs mx-auto leading-relaxed">
                  The definitive private football draft and auction engine. Premium mechanics for the modern manager.
                </p>
              </div>

              {/* Action Cards Container */}
              <div className="space-y-4">
                {/* 1. Quick Join Code input box (Glass) */}
                <form 
                  id="join-code-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const code = joinCodeInput.trim().toUpperCase();
                    if (!code) {
                      showToast("Please enter a lobby code", "error");
                      return;
                    }
                    handleFetchAndJoinLobby(code);
                  }}
                  className="p-5 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl relative group transition-all duration-300 hover:border-white/20"
                >
                  <div className="flex flex-col space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 font-mono">
                        Quick Join Game
                      </span>
                      <span className="text-[9px] uppercase tracking-widest text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded">
                        Active Code
                      </span>
                    </div>

                    <div className="flex space-x-2">
                      <input
                        id="lobby-code-input"
                        type="text"
                        maxLength={5}
                        placeholder="ENTER 5-LETTER CODE"
                        value={joinCodeInput}
                        onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                        className="flex-1 bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold tracking-widest placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/50 transition-all text-white uppercase"
                      />
                      <button
                        id="submit-join-code-btn"
                        type="submit"
                        disabled={isLoading}
                        className="bg-white text-black font-extrabold px-5 rounded-xl hover:bg-neutral-200 transition-transform active:scale-95 flex items-center justify-center disabled:opacity-50"
                      >
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </form>

                {/* 2. Create New Lobby Card (Main Accent) */}
                <div 
                  onClick={() => setView('create-lobby')}
                  className="p-5 rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,_#111a15_0%,_#0a0a0a_80%)] backdrop-blur-xl hover:border-emerald-500/30 transition-all duration-300 cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-emerald-400 group-hover:animate-bounce" />
                        <h3 className="font-display font-bold text-lg text-white">Create Lobby</h3>
                      </div>
                      <p className="text-xs text-neutral-400">
                        Become the Judge. Setup teams & invite friends.
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-all">
                      <Plus className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Public Lobbies Browser Segment */}
                <div className="p-5 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-neutral-500 font-mono">
                      Active Public Lobbies ({publicLobbies.length})
                    </span>
                    <button 
                      id="refresh-lobbies-btn"
                      onClick={fetchPublicLobbies}
                      className="text-[10px] uppercase font-mono font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Refresh
                    </button>
                  </div>

                  {publicLobbies.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-white/5 rounded-2xl">
                      <Compass className="w-8 h-8 text-neutral-700 mx-auto mb-2" />
                      <p className="text-xs text-neutral-500 font-medium">No open public rooms right now.</p>
                      <p className="text-[10px] text-neutral-600 mt-0.5">Toggle public on creation to share here.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                      {publicLobbies.map((lobby) => (
                        <div 
                          key={lobby.code}
                          onClick={() => {
                            setJoinCodeInput(lobby.code);
                            handleFetchAndJoinLobby(lobby.code);
                          }}
                          className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/20 hover:bg-white/[0.08] transition-all cursor-pointer flex items-center justify-between"
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white uppercase font-mono tracking-wide">
                              {lobby.teamAName} vs {lobby.teamBName}
                            </span>
                            <span className="text-[10px] text-neutral-500">
                              Judge: <span className="text-neutral-400">{lobby.judgeName}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono text-neutral-400 bg-white/5 px-2 py-0.5 rounded-lg">
                              {lobby.playerCount} joined
                            </span>
                            <div className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-lg text-xs font-mono font-bold">
                              #{lobby.code}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Sub-telemetry Footer */}
              <div className="flex justify-between items-center opacity-40 px-1 pt-2">
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-widest font-bold">Latency</span>
                  <span className="text-[10px] font-mono">14ms pitch-sync</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[9px] uppercase tracking-widest font-bold">Security</span>
                  <span className="text-[10px] font-mono">AES_256_Lobby</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[9px] uppercase tracking-widest font-bold">Auth</span>
                  <span className="text-[10px] font-mono">Direct / Judge</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* STATE C: CREATE LOBBY VIEW */}
          {view === 'create-lobby' && (
            <motion.div
              key="create"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full flex flex-col space-y-6"
            >
              <div className="space-y-2">
                <button 
                  id="back-from-create-btn"
                  onClick={() => setView('landing')}
                  className="text-xs text-neutral-500 hover:text-white transition-colors"
                >
                  ← Back to landing
                </button>
                <h3 className="text-3xl font-extrabold text-white tracking-tight font-display">
                  Create Lobby
                </h3>
                <p className="text-xs text-neutral-400">
                  Setup team parameters and register as the stadium Judge. No password required.
                </p>
              </div>

              <form id="create-lobby-form" onSubmit={handleCreateLobby} className="space-y-5">
                
                {/* 1. Judge Name */}
                <div className="space-y-1.5">
                  <label htmlFor="judge-name-input" className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">
                    Judge Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input
                      id="judge-name-input"
                      type="text"
                      required
                      placeholder="e.g. Marcus Aurelius"
                      value={formJudgeName}
                      onChange={(e) => setFormJudgeName(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:border-emerald-500/50 transition-all text-white font-medium"
                    />
                  </div>
                </div>

                {/* 2. Public vs Private Selector */}
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">
                    Lobby Visibility
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      id="lobby-private-btn"
                      type="button"
                      onClick={() => setIsLobbyPrivate(true)}
                      className={`py-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-center space-x-2 transition-all
                        ${isLobbyPrivate 
                          ? 'border-emerald-500/50 bg-emerald-500/5 text-white' 
                          : 'border-white/5 bg-[#0a0a0a] text-neutral-400 hover:border-white/10'
                        }`}
                    >
                      <Lock className="w-4 h-4 text-emerald-400" />
                      <span>Private Lobby</span>
                    </button>
                    
                    <button
                      id="lobby-public-btn"
                      type="button"
                      onClick={() => setIsLobbyPrivate(false)}
                      className={`py-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-center space-x-2 transition-all
                        ${!isLobbyPrivate 
                          ? 'border-emerald-500/50 bg-emerald-500/5 text-white' 
                          : 'border-white/5 bg-[#0a0a0a] text-neutral-400 hover:border-white/10'
                        }`}
                    >
                      <Globe className="w-4 h-4 text-cyan-400" />
                      <span>Public Lobby</span>
                    </button>
                  </div>
                </div>

                {/* 3. Match Type Selector */}
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">
                    Match Type
                  </span>
                  <div className="grid grid-cols-3 gap-3">
                    {(['5v5', '7v7', '11v11'] as const).map((type) => {
                      const label = type === '5v5' ? '5 vs 5' : type === '7v7' ? '7 vs 7' : '11 vs 11';
                      const desc = type === '5v5' ? '100M • 5 Rounds' : type === '7v7' ? '150M • 7 Rounds' : '500M • 11 Rounds';
                      const isSelected = matchType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setMatchType(type)}
                          className={`p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center justify-center space-y-1 transition-all
                            ${isSelected 
                              ? 'border-emerald-500/50 bg-emerald-500/5 text-white' 
                              : 'border-white/5 bg-[#0a0a0a] text-neutral-400 hover:border-white/10'
                            }`}
                        >
                          <span className="font-display font-extrabold text-sm">{type}</span>
                          <span className="text-[9px] text-neutral-500 font-mono font-medium">{desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Team Customization Fields */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 font-mono">
                    Staging Team Names
                  </span>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="team-a-name-input" className="text-[9px] uppercase text-neutral-400 font-medium">Team A (Left Side)</label>
                      <input
                        id="team-a-name-input"
                        type="text"
                        required
                        placeholder="Red Devils FC"
                        value={formTeamAName}
                        onChange={(e) => setFormTeamAName(e.target.value)}
                        className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500/50 transition-all text-white font-medium"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="team-b-name-input" className="text-[9px] uppercase text-neutral-400 font-medium">Team B (Right Side)</label>
                      <input
                        id="team-b-name-input"
                        type="text"
                        required
                        placeholder="Blue Knights"
                        value={formTeamBName}
                        onChange={(e) => setFormTeamBName(e.target.value)}
                        className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500/50 transition-all text-white font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Action Submit */}
                <button
                  id="submit-create-lobby-btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 bg-white text-black font-extrabold rounded-2xl text-sm transition-transform active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {isLoading ? 'GENERATING FIELD...' : 'INITIALIZE LOBBY'}
                  {!isLoading && <Plus className="w-4 h-4" />}
                </button>
              </form>
            </motion.div>
          )}

          {/* STATE D: ACTIVE LOBBY / WAITING ROOM */}
          {view === 'waiting-room' && currentLobby && (() => {
            const hasClaimedTeam = currentLobby.players.some(p => p.id === playerId);
            const showClaimView = !isJudge && !hasClaimedTeam;

            if (showClaimView) {
              const playerA = currentLobby.players.find(p => p.team === 'A');
              const playerB = currentLobby.players.find(p => p.team === 'B');

              const isTeamAOccupied = !!playerA && playerA.id !== playerId;
              const isTeamBOccupied = !!playerB && playerB.id !== playerId;

              return (
                <motion.div
                  key="claim-team-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="w-full flex flex-col space-y-6"
                >
                  <div className="text-center space-y-2">
                    <span className="text-[10px] uppercase font-mono tracking-[0.25em] font-bold text-emerald-400">
                      Choose Your Side
                    </span>
                    <h2 className="text-3xl font-extrabold text-white font-display tracking-tight leading-none uppercase">
                      Select Team
                    </h2>
                    <p className="text-xs text-neutral-400 max-w-xs mx-auto leading-relaxed">
                      Lobby <span className="text-emerald-400 font-mono font-bold">#{currentLobby.code}</span> • Created by Judge <strong className="text-white">@{currentLobby.judgeName}</strong>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {/* Team A Button */}
                    <button
                      id="claim-team-a-btn"
                      disabled={isTeamAOccupied || isLoading}
                      onClick={() => handleClaimTeam('A')}
                      className={`relative p-6 rounded-3xl border-2 text-left transition-all duration-300 flex flex-col justify-between h-36
                        ${isTeamAOccupied 
                          ? 'border-white/5 bg-[#0a0a0a]/50 opacity-40 cursor-not-allowed'
                          : 'border-white/10 bg-gradient-to-br from-emerald-950/20 to-black hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/5 cursor-pointer active:scale-[0.98]'
                        }`}
                    >
                      <div className="flex justify-between items-start w-full">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded">
                          TEAM A
                        </span>
                        {isTeamAOccupied ? (
                          <span className="text-[9px] uppercase tracking-widest text-red-500 font-mono bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-500/20">
                            Occupied
                          </span>
                        ) : (
                          <span className="text-[9px] uppercase tracking-widest text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 animate-pulse">
                            Available
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="block text-xl font-extrabold text-white font-display tracking-tight">
                          {currentLobby.teamAName}
                        </span>
                        <span className="text-xs text-neutral-400 font-medium">
                          {isTeamAOccupied ? 'Managed by opponent' : 'Claim this team'}
                        </span>
                      </div>
                    </button>

                    {/* Team B Button */}
                    <button
                      id="claim-team-b-btn"
                      disabled={isTeamBOccupied || isLoading}
                      onClick={() => handleClaimTeam('B')}
                      className={`relative p-6 rounded-3xl border-2 text-left transition-all duration-300 flex flex-col justify-between h-36
                        ${isTeamBOccupied 
                          ? 'border-white/5 bg-[#0a0a0a]/50 opacity-40 cursor-not-allowed'
                          : 'border-white/10 bg-gradient-to-br from-cyan-950/20 to-black hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/5 cursor-pointer active:scale-[0.98]'
                        }`}
                    >
                      <div className="flex justify-between items-start w-full">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-cyan-400 font-mono bg-cyan-500/10 px-2 py-0.5 rounded">
                          TEAM B
                        </span>
                        {isTeamBOccupied ? (
                          <span className="text-[9px] uppercase tracking-widest text-red-500 font-mono bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-500/20">
                            Occupied
                          </span>
                        ) : (
                          <span className="text-[9px] uppercase tracking-widest text-cyan-400 font-mono bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/20 animate-pulse">
                            Available
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="block text-xl font-extrabold text-white font-display tracking-tight">
                          {currentLobby.teamBName}
                        </span>
                        <span className="text-xs text-neutral-400 font-medium">
                          {isTeamBOccupied ? 'Managed by opponent' : 'Claim this team'}
                        </span>
                      </div>
                    </button>
                  </div>

                  <button
                    id="leave-claim-btn"
                    onClick={handleLeaveLobby}
                    className="text-xs text-neutral-500 hover:text-white transition-colors text-center w-full py-2"
                  >
                    ← Return to Main Page
                  </button>
                </motion.div>
              );
            }

            return (
              <motion.div
                key="waiting-room-lobby"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="w-full flex flex-col space-y-6"
              >
                {/* Lobby Status Header card */}
                <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-widest text-neutral-500 font-bold">
                      Arena Code
                    </span>
                    <span className="text-xl font-mono font-black text-white tracking-widest flex items-center gap-1.5">
                      {currentLobby.code}
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[9px] uppercase tracking-widest text-neutral-500 font-bold">
                      Lobby Mode
                    </span>
                    <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-neutral-300">
                      {currentLobby.isPrivate ? (
                        <>
                          <Lock className="w-3.5 h-3.5 text-emerald-400" /> Private
                        </>
                      ) : (
                        <>
                          <Globe className="w-3.5 h-3.5 text-cyan-400" /> Public
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Real-time Judge Connection Status Panel */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3.5 shadow-xl shadow-black/40">
                  <div className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase pb-1.5 border-b border-white/5 flex justify-between">
                    <span>Lobby Status</span>
                    <span className="text-emerald-400 font-mono">Judge @{currentLobby.judgeName}</span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-300">Team A: <span className="text-white font-bold">{currentLobby.teamAName}</span></span>
                      {currentLobby.players.some(p => p.team === 'A') ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                          ✅ Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[10px] text-amber-500 font-bold bg-amber-500/5 px-2.5 py-0.5 rounded-full border border-amber-500/10">
                          ⏳ Waiting
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-300">Team B: <span className="text-white font-bold">{currentLobby.teamBName}</span></span>
                      {currentLobby.players.some(p => p.team === 'B') ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                          ✅ Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[10px] text-amber-500 font-bold bg-amber-500/5 px-2.5 py-0.5 rounded-full border border-amber-500/10">
                          ⏳ Waiting
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Waiting Status Panel */}
                <div className="text-center py-1 space-y-1">
                  <h2 className="text-2xl font-bold text-white tracking-tight font-display">Lobby Pitch</h2>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-400">
                    {currentLobby.status === 'ready' ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                        Ready to begin the auction!
                      </span>
                    ) : (
                      <span className="text-neutral-500 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 inline-block" />
                        Waiting for both sides to claim their teams...
                      </span>
                    )}
                  </div>
                </div>

                {/* TACTICAL FOOTBALL PITCH FOR INTERACTIVE SELECTION */}
                <FootballPitch 
                  players={currentLobby.players}
                  teamAName={currentLobby.teamAName}
                  teamBName={currentLobby.teamBName}
                  activePlayerId={playerId}
                  onSelectTeam={handleSelectTeam}
                />

                {/* Invite link share section */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] uppercase tracking-widest font-mono text-neutral-500 font-bold">
                      Lobby Secret Link
                    </span>
                    <span className="text-[9px] font-mono text-neutral-500">
                      {currentLobby.players.length} online
                    </span>
                  </div>

                  <div className="flex items-center bg-black/60 border border-white/5 rounded-xl p-2.5 overflow-hidden">
                    <code className="text-xs text-neutral-400 flex-1 truncate uppercase font-mono tracking-tight select-all">
                      {window.location.origin}?lobby={currentLobby.code}
                    </code>
                    <button
                      id="copy-link-btn"
                      onClick={handleCopyLink}
                      className="ml-2 p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      {isCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Judge Actions controls vs Player status */}
                {isJudge ? (
                  <div className="space-y-3 pt-2">
                    <button
                      id="start-auction-btn"
                      onClick={handleStartAuction}
                      className={`w-full py-4 font-extrabold rounded-2xl text-sm transition-transform active:scale-95 flex items-center justify-center space-x-2
                        ${currentLobby.status === 'ready'
                          ? 'bg-white text-black text-black'
                          : 'bg-white/10 text-neutral-500 cursor-not-allowed border border-white/5'
                        }`}
                    >
                      <span>START AUCTION DRAFT</span>
                      <Trophy className="w-4 h-4" />
                    </button>

                    {currentLobby.status !== 'ready' && (
                      <div className="p-3 bg-neutral-900/40 border border-amber-500/15 rounded-xl flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-[10px] text-neutral-400 leading-normal">
                          <strong>Judge Note:</strong> Start option activates as soon as both Team A ({currentLobby.teamAName}) and Team B ({currentLobby.teamBName}) are claimed.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center p-3 bg-white/[0.01] border border-white/5 rounded-2xl">
                    <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                      Waiting for Judge <span className="text-emerald-400">@{currentLobby.judgeName}</span> to launch the game
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })()}

          {/* STATE E: ACTIVE AUCTION ROOM */}
          {view === 'auction-room' && currentLobby && (
            <motion.div
              key="auction-room-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full flex flex-col space-y-6"
            >
              {isJudge ? (
                <JudgeAuctionRoom
                  lobby={currentLobby}
                  onUpdatePlayers={handleUpdatePlayers}
                  onSetAuctionStatus={handleSetAuctionStatus}
                  onLeave={handleLeaveLobby}
                  isLoading={isLoading}
                  onRevealHiddenResults={handleRevealHiddenResults}
                  onResolveHiddenTie={handleResolveHiddenTie}
                  onNewMatch={handleStartAuction}
                />
              ) : (
                <TeamAuctionRoom
                  lobby={currentLobby}
                  playerId={playerId}
                  onLeave={handleLeaveLobby}
                  showToast={showToast}
                  onPlaceBid={handlePlaceBid}
                  onLeaveAuction={handleLeaveAuction}
                  onPlaceHiddenBid={handlePlaceHiddenBid}
                />
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* 3. SIMULATED START AUCTION CONGRATULATIONS DIALOG (STADIUM READY) */}
      <AnimatePresence>
        {showGameStartModal && currentLobby && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,_#141f1a_0%,_#070707_80%)] p-6 text-center space-y-6 shadow-2xl shadow-emerald-500/10"
            >
              <div className="relative mx-auto w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-md animate-pulse" />
                <Trophy className="w-8 h-8 text-emerald-400 relative" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-extrabold text-white font-display uppercase tracking-tight">
                  Pitch Ready!
                </h3>
                <p className="text-xs text-neutral-400">
                  Lobby <span className="text-emerald-400 font-mono font-bold">#{currentLobby.code}</span> has successfully locked in coordinates.
                </p>
              </div>

              <div className="border border-white/5 rounded-2xl p-4 bg-white/[0.02] text-left space-y-3">
                <span className="text-[9px] uppercase font-mono text-neutral-500 font-bold block">
                  Match Overview
                </span>
                
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <span className="block text-gray-400 font-medium">{currentLobby.teamAName}</span>
                    <span className="text-[10px] text-neutral-500">
                      {currentLobby.players.filter(p => p.team === 'A').length} Squad Members
                    </span>
                  </div>
                  <span className="text-emerald-400 font-bold font-mono">VS</span>
                  <div className="text-right">
                    <span className="block text-gray-400 font-medium">{currentLobby.teamBName}</span>
                    <span className="text-[10px] text-neutral-500">
                      {currentLobby.players.filter(p => p.team === 'B').length} Squad Members
                    </span>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-white/5 text-center">
                  <span className="text-[10px] text-neutral-400">
                    Stadium Judge: <strong className="text-white">@{currentLobby.judgeName}</strong>
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  id="close-draft-success-btn"
                  onClick={() => setShowGameStartModal(false)}
                  className="w-full py-3.5 bg-emerald-500 text-black font-extrabold rounded-xl text-xs hover:bg-emerald-400 transition-colors uppercase tracking-wider"
                >
                  Enter Auction Room (Simulated)
                </button>
                <button
                  id="dismiss-dialog-btn"
                  onClick={() => setShowGameStartModal(false)}
                  className="w-full py-3 text-neutral-400 hover:text-white transition-colors text-xs uppercase"
                >
                  Return to Lobby Pitch
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. TOAST CONTAINER */}
      <Toast toasts={toasts} onRemove={removeToast} />

      {/* 5. HUD TELEMETRY FOOTER */}
      <footer className="z-10 py-4 border-t border-white/5 bg-[#050505] text-center">
        <p className="text-[9px] uppercase tracking-[0.2em] text-neutral-600 font-bold">
          STADIUM DRAFT ENGINE • PRIVATE GAME CONSOLE
        </p>
      </footer>

    </div>
  );
}
