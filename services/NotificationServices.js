const Notification = require("../models/Notification");
const Parent = require("../models/Parent");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const mongoose = require('mongoose');

class NotificationService {
  static async createNotification(notificationData) {
    const notification = new Notification(notificationData);
    await notification.save();
    return notification;
  }

  static async getUserNotificationObject(userId, userModel) {
    let notification = await Notification.findOne({
      recipient: userId,
      recipientModel: userModel,
      isCombinedNotification: true
    });

    if (!notification) {
      notification = new Notification({
        recipient: userId,
        recipientModel: userModel,
        title: "Notifications",
        message: "You have new notifications",
        type: "combined",
        isCombinedNotification: true,
        notifications: [],
        unreadCount: 0,
        priority: "medium"
      });
      await notification.save();
    }

    return notification;
  }

  static async addToCombinedNotification(userId, userModel, notificationData) {
    const userNotification = await this.getUserNotificationObject(userId, userModel);

    const newNotificationItem = {
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

    userNotification.notifications.unshift(newNotificationItem);

    userNotification.unreadCount += 1;

    userNotification.message = `${userNotification.unreadCount} unread notifications`;

    userNotification.isRead = false;
    userNotification.updatedAt = new Date();

    await userNotification.save();
    return userNotification;
  }

  static async sendNotificationByRole(roles, data) {
    let recipients = [];

    if (roles.includes('Parent')) {
      const parents = await Parent.find({});
      recipients = recipients.concat(parents.map(p => ({
        recipient: p._id,
        recipientModel: 'Parent',
        name: p.name
      })));
    }
    if (roles.includes('Student')) {
      const students = await Student.find({});
      recipients = recipients.concat(students.map(s => ({
        recipient: s._id,
        recipientModel: 'Student',
        name: s.name
      })));
    }
    if (roles.includes('Teacher')) {
      const teachers = await Teacher.find({});
      recipients = recipients.concat(teachers.map(t => ({
        recipient: t._id,
        recipientModel: 'Teacher',
        name: t.name
      })));
    }

    const results = [];

    for (const recipient of recipients) {
      try {
        const result = await this.addToCombinedNotification(
          recipient.recipient,
          recipient.recipientModel,
          data
        );
        results.push(result);
      } catch (error) {
        console.error(`Error sending notification to ${recipient.recipientModel} ${recipient.name}:`, error);
      }
    }

    return results;
  }

  static async sendEventNotification(event) {
    return await this.sendNotificationByRole(
      ['Parent', 'Student', 'Teacher'],
      {
        title: 'New Event',
        message: `Event: ${event.name} on ${event.date.toLocaleDateString()} at ${event.location}`,
        type: 'event',
        relatedEntity: { entityType: 'Event', entityId: event._id },
        actionUrl: `/events/${event._id}`,
      }
    );
  }

  static async sendAssignmentNotification(assignment) {
    return await this.sendNotificationByRole(
      ['Parent'],
      {
        title: 'New Assignment',
        message: `Assignment "${assignment.title}" for ${assignment.subject} has been created. Due: ${assignment.dueDate?.toLocaleDateString() || 'Not specified'}`,
        type: 'assignment',
        relatedEntity: { entityType: 'Assignment', entityId: assignment._id },
        actionUrl: `/assignments/${assignment._id}`,
      }
    );
  }

  static async sendAssignmentNotificationToStudent(assignment, studentId) {
    try {
      const result = await this.addToCombinedNotification(
        studentId,
        'Student',
        {
          title: 'New Assignment',
          message: `New assignment "${assignment.title}" for ${assignment.subject}. Due: ${assignment.dueDate?.toLocaleDateString() || 'Not specified'}`,
          type: 'assignment',
          relatedEntity: { entityType: 'Assignment', entityId: assignment._id },
          actionUrl: `/assignments/${assignment._id}`,
        }
      );
      return result;
    } catch (error) {
      console.error(`Error sending assignment notification to student ${studentId}:`, error);
      throw error;
    }
  }

  static async sendGradeNotification(grade, assignment) {
    return await this.sendNotificationByRole(
      ['Student'],
      {
        title: 'Grade Assigned',
        message: `You received ${grade.marksObtained}/${assignment.totalMarks} (${grade.grade}) for "${assignment.title}"`,
        type: 'grade',
        relatedEntity: { entityType: 'Grade', entityId: grade._id },
        actionUrl: `/student/grades/${grade._id}`,
      }
    );
  }

  static async sendInvoiceNotification(invoice) {
    return await this.sendNotificationByRole(
      ['Parent'],
      {
        title: 'New Invoice Generated',
        message: `A new invoice #${invoice.invoiceNumber} for $${invoice.totalAmount} has been generated. Due date: ${invoice.dueDate?.toLocaleDateString() || 'Not specified'}`,
        type: 'fee',
        relatedEntity: { entityType: 'Invoice', entityId: invoice._id },
        actionUrl: `/parent/invoices/${invoice._id}`,
      }
    );
  }

  static async markNotificationItemAsRead(notificationId, itemId) {
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      throw new Error('Notification not found');
    }

    const notificationItem = notification.notifications.id(itemId);
    if (notificationItem && !notificationItem.isRead) {
      notificationItem.isRead = true;
      notification.unreadCount = Math.max(0, notification.unreadCount - 1);

      if (notification.unreadCount === 0) {
        notification.isRead = true;
      }

      await notification.save();
    }

    return notification;
  }

  static async markAllNotificationsAsRead(userId, userModel) {
    const notification = await this.getUserNotificationObject(userId, userModel);

    notification.notifications.forEach(item => {
      item.isRead = true;
    });

    notification.unreadCount = 0;
    notification.isRead = true;

    await notification.save();
    return notification;
  }

  static async getUserNotifications(userId, userModel, limit = 50) {
    const notification = await this.getUserNotificationObject(userId, userModel);

    const limitedNotifications = notification.notifications
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);

    return {
      _id: notification._id,
      recipient: notification.recipient,
      recipientModel: notification.recipientModel,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      isRead: notification.isRead,
      unreadCount: notification.unreadCount,
      notifications: limitedNotifications,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt
    };
  }

  static async cleanupOldNotifications(userId, userModel, keepCount = 100) {
    const notification = await this.getUserNotificationObject(userId, userModel);

    if (notification.notifications.length > keepCount) {
      notification.notifications = notification.notifications
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, keepCount);

      notification.unreadCount = notification.notifications.filter(n => !n.isRead).length;
      notification.message = `${notification.unreadCount} unread notifications`;

      await notification.save();
    }

    return notification;
  }
}

module.exports = NotificationService;