const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const NotificationService = require('../services/notificationService');

const router = express.Router();
const notificationService = new NotificationService();

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

router.get('/status', authenticateToken, (req, res) => {
  res.json({
    success: true,
    providers: {
      sms: !!notificationService.twilioClient,
      email: !!notificationService.emailTransporter
    }
  });
});

router.post(
  '/farmer-alert',
  authenticateToken,
  [
    body('message').trim().isLength({ min: 1 }).withMessage('Message is required'),
    body('subject').optional().isString(),
    body('channel').optional().isIn(['sms', 'email', 'both']).withMessage('Invalid channel'),
    body('language').optional().isIn(['hindi', 'telugu', 'english', 'kannada', 'tamil', 'malayalam'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await User.findById(req.user.userId).select('name phone email preferredLanguage');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const {
        message,
        subject = 'AgroMitra Alert',
        channel = 'both',
        language = user.preferredLanguage || 'english'
      } = req.body;

      const result = await notificationService.sendFarmerAlert(
        user,
        {
          subject,
          message,
          channel
        },
        language
      );

      res.json({
        success: true,
        recipient: {
          name: user.name,
          email: user.email || null,
          phone: user.phone || null
        },
        result
      });
    } catch (error) {
      console.error('Farmer alert route error:', error);
      res.status(500).json({ success: false, error: 'Error sending farmer alert' });
    }
  }
);

module.exports = router;
