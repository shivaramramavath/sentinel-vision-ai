import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('app.googleClientId') || 'placeholder-id',
      clientSecret: configService.get<string>('app.googleClientSecret') || 'placeholder-secret',
      callbackURL: configService.get<string>('app.googleCallbackUrl') || 'http://localhost:3001/api/v1/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails, photos } = profile;
    const primaryEmail = emails?.[0];

    const user = {
      provider: 'google',
      providerUserId: id,
      email: primaryEmail?.value?.toLowerCase(),
      emailVerified: primaryEmail?.verified === true,
      name: name ? `${name.givenName || ''} ${name.familyName || ''}`.trim() : profile.displayName,
      avatarUrl: photos?.[0]?.value,
    };

    done(null, user);
  }
}
