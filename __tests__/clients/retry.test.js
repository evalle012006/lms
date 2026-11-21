import { withRetry, isTransientError, describeError } from '@/lib/retry';

const noSleep = () => Promise.resolve();

test('retries transient network errors and then succeeds', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('Network error: fetch failed')).mockResolvedValue('ok');
    expect(await withRetry(fn, { sleep: noSleep })).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
});
test('gives up after the configured tries and rethrows', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fetch failed'));
    await expect(withRetry(fn, { tries: 3, sleep: noSleep })).rejects.toThrow('fetch failed');
    expect(fn).toHaveBeenCalledTimes(3);
});
test('does not retry real errors (validation, permissions)', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('field "x" not found in type'));
    await expect(withRetry(fn, { sleep: noSleep })).rejects.toThrow('not found');
    expect(fn).toHaveBeenCalledTimes(1);
});
test('describeError surfaces the underlying cause', () => {
    const err = Object.assign(new Error('Network error: fetch failed'), { networkError: { cause: { code: 'UND_ERR_HEADERS_TIMEOUT', message: 'Headers Timeout Error' } } });
    expect(describeError(err)).toBe('Network error: fetch failed | UND_ERR_HEADERS_TIMEOUT | Headers Timeout Error');
    expect(isTransientError(err)).toBe(true);
});
