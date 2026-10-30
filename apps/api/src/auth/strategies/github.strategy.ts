import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private readonly configService: ConfigService) {
    const clientID =
      configService.get<string>('oauth.github.clientId') ||
      configService.get<string>('app.githubClientId') ||
      process.env.GITHUB_CLIENT_ID ||
      'disabled-github-client-id';

    const clientSecret =
      configService.get<string>('oauth.github.clientSecret') ||
      configService.get<string>('app.githubClientSecret') ||
      process.env.GITHUB_CLIENT_SECRET ||
      'disabled-github-secret';

    const callbackURL =
      configService.get<string>('oauth.github.callbackUrl') ||
      configService.get<string>('app.githubCallbackUrl') ||
      process.env.GITHUB_CALLBACK_URL ||
      'http://localhost:3001/api/v1/auth/github/callback';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: (err: any, user?: any) => void,
  ): Promise<any> {
    const { id, displayName, username, emails, photos } = profile;

    // Read primary verified email from emails array provided by passport-github2
    let verifiedEmail = emails?.find((e: any) => e.primary && e.verified)?.value;
    if (!verifiedEmail) {
      verifiedEmail = emails?.find((e: any) => e.verified)?.value;
    }
    if (!verifiedEmail && emails?.[0]?.value) {
      verifiedEmail = emails[0].value;
    }

    if (!verifiedEmail) {
      return done(new UnauthorizedException('No verified primary email found on GitHub account.'));
    }

    const user = {
      provider: 'github',
      providerUserId: String(id),
      email: verifiedEmail.toLowerCase(),
      emailVerified: true,
      name: displayName || username || 'GitHub User',
      avatarUrl: photos?.[0]?.value,
    };

    done(null, user);
  }
}
