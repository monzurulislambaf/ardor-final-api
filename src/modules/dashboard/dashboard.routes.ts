import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { dashboardController } from './dashboard.controller';

const router = Router();

router.use(authenticate);

router.get('/admin', authorize('admin', 'manager', 'super_admin'), dashboardController.adminStats);
router.get('/client', dashboardController.clientStats);
router.get('/expert', authorize('expert'), dashboardController.expertStats);

export default router;
