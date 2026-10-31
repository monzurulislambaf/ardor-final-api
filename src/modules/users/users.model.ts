import bcrypt from 'bcryptjs';
import { type HydratedDocument, type Model, model, Schema } from 'mongoose';
import { env } from '../../config/env';
import { baseSchemaOptions } from '../../utils/mongoose';
import {
  DEFAULT_USER_ROLE,
  DEFAULT_USER_STATUS,
  USER_ROLES,
  USER_STATUSES,
  type UserRole,
  type UserStatus,
} from './users.constants';

export interface IUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  status: UserStatus;
  /** Incremented to invalidate every issued access token (password change, logout-all). */
  tokenVersion: number;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

export type UserDocument = HydratedDocument<IUser, IUserMethods>;
type UserModelType = Model<IUser, Record<string, never>, IUserMethods>;

/** Fields that must never leave the server, even if accidentally selected. */
const PRIVATE_FIELDS = [
  'password',
  'tokenVersion',
  'passwordResetTokenHash',
  'passwordResetExpiresAt',
] as const;

const userSchema = new Schema<IUser, UserModelType, IUserMethods>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: DEFAULT_USER_ROLE, index: true },
    status: { type: String, enum: USER_STATUSES, default: DEFAULT_USER_STATUS, index: true },
    tokenVersion: { type: Number, default: 0, select: false },
    lastLoginAt: { type: Date },
    passwordChangedAt: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false, index: true, sparse: true },
    passwordResetExpiresAt: { type: Date, select: false },
  },
  {
    ...baseSchemaOptions,
    toJSON: {
      ...baseSchemaOptions.toJSON,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        for (const field of PRIVATE_FIELDS) delete ret[field];
        delete ret.passwordChangedAt;
        return ret;
      },
    },
  },
);

userSchema.index({ createdAt: -1 });

// Single place where plain-text passwords are turned into hashes.
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, env.BCRYPT_ROUNDS);
  if (!this.isNew) this.passwordChangedAt = new Date();
});

userSchema.method('comparePassword', function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
});

export const UserModel = model<IUser, UserModelType>('User', userSchema);
