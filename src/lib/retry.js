// src/lib/retry.js — retry a flaky async call on transient network errors only.

const TRANSIENT = /fetch failed|network error|ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|socket hang up|UND_ERR|\b50[234]\b/i;

/** Message + the underlying cause (undici puts the real reason in err.cause). */
export function describeError(err) {
    const cause = err?.networkError?.cause ?? err?.cause ?? err?.networkError;
    return [err?.message, cause?.code, cause?.message].filter(Boolean).join(' | ');
}

export const isTransientError = (err) => TRANSIENT.test(describeError(err));

export async function withRetry(fn, { tries = 3, baseMs = 1000, sleep = (ms) => new Promise(r => setTimeout(r, ms)) } = {}) {
    for (let attempt = 1; ; attempt++) {
        try {
            return await fn();
        } catch (err) {
            if (attempt >= tries || !isTransientError(err)) throw err;
            await sleep(baseMs * 2 ** (attempt - 1));
        }
    }
}
