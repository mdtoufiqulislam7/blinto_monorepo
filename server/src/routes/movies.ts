import { Router } from 'express';
import * as c from '../controllers/movie.controller.js';

const router = Router();

router.post('/', c.create);
router.get('/', c.list);
router.patch('/:id', c.update);
router.get('/:id/rewatch-order', c.rewatchOrder);

export default router;
