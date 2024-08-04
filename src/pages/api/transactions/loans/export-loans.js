import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getMonths } from '@/lib/utils';
import { createExcelBuffer } from '@/lib/excel-writer';

export default apiHandler({
    get: downloadLoans
});

async function downloadLoans(req, res) {
    const { userId, userName, userRole, userBranchCode, month, year } = req.query;

    const months = getMonths();
    const monthName = months.find(m => m.value == month).label;
    let fileName = `DST ${monthName}_${year}.xlsx`;

    if (userRole == 'root') {
        fileName = `DST ${monthName}_${year}_All_Branches.xlsx`;
    } else if (userRole == 'deputy_director') {
        fileName = `${userName} DST ${monthName}_${year}.xlsx`;
    } else if (userRole == 'regional_manager') {
        fileName = `${userName} DST ${monthName}_${year}.xlsx`;
    } else if (userRole == 'area_admin') {
        fileName = `${userName} DST ${monthName}_${year}.xlsx`;
    } else if (userRole == 'branch_manager') {
        fileName = `${userBranchCode} DST ${monthName}_${year}.xlsx`;
    }

    try {
        const data = await getData(userId, month, year);
        const monthYear = `${monthName} ${year}`;

        const excelBuffer = await createExcelBuffer(data, userBranchCode, monthYear, userRole);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.send(excelBuffer);
    } catch (error) {
        console.error('Error generating Excel file:', error);
        res.status(500).json({ error: 'Error generating Excel file' });
    }
}

async function getData(userId, month, year) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (user) {
        let branchIds = [];
        if (user?.root) {
            const branches = await db.collection('branches').find({ }).toArray();
            branchIds = branches.map(branch => branch._id.toString());
        } else {
            if (user.areaId && user.role.shortCode === 'area_admin') {
                const branches = await db.collection('branches').find({ areaId: user.areaId }).toArray();
                branchIds = branches.map(branch => branch._id.toString());
            } else if (user.regionId && user.role.shortCode === 'regional_manager') {
                const branches = await db.collection('branches').find({ regionId: user.regionId }).toArray();
                branchIds = branches.map(branch => branch._id.toString());
            } else if (user.divisionId && user.role.shortCode === 'deputy_director') {
                const branches = await db.collection('branches').find({ divisionId: user.divisionId }).toArray();
                branchIds = branches.map(branch => branch._id.toString());
            } else if (user.role.shortCode === 'branch_manager') {
                branchIds.push(user.designatedBranchId);
            }
        }

        const data = [];
        const promise = await new Promise(async (resolve) => {
            const response = await Promise.all(branchIds.map(async (branchId) => {
                data.push.apply(data, await getAllLoanTransactionsByBranch(db, branchId, month, year));
            }));

            resolve(response);
        });

        if (promise) {
            return processData(data, user?.root);
        }
    }
}

async function getAllLoanTransactionsByBranch(db, branchId, month, year) {
    return await db
        .collection('loans')
        .aggregate([
            { $match: { $expr: { $and: [
                { $eq: ['$branchId', branchId] },
                { $ne: ['$status', 'pending'] },
                { $ne: ['$status', 'reject'] },
                {
                    $and: [
                        { $eq: [{ $substr: ['$dateGranted', 0, 4] }, year] },
                        { $eq: [{ $substr: ['$dateGranted', 5, 2] }, month] }
                    ]
                }
            ] } } },
            {
                $addFields: {
                    "branchIdObj": { $toObjectId: "$branchId" },
                    "clientIdObj": { $toObjectId: "$clientId" }
                }
            },
            {
                $lookup: {
                    from: "branches",
                    localField: "branchIdObj",
                    foreignField: "_id",
                    as: "branch"
                }
            },
            {
                $lookup: {
                    from: "client",
                    localField: "clientIdObj",
                    foreignField: "_id",
                    as: "client"
                }
            }
        ]).toArray();
}

function processData(rawData, root) {
    return rawData.map((loan, index) => {
        if (root) {
            const branchName = loan?.branch[0]?.name;
            return {
                index: index,
                clientName: loan?.client[0]?.fullName,
                branchName: branchName.toUpperCase(),
                loanPrincipal: loan.principalLoan,
                amountRelease: loan.amountRelease
            };
        } else {
            return {
                index: index,
                clientName: loan?.client[0]?.fullName,
                loanPrincipal: loan.principalLoan,
                amountRelease: loan.amountRelease
            };
        }
    });
}