import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type AuthIdentityDocument = AuthIdentity & Document;

@Schema({ collection: 'auth_identities', timestamps: true })
export class AuthIdentity {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'User', index: true })
  userId: string;

  @Prop({ required: true, enum: ['google', 'github'] })
  provider: 'google' | 'github';

  @Prop({ required: true })
  providerUserId: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop({ default: () => new Date() })
  linkedAt: Date;
}

export const AuthIdentitySchema = SchemaFactory.createForClass(AuthIdentity);
AuthIdentitySchema.index({ provider: 1, providerUserId: 1 }, { unique: true });
AuthIdentitySchema.index({ userId: 1, provider: 1 }, { unique: true });
