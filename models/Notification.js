const mongoose = require('mongoose');

const notificationItemSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId()
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  relatedEntity: {
    entityType: String,
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'notifications.relatedEntity.entityType'
    }
  },
  actionUrl: String,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'recipientModel'
  },
  recipientModel: {
    type: String,
    required: true,
    enum: ['Parent', 'Student', 'Teacher', 'Admin']
  },
  title: {
    type: String,
    default: 'Notifications'
  },
  message: {
    type: String,
    default: 'You have new notifications'
  },
  type: {
    type: String,
    default: 'combined'
  },
  isCombinedNotification: {
    type: Boolean,
    default: false
  },
  notifications: [notificationItemSchema],
  unreadCount: {
    type: Number,
    default: 0
  },
  isRead: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  }
}, {
  timestamps: true
});

notificationSchema.index({ recipient: 1, recipientModel: 1, isCombinedNotification: 1 });
notificationSchema.index({ 'notifications.createdAt': -1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ 'notifications.isRead': 1 });

notificationSchema.virtual('latestNotification').get(function() {
  return this.notifications.length > 0 ? this.notifications[0] : null;
});

notificationSchema.methods.addNotification = function(notificationData) {
  const newNotification = {
    _id: new mongoose.Types.ObjectId(),
    title: notificationData.title,
    message: notificationData.message,
    type: notificationData.type || 'general',
    relatedEntity: notificationData.relatedEntity || null,
    actionUrl: notificationData.actionUrl || '',
    priority: notificationData.priority || 'medium',
    createdAt: new Date(),
    isRead: false
  };

  this.notifications.unshift(newNotification);
  this.unreadCount += 1;
  this.message = `${this.unreadCount} unread notifications`;
  this.isRead = false;
  
  return this.save();
};

notificationSchema.statics.findByUser = function(userId, userModel) {
  return this.findOne({
    recipient: userId,
    recipientModel: userModel,
    isCombinedNotification: true
  });
};

module.exports = mongoose.model('Notification', notificationSchema);