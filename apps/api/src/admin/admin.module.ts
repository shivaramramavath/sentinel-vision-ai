import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Session, SessionSchema } from '../auth/schemas/session.schema';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Session.name, schema: SessionSchema },
    ]),
    AuditModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminBootstrapService],
  exports: [AdminService, AdminBootstrapService],
})
export class AdminModule {}
