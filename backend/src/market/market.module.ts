import { Module } from '@nestjs/common';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { GbmEngine } from './gbm.engine';

@Module({
  controllers: [MarketController],
  providers: [MarketService, GbmEngine],
  exports: [MarketService],
})
export class MarketModule {}
