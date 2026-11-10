import { AppError } from '../../utils/app-error';
import { ExpertModel } from '../experts/experts.model';
import { AppointmentModel } from '../appointments/appointments.model';
import { ConsultantAvailabilityModel, type ConsultantAvailabilityDocument } from './availability.model';
import { ConsultantUnavailableDateModel } from './availability-unavailable.model';
import type { AddUnavailableDateInput, UpsertAvailabilityInput } from './availability.schema';

/** Convert "HH:MM" to minutes-since-midnight. */
const toMinutes = (time: string): number => {
  const parts = time.split(':').map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
};

/** Convert minutes-since-midnight back to "HH:MM". */
const fromMinutes = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** Get the expert ObjectId from a user's email (for the expert portal). */
async function getExpertIdByEmail(userEmail: string) {
  const expert = await ExpertModel.findOne({ email: userEmail.toLowerCase() }).select('_id');
  if (!expert) throw AppError.forbidden('No expert profile linked to your account');
  return expert._id;
}

export const availabilityService = {
  /** List all weekly availability records for an expert (by expert ObjectId). */
  async listByExpert(expertId: string): Promise<ConsultantAvailabilityDocument[]> {
    return ConsultantAvailabilityModel.find({ expert: expertId }).sort({ dayOfWeek: 1 });
  },

  /** List all weekly availability records for the expert linked to this user email. */
  async listByUserEmail(userEmail: string): Promise<ConsultantAvailabilityDocument[]> {
    const expertId = await getExpertIdByEmail(userEmail);
    return ConsultantAvailabilityModel.find({ expert: expertId }).sort({ dayOfWeek: 1 });
  },

  /** Create or update a day's availability for an expert (via email). */
  async upsertByUserEmail(userEmail: string, input: UpsertAvailabilityInput): Promise<ConsultantAvailabilityDocument> {
    const expertId = await getExpertIdByEmail(userEmail);
    const doc = await ConsultantAvailabilityModel.findOneAndUpdate(
      { expert: expertId, dayOfWeek: input.dayOfWeek },
      { ...input, expert: expertId },
      { upsert: true, new: true, runValidators: true },
    );
    if (!doc) throw new AppError('Failed to save availability', 500);
    return doc;
  },

  /** Admin: upsert availability for any expert by their ID. */
  async upsertByExpertId(expertId: string, input: UpsertAvailabilityInput): Promise<ConsultantAvailabilityDocument> {
    const expert = await ExpertModel.findById(expertId).select('_id');
    if (!expert) throw AppError.notFound('Expert not found');
    const doc = await ConsultantAvailabilityModel.findOneAndUpdate(
      { expert: expertId, dayOfWeek: input.dayOfWeek },
      { ...input, expert: expertId },
      { upsert: true, new: true, runValidators: true },
    );
    if (!doc) throw new AppError('Failed to save availability', 500);
    return doc;
  },

  /** Delete a day's availability entry. */
  async deleteByUserEmail(userEmail: string, dayOfWeek: number): Promise<void> {
    const expertId = await getExpertIdByEmail(userEmail);
    const deleted = await ConsultantAvailabilityModel.findOneAndDelete({ expert: expertId, dayOfWeek });
    if (!deleted) throw AppError.notFound('Availability entry not found');
  },

  /** List unavailable dates for an expert. */
  async listUnavailableByExpert(expertId: string) {
    return ConsultantUnavailableDateModel.find({ expert: expertId }).sort({ date: 1 });
  },

  /** Add an unavailable date (via user email). */
  async addUnavailableByUserEmail(userEmail: string, input: AddUnavailableDateInput) {
    const expertId = await getExpertIdByEmail(userEmail);
    const doc = await ConsultantUnavailableDateModel.findOneAndUpdate(
      { expert: expertId, date: input.date },
      { expert: expertId, date: input.date, reason: input.reason },
      { upsert: true, new: true, runValidators: true },
    );
    return doc;
  },

  /** Remove an unavailable date (via user email). */
  async removeUnavailableByUserEmail(userEmail: string, dateId: string) {
    const expertId = await getExpertIdByEmail(userEmail);
    const doc = await ConsultantUnavailableDateModel.findOneAndDelete({ _id: dateId, expert: expertId });
    if (!doc) throw AppError.notFound('Unavailable date not found');
  },

  /**
   * Generate available time slots for an expert on a specific date.
   * Excludes slots that are already booked (confirmed or pending).
   */
  async getAvailableSlots(expertId: string, date: Date): Promise<string[]> {
    const dayOfWeek = date.getDay();
    const avail = await ConsultantAvailabilityModel.findOne({ expert: expertId, dayOfWeek, isActive: true });
    if (!avail) return [];

    // Check if date is blocked
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const isUnavailable = await ConsultantUnavailableDateModel.exists({
      expert: expertId,
      date: { $gte: startOfDay, $lte: endOfDay },
    });
    if (isUnavailable) return [];

    // Fetch existing bookings on this date
    const booked = await AppointmentModel.find({
      expert: expertId,
      scheduledDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['pending', 'confirmed', 'in-progress', 'rescheduled'] },
    }).select('scheduledTime scheduledEndTime');

    const bookedMinutes = new Set<number>(
      booked.flatMap(b => {
        if (!b.scheduledTime) return [];
        const start = toMinutes(b.scheduledTime);
        const end = b.scheduledEndTime ? toMinutes(b.scheduledEndTime) : start + avail.appointmentDuration;
        // Block every minute in this range
        const blocked: number[] = [];
        for (let m = start; m < end; m++) blocked.push(m);
        return blocked;
      }),
    );

    const slots: string[] = [];
    const workStart = toMinutes(avail.workingHours.start);
    const workEnd = toMinutes(avail.workingHours.end);

    for (let slot = workStart; slot + avail.appointmentDuration <= workEnd; slot += avail.slotInterval) {
      // Check if any minute in this slot is in a break
      const inBreak = avail.breaks.some(b => {
        const bs = toMinutes(b.start);
        const be = toMinutes(b.end);
        return slot < be && slot + avail.appointmentDuration > bs;
      });
      if (inBreak) continue;

      // Check if any minute in this slot is booked
      let isBooked = false;
      for (let m = slot; m < slot + avail.appointmentDuration; m++) {
        if (bookedMinutes.has(m)) { isBooked = true; break; }
      }
      if (!isBooked) slots.push(fromMinutes(slot));
    }

    return slots;
  },
};
