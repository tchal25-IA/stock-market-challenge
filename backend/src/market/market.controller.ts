import { Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { MarketService } from './market.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('market')
export class MarketController {
  constructor(private readonly market: MarketService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: { level: number }) {
    return this.market.listAssets(user.level);
  }

  @Get('assets/:symbol')
  @UseGuards(JwtAuthGuard)
  async detail(@Param('symbol') symbol: string) {
    const asset = await this.market.getAssetDetail(symbol);
    if (!asset) throw new NotFoundException('Titre introuvable');
    return asset;
  }

  @Post('tick')
  @UseGuards(JwtAuthGuard)
  tick() {
    return this.market.advanceTick();
  }
}
