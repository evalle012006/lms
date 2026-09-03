/**
 * Resolves the correct minimum weekly MCBU collection/target for a group,
 * based on its weeklyScheduleType. Falls back to the standard value if
 * the accelerated setting isn't configured yet (e.g. not yet saved by
 * an admin), rather than silently returning 0/NaN.
 */
export function resolveWeeklyMcbuMinimum(settings, weeklyScheduleType) {
    const standard = parseFloat(settings?.minWeeklyMcbuCollection) || 0;
    const acceleratedRaw = settings?.minWeeklyMcbuCollectionAccelerated;

    if (weeklyScheduleType === 'accelerated') {
        const accelerated = parseFloat(acceleratedRaw);
        return Number.isFinite(accelerated) ? accelerated : standard;
    }
    return standard;
}