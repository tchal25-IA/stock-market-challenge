import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Niveau minimum pour le bot Hold Champion. */
export const HOLD_BOT_UNLOCK_LEVEL = 11;

@Injectable()
export class TradingService {
  constructor(private readonly prisma: PrismaService) {}

  async buy(
    userId: string,
    symbol: string,
    amountEur: number,
    opts: { source?: string; skipLevelCheck?: boolean } = {},
  ) {
    if (amountEur <= 0) throw new BadRequestException('Montant invalide');
    const asset = await this.prisma.asset.findUnique({ where: { symbol: symbol.toUpperCase() } });
    if (!asset) throw new NotFoundException('Titre introuvable');

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!opts.skipLevelCheck && asset.unlockLevel > user.level) {
      throw new BadRequestException(`Titre verrouillé — niveau ${asset.unlockLevel} requis`);
    }
    if (user.cash < amountEur) throw new BadRequestException('Cash insuffisant');

    const quantity = amountEur / asset.currentPrice;
    const total = amountEur;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { cash: { decrement: total } },
      });
      const existing = await tx.holding.findUnique({
        where: { userId_assetId: { userId, assetId: asset.id } },
      });
      if (existing) {
        const newQty = existing.quantity + quantity;
        const newAvg = (existing.quantity * existing.avgCost + total) / newQty;
        await tx.holding.update({
          where: { id: existing.id },
          data: { quantity: newQty, avgCost: newAvg },
        });
      } else {
        await tx.holding.create({
          data: { userId, assetId: asset.id, quantity, avgCost: asset.currentPrice },
        });
      }
      await tx.trade.create({
        data: {
          userId,
          assetId: asset.id,
          side: 'buy',
          quantity,
          price: asset.currentPrice,
          total,
          source: opts.source ?? 'manual',
        },
      });
    });

    return { ok: true, side: 'buy', symbol: asset.symbol, quantity, price: asset.currentPrice, total };
  }

  async sell(userId: string, symbol: string, quantity: number, opts: { source?: string } = {}) {
    if (quantity <= 0) throw new BadRequestException('Quantité invalide');
    const asset = await this.prisma.asset.findUnique({ where: { symbol: symbol.toUpperCase() } });
    if (!asset) throw new NotFoundException('Titre introuvable');

    const holding = await this.prisma.holding.findUnique({
      where: { userId_assetId: { userId, assetId: asset.id } },
    });
    if (!holding || holding.quantity < quantity - 1e-9) {
      throw new BadRequestException('Quantité insuffisante');
    }

    const total = quantity * asset.currentPrice;
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { cash: { increment: total } },
      });
      const remaining = holding.quantity - quantity;
      if (remaining < 1e-8) {
        await tx.holding.delete({ where: { id: holding.id } });
      } else {
        await tx.holding.update({
          where: { id: holding.id },
          data: { quantity: remaining },
        });
      }
      await tx.trade.create({
        data: {
          userId,
          assetId: asset.id,
          side: 'sell',
          quantity,
          price: asset.currentPrice,
          total,
          source: opts.source ?? 'manual',
        },
      });
    });

    return { ok: true, side: 'sell', symbol: asset.symbol, quantity, price: asset.currentPrice, total };
  }
}
