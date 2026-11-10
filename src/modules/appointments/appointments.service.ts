import { randomBytes } from 'node:crypto';
import type { QueryFilter } from 'mongoose';
import { AppError } from '../../utils/app-error';
import { buildSearchFilter, paginate, parseSort } from '../../utils/pagination';
import { UserModel } from '../users/users.model';
import { ExpertModel } from '../experts/experts.model';
import { type IAppointment, type AppointmentDocument, AppointmentModel } from './appointments.model';
import type { CreateAppointmentInput, ExpertConsultationUpdateInput, ListAppointmentsQuery, UpdateAppointmentInput } from './appointments.schema';

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

  /** Expert portal: returns appointments assigned to the expert whose profile email matches the given user email. */
  async listByExpert(userEmail: string, query: ListAppointmentsQuery) {
    const expert = await ExpertModel.findOne({ email: userEmail.toLowerCase() });
    if (!expert) {
      return paginate(AppointmentModel, { _id: null } as QueryFilter<IAppointment>, {
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        sort: { createdAt: -1 },
        populate: 'expert',
      });
    }

    const filter: QueryFilter<IAppointment> = { expert: expert._id as IAppointment['expert'] };
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
      followUpOf: input.followUpOf,
      referenceNumber: generateReferenceNumber(),
    });

    return { appointment, autoCreatedUser };
  },

  async update(id: string, input: UpdateAppointmentInput): Promise<AppointmentDocument> {
    const appointment = await getAppointmentOrThrow(id);
    Object.assign(appointment, input);
    return appointment.save();
  },

  /** Expert portal: update consultation details (meeting URL, notes, diagnosis, etc.). */
  async updateConsultationByExpert(id: string, userEmail: string, input: ExpertConsultationUpdateInput): Promise<AppointmentDocument> {
    const expert = await ExpertModel.findOne({ email: userEmail.toLowerCase() });
    if (!expert) throw AppError.forbidden('No expert profile linked to your account');

    const appointment = await AppointmentModel.findById(id).select('+meetingUrl +consultationNotes +diagnosisNotes +treatmentPlan');
    if (!appointment) throw AppError.notFound('Appointment not found');
    if (String(appointment.expert) !== String(expert._id)) throw AppError.forbidden('You can only update your own appointments');

    const allowedUpdates: Partial<IAppointment> = {};
    if (input.meetingUrl !== undefined) allowedUpdates.meetingUrl = input.meetingUrl;
    if (input.meetingProvider !== undefined) allowedUpdates.meetingProvider = input.meetingProvider;
    if (input.consultationInstructions !== undefined) allowedUpdates.consultationInstructions = input.consultationInstructions;
    if (input.consultationNotes !== undefined) allowedUpdates.consultationNotes = input.consultationNotes;
    if (input.diagnosisNotes !== undefined) allowedUpdates.diagnosisNotes = input.diagnosisNotes;
    if (input.treatmentPlan !== undefined) allowedUpdates.treatmentPlan = input.treatmentPlan;
    if (input.followUpRecommendation !== undefined) allowedUpdates.followUpRecommendation = input.followUpRecommendation;
    if (input.status !== undefined) {
      if (appointment.status === 'cancelled') throw AppError.badRequest('Cannot update a cancelled appointment');
      allowedUpdates.status = input.status;
      if (input.status === 'completed') allowedUpdates.completedAt = new Date();
      if (input.status === 'in-progress') allowedUpdates.consultationStartedAt = new Date();
    }

    Object.assign(appointment, allowedUpdates);
    const saved = await appointment.save();
    return saved.populate('expert', 'name slug category title');
  },

  /** Get a single appointment with private consultation fields (for experts and admins). */
  async getByIdForExpert(id: string, userEmail: string): Promise<AppointmentDocument> {
    const expert = await ExpertModel.findOne({ email: userEmail.toLowerCase() });
    if (!expert) throw AppError.forbidden('No expert profile linked to your account');

    const appointment = await AppointmentModel.findById(id)
      .select('+meetingUrl +consultationNotes +diagnosisNotes +treatmentPlan')
      .populate('expert', 'name slug category title');
    if (!appointment) throw AppError.notFound('Appointment not found');
    if (String(appointment.expert?._id ?? appointment.expert) !== String(expert._id)) {
      throw AppError.forbidden('You can only view your own appointments');
    }
    return appointment;
  },

  /** Get a single appointment for the patient (includes meeting URL but not private notes). */
  async getByIdForClient(id: string, userId: string): Promise<AppointmentDocument> {
    const appointment = await AppointmentModel.findById(id)
      .select('+meetingUrl')
      .populate('expert', 'name slug category title image');
    if (!appointment) throw AppError.notFound('Appointment not found');
    if (String(appointment.user) !== userId) throw AppError.forbidden('You can only view your own appointments');
    return appointment;
  },

  /** Expert portal: update status of an appointment assigned to this expert. */
  async updateStatusByExpert(id: string, userEmail: string, status: string): Promise<AppointmentDocument> {
    const expert = await ExpertModel.findOne({ email: userEmail.toLowerCase() });
    if (!expert) throw AppError.forbidden('No expert profile linked to your account');

    // Fetch without populate so appointment.expert is a raw ObjectId for safe comparison.
    const appointment = await AppointmentModel.findById(id);
    if (!appointment) throw AppError.notFound('Appointment not found');

    if (String(appointment.expert) !== String(expert._id)) {
      throw AppError.forbidden('You can only update your own appointments');
    }
    if (appointment.status === 'cancelled') {
      throw AppError.badRequest('Cannot update a cancelled appointment');
    }
    appointment.status = status as AppointmentDocument['status'];
    const saved = await appointment.save();
    return saved.populate('expert', 'name slug category title');
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
