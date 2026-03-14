const nodemailer = require('nodemailer');
const cron = require('node-cron');
const Calendar = require('../models/Calendar');
const User = require('../models/User');
const { getTranslation } = require('../utils/translations');

class NotificationService {
  constructor() {
    this.twilioClient = null;
    this.emailTransporter = null;
    this.schedulerStarted = false;
    this.initializeServices();
  }

  initializeServices() {
    // Initialize Twilio for SMS
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      try {
        const twilio = require('twilio');
        this.twilioClient = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
      } catch (error) {
        console.error('Twilio initialization failed:', error.message);
        this.twilioClient = null;
      }
    }

    // Initialize email transporter
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const hasCustomSmtp = !!process.env.EMAIL_HOST;

      this.emailTransporter = nodemailer.createTransport(
        hasCustomSmtp
          ? {
              host: process.env.EMAIL_HOST,
              port: Number(process.env.EMAIL_PORT || 587),
              secure: String(process.env.EMAIL_SECURE || 'false') === 'true',
              auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
              }
            }
          : {
              service: 'gmail',
              auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
              }
            }
      );
    }
  }

  // Send SMS notification
  async sendSMS(phoneNumber, message, language = 'english') {
    try {
      if (!this.twilioClient) {
        console.log('Twilio not configured, SMS not sent');
        return { success: false, error: 'SMS service not configured' };
      }

      const result = await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });

      console.log('SMS sent successfully:', result.sid);
      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error('SMS sending error:', error);
      return { success: false, error: error.message };
    }
  }

  // Send email notification
  async sendEmail(email, subject, message, language = 'english') {
    try {
      if (!this.emailTransporter) {
        console.log('Email not configured, email not sent');
        return { success: false, error: 'Email service not configured' };
      }

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: subject,
        html: message
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Email sending error:', error);
      return { success: false, error: error.message };
    }
  }

  // Send farmer alert through SMS, email, or both channels
  async sendFarmerAlert(user, alert, language = 'english') {
    try {
      if (!user || !alert || !alert.message) {
        return { success: false, error: 'Invalid user or alert payload' };
      }

      const channel = alert.channel || 'both';
      const smsMessage = String(alert.smsMessage || alert.message).replace(/<[^>]*>/g, '');
      const emailSubject = alert.subject || 'AgroMitra Alert';
      const emailMessage = String(alert.emailMessage || alert.message);

      const result = {
        success: true,
        channel,
        sms: null,
        email: null
      };

      if ((channel === 'sms' || channel === 'both') && user.phone) {
        result.sms = await this.sendSMS(user.phone, smsMessage, language);
      }

      if ((channel === 'email' || channel === 'both') && user.email) {
        result.email = await this.sendEmail(user.email, emailSubject, emailMessage, language);
      }

      return result;
    } catch (error) {
      console.error('Farmer alert error:', error);
      return { success: false, error: error.message };
    }
  }

  // Send push notification (placeholder for future implementation)
  async sendPushNotification(userId, title, message, data = {}) {
    try {
      // This would integrate with services like Firebase Cloud Messaging
      console.log(`Push notification to user ${userId}: ${title} - ${message}`);
      return { success: true };
    } catch (error) {
      console.error('Push notification error:', error);
      return { success: false, error: error.message };
    }
  }

  // Send voice message (placeholder for future implementation)
  async sendVoiceMessage(phoneNumber, message, language = 'english') {
    try {
      // This would integrate with Twilio Voice API
      console.log(`Voice message to ${phoneNumber}: ${message}`);
      return { success: true };
    } catch (error) {
      console.error('Voice message error:', error);
      return { success: false, error: error.message };
    }
  }

  // Send activity reminder
  async sendActivityReminder(activity, user, language = 'english') {
    try {
      const message = this.formatActivityReminder(activity, user, language);
      
      // Send SMS
      if (user.phone) {
        await this.sendSMS(user.phone, message, language);
      }

      // Send email
      if (user.email) {
        const subject = getTranslation('calendar', language) + ' - ' + activity.name;
        await this.sendEmail(user.email, subject, message, language);
      }

      // Send push notification
      await this.sendPushNotification(user._id, activity.name, message);

      return { success: true };
    } catch (error) {
      console.error('Activity reminder error:', error);
      return { success: false, error: error.message };
    }
  }

  // Format activity reminder message
  formatActivityReminder(activity, user, language) {
    const translations = {
      english: {
        reminder: "Reminder:",
        activity: "Activity:",
        scheduled: "Scheduled for:",
        priority: "Priority:",
        instructions: "Instructions:",
        high: "High",
        medium: "Medium",
        low: "Low",
        critical: "Critical"
      },
      hindi: {
        reminder: "याद दिलाना:",
        activity: "गतिविधि:",
        scheduled: "निर्धारित समय:",
        priority: "प्राथमिकता:",
        instructions: "निर्देश:",
        high: "उच्च",
        medium: "मध्यम",
        low: "कम",
        critical: "महत्वपूर्ण"
      },
      telugu: {
        reminder: "గుర్తుచేయడం:",
        activity: "కార్యకలాపం:",
        scheduled: "షెడ్యూల్:",
        priority: "ప్రాధాన్యత:",
        instructions: "సూచనలు:",
        high: "అధిక",
        medium: "మధ్యమ",
        low: "తక్కువ",
        critical: "క్లిష్టమైన"
      }
    };

    const t = translations[language] || translations.english;
    const priorityText = t[activity.priority] || activity.priority;
    
    return `${t.reminder}\n${t.activity} ${activity.name}\n${t.scheduled} ${new Date(activity.scheduledDate).toLocaleDateString()}\n${t.priority} ${priorityText}\n${t.instructions} ${activity.instructions?.text || activity.description}`;
  }

  // Schedule daily reminder checks
  scheduleReminderChecks() {
    if (this.schedulerStarted) {
      return;
    }
    this.schedulerStarted = true;

    const toDailyCron = (value) => {
      if (!value || typeof value !== 'string') return null;
      const match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
      if (!match) return null;
      const hour = Number(match[1]);
      const minute = Number(match[2]);
      return `${minute} ${hour} * * *`;
    };

    const toEveryMinutesCron = (value) => {
      const minutes = Number(value);
      if (!Number.isFinite(minutes) || minutes <= 0) return null;
      return `*/${Math.max(1, Math.floor(minutes))} * * * *`;
    };

    const reminderDailyCron = toDailyCron(process.env.REMINDER_DAILY_TIME);
    const overdueDailyCron = toDailyCron(process.env.OVERDUE_DAILY_TIME);
    const reminderEveryCron = toEveryMinutesCron(process.env.REMINDER_EVERY_MINUTES || 5);
    const overdueEveryCron = toEveryMinutesCron(process.env.OVERDUE_EVERY_MINUTES || 5);

    // Priority: DAILY_TIME > EVERY_MINUTES > explicit CRON > default(5 min)
    const reminderCron = reminderDailyCron || reminderEveryCron || process.env.REMINDER_CHECK_CRON || '*/5 * * * *';
    const overdueCron = overdueDailyCron || overdueEveryCron || process.env.OVERDUE_CHECK_CRON || '*/5 * * * *';
    const timezone = process.env.ALERTS_TIMEZONE || undefined;

    const safeReminderCron = cron.validate(reminderCron) ? reminderCron : '*/5 * * * *';
    const safeOverdueCron = cron.validate(overdueCron) ? overdueCron : '*/5 * * * *';

    // Check reminders based on configured schedule
    cron.schedule(safeReminderCron, async () => {
      await this.checkAndSendReminders();
    }, timezone ? { timezone } : undefined);

    // Check overdue activities based on configured schedule
    cron.schedule(safeOverdueCron, async () => {
      await this.checkOverdueActivities();
    }, timezone ? { timezone } : undefined);

    console.log(`Reminder scheduler active: reminders='${safeReminderCron}', overdue='${safeOverdueCron}'${timezone ? `, timezone='${timezone}'` : ''}`);
  }

  // Check and send reminders
  async checkAndSendReminders() {
    try {
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      // Find activities with reminders in the next hour
      const calendars = await Calendar.find({
        isActive: true,
        'activities.reminders.scheduledTime': {
          $gte: now,
          $lte: oneHourFromNow
        },
        'activities.reminders.sent': false
      }).populate('user', 'name phone email preferredLanguage');

      for (const calendar of calendars) {
        const user = calendar.user;
        if (!user) {
          console.warn(`Skipping reminder check for calendar ${calendar._id}: user not found`);
          continue;
        }
        const language = user.preferredLanguage || 'english';
        for (const activity of calendar.activities) {
          for (const reminder of activity.reminders) {
            if (reminder.scheduledTime >= now && reminder.scheduledTime <= oneHourFromNow && !reminder.sent) {
              await this.sendActivityReminder(activity, user, language);
              reminder.sent = true;
            }
          }
        }
        await calendar.save();
      }

      console.log('Reminder checks completed');
    } catch (error) {
      console.error('Reminder check error:', error);
    }
  }

  // Check for overdue activities
  async checkOverdueActivities() {
    try {
      const now = new Date();

      const calendars = await Calendar.find({
        isActive: true,
        'activities.scheduledDate': { $lt: now },
        'activities.status': 'pending'
      }).populate('user', 'name phone email preferredLanguage');

      for (const calendar of calendars) {
        const user = calendar.user;
        if (!user) {
          console.warn(`Skipping overdue check for calendar ${calendar._id}: user not found`);
          continue;
        }
        const language = user.preferredLanguage || 'english';
        for (const activity of calendar.activities) {
          if (activity.scheduledDate && activity.scheduledDate < now && activity.status === 'pending') {
            const overdueMessage = this.formatOverdueMessage(activity, user, language);
            
            // Send overdue notification
            if (user.phone) {
              await this.sendSMS(user.phone, overdueMessage, language);
            }
            
            if (user.email) {
              const subject = 'Overdue Activity - ' + activity.name;
              await this.sendEmail(user.email, subject, overdueMessage, language);
            }
          }
        }
      }

      console.log('Overdue activity checks completed');
    } catch (error) {
      console.error('Overdue activity check error:', error);
    }
  }

  // Format overdue message
  formatOverdueMessage(activity, user, language) {
    const translations = {
      english: {
        overdue: "OVERDUE ACTIVITY",
        activity: "Activity:",
        wasScheduled: "Was scheduled for:",
        daysOverdue: "Days overdue:",
        pleaseComplete: "Please complete this activity as soon as possible."
      },
      hindi: {
        overdue: "अतिदेय गतिविधि",
        activity: "गतिविधि:",
        wasScheduled: "निर्धारित थी:",
        daysOverdue: "दिन अतिदेय:",
        pleaseComplete: "कृपया इस गतिविधि को जल्द से जल्द पूरा करें।"
      },
      telugu: {
        overdue: "అతివ్యయ కార్యకలాపం",
        activity: "కార్యకలాపం:",
        wasScheduled: "షెడ్యూల్ చేయబడింది:",
        daysOverdue: "అతివ్యయ రోజులు:",
        pleaseComplete: "దయచేసి ఈ కార్యకలాపాన్ని వీలైనంత త్వరగా పూర్తి చేయండి."
      }
    };

    const t = translations[language] || translations.english;
    const daysOverdue = Math.ceil((new Date() - activity.scheduledDate) / (1000 * 60 * 60 * 24));
    
    return `${t.overdue}\n${t.activity} ${activity.name}\n${t.wasScheduled} ${new Date(activity.scheduledDate).toLocaleDateString()}\n${t.daysOverdue} ${daysOverdue}\n${t.pleaseComplete}`;
  }

  // Send weather alert
  async sendWeatherAlert(user, alert, language = 'english') {
    try {
      const message = this.formatWeatherAlert(alert, language);
      
      if (user.phone) {
        await this.sendSMS(user.phone, message, language);
      }
      
      if (user.email) {
        const subject = 'Weather Alert - ' + alert.type;
        await this.sendEmail(user.email, subject, message, language);
      }

      return { success: true };
    } catch (error) {
      console.error('Weather alert error:', error);
      return { success: false, error: error.message };
    }
  }

  // Format weather alert
  formatWeatherAlert(alert, language) {
    const translations = {
      english: {
        weatherAlert: "WEATHER ALERT",
        type: "Alert Type:",
        severity: "Severity:",
        description: "Description:",
        recommendation: "Recommendation:"
      },
      hindi: {
        weatherAlert: "मौसम चेतावनी",
        type: "चेतावनी प्रकार:",
        severity: "गंभीरता:",
        description: "विवरण:",
        recommendation: "सिफारिश:"
      },
      telugu: {
        weatherAlert: "వాతావరణ హెచ్చరిక",
        type: "హెచ్చరిక రకం:",
        severity: "తీవ్రత:",
        description: "వివరణ:",
        recommendation: "సిఫార్సు:"
      }
    };

    const t = translations[language] || translations.english;
    
    return `${t.weatherAlert}\n${t.type} ${alert.type}\n${t.severity} ${alert.severity}\n${t.description} ${alert.description}\n${t.recommendation} ${alert.recommendation}`;
  }

  // Send pest alert
  async sendPestAlert(user, alert, language = 'english') {
    try {
      const message = this.formatPestAlert(alert, language);
      
      if (user.phone) {
        await this.sendSMS(user.phone, message, language);
      }
      
      if (user.email) {
        const subject = 'Pest Alert - ' + alert.pestName;
        await this.sendEmail(user.email, subject, message, language);
      }

      return { success: true };
    } catch (error) {
      console.error('Pest alert error:', error);
      return { success: false, error: error.message };
    }
  }

  // Format pest alert
  formatPestAlert(alert, language) {
    const translations = {
      english: {
        pestAlert: "PEST ALERT",
        pestName: "Pest:",
        crop: "Crop:",
        severity: "Severity:",
        treatment: "Recommended Treatment:",
        prevention: "Prevention:"
      },
      hindi: {
        pestAlert: "कीट चेतावनी",
        pestName: "कीट:",
        crop: "फसल:",
        severity: "गंभीरता:",
        treatment: "अनुशंसित उपचार:",
        prevention: "रोकथाम:"
      },
      telugu: {
        pestAlert: "కీటక హెచ్చరిక",
        pestName: "కీటకం:",
        crop: "పంట:",
        severity: "తీవ్రత:",
        treatment: "సిఫార్సు చేసిన చికిత్స:",
        prevention: "నివారణ:"
      }
    };

    const t = translations[language] || translations.english;
    
    return `${t.pestAlert}\n${t.pestName} ${alert.pestName}\n${t.crop} ${alert.cropName}\n${t.severity} ${alert.severity}\n${t.treatment} ${alert.treatment}\n${t.prevention} ${alert.prevention}`;
  }
}

module.exports = NotificationService;
