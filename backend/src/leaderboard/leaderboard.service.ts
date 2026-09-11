import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type LeaderboardEntry = {
  rank: number;
  username: string;
  value: number;
  isCurrentUser: boolean;
};

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(currentUserId: string, by: 'portfolio' | 'level' = 'portfolio') {
    // Récupère tous les utilisateurs non-guests avec leurs stats
    const users = await this.prisma.user.findMany({
      where: { isGuest: false },
      select: {
        id: true,
        username: true,
        level: true,
        cash: true,
        holdings: {
          include: {
            asset: true,
          },
        },
      },
    });

    // Calcule la valeur du portfolio pour chaque utilisateur
    const entries = users.map((user) => {
      const holdingsValue = user.holdings.reduce(
        (sum, h) => sum + h.quantity * h.asset.currentPrice,
        0,
      );
      const portfolioValue = user.cash + holdingsValue;

      return {
        id: user.id,
        username: user.username,
        level: user.level,
        portfolioValue,
      };
    });

    // Tri selon le critère choisi
    let sorted: typeof entries;
    if (by === 'portfolio') {
      sorted = entries.sort((a, b) => b.portfolioValue - a.portfolioValue);
    } else {
      sorted = entries.sort((a, b) => {
        if (b.level !== a.level) return b.level - a.level;
        return b.portfolioValue - a.portfolioValue; // Départage par portfolio
      });
    }

    // Ajoute les rangs et limite au top 100
    const top100: LeaderboardEntry[] = sorted.slice(0, 100).map((entry, index) => ({
      rank: index + 1,
      username: entry.username,
      value: by === 'portfolio' ? entry.portfolioValue : entry.level,
      isCurrentUser: entry.id === currentUserId,
    }));

    // Trouve le rang de l'utilisateur courant s'il n'est pas dans le top 100
    const currentUserIndex = sorted.findIndex((e) => e.id === currentUserId);
    let currentUserRank: LeaderboardEntry | null = null;
    
    if (currentUserIndex >= 100) {
      const currentEntry = sorted[currentUserIndex];
      currentUserRank = {
        rank: currentUserIndex + 1,
        username: currentEntry.username,
        value: by === 'portfolio' ? currentEntry.portfolioValue : currentEntry.level,
        isCurrentUser: true,
      };
    }

    return {
      by,
      entries: top100,
      currentUserRank: currentUserRank ?? undefined,
      totalPlayers: sorted.length,
    };
  }
}
