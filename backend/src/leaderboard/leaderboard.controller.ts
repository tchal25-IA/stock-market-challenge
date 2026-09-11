import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsEnum, IsOptional } from 'class-validator';
import { LeaderboardService } from './leaderboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

class GetLeaderboardDto {
  @IsOptional()
  @IsEnum(['portfolio', 'level'])
  by?: 'portfolio' | 'level';
}

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  get(@CurrentUser() user: { userId: string }, @Query() dto: GetLeaderboardDto) {
    return this.leaderboard.get(user.userId, dto.by ?? 'portfolio');
  }
}
