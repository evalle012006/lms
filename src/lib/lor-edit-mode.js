// A pre-save row can appear after the rest of a weekly group was already submitted (for example when its loan only
// became eligible for pre-save later). Every submitted row sets the register read-only, which used to leave that
// late row impossible to transact. This decides when such a row must re-open the register for editing.
// Mirrors the conditions under which a fresh (nothing submitted yet) group is editable: collection day, not a
// weekend/holiday, not closed (the caller checks the closed/past-date state).
export const hasActionablePreSaveRow = (rows, { groupDay, dayName, isWeekend, isHoliday } = {}) => {
    if (isWeekend || isHoliday) return false;
    if (!groupDay || groupDay !== dayName) return false;
    return (rows ?? []).some(cc =>
        cc?.origin === 'pre-save'
        && !cc.draft
        && cc.status === 'active'
        && (cc.transferStr == null || cc.transferStr === '-')
    );
};
