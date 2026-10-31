import { type HydratedDocument, model, Schema, type Types } from 'mongoose';
import { baseSchemaOptions } from '../../utils/mongoose';

export interface IRefreshToken {
  user: Types.ObjectId;
  /** Unique id embedded in the JWT (`jti`). */
  jti: string;
  /** Shared by every rotation of one login; revoking the family kills the whole chain. */
  family: string;
  /** SHA-256 of the token. The raw token is never stored. */
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  /** Why the token was revoked: rotated, logout, reuse-detected, password-change, ... */
  revokedReason?: string;
  replacedByJti?: string;
  userAgent?: string;
  ip?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type RefreshTokenDocument = HydratedDocument<IRefreshToken>;

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jti: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    revokedReason: { type: String },
    replacedByJti: { type: String },
    userAgent: { type: String, maxlength: 512 },
    ip: { type: String, maxlength: 64 },
  },
  baseSchemaOptions,
);

// MongoDB removes expired tokens automatically.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = model<IRefreshToken>('RefreshToken', refreshTokenSchema);
