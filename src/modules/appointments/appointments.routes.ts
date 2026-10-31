import { Router } from 'express';
import { authenticate, authorize, optionalAuthenticate } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../utils/object-id';
import { appointmentsController } from './appointments.controller';
import { createAppointmentSchema, listAppointmentsQuerySchema, updateAppointmentSchema } from './appointments.schema';

const router = Router();

// Public: book an appointment (creates client account if password given)
router.post('/', optionalAuthenticate, validate({ body: createAppointmentSchema }), appointmentsController.create);

// Authenticated routes
router.use(authenticate);

// Client: own appointments
router.get('/mine', validate({ query: listAppointmentsQuerySchema }), appointmentsController.listMine);
router.patch('/:id/cancel', validate({ params: idParamsSchema }), appointmentsController.cancel);

// Admin/Manager
router.get('/', authorize('admin', 'manager'), validate({ query: listAppointmentsQuerySchema }), appointmentsController.list);
router.get('/stats', authorize('admin', 'manager'), appointmentsController.stats);
router.get('/:id', authorize('admin', 'manager'), validate({ params: idParamsSchema }), appointmentsController.getById);
router.patch('/:id', authorize('admin'), validate({ params: idParamsSchema, body: updateAppointmentSchema }), appointmentsController.update);
router.delete('/:id', authorize('admin'), validate({ params: idParamsSchema }), appointmentsController.remove);

export default router;
