import { Module, forwardRef } from '@nestjs/common';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { GbmEngine } from './gbm.engine';
import { BotsModule } from '../bots/bots.module';

@Module({
  imports: [forwardRef(() => BotsModule)],
  controllers: [MarketController],
  providers: [MarketService, GbmEngine],
  exports: [MarketService],
})
export class MarketModule {}
