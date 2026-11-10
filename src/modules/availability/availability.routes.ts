import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../utils/object-id';
import { availabilityController } from './availability.controller';
import { addUnavailableDateSchema, getSlotsQuerySchema, upsertAvailabilitySchema } from './availability.schema';

const router = Router();

// Public: get available slots for a consultant on a date
router.get('/experts/:expertId/slots', validate({ query: getSlotsQuerySchema }), availabilityController.getSlots);

router.use(authenticate);

// Expert portal: manage own schedule
router.get('/mine', authorize('expert'), availabilityController.listMine);
router.post('/mine', authorize('expert'), validate({ body: upsertAvailabilitySchema }), availabilityController.upsert);
router.delete('/mine/:day', authorize('expert'), availabilityController.deleteDay);
router.get('/mine/unavailable', authorize('expert'), availabilityController.listUnavailableMine);
router.post('/mine/unavailable', authorize('expert'), validate({ body: addUnavailableDateSchema }), availabilityController.addUnavailable);
router.delete('/mine/unavailable/:id', authorize('expert'), validate({ params: idParamsSchema }), availabilityController.removeUnavailable);

// Admin: manage any expert's schedule
router.get('/experts/:expertId', authorize('admin', 'manager', 'super_admin'), availabilityController.listForExpert);
router.post('/experts/:expertId', authorize('admin', 'super_admin'), validate({ body: upsertAvailabilitySchema }), availabilityController.upsertForExpert);

export default router;
