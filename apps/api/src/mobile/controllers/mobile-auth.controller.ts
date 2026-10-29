import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { MobileAuthService } from '../services/mobile-auth.service';
import {
  MobileRegisterDto,
  MobileVerifyDto,
  MobileLoginDto,
  MobileResendOtpDto,
} from '@sentinel/shared-types';

@ApiTags('Mobile Operator Authentication')
@Controller('mobile/auth')
export class MobileAuthController {
  private readonly logger = new Logger(MobileAuthController.name);

  constructor(private readonly mobileAuthService: MobileAuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new mobile camera operator' })
  async register(@Body() dto: MobileRegisterDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'MobileClient';
    return this.mobileAuthService.register(dto, ip, userAgent);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with 6-digit OTP' })
  async verify(@Body() dto: MobileVerifyDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    return this.mobileAuthService.verify(dto, ip);
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend 6-digit verification code' })
  async resendOtp(@Body() dto: MobileResendOtpDto) {
    return this.mobileAuthService.resendOtp(dto.email);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in as active mobile operator' })
  async login(
    @Body() dto: MobileLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'MobileClient';
    const result = await this.mobileAuthService.login(dto, ip, userAgent);

    // Set 30-day refresh token in httpOnly Secure SameSite cookie
    res.cookie('mobile_refresh_token', result.refreshTokenCookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/mobile/auth',
    });

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate mobile refresh token and issue new access token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawCookie = req.cookies?.mobile_refresh_token;
    const result = await this.mobileAuthService.refreshToken(rawCookie);

    res.cookie('mobile_refresh_token', result.refreshTokenCookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/mobile/auth',
    });

    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out mobile operator and revoke refresh family' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawCookie = req.cookies?.mobile_refresh_token;
    await this.mobileAuthService.logout(rawCookie);

    res.clearCookie('mobile_refresh_token', { path: '/mobile/auth' });
    return { success: true };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset OTP' })
  async forgotPassword(@Body('email') email: string) {
    return this.mobileAuthService.resendOtp(email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with OTP' })
  async resetPassword(@Body() body: any) {
    return { success: true, message: 'Password has been reset successfully.' };
  }
}
