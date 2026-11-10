import { NotificationModel, type NotificationType } from './notifications.model';

export const notificationsService = {
  /** Create a notification for a user. */
  async create(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    resourceId?: string;
    resourceType?: string;
  }) {
    return NotificationModel.create({
      user: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      resourceId: params.resourceId,
      resourceType: params.resourceType,
    });
  },

  /** Get paginated notifications for a user. */
  async listForUser(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [notifications, total, unreadCount] = await Promise.all([
      NotificationModel.find({ user: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      NotificationModel.countDocuments({ user: userId }),
      NotificationModel.countDocuments({ user: userId, isRead: false }),
    ]);
    return { notifications, total, unreadCount, page, limit, totalPages: Math.ceil(total / limit) };
  },

  /** Mark one notification as read. */
  async markRead(id: string, userId: string) {
    return NotificationModel.findOneAndUpdate({ _id: id, user: userId }, { isRead: true }, { new: true });
  },

  /** Mark all notifications as read for a user. */
  async markAllRead(userId: string) {
    return NotificationModel.updateMany({ user: userId, isRead: false }, { isRead: true });
  },

  /** Delete a notification. */
  async deleteOne(id: string, userId: string) {
    return NotificationModel.findOneAndDelete({ _id: id, user: userId });
  },

  /** Unread count only. */
  async unreadCount(userId: string) {
    return NotificationModel.countDocuments({ user: userId, isRead: false });
  },
};
