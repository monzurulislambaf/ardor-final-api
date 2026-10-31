import { randomBytes } from 'node:crypto';
import type { QueryFilter } from 'mongoose';
import { AppError } from '../../utils/app-error';
import { buildSearchFilter, paginate, parseSort } from '../../utils/pagination';
import { UserModel } from '../users/users.model';
import { type IAppointment, type AppointmentDocument, AppointmentModel } from './appointments.model';
import type { CreateAppointmentInput, ListAppointmentsQuery, UpdateAppointmentInput } from './appointments.schema';

const SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'preferredDate', 'status', 'clientName'];
const SEARCHABLE_FIELDS = ['clientName', 'clientEmail', 'referenceNumber'];

const generateReferenceNumber = (): string => {
  const prefix = 'APT';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

const getAppointmentOrThrow = async (id: string): Promise<AppointmentDocument> => {
  const appointment = await AppointmentModel.findById(id).populate('expert', 'name slug category title');
  if (!appointment) throw AppError.notFound('Appointment not found');
  return appointment;
};

export const appointmentsService = {
  async list(query: ListAppointmentsQuery) {
    const filter: QueryFilter<IAppointment> = {};
    if (query.status) filter.status = query.status;
    if (query.expertCategory) filter.expertCategory = query.expertCategory;

    const search = buildSearchFilter<IAppointment>(query.search, SEARCHABLE_FIELDS);
    if (search) Object.assign(filter, search);

    return paginate(AppointmentModel, filter, {
      page: query.page,
      limit: query.limit,
      sort: parseSort(query.sort, SORTABLE_FIELDS),
      populate: 'expert',
    });
  },

  async listByUser(userId: string, query: ListAppointmentsQuery) {
    const filter: QueryFilter<IAppointment> = { user: userId as unknown as IAppointment['user'] };
    if (query.status) filter.status = query.status;

    return paginate(AppointmentModel, filter, {
      page: query.page,
      limit: query.limit,
      sort: parseSort(query.sort, SORTABLE_FIELDS),
      populate: 'expert',
    });
  },

  getById: getAppointmentOrThrow,

  async create(input: CreateAppointmentInput, userId?: string): Promise<{ appointment: AppointmentDocument; autoCreatedUser?: boolean }> {
    let autoCreatedUser = false;
    let assignedUserId = userId;

    // Auto-create client account if password provided and no user
    if (!assignedUserId && input.password) {
      const existing = await UserModel.findOne({ email: input.clientEmail }).select('+password');
      if (existing) {
        // Never attach a booking to someone else's account without their password.
        if (!(await existing.comparePassword(input.password))) {
          throw AppError.conflict('An account with this email already exists. Enter its password or sign in first.', [
            { field: 'password', message: 'Incorrect password for existing account' },
          ]);
        }
        assignedUserId = existing.id as string;
      } else {
        const newUser = await UserModel.create({
          name: input.clientName,
          email: input.clientEmail,
          password: input.password,
          role: 'client',
        });
        assignedUserId = newUser.id as string;
        autoCreatedUser = true;
      }
    }

    const appointment = await AppointmentModel.create({
      user: assignedUserId,
      expert: input.expertId,
      clientName: input.clientName,
      clientEmail: input.clientEmail,
      clientPhone: input.clientPhone,
      expertCategory: input.expertCategory,
      type: input.type,
      preferredDate: input.preferredDate,
      preferredTime: input.preferredTime,
      notes: input.notes,
      referenceNumber: generateReferenceNumber(),
    });

    return { appointment, autoCreatedUser };
  },

  async update(id: string, input: UpdateAppointmentInput): Promise<AppointmentDocument> {
    const appointment = await getAppointmentOrThrow(id);
    Object.assign(appointment, input);
    return appointment.save();
  },

  async cancel(id: string, userId: string): Promise<AppointmentDocument> {
    const appointment = await getAppointmentOrThrow(id);
    if (String(appointment.user) !== userId) throw AppError.forbidden('You can only cancel your own appointments');
    if (appointment.status === 'completed' || appointment.status === 'cancelled') {
      throw AppError.badRequest(`Cannot cancel an appointment that is already ${appointment.status}`);
    }
    appointment.status = 'cancelled';
    return appointment.save();
  },

  async remove(id: string): Promise<void> {
    const deleted = await AppointmentModel.findByIdAndDelete(id);
    if (!deleted) throw AppError.notFound('Appointment not found');
  },

  async countByStatus() {
    const result = await AppointmentModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const counts: Record<string, number> = {};
    for (const row of result) {
      counts[row._id as string] = row.count as number;
    }
    return counts;
  },
};
