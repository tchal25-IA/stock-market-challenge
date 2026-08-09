import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('portfolio')
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get()
  get(@CurrentUser() user: { userId: string }) {
    return this.portfolio.getPortfolio(user.userId);
  }

  @Get('history')
  history(@CurrentUser() user: { userId: string }) {
    return this.portfolio.history(user.userId);
  }

  @Post('tutorial-done')
  tutorial(@CurrentUser() user: { userId: string }) {
    return this.portfolio.completeTutorial(user.userId);
  }

  @Post('level-up')
  levelUp(@CurrentUser() user: { userId: string }) {
    return this.portfolio.levelUp(user.userId);
  }
}
