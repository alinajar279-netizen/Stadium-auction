import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { Lobby, Player, FootballPlayer, MATCH_CONFIGS } from "./src/types";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory store for lobbies. In a simple app, this works beautifully
// and avoids complex database setups while retaining instant multi-device synchrony!
const lobbies = new Map<string, Lobby>();

// Helper to generate a unique 5-letter uppercase code
function generateLobbyCode(): string {
  const chars = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789"; // No O/0 to avoid confusion
  let code = "";
  do {
    code = "";
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (lobbies.has(code));
  return code;
}

// Clean up expired/stale lobbies (older than 4 hours)
setInterval(() => {
  const now = new Date().getTime();
  const fourHours = 4 * 60 * 60 * 1000;
  for (const [code, lobby] of lobbies.entries()) {
    const createdTime = new Date(lobby.createdAt).getTime();
    if (now - createdTime > fourHours) {
      lobbies.delete(code);
      console.log(`[Lobby Cleanup] Deleted expired lobby ${code}`);
    }
  }
}, 30 * 60 * 1000); // run every 30 minutes

// ---------------------- API ROUTES ----------------------

// Get list of public lobbies
app.get("/api/public-lobbies", (req, res) => {
  const publicList = Array.from(lobbies.values())
    .filter(l => !l.isPrivate)
    .map(l => ({
      code: l.code,
      judgeName: l.judgeName,
      teamAName: l.teamAName,
      teamBName: l.teamBName,
      playerCount: l.players.length,
      createdAt: l.createdAt
    }));
  res.json(publicList);
});

// Create a new lobby (Judge acts as creator)
app.post("/api/lobby", (req, res) => {
  const { judgeName, teamAName, teamBName, isPrivate, judgeId, matchType } = req.body;

  if (!judgeName || !teamAName || !teamBName) {
    return res.status(400).json({ error: "Missing required lobby details" });
  }

  const selectedMatchType = (matchType === '5v5' || matchType === '7v7' || matchType === '11v11') ? matchType : '11v11';
  const config = MATCH_CONFIGS[selectedMatchType];

  const code = generateLobbyCode();
  const newLobby: Lobby = {
    code,
    isPrivate: !!isPrivate,
    judgeName: judgeName.trim(),
    judgeId,
    teamAName: teamAName.trim(),
    teamBName: teamBName.trim(),
    createdAt: new Date().toISOString(),
    players: [],
    status: "waiting",
    activePlayer: null,
    hiddenPlayer: null,
    auctionStatus: "waiting",
    currentBid: 0,
    leadingTeam: null,
    teamALeft: false,
    teamBLeft: false,
    winnerTeam: null,
    teamAPlayers: [],
    teamBPlayers: [],
    teamABudget: config.budget,
    teamBBudget: config.budget,
    history: [],
    auctionMode: "public",
    teamAAttempts: [],
    teamBAttempts: [],
    hiddenAuctionRevealed: false,
    tieDetected: false,
    matchType: selectedMatchType,
    currentRound: 1,
    matchFinished: false,
  };

  lobbies.set(code, newLobby);
  console.log(`[Lobby Created] Code: ${code}, Judge: ${judgeName}, Teams: ${teamAName} vs ${teamBName}`);
  res.json(newLobby);
});

// Get detailed status of a specific lobby
app.get("/api/lobby/:code", (req, res) => {
  const code = req.params.code.toUpperCase();
  const lobby = lobbies.get(code);

  if (!lobby) {
    return res.status(404).json({ error: "Lobby not found" });
  }

  const { playerId } = req.query;
  const isJudge = lobby.judgeId === playerId;
  const player = lobby.players.find(p => p.id === playerId);
  const team = player?.team; // 'A' or 'B'

  // Clone the lobby so we do not mutate the in-memory master copy
  const clientLobby: any = { ...lobby };

  // If Hidden Auction is running and not yet finished
  if (clientLobby.auctionMode === 'hidden' && clientLobby.auctionStatus !== 'finished') {
    // Hidden Player is NEVER visible to teams while not finished
    if (!isJudge) {
      clientLobby.hiddenPlayer = null;
    }

    // Hide attempts details from teams
    if (team === 'A') {
      // Team A only sees their own attempts
      clientLobby.teamBAttempts = [];
    } else if (team === 'B') {
      // Team B only sees their own attempts
      clientLobby.teamAAttempts = [];
    } else if (!isJudge) {
      // Spectator/other
      clientLobby.teamAAttempts = [];
      clientLobby.teamBAttempts = [];
    }

    // Judge NEVER sees the actual bid amounts, only the counts
    if (isJudge) {
      clientLobby.teamAAttemptsCount = lobby.teamAAttempts ? lobby.teamAAttempts.length : 0;
      clientLobby.teamBAttemptsCount = lobby.teamBAttempts ? lobby.teamBAttempts.length : 0;
      clientLobby.teamAAttempts = [];
      clientLobby.teamBAttempts = [];
    }
  }

  res.json(clientLobby);
});

// Player claims a team (joins lobby under Team A or B)
app.post("/api/lobby/:code/claim-team", (req, res) => {
  const code = req.params.code.toUpperCase();
  const { playerId, team } = req.body; // team is 'A' or 'B'

  if (!playerId || (team !== 'A' && team !== 'B')) {
    return res.status(400).json({ error: "Player ID and team selection ('A' or 'B') are required" });
  }

  const lobby = lobbies.get(code);
  if (!lobby) {
    return res.status(404).json({ error: "Lobby not found" });
  }

  // Check if team is already claimed by someone else
  const existingPlayerWithTeam = lobby.players.find(p => p.team === team);
  if (existingPlayerWithTeam && existingPlayerWithTeam.id !== playerId) {
    return res.status(400).json({ error: `Team ${team === 'A' ? lobby.teamAName : lobby.teamBName} is already occupied` });
  }

  // Remove player from any previous teams in this lobby to prevent double entry
  lobby.players = lobby.players.filter(p => p.id !== playerId);

  const player: Player = {
    id: playerId,
    name: `${team === 'A' ? lobby.teamAName : lobby.teamBName} Manager`,
    team,
    joinedAt: new Date().toISOString()
  };
  lobby.players.push(player);

  // Update status based on team distribution (requires both Team A and Team B)
  const hasTeamA = lobby.players.some(p => p.team === 'A');
  const hasTeamB = lobby.players.some(p => p.team === 'B');
  lobby.status = (hasTeamA && hasTeamB) ? 'ready' : 'waiting';

  console.log(`[Team Claimed] Lobby: ${code}, Player: ${player.name}, Team: ${team}`);
  res.json({ lobby, player });
});

// Select or toggle team selection (for compatibility / custom updates)
app.post("/api/lobby/:code/select-team", (req, res) => {
  const code = req.params.code.toUpperCase();
  const { playerId, team } = req.body; // team is 'A', 'B', or null

  const lobby = lobbies.get(code);
  if (!lobby) {
    return res.status(404).json({ error: "Lobby not found" });
  }

  // If team is null (e.g. going to bench / releasing team)
  if (team === null) {
    lobby.players = lobby.players.filter(p => p.id !== playerId);
  } else {
    // Check if team is occupied by another player
    const existingPlayerWithTeam = lobby.players.find(p => p.team === team);
    if (existingPlayerWithTeam && existingPlayerWithTeam.id !== playerId) {
      return res.status(400).json({ error: "This team is already occupied" });
    }

    lobby.players = lobby.players.filter(p => p.id !== playerId);
    lobby.players.push({
      id: playerId,
      name: `${team === 'A' ? lobby.teamAName : lobby.teamBName} Manager`,
      team,
      joinedAt: new Date().toISOString()
    });
  }

  // Update status based on team distribution
  const hasTeamA = lobby.players.some(p => p.team === 'A');
  const hasTeamB = lobby.players.some(p => p.team === 'B');
  lobby.status = (hasTeamA && hasTeamB) ? 'ready' : 'waiting';

  console.log(`[Team Selection] Lobby: ${code}, Player ID: ${playerId}, Team: ${team}`);
  res.json(lobby);
});

// Player leaves a lobby
app.post("/api/lobby/:code/leave", (req, res) => {
  const code = req.params.code.toUpperCase();
  const { playerId } = req.body;

  const lobby = lobbies.get(code);
  if (!lobby) {
    return res.status(404).json({ error: "Lobby not found" });
  }

  const initialCount = lobby.players.length;
  lobby.players = lobby.players.filter(p => p.id !== playerId);

  if (lobby.players.length !== initialCount) {
    console.log(`[Player Left] Lobby: ${code}, Player ID: ${playerId}`);
    const hasTeamA = lobby.players.some(p => p.team === 'A');
    const hasTeamB = lobby.players.some(p => p.team === 'B');
    lobby.status = (hasTeamA && hasTeamB) ? 'ready' : 'waiting';
  }

  res.json(lobby);
});

// Reconnect to a lobby using saved session info
app.post("/api/lobby/:code/reconnect", (req, res) => {
  const code = req.params.code.toUpperCase();
  const { playerId, role, isJudge } = req.body;

  if (!playerId) {
    return res.status(400).json({ error: "Player ID/Session ID is required to reconnect" });
  }

  const lobby = lobbies.get(code);
  if (!lobby) {
    return res.status(404).json({ error: "Lobby not found" });
  }

  // If Judge reconnects
  if (isJudge === true || role === 'judge') {
    return res.json({ lobby, role: 'judge', isJudge: true });
  }

  // If Team A or B reconnects
  if (role === 'A' || role === 'B') {
    const existingTeamPlayer = lobby.players.find(p => p.team === role);
    if (existingTeamPlayer) {
      if (existingTeamPlayer.id === playerId) {
        return res.json({ lobby, role, isJudge: false });
      } else {
        return res.status(400).json({ error: `Team ${role === 'A' ? lobby.teamAName : lobby.teamBName} is already occupied by another device.` });
      }
    } else {
      // Re-claim the slot if vacant
      const player: Player = {
        id: playerId,
        name: `${role === 'A' ? lobby.teamAName : lobby.teamBName} Manager`,
        team: role,
        joinedAt: new Date().toISOString()
      };
      lobby.players = lobby.players.filter(p => p.id !== playerId);
      lobby.players.push(player);

      const hasTeamA = lobby.players.some(p => p.team === 'A');
      const hasTeamB = lobby.players.some(p => p.team === 'B');
      lobby.status = (hasTeamA && hasTeamB) ? 'ready' : 'waiting';

      console.log(`[Reclaim Slot] Lobby: ${code}, Player ID: ${playerId}, Team: ${role}`);
      return res.json({ lobby, role, isJudge: false });
    }
  }

  return res.status(400).json({ error: "Invalid reconnect parameters" });
});

// Start the auction draft (automatically transitions players)
app.post("/api/lobby/:code/start-draft", (req, res) => {
  const code = req.params.code.toUpperCase();
  const { playerId } = req.body;
  const lobby = lobbies.get(code);
  if (!lobby) {
    return res.status(404).json({ error: "Lobby not found" });
  }

  // Verify Judge Authority
  if (!playerId) {
    return res.status(400).json({ error: "Player ID is required for authentication." });
  }
  if (!lobby.judgeId) {
    lobby.judgeId = playerId;
  } else if (lobby.judgeId !== playerId) {
    return res.status(403).json({ error: "Unauthorized: Only the Judge can start the draft." });
  }

  const config = MATCH_CONFIGS[lobby.matchType || '11v11'];
  lobby.status = 'active';
  lobby.auctionStatus = 'waiting';
  lobby.activePlayer = null;
  lobby.hiddenPlayer = null;
  lobby.currentBid = 0;
  lobby.leadingTeam = null;
  lobby.teamALeft = false;
  lobby.teamBLeft = false;
  lobby.winnerTeam = null;
  lobby.teamAPlayers = [];
  lobby.teamBPlayers = [];
  lobby.teamABudget = config.budget;
  lobby.teamBBudget = config.budget;
  lobby.currentRound = 1;
  lobby.matchFinished = false;
  lobby.auctionMode = 'public';
  lobby.teamAAttempts = [];
  lobby.teamBAttempts = [];
  lobby.hiddenAuctionRevealed = false;
  lobby.tieDetected = false;

  console.log(`[Draft Started] Lobby: ${code}`);
  res.json(lobby);
});

// Update the selected players (visible and/or hidden)
app.post("/api/lobby/:code/nominate", (req, res) => {
  const code = req.params.code.toUpperCase();
  const { activePlayer, hiddenPlayer, playerId } = req.body; // activePlayer, hiddenPlayer: { name, position } | null
  const lobby = lobbies.get(code);
  if (!lobby) {
    return res.status(404).json({ error: "Lobby not found" });
  }

  // Verify Judge Authority
  if (!playerId) {
    return res.status(400).json({ error: "Player ID is required for authentication." });
  }
  if (!lobby.judgeId) {
    lobby.judgeId = playerId;
  } else if (lobby.judgeId !== playerId) {
    return res.status(403).json({ error: "Unauthorized: Only the Judge can select/nominate players." });
  }

  if (lobby.matchFinished) {
    return res.status(400).json({ error: "Match completed. No more nominations can be made." });
  }
  const config = MATCH_CONFIGS[lobby.matchType || '11v11'];
  if ((lobby.teamAPlayers || []).length >= config.maxPlayers || (lobby.teamBPlayers || []).length >= config.maxPlayers) {
    return res.status(400).json({ error: `Teams have already reached the maximum roster limit of ${config.maxPlayers} players.` });
  }

  if (activePlayer !== undefined) {
    lobby.activePlayer = activePlayer;
    // Nominating a new player resets current bid and leading team
    lobby.currentBid = 0;
    lobby.leadingTeam = null;
    lobby.teamALeft = false;
    lobby.teamBLeft = false;
    lobby.winnerTeam = null;
  }
  if (hiddenPlayer !== undefined) {
    lobby.hiddenPlayer = hiddenPlayer;
  }

  console.log(`[Nomination Updated] Lobby: ${code}, Active: ${lobby.activePlayer?.name || 'none'}, Hidden: ${lobby.hiddenPlayer?.name || 'none'}`);
  res.json(lobby);
});

// Update auction status
app.post("/api/lobby/:code/set-auction-status", (req, res) => {
  const code = req.params.code.toUpperCase();
  const { status, playerId, auctionMode } = req.body; // 'waiting' | 'running' | 'finished', auctionMode: 'public' | 'hidden'
  const lobby = lobbies.get(code);
  if (!lobby) {
    return res.status(404).json({ error: "Lobby not found" });
  }

  // Verify Judge Authority
  if (!playerId) {
    return res.status(400).json({ error: "Player ID is required for authentication." });
  }
  if (!lobby.judgeId) {
    lobby.judgeId = playerId;
  } else if (lobby.judgeId !== playerId) {
    return res.status(403).json({ error: "Unauthorized: Only the Judge can control the auction state." });
  }

  if (status === 'waiting' || status === 'running' || status === 'finished') {
    if (status === 'running' || status === 'waiting') {
      if (lobby.matchFinished) {
        return res.status(400).json({ error: "The match has already finished. No more auctions can be started." });
      }
      const config = MATCH_CONFIGS[lobby.matchType || '11v11'];
      if ((lobby.teamAPlayers || []).length >= config.maxPlayers || (lobby.teamBPlayers || []).length >= config.maxPlayers) {
        return res.status(400).json({ error: `Teams have already reached the maximum roster limit of ${config.maxPlayers} players.` });
      }
    }

    if (status === 'running') {
      const mode = auctionMode || 'public';
      if (mode === 'hidden') {
        if (!lobby.activePlayer || !lobby.hiddenPlayer) {
          return res.status(400).json({ error: "Both a Visible Player and a Hidden Player must be nominated to start a Hidden Auction." });
        }
        lobby.auctionMode = 'hidden';
        lobby.teamAAttempts = [];
        lobby.teamBAttempts = [];
        lobby.hiddenAuctionRevealed = false;
        lobby.tieDetected = false;
        lobby.currentBid = 0;
        lobby.leadingTeam = null;
        lobby.winnerTeam = null;
      } else {
        if (!lobby.activePlayer) {
          return res.status(400).json({ error: "A Visible Player must be nominated to start the auction." });
        }
        lobby.auctionMode = 'public';
        lobby.teamAAttempts = [];
        lobby.teamBAttempts = [];
        lobby.hiddenAuctionRevealed = false;
        lobby.tieDetected = false;
      }
      lobby.auctionStatus = 'running';
    } else if (status === 'finished') {
      const winner = lobby.winnerTeam || lobby.leadingTeam;
      if (winner && lobby.activePlayer && lobby.hiddenPlayer) {
        if (!lobby.teamAPlayers) lobby.teamAPlayers = [];
        if (!lobby.teamBPlayers) lobby.teamBPlayers = [];

        if (winner === 'A') {
          lobby.teamAPlayers.push(lobby.activePlayer);
          lobby.teamBPlayers.push(lobby.hiddenPlayer);
          const winningBid = lobby.currentBid || 0;
          lobby.teamABudget = Math.max(0, (lobby.teamABudget ?? 500) - winningBid);
        } else {
          lobby.teamBPlayers.push(lobby.activePlayer);
          lobby.teamAPlayers.push(lobby.hiddenPlayer);
          const winningBid = lobby.currentBid || 0;
          lobby.teamBBudget = Math.max(0, (lobby.teamBBudget ?? 500) - winningBid);
        }

        // Add to draft history
        if (!lobby.history) {
          lobby.history = [];
        }
        lobby.history.push({
          visiblePlayer: lobby.activePlayer,
          hiddenPlayer: lobby.hiddenPlayer,
          winningTeam: winner,
          winningBid: lobby.currentBid || 0
        });

        console.log(`[Player Assigned & Budget Deducted] Lobby: ${code}. Winner: Team ${winner} gets ${lobby.activePlayer.name} paying ${lobby.currentBid}M. Loser gets ${lobby.hiddenPlayer.name}`);
      }

      // Transition only to finished state, retaining display values for the completed auction
      lobby.auctionStatus = 'finished';
      completeAuctionRound(lobby);
    } else {
      lobby.auctionStatus = status;
      if (status === 'waiting') {
        // Reset the Auction State for the next round
        lobby.currentBid = 0;
        lobby.leadingTeam = null;
        lobby.winnerTeam = null;
        lobby.teamALeft = false;
        lobby.teamBLeft = false;
        lobby.activePlayer = null;
        lobby.hiddenPlayer = null;
        lobby.auctionMode = 'public';
        lobby.teamAAttempts = [];
        lobby.teamBAttempts = [];
        lobby.hiddenAuctionRevealed = false;
        lobby.tieDetected = false;
      }
    }
  }

  console.log(`[Auction Status] Lobby: ${code} updated to ${lobby.auctionStatus} (mode: ${lobby.auctionMode})`);
  res.json(lobby);
});

// Place a live bid on behalf of a team
app.post("/api/lobby/:code/place-bid", (req, res) => {
  const code = req.params.code.toUpperCase();
  const { team, bidAmount } = req.body; // team: 'A' | 'B', bidAmount: number
  const lobby = lobbies.get(code);
  if (!lobby) {
    return res.status(404).json({ error: "Lobby not found" });
  }

  if (lobby.matchFinished) {
    return res.status(400).json({ error: "The match has already finished. Bidding is disabled." });
  }

  if (lobby.auctionStatus !== 'running') {
    return res.status(400).json({ error: "Auction is not running" });
  }

  if (!team || (team !== 'A' && team !== 'B')) {
    return res.status(400).json({ error: "Invalid team placing bid" });
  }

  if (team === 'A' && lobby.teamALeft) {
    return res.status(400).json({ error: "Your team has already left this auction." });
  }
  if (team === 'B' && lobby.teamBLeft) {
    return res.status(400).json({ error: "Your team has already left this auction." });
  }

  const currentBid = lobby.currentBid || 0;
  if (bidAmount <= currentBid) {
    return res.status(400).json({ error: "Your bid must be higher than the current bid." });
  }

  const budget = team === 'A' ? (lobby.teamABudget ?? 500) : (lobby.teamBBudget ?? 500);
  if (bidAmount > budget) {
    return res.status(400).json({ error: "Insufficient budget." });
  }

  lobby.currentBid = bidAmount;
  lobby.leadingTeam = team;

  console.log(`[Bid Placed] Lobby: ${code}, Team: ${team}, Amount: ${bidAmount}M`);
  res.json(lobby);
});

// Leave auction on behalf of a team
app.post("/api/lobby/:code/leave-auction", (req, res) => {
  const code = req.params.code.toUpperCase();
  const { team } = req.body; // team: 'A' | 'B'
  const lobby = lobbies.get(code);
  if (!lobby) {
    return res.status(404).json({ error: "Lobby not found" });
  }

  if (lobby.auctionStatus !== 'running') {
    return res.status(400).json({ error: "Auction is not running" });
  }

  if (team === 'A') {
    lobby.teamALeft = true;
  } else if (team === 'B') {
    lobby.teamBLeft = true;
  } else {
    return res.status(400).json({ error: "Invalid team leaving auction" });
  }

  // Check if other team becomes Current Winner
  if (lobby.teamALeft && !lobby.teamBLeft) {
    lobby.winnerTeam = 'B';
  } else if (lobby.teamBLeft && !lobby.teamALeft) {
    lobby.winnerTeam = 'A';
  }

  console.log(`[Leave Auction] Lobby: ${code}, Team: ${team} left. Winner: ${lobby.winnerTeam || 'None'}`);
  res.json(lobby);
});

// ---------------------- HIDDEN AUCTION HELPERS & ENDPOINTS ----------------------

function completeAuctionRound(lobby: Lobby) {
  const config = MATCH_CONFIGS[lobby.matchType || '11v11'];
  if ((lobby.currentRound ?? 1) >= config.maxRounds) {
    lobby.matchFinished = true;
    console.log(`[Match Finished] Lobby: ${lobby.code} completed all ${config.maxRounds} rounds!`);
  } else {
    lobby.currentRound = (lobby.currentRound ?? 1) + 1;
    console.log(`[Round Progressed] Lobby: ${lobby.code} is now preparing for Round ${lobby.currentRound}/${config.maxRounds}`);
  }
}

function assignHiddenAuctionPlayers(lobby: Lobby, winner: 'A' | 'B', winningBid: number) {
  if (!lobby.activePlayer || !lobby.hiddenPlayer) return;

  if (!lobby.teamAPlayers) lobby.teamAPlayers = [];
  if (!lobby.teamBPlayers) lobby.teamBPlayers = [];

  if (winner === 'A') {
    lobby.teamAPlayers.push(lobby.activePlayer);
    lobby.teamBPlayers.push(lobby.hiddenPlayer);
    lobby.teamABudget = Math.max(0, (lobby.teamABudget ?? 500) - winningBid);
  } else {
    lobby.teamBPlayers.push(lobby.activePlayer);
    lobby.teamAPlayers.push(lobby.hiddenPlayer);
    lobby.teamBBudget = Math.max(0, (lobby.teamBBudget ?? 500) - winningBid);
  }

  lobby.currentBid = winningBid;
  lobby.leadingTeam = winner;
  lobby.winnerTeam = winner;
  lobby.hiddenAuctionRevealed = true;
  lobby.tieDetected = false;

  if (!lobby.history) {
    lobby.history = [];
  }
  lobby.history.push({
    visiblePlayer: lobby.activePlayer,
    hiddenPlayer: lobby.hiddenPlayer,
    winningTeam: winner,
    winningBid: winningBid
  });

  lobby.auctionStatus = 'finished';
  completeAuctionRound(lobby);
}

function executeHiddenAuctionReveal(lobby: Lobby) {
  const lastBidA = lobby.teamAAttempts && lobby.teamAAttempts.length > 0 ? lobby.teamAAttempts[lobby.teamAAttempts.length - 1] : 0;
  const lastBidB = lobby.teamBAttempts && lobby.teamBAttempts.length > 0 ? lobby.teamBAttempts[lobby.teamBAttempts.length - 1] : 0;

  if (lastBidA === lastBidB) {
    lobby.tieDetected = true;
    lobby.hiddenAuctionRevealed = true;
    console.log(`[Hidden Tie Detected] Lobby: ${lobby.code}, Bid: ${lastBidA}M`);
  } else if (lastBidA > lastBidB) {
    assignHiddenAuctionPlayers(lobby, 'A', lastBidA);
  } else {
    assignHiddenAuctionPlayers(lobby, 'B', lastBidB);
  }
}

// Place a hidden auction bid attempt
app.post("/api/lobby/:code/place-hidden-bid", (req, res) => {
  const code = req.params.code.toUpperCase();
  const { team, bidAmount, playerId } = req.body;
  const lobby = lobbies.get(code);

  if (!lobby) {
    return res.status(404).json({ error: "Lobby not found" });
  }

  if (lobby.matchFinished) {
    return res.status(400).json({ error: "The match has already finished. Bidding is disabled." });
  }

  if (lobby.auctionStatus !== 'running') {
    return res.status(400).json({ error: "Auction is not running" });
  }

  if (lobby.auctionMode !== 'hidden') {
    return res.status(400).json({ error: "Not in Hidden Auction mode" });
  }

  if (!team || (team !== 'A' && team !== 'B')) {
    return res.status(400).json({ error: "Invalid team placing bid" });
  }

  const budget = team === 'A' ? (lobby.teamABudget ?? 500) : (lobby.teamBBudget ?? 500);
  if (bidAmount <= 0) {
    return res.status(400).json({ error: "Bid must be greater than zero." });
  }
  if (bidAmount > budget) {
    return res.status(400).json({ error: "Insufficient budget." });
  }

  const attempts = team === 'A' ? (lobby.teamAAttempts || []) : (lobby.teamBAttempts || []);
  if (attempts.length >= 3) {
    return res.status(400).json({ error: "No attempts remaining." });
  }

  attempts.push(bidAmount);
  if (team === 'A') {
    lobby.teamAAttempts = attempts;
  } else {
    lobby.teamBAttempts = attempts;
  }

  console.log(`[Hidden Bid Placed] Lobby: ${code}, Team: ${team}, Bid: ${bidAmount}M (Attempt ${attempts.length}/3)`);

  const teamACompleted = (lobby.teamAAttempts || []).length === 3;
  const teamBCompleted = (lobby.teamBAttempts || []).length === 3;

  if (teamACompleted && teamBCompleted) {
    executeHiddenAuctionReveal(lobby);
    console.log(`[Hidden Auto Reveal] Both teams completed 3/3 attempts. Executing reveal.`);
  }

  res.json(lobby);
});

// Manual reveal of the results of the Hidden Auction
app.post("/api/lobby/:code/reveal-hidden", (req, res) => {
  const code = req.params.code.toUpperCase();
  const { playerId } = req.body;
  const lobby = lobbies.get(code);

  if (!lobby) {
    return res.status(404).json({ error: "Lobby not found" });
  }

  if (lobby.judgeId !== playerId) {
    return res.status(403).json({ error: "Unauthorized: Only the Judge can reveal the results." });
  }

  if (lobby.auctionStatus !== 'running' || lobby.auctionMode !== 'hidden') {
    return res.status(400).json({ error: "Hidden Auction is not running." });
  }

  executeHiddenAuctionReveal(lobby);
  res.json(lobby);
});

// Resolve a hidden tie
app.post("/api/lobby/:code/resolve-hidden-tie", (req, res) => {
  const code = req.params.code.toUpperCase();
  const { playerId, action, manualWinner } = req.body; // action: 'restart' | 'manual', manualWinner: 'A' | 'B'
  const lobby = lobbies.get(code);

  if (!lobby) {
    return res.status(404).json({ error: "Lobby not found" });
  }

  if (lobby.judgeId !== playerId) {
    return res.status(403).json({ error: "Unauthorized: Only the Judge can resolve ties." });
  }

  if (!lobby.tieDetected) {
    return res.status(400).json({ error: "No tie detected to resolve." });
  }

  if (action === 'restart') {
    lobby.teamAAttempts = [];
    lobby.teamBAttempts = [];
    lobby.tieDetected = false;
    lobby.hiddenAuctionRevealed = false;
    lobby.auctionStatus = 'running';
    console.log(`[Hidden Tie Resolved] Lobby: ${code} - Restarted Hidden Auction`);
  } else if (action === 'manual') {
    if (manualWinner !== 'A' && manualWinner !== 'B') {
      return res.status(400).json({ error: "Invalid manual winner team selected." });
    }
    const winningBid = lobby.teamAAttempts && lobby.teamAAttempts.length > 0 ? lobby.teamAAttempts[lobby.teamAAttempts.length - 1] : 0;
    assignHiddenAuctionPlayers(lobby, manualWinner, winningBid);
    console.log(`[Hidden Tie Resolved] Lobby: ${code} - Manually assigned to Team ${manualWinner}`);
  } else {
    return res.status(400).json({ error: "Invalid resolution action." });
  }

  res.json(lobby);
});

// -------------------- VITE / STATIC MIDDLEWARE --------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server", err);
});
