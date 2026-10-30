import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly configService: ConfigService) {
    const clientID =
      configService.get<string>('oauth.google.clientId') ||
      configService.get<string>('app.googleClientId') ||
      process.env.GOOGLE_CLIENT_ID ||
      'disabled-google-client-id';

    const clientSecret =
      configService.get<string>('oauth.google.clientSecret') ||
      configService.get<string>('app.googleClientSecret') ||
      process.env.GOOGLE_CLIENT_SECRET ||
      'disabled-google-secret';

    const callbackURL =
      configService.get<string>('oauth.google.callbackUrl') ||
      configService.get<string>('app.googleCallbackUrl') ||
      process.env.GOOGLE_CALLBACK_URL ||
      'http://localhost:3001/api/v1/auth/google/callback';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['openid', 'email', 'profile'],
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
