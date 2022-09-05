import renderer from 'react-test-renderer';
import Layout from '@/components/Layout';

describe('Hybrid AG Test Suite', () => {
    it('runs just testing correctly', () => {
        expect(true).toEqual(true);
    });

    it('layout renders correctly', () => {
        const tree = renderer
            .create(<Layout />)
            .toJSON();
        expect(tree).toMatchSnapshot();
    });
});