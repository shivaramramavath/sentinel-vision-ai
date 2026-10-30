import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController, AdminAuthController } from './auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { GoogleStrategy } from './strategies/google.strategy';
import { GitHubStrategy } from './strategies/github.strategy';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AuthIdentity, AuthIdentitySchema } from './schemas/auth-identity.schema';
import { Session, SessionSchema } from './schemas/session.schema';
import { AuthToken, AuthTokenSchema } from './schemas/auth-token.schema';
import { Invite, InviteSchema } from './schemas/invite.schema';
import { AuditModule } from '../audit/audit.module';

@Global()
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: AuthIdentity.name, schema: AuthIdentitySchema },
      { name: Session.name, schema: SessionSchema },
      { name: AuthToken.name, schema: AuthTokenSchema },
      { name: Invite.name, schema: InviteSchema },
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>('auth.jwtAccessSecret') ||
          config.get<string>('app.jwtAccessSecret') ||
          config.get<string>('app.jwtSecret'),
        signOptions: {
          expiresIn: config.get<string>('auth.jwtAccessTtl') || config.get<string>('app.jwtAccessExpiresIn', '15m'),
        },
      }),
    }),
    AuditModule,
  ],
  controllers: [AuthController, AdminAuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard, GoogleStrategy, GitHubStrategy],
  exports: [AuthService, JwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
