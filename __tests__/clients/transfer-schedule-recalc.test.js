const { needsTransferRecalculation, getTransferPreview } = require('@/lib/transfer-recalculation');

const base = { targetWeeklyScheduleType: 'accelerated', amountRelease: 12000, loanBalance: 6000, currentActiveLoan: 500, currentLoanTerms: 24, currentNoOfPayments: 12 };

test('weekly standard -> weekly accelerated now needs recalculation (was silently skipped)', () => {
    expect(needsTransferRecalculation({ sourceOccurence: 'weekly', targetOccurence: 'weekly', targetWeeklyScheduleType: 'accelerated', currentWeeklyScheduleType: 'standard' })).toBe(true);
    // legacy loan without a schedule type counts as standard
    expect(needsTransferRecalculation({ sourceOccurence: 'weekly', targetOccurence: 'weekly', targetWeeklyScheduleType: 'accelerated', currentWeeklyScheduleType: null })).toBe(true);
});

test('same weekly schedule, or daily -> daily, needs nothing', () => {
    expect(needsTransferRecalculation({ sourceOccurence: 'weekly', targetOccurence: 'weekly', targetWeeklyScheduleType: 'accelerated', currentWeeklyScheduleType: 'accelerated' })).toBe(false);
    expect(needsTransferRecalculation({ sourceOccurence: 'weekly', targetOccurence: 'weekly', targetWeeklyScheduleType: null, currentWeeklyScheduleType: 'standard' })).toBe(false);
    expect(needsTransferRecalculation({ sourceOccurence: 'daily', targetOccurence: 'daily' })).toBe(false);
});

test('occurence change always recalculates', () => {
    expect(needsTransferRecalculation({ sourceOccurence: 'daily', targetOccurence: 'weekly', targetWeeklyScheduleType: 'standard' })).toBe(true);
});

test('preview: standard -> accelerated re-amortizes to 12 terms / doubled installment, flags occurenceChanged=false', () => {
    const p = getTransferPreview({ ...base, sourceOccurence: 'weekly', targetOccurence: 'weekly', currentWeeklyScheduleType: 'standard' });
    expect(p).toMatchObject({ recalculated: true, occurenceChanged: false, loanTerms: 12, activeLoan: 1000, weeklyScheduleType: 'accelerated' });
});

test('preview: nothing owed -> left alone', () => {
    const p = getTransferPreview({ ...base, loanBalance: 0, sourceOccurence: 'weekly', targetOccurence: 'weekly', currentWeeklyScheduleType: 'standard' });
    expect(p.recalculated).toBe(false);
});
