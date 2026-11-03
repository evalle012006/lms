/**
 * Group is the source of truth for weekly schedule type (the server already
 * uses group.weeklyScheduleType). Falls back only when the group object
 * doesn't carry the field at all. Legacy weekly groups with a null type
 * are treated as standard (24 weeks). Returns null for daily groups.
 */
export function resolveWeeklyScheduleType(group, fallback = 'standard') {
    if (group?.occurence === 'daily') return null;
    if (group && Object.prototype.hasOwnProperty.call(group, 'weeklyScheduleType')) {
        return group.weeklyScheduleType === 'accelerated' ? 'accelerated' : 'standard';
    }
    return fallback === 'accelerated' ? 'accelerated' : 'standard';
}