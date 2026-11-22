import { detectDuplicates } from '@/lib/duplicate-clients';

const mk = (o) => ({
    _id: 'x', firstName: 'MARITES', middleName: null, lastName: 'DELA CRUZ', birthdate: null,
    contactNumber: null, branchId: 'b1', branchName: 'B1', groupId: 'g1', loId: 'lo1', status: 'active', ...o,
});
const idsOf = (cl) => cl.members.map(m => m._id).sort();

describe('clustering does not chain different people', () => {
    it('a sparse record (no middle name, no birthdate) cannot bridge two different people', () => {
        const hub = mk({ _id: 'hub' });
        const p1 = mk({ _id: 'p1a', middleName: 'DUNGCA', birthdate: '1982-01-03', contactNumber: '09486084156' });
        const p1b = mk({ _id: 'p1b', middleName: 'DUNGCA', birthdate: '1982-01-03', contactNumber: '09647604226' });
        const p2 = mk({ _id: 'p2a', middleName: 'RESGONIO', birthdate: '1979-09-20', contactNumber: '09973747187' });
        const p2b = mk({ _id: 'p2b', middleName: 'RESGONIO', birthdate: '1979-09-20', contactNumber: '09657477015' });
        const { clusters, stats } = detectDuplicates([hub, p1, p1b, p2, p2b], new Set(['p1a', 'p2a']));
        const withP1 = clusters.find(c => idsOf(c).includes('p1a'));
        const withP2 = clusters.find(c => idsOf(c).includes('p2a'));
        // never one group containing both people
        expect(withP1 && withP2 && withP1 === withP2).toBeFalsy();
        for (const c of clusters) {
            const ids = idsOf(c);
            expect(ids.includes('p1a') && ids.includes('p2a')).toBe(false);
        }
        expect(stats.rejectedLinks).toBeGreaterThan(0);
    });

    it('real duplicates (same name + birthdate) still group, and stay exact', () => {
        const a = mk({ _id: 'a', middleName: 'S', birthdate: '1970-02-18', contactNumber: '09511573069' });
        const b = mk({ _id: 'b', middleName: 'S', birthdate: '1970-02-18', contactNumber: '09511573069', branchId: 'b2' });
        const c = mk({ _id: 'c', middleName: 'S', birthdate: '1970-02-18', contactNumber: '09511573069', branchId: 'b3' });
        const { clusters } = detectDuplicates([a, b, c], new Set(['a', 'b']));
        expect(clusters).toHaveLength(1);
        expect(idsOf(clusters[0])).toEqual(['a', 'b', 'c']);
        expect(clusters[0].confidence).toBe('exact');
    });

    it('group confidence is the weakest joining link, not the best pair', () => {
        const a = mk({ _id: 'a', middleName: 'S', birthdate: '1970-02-18' });
        const b = mk({ _id: 'b', middleName: 'S', birthdate: '1970-02-18' });
        const weak = mk({ _id: 'w', middleName: null, birthdate: null });
        const { clusters } = detectDuplicates([a, b, weak], new Set(['a']));
        expect(clusters).toHaveLength(1);
        expect(idsOf(clusters[0])).toEqual(['a', 'b', 'w']);
        expect(clusters[0].confidence).toBe('possible');
    });

    it('every member carries a remark; one is the reference record', () => {
        const a = mk({ _id: 'a', middleName: 'S', birthdate: '1970-02-18', contactNumber: '09511573069' });
        const b = mk({ _id: 'b', middleName: 'S', birthdate: '1970-02-18', contactNumber: '09511573069' });
        const { clusters } = detectDuplicates([a, b], new Set(['a']));
        const ms = clusters[0].members;
        expect(ms.filter(m => m.match.anchor)).toHaveLength(1);
        const other = ms.find(m => !m.match.anchor);
        expect(other.match.confidence).toBe('exact');
        expect(other.match.reasons).toContain('Same birthdate');
        expect(other.match.differs).toEqual([]);
    });

    it('a record linked only through another one says so (via) and lists what differs', () => {
        const a = mk({ _id: 'a', middleName: 'S', birthdate: '1970-02-18', contactNumber: '09511573069' });
        const b = mk({ _id: 'b', middleName: 'S', birthdate: '1970-02-18', contactNumber: '09511573069' });
        const c = mk({ _id: 'c', middleName: 'S', birthdate: '1970-02-19', contactNumber: '09511573069' }); // near birthdate, same phone
        const { clusters } = detectDuplicates([a, b, c], new Set(['a']));
        const cm = clusters[0].members.find(m => m._id === 'c');
        expect(cm.match.differs).toContain('Birthdate');
    });
});

describe('reviewer exclusions ("not the same person")', () => {
    it('an excluded pair never ends up in the same group, even though they match', () => {
        const mkd = (id, extra = {}) => mk({ _id: id, middleName: 'S', birthdate: '1970-02-18', contactNumber: '09511573069', ...extra });
        const a = mkd('a'), b = mkd('b'), c = mkd('c');
        const withoutEx = detectDuplicates([a, b, c], new Set(['a', 'b'])).clusters;
        expect(idsOf(withoutEx[0])).toEqual(['a', 'b', 'c']);

        const ex = new Set(['b|c']);
        const { clusters } = detectDuplicates([a, b, c], new Set(['a', 'b']), [], { exclusions: ex });
        for (const cl of clusters) {
            const ids = idsOf(cl);
            expect(ids.includes('b') && ids.includes('c')).toBe(false);
        }
        // b and c are still each linked to a, but only one of them can join it
        expect(clusters.length).toBeGreaterThan(0);
    });
});
