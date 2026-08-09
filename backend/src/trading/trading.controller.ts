import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsNumber, IsString, Min } from 'class-validator';
import { TradingService } from './trading.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

class BuyDto {
  @IsString()
  symbol!: string;

  @IsNumber()
  @Min(1)
  amountEur!: number;
}

class SellDto {
  @IsString()
  symbol!: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;
}

@Controller('trading')
@UseGuards(JwtAuthGuard)
export class TradingController {
  constructor(private readonly trading: TradingService) {}

  @Post('buy')
  buy(@CurrentUser() user: { userId: string }, @Body() dto: BuyDto) {
    return this.trading.buy(user.userId, dto.symbol, dto.amountEur);
  }

  @Post('sell')
  sell(@CurrentUser() user: { userId: string }, @Body() dto: SellDto) {
    return this.trading.sell(user.userId, dto.symbol, dto.quantity);
  }
}
