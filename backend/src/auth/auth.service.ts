import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ClaimDto } from './dto/claim.dto';

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
      where: { OR: [{ email: dto.email.toLowerCase() }, { username: dto.username }] },
    });
    if (existing) throw new ConflictException('Email ou username déjà pris');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
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
    const login = dto.login.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: login.toLowerCase() }, { username: login }],
      },
    });
    if (!user?.passwordHash) throw new UnauthorizedException('Identifiants invalides');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Identifiants invalides');
    return this.tokenResponse(user.id);
  }

  /** Convertit un compte invité en compte permanent (conserve portfolio). */
  async claim(userId: string, dto: ClaimDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.isGuest) throw new BadRequestException('Compte déjà enregistré');
    const clash = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email.toLowerCase() }, { username: dto.username }],
        NOT: { id: userId },
      },
    });
    if (clash) throw new ConflictException('Email ou username déjà pris');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: dto.email.toLowerCase(),
        username: dto.username,
        passwordHash,
        isGuest: false,
      },
    });
    return this.tokenResponse(userId);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      isGuest: user.isGuest,
      level: user.level,
      cash: user.cash,
      tutorialDone: user.tutorialDone,
    };
  }

  private async tokenResponse(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const accessToken = await this.jwt.signAsync(
      { sub: userId, guest: user.isGuest },
      { expiresIn: user.isGuest ? '14d' : '7d' },
    );
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
