import { connectToDatabase } from "@/lib/mongodb";
import { faker } from '@faker-js/faker';
import { getCurrentDate } from '@/lib/utils';

export default async function handler(req, res) {
    const { db } = await connectToDatabase();

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
    const data = await db.collection('users').insertMany(users);

    res.status(200).json(data);
}