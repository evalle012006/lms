import {
    detectDuplicates, detectMultiActiveLoans, clusterKey, normalizePhone, normalizeBirthdate, normalizeName,
} from '@/lib/duplicate-clients';

const base = (o) => ({
    _id: 'c0', firstName: 'JOVERA', middleName: 'M', lastName: 'ALBER', birthdate: '1975-04-06',
    contactNumber: '09953661887', branchId: 'b1', branchName: 'Guinobatan', groupId: 'g1', loId: 'lo1',
    status: 'active', ...o,
});

describe('normalizers', () => {
    it('normalizes PH phones', () => {
        expect(normalizePhone('+63 995 366 1887')).toBe('9953661887');
        expect(normalizePhone('09953661887')).toBe('9953661887');
        expect(normalizePhone('0000000000')).toBeNull();
        expect(normalizePhone('-')).toBeNull();
    });
    it('normalizes birthdates and rejects junk', () => {
        expect(normalizeBirthdate('April 06, 1975')).toBe('1975-04-06');
        expect(normalizeBirthdate('1975-04-06T00:00:00.000Z')).toBe('1975-04-06');
        expect(normalizeBirthdate('1800-01-01')).toBeNull();
    });
    it('strips accents, punctuation and suffixes', () => {
        expect(normalizeName("Peña, Jr.")).toBe('PENA');
    });
});

describe('detectDuplicates', () => {
    it('flags identical data on a different branch with both active as exact / both_active', () => {
        const a = base({ _id: 'a' });
        const b = base({ _id: 'b', branchId: 'b2', branchName: 'Other', loId: 'lo2', groupId: 'g2' });
        const { clusters } = detectDuplicates([a, b], new Set(['a', 'b']));
        expect(clusters).toHaveLength(1);
        expect(clusters[0]).toMatchObject({ view: 'active', confidence: 'exact', severity: 'both_active' });
        expect(clusters[0].scenarios).toContain('cross_branch');
    });

    it('flags near-identical data on the same branch, different group', () => {
        const a = base({ _id: 'a' });
        const b = base({ _id: 'b', firstName: 'JOVERA', middleName: null, groupId: 'g2', contactNumber: '9953661887' });
        const { clusters } = detectDuplicates([a, b], new Set(['a']));
        expect(clusters[0].scenarios).toEqual(['same_lo_diff_group']);
        expect(['exact', 'high']).toContain(clusters[0].confidence);
        expect(clusters[0].severity).toBe('one_active');
    });

    it('catches first/last name swapped and typo in birthdate', () => {
        const a = base({ _id: 'a' });
        const b = base({ _id: 'b', firstName: 'ALBER', lastName: 'JOVERA', birthdate: '1975-06-04' });
        const { clusters } = detectDuplicates([a, b], new Set(['a']));
        expect(clusters).toHaveLength(1);
    });

    it('does not flag same name with clearly different birthdate and phone', () => {
        const a = base({ _id: 'a' });
        const b = base({ _id: 'b', birthdate: '1990-01-15', contactNumber: '09170000001' });
        expect(detectDuplicates([a, b], new Set(['a', 'b'])).clusters).toHaveLength(0);
    });

    it('puts an offset record identical to an active client in the closed view', () => {
        const a = base({ _id: 'a' });
        const b = base({ _id: 'b', status: 'offset', groupId: '', loId: '', oldGroupId: 'g9', oldLoId: 'lo9' });
        const { clusters } = detectDuplicates([a, b], new Set(['a']));
        expect(clusters).toHaveLength(1);
        expect(clusters[0]).toMatchObject({ view: 'closed', exactClosedVsActive: true });
    });

    it('lists multiple offset records of the same person in the closed view', () => {
        const a = base({ _id: 'a', status: 'offset' });
        const b = base({ _id: 'b', status: 'offset', branchId: 'b2' });
        const { clusters } = detectDuplicates([a, b], new Set());
        expect(clusters[0].view).toBe('closed');
    });

    it('skips oversized generic buckets instead of comparing them', () => {
        const many = Array.from({ length: 200 }, (_, i) =>
            base({ _id: `x${i}`, firstName: `NAME${i}`, lastName: 'SANTOS', contactNumber: null }));
        const { stats } = detectDuplicates(many, new Set());
        expect(stats.skippedBuckets).toBeGreaterThan(0);
    });
});

describe('detectMultiActiveLoans', () => {
    const loan = (id, clientId, cycle) => ({ _id: id, clientId, loanCycle: cycle, principalLoan: 5000, loanBalance: 3000, slotNo: 1 });

    it('flags one client id that owns two active loans, newest cycle first', () => {
        const out = detectMultiActiveLoans([base({ _id: 'a' })], [loan('l1', 'a', 1), loan('l2', 'a', 2), loan('l3', 'z', 1)]);
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ view: 'same_client', activeCount: 2, severity: 'both_active' });
        expect(out[0].members[0].activeLoans.map(l => l._id)).toEqual(['l2', 'l1']);
    });

    it('ignores clients with a single active loan and loans of unknown clients', () => {
        expect(detectMultiActiveLoans([base({ _id: 'a' })], [loan('l1', 'a', 1), loan('l2', 'ghost', 1), loan('l3', 'ghost', 2)])).toHaveLength(0);
    });
});

describe('clusterKey', () => {
    it('is stable when a newer record joins the group', () => {
        const two = { members: [{ _id: 'b' }, { _id: 'a' }] };
        const three = { members: [{ _id: 'c' }, { _id: 'a' }, { _id: 'b' }] };
        expect(clusterKey(two)).toBe('dc_a');
        expect(clusterKey(three)).toBe('dc_a');
    });
});
