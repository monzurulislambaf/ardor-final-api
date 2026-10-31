import { Types } from 'mongoose';
import { UserModel } from '../users/users.model';
import { ExpertModel } from '../experts/experts.model';
import { AppointmentModel } from '../appointments/appointments.model';
import { EnquiryModel } from '../enquiries/enquiries.model';

export const dashboardService = {
  async getAdminStats() {
    const [totalUsers, totalExperts, totalAppointments, totalEnquiries, recentAppointments, recentEnquiries, appointmentsByStatus, enquiriesByStatus, expertsByCategory] = await Promise.all([
      UserModel.countDocuments(),
      ExpertModel.countDocuments({ status: 'active' }),
      AppointmentModel.countDocuments(),
      EnquiryModel.countDocuments(),
      AppointmentModel.find().sort({ createdAt: -1 }).limit(5).populate('expert', 'name slug category'),
      EnquiryModel.find().sort({ createdAt: -1 }).limit(5),
      AppointmentModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      EnquiryModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      ExpertModel.aggregate([{ $match: { status: 'active' } }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
    ]);

    const toMap = (arr: { _id: string; count: number }[]) => {
      const m: Record<string, number> = {};
      for (const r of arr) m[r._id] = r.count;
      return m;
    };

    return {
      totals: { users: totalUsers, experts: totalExperts, appointments: totalAppointments, enquiries: totalEnquiries },
      recentAppointments,
      recentEnquiries,
      appointmentsByStatus: toMap(appointmentsByStatus),
      enquiriesByStatus: toMap(enquiriesByStatus),
      expertsByCategory: toMap(expertsByCategory),
    };
  },

  async getClientStats(userId: string) {
    const [totalAppointments, appointments, appointmentsByStatus] = await Promise.all([
      AppointmentModel.countDocuments({ user: userId }),
      AppointmentModel.find({ user: userId }).sort({ createdAt: -1 }).limit(10).populate('expert', 'name slug category title'),
      AppointmentModel.aggregate([
        // Aggregation pipelines skip Mongoose casting, so the id must be an ObjectId.
        { $match: { user: new Types.ObjectId(userId) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const toMap = (arr: { _id: string; count: number }[]) => {
      const m: Record<string, number> = {};
      for (const r of arr) m[r._id] = r.count;
      return m;
    };

    return {
      totalAppointments,
      appointments,
      appointmentsByStatus: toMap(appointmentsByStatus),
    };
  },
};
