import { orderGroups } from '../../src/lib/support-group-order';

const g = (groupNo, occurence, noOfClients, day, dayNo) => ({ _id: `${occurence}${groupNo}${day ?? ''}`, groupNo, occurence, noOfClients, day, dayNo });

test('same type with clients, then same type without clients, then others; by groupNo (weekly: then day)', () => {
    const list = [
        g(3, 'daily', 0), g(2, 'weekly', 5, 'Tuesday'), g(10, 'weekly', 4, 'Monday'), g(2, 'weekly', 6, 'Monday'),
        g(1, 'daily', 9), g(1, 'weekly', 0, 'Monday'), g(9, 'weekly', 3, 'Friday'),
    ];
    const out = orderGroups(list, 'weekly');
    expect(out.map((x) => `${x.section}:${x.occurence}${x.groupNo}${x.day ?? ''}`)).toEqual([
        '1:weekly2Monday', '1:weekly2Tuesday', '1:weekly9Friday', '1:weekly10Monday',
        '2:weekly1Monday',
        '3:daily1', '3:daily3',
    ]);
});
test('no loan officer type puts everything in "others"', () => {
    expect(orderGroups([g(1, 'daily', 3)], null)[0].section).toBe(3);
});
