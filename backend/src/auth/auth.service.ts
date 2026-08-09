import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async guest() {
    const username = `trader_${Date.now().toString(36)}`;
    const user = await this.prisma.user.create({
      data: { username, isGuest: true, cash: 10000, level: 1 },
    });
    return this.tokenResponse(user.id);
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing) throw new ConflictException('Email ou username déjà pris');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
        isGuest: false,
        cash: 10000,
        level: 1,
      },
    });
    return this.tokenResponse(user.id);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.login }, { username: dto.login }],
      },
    });
    if (!user?.passwordHash) throw new UnauthorizedException('Identifiants invalides');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Identifiants invalides');
    return this.tokenResponse(user.id);
  }

  private async tokenResponse(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const accessToken = await this.jwt.signAsync({ sub: userId });
    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isGuest: user.isGuest,
        level: user.level,
        cash: user.cash,
        tutorialDone: user.tutorialDone,
      },
    };
  }
}
