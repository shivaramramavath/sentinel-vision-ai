import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MobileUser, MobileUserDocument } from '../schemas/mobile-user.schema';

export interface MobileJwtPayload {
  sub: string; // mobileUserId
  email: string;
  role: 'mobile_operator';
  aud: 'mobile';
  scopes: string[];
}

@Injectable()
export class MobileJwtAuthGuard implements CanActivate {
  private readonly mobileSecret: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectModel(MobileUser.name) private readonly mobileUserModel: Model<MobileUserDocument>,
  ) {
    this.mobileSecret = this.configService.get<string>(
      'app.jwtMobileSecret',
      'sentinel-mobile-realm-secret-2026',
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid mobile authorization header');
    }

    const token = authHeader.split(' ')[1];
    let payload: MobileJwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<MobileJwtPayload>(token, {
        secret: this.mobileSecret,
        audience: 'mobile',
      });
    } catch (err: any) {
      throw new UnauthorizedException('Invalid or expired mobile access token');
    }

    if (payload.aud !== 'mobile' || payload.role !== 'mobile_operator') {
      throw new ForbiddenException('Invalid token realm: mobile_operator token required');
    }

    // Verify user exists and is active
    const user = await this.mobileUserModel.findOne({ mobileUserId: payload.sub });
    if (!user) {
      throw new UnauthorizedException('Mobile operator not found');
    }

    if (user.status !== 'active') {
      if (user.status === 'suspended') {
        throw new ForbiddenException('Mobile operator account has been suspended');
      }
      if (user.status === 'rejected') {
        throw new ForbiddenException('Mobile operator account registration was rejected');
      }
      throw new ForbiddenException(`Mobile operator account is ${user.status}`);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Mobile account is temporarily locked due to failed attempts');
    }

    // Attach mobile operator to request
    request.mobileUser = {
      mobileUserId: user.mobileUserId,
      email: user.email,
      fullName: user.fullName,
      role: 'mobile_operator',
      siteIds: user.siteIds,
    };

    return true;
  }
}
