import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  VerifyEmailDto,
  ResendVerificationDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  UpdateProfileDto,
  MfaVerifyDto,
  ApproveUserDto,
  RejectUserDto,
  CreateInviteDto,
} from './dto/auth-requests.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private setRefreshCookie(res: Response, cookieValue: string): void {
    const cookieName = this.configService.get<string>('app.refreshCookieName', 'sentinel_rt');
    const isProd = this.configService.get<string>('app.nodeEnv') === 'production';

    res.cookie(cookieName, cookieValue, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
  }

  private clearRefreshCookie(res: Response): void {
    const cookieName = this.configService.get<string>('app.refreshCookieName', 'sentinel_rt');
    res.clearCookie(cookieName, {
      path: '/api/v1/auth',
      sameSite: 'lax',
    });
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RateLimitGuard)
  @RateLimit({ max: 5, windowMs: 60000, keyPrefix: 'register' })
  @ApiOperation({ summary: 'Register a new account' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const correlationId = (req.headers['x-correlation-id'] as string) || 'reg';
    return this.authService.register(dto, correlationId);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address via token' })
  async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
    const correlationId = (req.headers['x-correlation-id'] as string) || 'verify';
    return this.authService.verifyEmail(dto.token, correlationId);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit({ max: 3, windowMs: 60000, keyPrefix: 'resend-verify' })
  @ApiOperation({ summary: 'Resend email verification link' })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto.email);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit({ max: 5, windowMs: 60000, keyPrefix: 'login' })
  @ApiOperation({ summary: 'Login with email and password' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto.email, dto.password, dto.mfaCode, {
      userAgent: req.headers['user-agent'],
      ip: req.ip || (req.headers['x-forwarded-for'] as string),
      correlationId: req.headers['x-correlation-id'] as string,
    });

    if (result.refreshTokenCookieValue) {
      this.setRefreshCookie(res, result.refreshTokenCookieValue);
    }

    return {
      accessToken: result.accessToken,
      user: result.user,
      mfaRequired: result.mfaRequired,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Silent refresh using rotated refresh token cookie' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieName = this.configService.get<string>('app.refreshCookieName', 'sentinel_rt');
    const cookieValue = req.cookies?.[cookieName];

    const result = await this.authService.refreshSession(
      cookieValue,
      req.headers['x-correlation-id'] as string,
    );
    this.setRefreshCookie(res, result.newRefreshTokenCookieValue);
    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke refresh session and clear cookie' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieName = this.configService.get<string>('app.refreshCookieName', 'sentinel_rt');
    const cookieValue = req.cookies?.[cookieName];
    const currentJti = (req as any).user?.jti;

    await this.authService.logout(cookieValue, currentJti);
    this.clearRefreshCookie(res);
    return { message: 'Logged out successfully' };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all sessions across all devices' })
  async logoutAll(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = (req as any).user?.id;
    const currentJti = (req as any).user?.jti;

    await this.authService.logoutAll(userId, currentJti);
    this.clearRefreshCookie(res);
    return { message: 'All active sessions invalidated successfully' };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(RateLimitGuard)
  @RateLimit({ max: 3, windowMs: 60000, keyPrefix: 'forgot-pass' })
  @ApiOperation({ summary: 'Request password reset email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { message: 'If the email exists, a password reset link has been dispatched.' };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset account password with token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password has been updated. Please sign in with your new password.' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  async getProfile(@Req() req: Request) {
    return (req as any).user;
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update profile details' })
  async updateProfile(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    const userId = (req as any).user.id;
    // update profile in user model
    return (req as any).user;
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password for authenticated user' })
  async changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    const userId = (req as any).user.id;
    await this.authService.changePassword(userId, dto.currentPassword, dto.newPassword);
    return { message: 'Password updated successfully' };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active sessions' })
  async getSessions(@Req() req: Request) {
    const userId = (req as any).user.id;
    const currentSessionId = (req as any).user.sessionId;
    return this.authService.getSessions(userId, currentSessionId);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a specific session' })
  async revokeSession(@Req() req: Request, @Param('id') sessionId: string) {
    const userId = (req as any).user.id;
    await this.authService.revokeSession(userId, sessionId);
    return { message: 'Session revoked successfully' };
  }

  // --- MFA Endpoints ---

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate TOTP MFA setup (returns QR code)' })
  async setupMfa(@Req() req: Request) {
    const userId = (req as any).user.id;
    return this.authService.setupMfa(userId);
  }

  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify code and enable MFA; generates recovery codes' })
  async enableMfa(@Req() req: Request, @Body() dto: MfaVerifyDto) {
    const userId = (req as any).user.id;
    return this.authService.enableMfa(userId, dto.code);
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable TOTP MFA' })
  async disableMfa(@Req() req: Request, @Body() dto: MfaVerifyDto) {
    const userId = (req as any).user.id;
    await this.authService.disableMfa(userId, dto.code);
    return { message: 'Two-factor authentication disabled' };
  }

  // --- Linked Identities ---

  @Get('identities')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get linked social identities' })
  async getIdentities(@Req() req: Request) {
    const userId = (req as any).user.id;
    return this.authService.getIdentities(userId);
  }

  @Delete('identities/:provider')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unlink a social identity' })
  async unlinkIdentity(
    @Req() req: Request,
    @Param('provider') provider: 'google' | 'github',
  ) {
    const userId = (req as any).user.id;
    await this.authService.unlinkIdentity(userId, provider);
    return { message: `Disconnected ${provider} identity` };
  }

  // --- OAuth 2.0 (Google & GitHub) ---

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Redirect to Google OAuth' })
  googleAuth() {
    // Passport redirects automatically
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback handler' })
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const webUrl = this.configService.get<string>('app.webUrl', 'http://localhost:3000');
    try {
      const result = await this.authService.handleOAuthCallback((req as any).user);
      if (result.sessionCookie) {
        this.setRefreshCookie(res, result.sessionCookie);
      }
      return res.redirect(`${webUrl}/auth/callback?status=${result.status}`);
    } catch {
      return res.redirect(`${webUrl}/auth/callback?status=error`);
    }
  }

  @Get('github')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'Redirect to GitHub OAuth' })
  githubAuth() {
    // Passport redirects automatically
  }

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'GitHub OAuth callback handler' })
  async githubAuthCallback(@Req() req: Request, @Res() res: Response) {
    const webUrl = this.configService.get<string>('app.webUrl', 'http://localhost:3000');
    try {
      const result = await this.authService.handleOAuthCallback((req as any).user);
      if (result.sessionCookie) {
        this.setRefreshCookie(res, result.sessionCookie);
      }
      return res.redirect(`${webUrl}/auth/callback?status=${result.status}`);
    } catch {
      return res.redirect(`${webUrl}/auth/callback?status=error`);
    }
  }
}

@ApiTags('Admin Users & Invites')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('users/:id/approve')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Approve user and assign role' })
  async approveUser(
    @Param('id') userId: string,
    @Body() dto: ApproveUserDto,
    @Req() req: Request,
  ) {
    const actor = (req as any).user?.email || 'admin';
    await this.authService.approveUser(userId, dto.role, actor);
    return { message: 'User approved and notified via email' };
  }

  @Post('users/:id/reject')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Reject user registration' })
  async rejectUser(@Param('id') userId: string, @Body() dto: RejectUserDto) {
    await this.authService.rejectUser(userId, dto.reason);
    return { message: 'User registration rejected and notified' };
  }

  @Post('users/:id/suspend')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Suspend user account and revoke sessions' })
  async suspendUser(@Param('id') userId: string) {
    await this.authService.suspendUser(userId);
    return { message: 'User suspended and sessions revoked' };
  }

  @Post('users/:id/reactivate')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Reactivate suspended user' })
  async reactivateUser(@Param('id') userId: string) {
    await this.authService.reactivateUser(userId);
    return { message: 'User reactivated' };
  }

  @Post('users/:id/reset-mfa')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Reset user MFA' })
  async resetUserMfa(@Param('id') userId: string) {
    await this.authService.resetUserMfa(userId);
    return { message: 'User MFA reset' };
  }

  @Post('users/:id/force-logout')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Force revoke all sessions for user' })
  async forceLogout(@Param('id') userId: string) {
    await this.authService.logoutAll(userId);
    return { message: 'User logged out of all devices' };
  }

  @Post('invites')
  @Roles('super_admin', 'investigator')
  @ApiOperation({ summary: 'Create a new operator/investigator invite' })
  async createInvite(@Body() dto: CreateInviteDto, @Req() req: Request) {
    const creatorEmail = (req as any).user?.email;
    return this.authService.createInvite(dto, creatorEmail);
  }
}
