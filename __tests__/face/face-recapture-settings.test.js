jest.mock('@/lib/graph/graph.provider', () => require('../../__mocks__/face-harness').graphProviderMock());
jest.mock('@/lib/graph/graph.util',     () => require('../../__mocks__/face-harness').graphUtilMock());

const { graph, answer, queryFor } = require('../../__mocks__/face-harness');
const { isFaceRecaptureEnabled } = require('@/lib/face-recapture-settings');
const { SETTINGS_FIELDS } = require('@/lib/graph.fields');

beforeEach(() => graph.query.mockReset());

describe('isFaceRecaptureEnabled', () => {
    it('is ON only for a strict boolean true', async () => {
        answer({ faceRecaptureSetting: [{ allowFaceRecapture: true }] });
        expect(await isFaceRecaptureEnabled()).toBe(true);
    });
    it.each([[false], [null], [undefined], ['true'], ['yes'], [1], [{}]])('is OFF for %p', async (value) => {
        answer({ faceRecaptureSetting: [{ allowFaceRecapture: value }] });
        expect(await isFaceRecaptureEnabled()).toBe(false);
    });
    it('is OFF with no settings row', async () => {
        answer({ faceRecaptureSetting: [] });
        expect(await isFaceRecaptureEnabled()).toBe(false);
    });
    it('reads a single row of the settings table', async () => {
        answer({ faceRecaptureSetting: [{ allowFaceRecapture: true }] });
        await isFaceRecaptureEnabled();
        expect(queryFor('faceRecaptureSetting')).toMatchObject({ table: 'settings', args: { limit: 1 } });
    });
    it('propagates a read failure instead of guessing', async () => {
        graph.query.mockRejectedValue(new Error('hasura down'));
        await expect(isFaceRecaptureEnabled()).rejects.toThrow('hasura down');
    });
});

describe('settings contract', () => {
    it('the settings API returns the switch (it must be in SETTINGS_FIELDS)', () => {
        expect(SETTINGS_FIELDS).toMatch(/\ballowFaceRecapture\b/);
    });
});