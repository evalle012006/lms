import { hasActionablePreSaveRow } from '@/lib/lor-edit-mode';

const ctx = { groupDay: 'friday', dayName: 'friday', isWeekend: false, isHoliday: false };
const submitted = { origin: null, draft: false, status: 'active' };
const preSave = { origin: 'pre-save', draft: null, status: 'active' };

describe('late pre-save row re-opens an already-submitted group', () => {
    test('slot 1 pre-save + submitted rows -> editable (the Mockingbird case)', () => {
        expect(hasActionablePreSaveRow([preSave, submitted, submitted], ctx)).toBe(true);
    });
    test('fully submitted group (no pre-save left) stays read-only', () => {
        expect(hasActionablePreSaveRow([submitted, submitted], ctx)).toBe(false);
    });
    test('not the group collection day -> unchanged (pre-save rows exist for every weekly loan)', () => {
        expect(hasActionablePreSaveRow([preSave], { ...ctx, groupDay: 'monday' })).toBe(false);
    });
    test.each([['weekend', { isWeekend: true }], ['holiday', { isHoliday: true }]])('%s -> unchanged', (_, o) => {
        expect(hasActionablePreSaveRow([preSave], { ...ctx, ...o })).toBe(false);
    });
    test('completed / draft / transferred / other-origin rows do not count', () => {
        expect(hasActionablePreSaveRow([{ ...preSave, status: 'completed' }], ctx)).toBe(false);
        expect(hasActionablePreSaveRow([{ ...preSave, draft: true }], ctx)).toBe(false);
        expect(hasActionablePreSaveRow([{ ...preSave, transferStr: 'Transferred' }], ctx)).toBe(false);
        expect(hasActionablePreSaveRow([{ ...preSave, origin: 'automation-ar-loan' }, { ...preSave, origin: 'offline' }], ctx)).toBe(false);
    });
    test('empty / missing input is safe', () => {
        expect(hasActionablePreSaveRow([], ctx)).toBe(false);
        expect(hasActionablePreSaveRow(undefined)).toBe(false);
    });
});
