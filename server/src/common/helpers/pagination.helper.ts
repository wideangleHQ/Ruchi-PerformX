/**
 * The flat pagination envelope every list endpoint in this API returns:
 * `{ data, total, page, limit, hasMore }`. `tasks.findAll`,
 * `self-actions.findAll`, and `notifications.getUserNotifications` each
 * hand-write this same shape; new paginated endpoints call this instead of
 * writing it again.
 */
export function paginate<T>(data: T[], total: number, page: number, limit: number) {
  return { data, total, page, limit, hasMore: page * limit < total };
}
