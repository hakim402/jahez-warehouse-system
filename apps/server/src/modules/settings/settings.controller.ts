import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../tenancy/auth.guard';
import { AuthenticatedRequest } from '../tenancy/types';
import { OwnerGuard } from './owner.guard';
import { SettingsInput } from './settings-input';
import { SettingsService } from './settings.service';
@Controller('users')
@UseGuards(AuthGuard, OwnerGuard)
export class UsersController {
  constructor(private readonly settings: SettingsService) {}
  @Get() list(@Req() req: AuthenticatedRequest, @Query() query: SettingsInput) { return this.settings.listUsers(req.user!, query); }
  @Get(':id') get(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.settings.getUser(req.user!, id); }
  @Post() create(@Req() req: AuthenticatedRequest, @Body() body: SettingsInput) { return this.settings.createUser(req.user!, body ?? {}); }
  @Patch(':id') update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: SettingsInput) { return this.settings.updateUser(req.user!, id, body ?? {}); }
  @Post(':id/password-reset') reset(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: SettingsInput) { return this.settings.resetPassword(req.user!, id, body ?? {}); }
}
@Controller('settings')
@UseGuards(AuthGuard, OwnerGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}
  @Get('warehouses') warehouses(@Req() req: AuthenticatedRequest) { return this.settings.listWarehouses(req.user!); }
  @Get('receiving-tolerances') tolerances(@Req() req: AuthenticatedRequest) { return this.settings.getTolerances(req.user!); }
  @Patch('receiving-tolerances') update(@Req() req: AuthenticatedRequest, @Body() body: SettingsInput) { return this.settings.updateTolerances(req.user!, body ?? {}); }
}
