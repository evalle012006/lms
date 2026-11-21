jest.mock('@/lib/graph/graph.provider', () => require('../../__mocks__/face-harness').graphProviderMock());
jest.mock('@/lib/graph/graph.util',     () => require('../../__mocks__/face-harness').graphUtilMock());

const { graph, answer, queryFor } = require('../../__mocks__/face-harness');
const { isFaceUniquenessEnforced } = require('@/lib/face-uniqueness-settings');
const { SETTINGS_FIELDS } = require('@/lib/graph.fields');

beforeEach(() => { graph.query.mockReset(); jest.spyOn(console, 'warn').mockImplementation(() => {}); });

describe('isFaceUniquenessEnforced (default ON)', () => {
    it('is OFF only for a stored boolean false', async () => {
        answer({ faceUniquenessSetting: [{ enforceFaceUniqueness: false }] });
        expect(await isFaceUniquenessEnforced()).toBe(false);
    });
    it.each([[true], [null], [undefined], ['false'], [0]])('stays ON for %p', async (value) => {
        answer({ faceUniquenessSetting: [{ enforceFaceUniqueness: value }] });
        expect(await isFaceUniquenessEnforced()).toBe(true);
    });
    it('is ON with no settings row', async () => {
        answer({ faceUniquenessSetting: [] });
        expect(await isFaceUniquenessEnforced()).toBe(true);
    });
    it('stays ON when the settings read fails', async () => {
        graph.query.mockRejectedValue(new Error('hasura down'));
        expect(await isFaceUniquenessEnforced()).toBe(true);
    });
    it('reads one row of the settings table', async () => {
        answer({ faceUniquenessSetting: [{ enforceFaceUniqueness: true }] });
        await isFaceUniquenessEnforced();
        expect(queryFor('faceUniquenessSetting')).toMatchObject({ table: 'settings', args: { limit: 1 } });
    });
});

describe('settings contract', () => {
    it('the settings API returns the switch', () => {
        expect(SETTINGS_FIELDS).toMatch(/\benforceFaceUniqueness\b/);
    });
});
