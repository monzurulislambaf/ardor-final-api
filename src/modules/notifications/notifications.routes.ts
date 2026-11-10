import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { notificationsController } from './notifications.controller';

const router = Router();

router.use(authenticate);

router.get('/', notificationsController.list);
router.get('/unread-count', notificationsController.unreadCount);
router.patch('/read-all', notificationsController.markAllRead);
router.patch('/:id/read', notificationsController.markRead);
router.delete('/:id', notificationsController.deleteOne);

export default router;
