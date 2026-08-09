import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { BotsService } from './bots.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

class ConfigureBotDto {
  @IsString()
  kind!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(40)
  allocationPct?: number;
}

@Controller('bots')
@UseGuards(JwtAuthGuard)
export class BotsController {
  constructor(private readonly bots: BotsService) {}

  @Get()
  list(@CurrentUser() user: { userId: string }) {
    return this.bots.list(user.userId);
  }

  @Post('configure')
  configure(@CurrentUser() user: { userId: string }, @Body() dto: ConfigureBotDto) {
    return this.bots.configure(user.userId, dto.kind, dto.enabled, dto.allocationPct);
  }
}
