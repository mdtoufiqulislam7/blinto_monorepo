import { Router } from 'express';
import * as c from '../controllers/cinema.controller.js';

const router = Router();

router.post('/', c.create);
router.get('/', c.list);
router.get('/:id/booking', c.booking);

export default router;
