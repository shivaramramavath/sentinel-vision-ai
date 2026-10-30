import { registerAs } from '@nestjs/config';

export const oauthConfig = registerAs('oauth', () => ({
  google: {
    enabled: process.env.OAUTH_GOOGLE_ENABLED === 'true',
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL ?? '',
  },
  github: {
    enabled: process.env.OAUTH_GITHUB_ENABLED === 'true',
    clientId: process.env.GITHUB_CLIENT_ID ?? '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    callbackUrl: process.env.GITHUB_CALLBACK_URL ?? '',
  },
}));
