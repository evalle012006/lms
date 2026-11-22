// Regression: mutations must not be written to Apollo's InMemoryCache (kept every mutation payload forever).
process.env.HASURA_URL = process.env.HASURA_URL || 'http://localhost:8080';
import { GraphProvider } from '@/lib/graph/graph.provider';

describe('GraphProvider cache policy', () => {
    test('mutations are no-cache', () => {
        const g = new GraphProvider();
        expect(g.apollo.defaultOptions.mutate.fetchPolicy).toBe('no-cache');
        expect(g.apollo.defaultOptions.query.fetchPolicy).toBe('no-cache');
    });
});
