import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../tenancy/auth.guard';
import { AuthenticatedRequest } from '../tenancy/types';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() body: { phone?: unknown; password?: unknown; tenantId?: unknown; deviceId?: unknown }) {
    return this.auth.login(body ?? {});
  }

  @Post('refresh')
  refresh(@Body() body: { refreshToken?: unknown }) {
    return this.auth.refresh(body?.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  async logout(@Req() request: AuthenticatedRequest) {
    await this.auth.logout(request.user!);
    return { status: 'ok' };
  }

  @Get('sessions')
  @UseGuards(AuthGuard)
  listSessions(@Req() request: AuthenticatedRequest) {
    return this.auth.listSessions(request.user!);
  }

  @Delete('sessions/:id')
  @UseGuards(AuthGuard)
  async revokeSession(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    await this.auth.revokeSession(request.user!, id);
    return { status: 'ok' };
  }
}