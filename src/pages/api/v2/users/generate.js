import { faker } from '@faker-js/faker';
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, insertQl } from "@/lib/graph/graph.util";

const graph = new GraphProvider();
const USER_TYPE = createGraphType('users', `
${USER_FIELDS}
`)('users');

export default async function handler(req, res) {
    const role = {
        _id: "62e22a4a4c34adfb29a0ed41",
        name: "platform user",
        shortCode: "user",
        rep: 2,
        value: 2,
        label: "Platform User"
    }
    const users = Array.from(Array(10).keys()).map(item => {
        const firstName = faker.name.firstName();
        const lastName = faker.name.lastName();
        return {
            _id: generateUUID(),
            firstName: firstName,
            lastName: lastName,
            email: faker.internet.email(firstName, lastName),
            number: faker.phone.number(`61-#-####-####`),
            position: faker.name.jobType(),
            logged: false,
            lastLogin: null, 
            dateAdded: getCurrentDate(),
            role: role
        };
    });

    const data = await graph.mutation(
        insertQl(USER_TYPE, {
            objects: users
        })
    ).then(res => res.data.users.returning);


    res.status(200).json(data);
}