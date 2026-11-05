import type { QueryFilter } from 'mongoose';
import { AppError } from '../../utils/app-error';
import { buildSearchFilter, paginate, parseSort } from '../../utils/pagination';
import { sameId } from '../../utils/object-id';
import { type IUser, type UserDocument, UserModel } from './users.model';
import type {
  CreateUserInput,
  ListUsersQuery,
  UpdateProfileInput,
  UpdateUserInput,
} from './users.schema';

const SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'name', 'email', 'role', 'status', 'lastLoginAt'];
const SEARCHABLE_FIELDS = ['name', 'email'];

const getUserOrThrow = async (id: string): Promise<UserDocument> => {
  const user = await UserModel.findById(id);
  if (!user) throw AppError.notFound('User not found');
  return user;
};

export const usersService = {
  async list(query: ListUsersQuery) {
    const filter: QueryFilter<IUser> = {};
    if (query.role) filter.role = query.role;
    if (query.status) filter.status = query.status;

    const search = buildSearchFilter<IUser>(query.search, SEARCHABLE_FIELDS);
    if (search) Object.assign(filter, search);

    return paginate(UserModel, filter, {
      page: query.page,
      limit: query.limit,
      sort: parseSort(query.sort, SORTABLE_FIELDS),
    });
  },

  getById: getUserOrThrow,

  // --- Lookups used by the auth module only (they expose private fields) ---

  /** Includes the password hash and token version. */
  findByEmailWithPassword(email: string) {
    return UserModel.findOne({ email: email.toLowerCase() }).select('+password +tokenVersion');
  },

  findByIdWithPassword(id: string) {
    return UserModel.findById(id).select('+password +tokenVersion');
  },

  /** Includes the token version, used to validate access tokens. */
  findForAuth(id: string) {
    return UserModel.findById(id).select('+tokenVersion');
  },

  findByEmailForReset(email: string) {
    return UserModel.findOne({ email: email.toLowerCase() });
  },

  findByResetTokenHash(hash: string) {
    return UserModel.findOne({ passwordResetTokenHash: hash }).select(
      '+passwordResetTokenHash +passwordResetExpiresAt +tokenVersion',
    );
  },

  async bumpTokenVersion(id: string): Promise<void> {
    await UserModel.updateOne({ _id: id }, { $inc: { tokenVersion: 1 } });
  },

  async create(input: CreateUserInput): Promise<UserDocument> {
    const existing = await UserModel.exists({ email: input.email });
    if (existing) {
      throw AppError.conflict('Email is already registered', [
        { field: 'email', message: 'email is already in use' },
      ]);
    }
    // Password is hashed by the model's pre-save hook.
    return UserModel.create(input);
  },

  async update(id: string, input: UpdateUserInput, actorId: string): Promise<UserDocument> {
    const user = await getUserOrThrow(id);

    if (sameId(id, actorId) && (input.role !== undefined || input.status !== undefined)) {
      throw AppError.forbidden('You cannot change your own role or status');
    }

    if (input.name !== undefined) user.name = input.name;
    if (input.email !== undefined) {
      const existing = await UserModel.findOne({ email: input.email }).select('_id');
      if (existing && String(existing._id) !== id) {
        throw AppError.conflict('Email is already in use', [{ field: 'email', message: 'email is already in use' }]);
      }
      user.email = input.email;
    }
    if (input.role !== undefined) user.role = input.role;
    if (input.status !== undefined) user.status = input.status;
    return user.save();
  },

  async updateProfile(id: string, input: UpdateProfileInput): Promise<UserDocument> {
    const user = await getUserOrThrow(id);
    if (input.name !== undefined) user.name = input.name;
    return user.save();
  },

  async remove(id: string, actorId: string): Promise<void> {
    if (sameId(id, actorId)) throw AppError.forbidden('You cannot delete your own account');
    const deleted = await UserModel.findByIdAndDelete(id);
    if (!deleted) throw AppError.notFound('User not found');
  },
};
