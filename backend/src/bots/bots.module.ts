import { Module, forwardRef } from '@nestjs/common';
import { BotsService } from './bots.service';
import { BotsController } from './bots.controller';
import { TradingModule } from '../trading/trading.module';

@Module({
  imports: [forwardRef(() => TradingModule)],
  providers: [BotsService],
  controllers: [BotsController],
  exports: [BotsService],
})
export class BotsModule {}
