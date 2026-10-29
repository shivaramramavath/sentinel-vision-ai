import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type AuthTokenPurpose = 'verify_email' | 'password_reset' | 'unlock_account' | 'mobile_verify';

export type AuthTokenDocument = AuthToken & Document;

@Schema({ collection: 'auth_tokens', timestamps: true })
export class AuthToken {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'User', index: true })
  userId: string;

  @Prop({ required: true, unique: true, index: true })
  tokenHash: string; // SHA-256 of the plain token; plain token is never stored in DB

  @Prop({ required: true, enum: ['verify_email', 'password_reset', 'unlock_account', 'mobile_verify'] })
  purpose: AuthTokenPurpose;

  @Prop({ required: true, index: true })
  expiresAt: Date;

  @Prop()
  usedAt?: Date;
}

export const AuthTokenSchema = SchemaFactory.createForClass(AuthToken);
AuthTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // MongoDB TTL auto-cleanup
