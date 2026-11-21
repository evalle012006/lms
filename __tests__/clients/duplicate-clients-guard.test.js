jest.mock('@/lib/graph/graph.provider', () => ({ GraphProvider: class { query() {} mutation() {} } }));

import { evaluateMatches, isBlockingMatch, toMatchSummary } from '@/lib/duplicate-clients-guard';

const existing = (o) => ({
    _id: 'e1', firstName: 'JOVERA', middleName: 'M', lastName: 'ALBER', birthdate: '1975-04-06',
    contactNumber: '09953661887', branchId: 'b1', branchName: 'Guinobatan', groupId: 'g1', loId: 'lo1',
    status: 'active', ...o,
});
const candidate = (o) => ({
    firstName: 'JOVERA', middleName: 'M', lastName: 'ALBER', birthdate: '1975-04-06',
    contactNumber: '09953661887', branchId: 'b2', ...o,
});

describe('evaluateMatches / isBlockingMatch', () => {
    it('blocks an exact match to a client with an active loan', () => {
        const [m] = evaluateMatches(candidate(), [existing()], { e1: { active: true } });
        expect(m.confidence).toBe('exact');
        expect(isBlockingMatch(m)).toBe(true);
    });

    it('blocks when the matching client only has a PENDING loan', () => {
        const [m] = evaluateMatches(candidate(), [existing()], { e1: { pending: true } });
        expect(isBlockingMatch(m)).toBe(true);
    });

    it('does NOT block an exact match to a client with no active/pending loan (warn only)', () => {
        const [m] = evaluateMatches(candidate(), [existing({ status: 'offset' })], {});
        expect(m.confidence).toBe('exact');
        expect(isBlockingMatch(m)).toBe(false);
    });

    it('does NOT block a merely possible match even if the client has an active loan', () => {
        const addr = { addressBarangayDistrict: 'POBLACION', addressMunicipalityCity: 'GUINOBATAN' };
        const [m] = evaluateMatches(
            candidate({ firstName: 'JOVERAA', birthdate: null, contactNumber: null, ...addr }),
            [existing({ birthdate: null, contactNumber: null, ...addr })], { e1: { active: true } });
        expect(m.confidence).toBe('possible');
        expect(isBlockingMatch(m)).toBe(false);
    });

    it('does not flag a fuzzy name when nothing else ties the two records together', () => {
        const out = evaluateMatches(
            candidate({ firstName: 'JOVERAA', birthdate: null, contactNumber: null }),
            [existing({ birthdate: null, contactNumber: null })], { e1: { active: true } });
        expect(out).toHaveLength(0);
    });

    it('catches swapped names and a different phone format on the same person', () => {
        const [m] = evaluateMatches(
            candidate({ firstName: 'ALBER', lastName: 'JOVERA', contactNumber: '+639953661887' }),
            [existing()], { e1: { active: true } });
        expect(isBlockingMatch(m)).toBe(true);
    });

    it('ignores a different person who shares a name (birthdate and phone differ)', () => {
        const out = evaluateMatches(candidate({ birthdate: '1990-01-15', contactNumber: '09170000001' }),
            [existing()], { e1: { active: true } });
        expect(out).toHaveLength(0);
    });

    it('summary exposes only what staff need', () => {
        const [m] = evaluateMatches(candidate(), [existing()], { e1: { active: true } });
        expect(Object.keys(toMatchSummary(m)).sort()).toEqual(
            ['birthdate', 'branchName', 'clientId', 'confidence', 'hasActiveLoan', 'hasPendingLoan', 'name', 'reasons', 'status']);
    });
});
