import { Router } from 'express';
import { isDatabaseReady } from './config/database';
import authRoutes from './modules/auth/auth.routes';
import exampleRoutes from './modules/example/example.routes';
import filesRoutes from './modules/files/files.routes';
import usersRoutes from './modules/users/users.routes';
import expertsRoutes from './modules/experts/experts.routes';
import appointmentsRoutes from './modules/appointments/appointments.routes';
import enquiriesRoutes from './modules/enquiries/enquiries.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import availabilityRoutes from './modules/availability/availability.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import { sendError, sendSuccess } from './utils/api-response';

const router = Router();

router.get('/health', (_req, res) => {
  if (!isDatabaseReady()) {
    sendError(res, 'Service unavailable: database not connected', 503);
    return;
  }
  sendSuccess(
    res,
    {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      database: 'connected',
    },
    'Service is healthy',
  );
});

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/experts', expertsRoutes);
router.use('/appointments', appointmentsRoutes);
router.use('/enquiries', enquiriesRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/availability', availabilityRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/examples', exampleRoutes);
router.use('/files', filesRoutes);

export default router;
