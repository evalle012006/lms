import { parseRole, getRole, getShortCode, getRep, isSystemAdmin, isAdminLevel, isSupport, roleKey, findRoleByKey } from '@/lib/roles';

const roles = [
    { _id: 'a', name: 'administrator', shortCode: 'admin', rep: 1 },
    { _id: 's', name: 'support', shortCode: 'support', rep: 1 },
    { _id: 'd', name: 'deputy director', shortCode: 'deputy_director', rep: 2 },
    { _id: 'r', name: 'regional manager', shortCode: 'regional_manager', rep: 2 },
    { _id: 'm', name: 'area manager', shortCode: 'area_admin', rep: 2 },
    { _id: 'l', name: 'loan officer', shortCode: 'loan_officer', rep: 4 },
];

describe('parseRole / getRole', () => {
    it('reads an object, a JSON string and rejects junk without throwing', () => {
        expect(parseRole({ shortCode: 'admin' })).toEqual({ shortCode: 'admin' });
        expect(parseRole('{"shortCode":"admin","rep":1}')).toEqual({ shortCode: 'admin', rep: 1 });
        for (const bad of [null, undefined, '', 'not json', '[1]', '"str"', 5, []]) expect(parseRole(bad)).toBeNull();
    });
    it('normalises rep to a number and works for a user or a bare role', () => {
        expect(getRole({ role: '{"shortCode":"loan_officer","rep":"4"}' }).rep).toBe(4);
        expect(getRole({ shortCode: 'x', rep: 3 }).rep).toBe(3);
        expect(getRole({ role: null })).toBeNull();
        expect(getShortCode({ role: '{"shortCode":"cashier"}' })).toBe('cashier');
        expect(getRep({})).toBeNull();
    });
});

describe('system level', () => {
    it('root, admin and support are system admins; others are not', () => {
        expect(isSystemAdmin({ root: true, role: { shortCode: 'branch_manager', rep: 3 } })).toBe(true);
        expect(isSystemAdmin({ role: { shortCode: 'admin', rep: 1 } })).toBe(false);
        expect(isAdminLevel({ role: { shortCode: 'admin', rep: 1 } })).toBe(true);
        expect(isSystemAdmin({ role: { shortCode: 'support', rep: 1 } })).toBe(false);
        expect(isAdminLevel({ role: { shortCode: 'support', rep: 1 } })).toBe(true);
        expect(isSupport({ role: '{"shortCode":"support","rep":1}' })).toBe(true);
        expect(isSystemAdmin({ role: { shortCode: 'regional_manager', rep: 2 } })).toBe(false);
        expect(isAdminLevel({ role: { shortCode: 'someone', rep: 1 } })).toBe(true);
        expect(isAdminLevel(null)).toBe(false);
    });
});

describe('role picker keys', () => {
    it('resolves the EXACT role even when reps collide (no hybrid object)', () => {
        expect(findRoleByKey(roles, '1-support')._id).toBe('s');
        expect(findRoleByKey(roles, '1-admin')._id).toBe('a');
        expect(findRoleByKey(roles, '2-area_admin')).toEqual(roles[4]);
        expect(findRoleByKey(roles, '2-nope')).toBeNull();
        expect(findRoleByKey(roles, 4)._id).toBe('l');        // legacy bare rep
        expect(findRoleByKey(roles, '')).toBeNull();
    });
    it('roleKey round-trips', () => {
        expect(roleKey(roles[1])).toBe('1-support');
        expect(findRoleByKey(roles, roleKey(roles[3]))).toBe(roles[3]);
        expect(roleKey(null)).toBe('');
    });
});
