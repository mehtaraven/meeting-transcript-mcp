import express from 'express';
import { authenticateUser } from '../middleware/auth';
import { getUserProfile } from '../services/userService';

const router = express.Router();

router.get('/profile', authenticateUser, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const profile = await getUserProfile(userId);
    res.json({ user: profile });
  } catch (error) {
    next(error);
  }
});

export default router;
