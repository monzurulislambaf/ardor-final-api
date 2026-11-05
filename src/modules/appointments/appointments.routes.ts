import { Router } from 'express';
import { authenticate, authorize, optionalAuthenticate } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../utils/object-id';
import { appointmentsController } from './appointments.controller';
import { createAppointmentSchema, expertStatusUpdateSchema, listAppointmentsQuerySchema, updateAppointmentSchema } from './appointments.schema';

const router = Router();

// Public: book an appointment (creates client account if password given)
router.post('/', optionalAuthenticate, validate({ body: createAppointmentSchema }), appointmentsController.create);

// Authenticated routes
router.use(authenticate);

// Client: own appointments
router.get('/mine', validate({ query: listAppointmentsQuerySchema }), appointmentsController.listMine);
router.patch('/:id/cancel', validate({ params: idParamsSchema }), appointmentsController.cancel);

// Expert: appointments assigned to them (matched by user email ↔ expert.email)
router.get('/expert', authorize('expert'), validate({ query: listAppointmentsQuerySchema }), appointmentsController.listForExpert);
router.patch('/:id/expert-status', authorize('expert'), validate({ params: idParamsSchema, body: expertStatusUpdateSchema }), appointmentsController.updateStatusForExpert);

// Admin/Manager/Super-admin
router.get('/', authorize('admin', 'manager', 'super_admin'), validate({ query: listAppointmentsQuerySchema }), appointmentsController.list);
router.get('/stats', authorize('admin', 'manager', 'super_admin'), appointmentsController.stats);
router.get('/:id', authorize('admin', 'manager', 'super_admin'), validate({ params: idParamsSchema }), appointmentsController.getById);
router.patch('/:id', authorize('admin', 'super_admin'), validate({ params: idParamsSchema, body: updateAppointmentSchema }), appointmentsController.update);
router.delete('/:id', authorize('admin', 'super_admin'), validate({ params: idParamsSchema }), appointmentsController.remove);

export default router;
