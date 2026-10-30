import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User, UserSchema } from '../users/schemas/user.schema';
import { RedisModule } from '../common/redis/redis.module';
import { AuditModule } from '../audit/audit.module';
import { RbacService } from './rbac.service';
import { PolicyService } from './services/policy.service';
import { PermissionsGuard } from './guards/permissions.guard';
import { StepUpGuard } from './guards/step-up.guard';
import { RbacDataShapingInterceptor } from './interceptors/rbac-data-shaping.interceptor';
import { RbacController } from './rbac.controller';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>('auth.jwtAccessSecret') ||
          config.get<string>('app.jwtAccessSecret') ||
          'dev-secret-change-in-production',
        signOptions: {
          expiresIn:
            config.get<string>('auth.jwtAccessTtl') ||
            config.get<string>('app.jwtAccessExpiresIn', '15m'),
        },
      }),
    }),
    RedisModule,
    AuditModule,
  ],
  controllers: [RbacController],
  providers: [
    RbacService,
    PolicyService,
    PermissionsGuard,
    StepUpGuard,
    RbacDataShapingInterceptor,
  ],
  exports: [
    RbacService,
    PolicyService,
    PermissionsGuard,
    StepUpGuard,
    RbacDataShapingInterceptor,
  ],
})
export class RbacModule {}
