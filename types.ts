export interface Player {
  id: string;
  name: string;
  team: 'A' | 'B' | null;
  joinedAt: string;
}

export interface FootballPlayer {
  name: string;
  position: string;
}

export interface AuctionHistoryItem {
  visiblePlayer: FootballPlayer;
  hiddenPlayer: FootballPlayer;
  winningTeam: 'A' | 'B';
  winningBid: number;
}

export interface Lobby {
  code: string;
  isPrivate: boolean;
  judgeName: string;
  judgeId?: string;
  teamAName: string;
  teamBName: string;
  createdAt: string;
  players: Player[];
  status: 'waiting' | 'ready' | 'active';
  activePlayer?: FootballPlayer | null;
  hiddenPlayer?: FootballPlayer | null;
  auctionStatus?: 'waiting' | 'running' | 'finished';
  currentBid?: number;
  leadingTeam?: 'A' | 'B' | null;
  teamALeft?: boolean;
  teamBLeft?: boolean;
  winnerTeam?: 'A' | 'B' | null;
  teamAPlayers?: FootballPlayer[];
  teamBPlayers?: FootballPlayer[];
  teamABudget?: number;
  teamBBudget?: number;
  history?: AuctionHistoryItem[];
  auctionMode?: 'public' | 'hidden';
  teamAAttempts?: number[];
  teamBAttempts?: number[];
  teamAAttemptsCount?: number;
  teamBAttemptsCount?: number;
  hiddenAuctionRevealed?: boolean;
  tieDetected?: boolean;
  matchType?: '5v5' | '7v7' | '11v11';
  currentRound?: number;
  matchFinished?: boolean;
}

export interface MatchConfig {
  budget: number;
  maxPlayers: number;
  maxRounds: number;
  pitchLayout: string;
}

export const MATCH_CONFIGS: Record<'5v5' | '7v7' | '11v11', MatchConfig> = {
  '5v5': {
    budget: 100,
    maxPlayers: 5,
    maxRounds: 5,
    pitchLayout: '5-a-side layout'
  },
  '7v7': {
    budget: 150,
    maxPlayers: 7,
    maxRounds: 7,
    pitchLayout: '7-a-side layout'
  },
  '11v11': {
    budget: 500,
    maxPlayers: 11,
    maxRounds: 11,
    pitchLayout: '11-a-side layout'
  }
};

export interface LobbyCreationRequest {
  judgeName: string;
  teamAName: string;
  teamBName: string;
  isPrivate: boolean;
}

export interface JoinLobbyRequest {
  playerName: string;
  team: 'A' | 'B' | null;
}

