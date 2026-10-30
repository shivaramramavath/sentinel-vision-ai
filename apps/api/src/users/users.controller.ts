import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile from database' })
  async getMe(@Request() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User record not found in database');
    }
    if (user.status === 'suspended' || user.status === 'rejected') {
      throw new ForbiddenException('Account is ' + user.status);
    }
    return {
      id: String(user._id),
      email: user.email,
      name: user.fullName || '',
      fullName: user.fullName || '',
      role: user.role,
      badgeNumber: user.badgeNumber || '',
      department: user.department || '',
      status: user.status,
      avatarUrl: user.avatarUrl || '',
      mfaEnabled: user.mfa?.enabled || false,
      mustChangePassword: Boolean(user.mustChangePassword),
      mfaEnrollmentRequired: Boolean(user.mfaEnrollmentRequired),
      createdVia: user.createdVia,
      createdAt: (user as any).createdAt ? (user as any).createdAt.toISOString() : undefined,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    };
  }

  @Get()
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'List all users in Sentinel' })
  async getUsers() {
    return this.usersService.findAll();
  }

  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload and update user profile avatar' })
  async uploadAvatar(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Avatar image file is required');
    }
    const updated = await this.usersService.updateAvatar(id, file.buffer, file.mimetype);
    return {
      id: updated._id,
      email: updated.email,
      fullName: updated.fullName,
      avatarUrl: updated.avatarUrl,
    };
  }
}
