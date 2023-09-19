import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import formidable from "formidable";
import fs from "fs";
import { excelReader } from "@/lib/excel-reader";
import logger from "@/logger";
import moment from "moment";
import { v4 as uuidv4 } from 'uuid';
import { getEndDate } from '@/lib/utils';

export default apiHandler({
    post: startMigration
});

async function startMigration(req, res) {
    logger.debug({page: 'migrations', message: 'Starting Migrations'});
    let statusCode = 200;
    let response = {};

    const form = new formidable.IncomingForm({ keepExtensions: true });
    const promise = await new Promise((resolve, reject) => {
        form.parse(req, async (err, fields, files) => {
            console.log(fields)
            // const branchData = await db.collection('branches').find({ _id: new ObjectId(fields.branchId) }).toArray();
            // const userData = await db.collection('users').find({ _id: new ObjectId(fields.loId) }).toArray();

            let file;
            if (files.file) {
                file = await saveFile(files.file, fields.loId);
            }

            logger.debug({page: 'migrations', message: `File Directory: ${file}`});
            let fileProcessComplete = false;
            if (file) {
                fileProcessComplete = await processExcel(file, fields.branchId, fields.loId);
            }

            if (err) {
                resolve({ formError: true })
            }

            resolve({ success: true, fileProcessComplete });
        });
    });
    response = { ...response, success: true, ...promise };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

const processExcel = async (file, branchId, loId) => {
    let complete = false;

    const data = excelReader('./public/migrations/' + file);

    data.map((sheet, sheetIdx) => {
        if (sheetIdx == 0) {
            processLOR(sheet.data, branchId, loId);
        } else if (sheetIdx == 1) {
            // LOS
        } else if (sheetIdx == 2) {
            // Group Summary
            complete = true;
        }  
    });
    return complete;
}

const processLOR = async (sheetData, branchId, loId) => {
    logger.debug({page: 'migrations', message: "Processing LOR Sheet"});
    const { db } = await connectToDatabase();
    const cashCollections = [];
    const loans = [];
    const clients = [];

    let groupName;
    let collectionDate1;
    let collectionDate2;
    let collectionDate3;
    let collectionDate4;
    let collectionDate5;
    let collectionDate6;
    let collectionDate7;
    let collectionDate8;
    let collectionDate9;
    let collectionDate10;
    let collectionDate11;
    let collectionDate12;
    let collectionDate13;
    let collectionDate14;
    let collectionDate15;
    let collectionDate16;
    let collectionDate17;
    let collectionDate18;
    let collectionDate19;
    let collectionDate20;
    let collectionDate21;
    let collectionDate22;
    let collectionDate23;
    let collectionDate24;
    let collectionDate25;

    sheetData.map((col, i) => {
        // get group no
        if (i === 1) {
            // col[6] groupNo
        } else if (i === 2 || i === 36 || i === 70 || i === 104 || i === 138 || i === 172 || i === 206 || i === 240 || i === 274 || i === 308 || i === 342 || i === 376) {
            groupName = col[2]?.toUpperCase();
            logger.debug({page: 'migrations', message: `Group Name: ${groupName}`});
        } else if (i === 3) {
            // skip this only headers
        } else if (i === 4 || i === 38 || i === 72 || i === 106 || i === 140 || i === 174 || i === 208 || i === 242 || i === 276 || i === 310 || i === 344 || i === 378) {
            // first week index 28 - 37
            // collectionDate5 = parseDate(col[36]);
            // second week index 38 - 47
            // collectionDate6 = parseDate(col[38]);
            // collectionDate7 = parseDate(col[40]);
            // collectionDate8 = parseDate(col[42]);
            // collectionDate9 = parseDate(col[44]);
            // collectionDate10 = parseDate(col[46]);
            // third week index 48 - 57
            // collectionDate11 = parseDate(col[48]);
            // collectionDate12 = parseDate(col[50]);
            // collectionDate13 = parseDate(col[52]);
            // collectionDate14 = parseDate(col[54]);
            // collectionDate15 = parseDate(col[56]);
            // fourth week index 58 - 67
            // fifth week index 68 - 77
        } else if (i === 5) {
            // another header
        } else if (i > 5 && i < 406) { // DOUBLE CHECK ROW INDEXES
            // starts of transaction
            // skip rows
            if (i === 37 || i === 71 || i === 105 || i === 139 || i === 173 || i === 207 || i === 241 || i === 275 || i === 309 || i === 343 || i === 377) {
                // nothing to do...just skipping
            } else {
                const slotNo = col[0] ? parseInt(col[0]) : null;
                logger.debug({page: 'migrations', message: `Slot No: ${slotNo}`});
                const clientName = extractName(col[1]);
                if (clientName) {
                    logger.debug({page: 'migrations', message: `Client Name: ${clientName.firstName} ${clientName.lastName}`});
                    const clientDOB = col[2] ? parseDate(col[2]) : null;
                    const coMaker = col[3] ? col[3] : null;
                    const admissionDate = col[4] ? parseDate(col[4]) : null;
                    const guarantorName = extractName(col[5]);
                    const clientAddress = col[6];
                    const clientPhoneNo = col[7];
                    const loanCycle = col[8] ? parseInt(col[8]) : 0;
                    const loanHistory = { date: col[9], amount: col[10], cycle: col[11] };
                    const dateGranted = col[12] ? parseDate(col[12]) : null;
                    const amountRelease = col[13] ? parseFloat(col[13]) : 0;
                    const principalLoan = amountRelease / 1.20;
                    const activeLoan = (principalLoan * 1.20) / 60; // IF TRANSACTION IS DAILY!!!! ADJUST
                    // skip col[14] another loanCycle
                    // skip col[15 - 20] no data
                    // skip col[21] another slotNo
                    // skip col[22] no of clients
                    let startingMcbu = col[23] ? parseFloat(col[23]) : 0;
                    // skip col[24] forwarded amountRelease
                    let startingLoanBalance = col[25] ? parseFloat(col[25]) : 0;
                    let startingNoOfPayments = (amountRelease - startingLoanBalance) / activeLoan;
                    // skip col[26] forwarded pastDue
                    // skip col[27] dateRelease no data
                    // starting 28 - 78 cashcollections
                    const mcbuWithdrawalAmount = col[79] ? parseFloat(col[79]) : 0;
                    const mcbuInterestAmount = col[80] ? parseFloat(col[80]) : 0;
                    // skip col[81] mcbu returned count
                    const mcbuReturnedAmount = col[82] ? parseFloat(col[82]) : 0;
                    // skip col[83] fullpayment count
                    // ADJUST HERE IF THERE IS A DATA
                    const fullPaymentAmount = col[84];
                    const fullPaymentDate = '';
                    // skip 84 - 85
                    const mcbu = col[86] ? parseFloat(col[86]) : 0;
                    // skip col[87] after amount release
                    const loanBalance = col[88] ? parseFloat(col[88]) : 0;
                    const noOfPayments = (amountRelease - loanBalance) / activeLoan;
                    const pastDue = col[89] ? parseFloat(col[89]) : 0;

                    const startDate = moment(dateGranted).add(1, 'days').format('YYYY-MM-DD');
                    const endDate = getEndDate(dateGranted, 60 ); // ADJUST IF WEEKLY
                    
                    // ADJUST THIS FOR NEW MONTH!!!!
                    const client = {
                        tempId: uuidv4(),
                        branchId: branchId,
                        loId: loId,
                        groupName: groupName,
                        firstName: clientName.firstName,
                        middleName: clientName.middleName,
                        lastName: clientName.lastName,
                        birthdate: clientDOB,
                        address: clientAddress,
                        status: 'active',
                        deliquent: false,
                        contactNumber: clientPhoneNo,
                        insertedBy: "migration",
                        dateAdded: new Date()
                    }

                    const loan = {
                        branchId: branchId,
                        loId: loId,
                        groupName: groupName,
                        slotNo: slotNo,
                        clientId: client.tempId,
                        admissionDate: admissionDate,
                        mcbu: mcbu,
                        principalLoan: principalLoan,
                        activeLoan: activeLoan,
                        amountRelease: amountRelease,
                        loanBalance: loanBalance,
                        noOfPayments: noOfPayments,
                        loanCycle: loanCycle,
                        pnNumber: '',
                        status: 'active',
                        occurence: 'daily', // ADJUST IF WEEKLY
                        loanTerms: 60, // ADJUST IF WEEKLY
                        loanRelease: amountRelease,
                        mispayment: 0,
                        dateGranted: dateGranted,
                        startDate: startDate,
                        endDate: endDate,
                        advanceDays: 0,
                        fullPaymentDate: null,
                        history: {},
                        mcbuCollection: mcbu,
                        mcbuIntereset: mcbuInterestAmount,
                        mcbuTarget: null, // ADJUST IF WEEKLY
                        mcbuWithdrawal: mcbuWithdrawalAmount,
                        noPastDue: 0, // ADJUST IF THERE IS PASTDUE
                        pastDue: pastDue,
                        coMaker: coMaker,
                        guarantorFirstName: guarantorName.firstName,
                        guarantorMiddleName: guarantorName.middleName,
                        guarantorLastName: guarantorName.lastName,
                        insertedBy: "migration",
                        insertedDateTime: new Date()
                    }

                    // const header = {
                    //     branchId: branchId,
                    //     loId: loId,
                    //     groupName: groupName,
                    //     clientId: client.tempId,
                    //     slotNo: slotNo,
                    //     loanCycle: loanCycle,
                    //     mispayment: false, // ADJUST IF THERE IS DATA
                    //     mispaymentStr: 'No',
                    //     activeLoan: activeLoan,
                    //     targetCollection: activeLoan,
                    //     amountRelease: amountRelease,
                    //     occurence: 'daily', // ADJUST IF WEEKLY
                    //     currentReleaseAmount: 0, // ADJUST IF THERE IS DATA
                    //     fullPayment: 0, // ADJUST IF THERE IS DATA
                    //     fullPaymentDate: null, // ADJUST IF THERE IS DATA
                    //     remarks: "",
                    //     pastDue: 0, // ADJUST IF THERE IS DATA
                    //     status: 'active',
                    //     loanTerms: 60,
                    //     mcbuWithdrawalFlag: false,
                    //     insertedBy: "migration",
                    //     insertedDateTime: new Date(),
                    //     groupStatus: "closed",
                    //     deliquent: false
                    // }

                    // // ADJUST IF THERE ARE CHANGES
                    // // START COLLECTIONS
                    // let mcbuCol = col[36] ? parseFloat(col[36]) : 0; // ADJUST IF FIRST COLLECTION CHANGES
                    // let paymentCollection = col[37] ? parseFloat(col[37]) : 0; // ADJUST IF FIRST COLLECTION CHANGES
                    // cashCollections.push({
                    //     ...header,
                    //     excess: 0,
                    //     total: paymentCollection,
                    //     noOfPayments: startingNoOfPayments + 1,
                    //     mcbu: startingMcbu + mcbuCol, 
                    //     mcbuCol: mcbuCol,
                    //     mcbuWithdrawal: 0,
                    //     mcbuReturnAmt: 0,
                    //     mcbuInterest: 0,
                    //     loanBalance: startingLoanBalance - paymentCollection,
                    //     paymentCollection: paymentCollection,
                    //     dateAdded: collectionDate5 ? moment(collectionDate5).format("YYYY-MM-DD") : null
                    // });

                    // mcbuCol = col[38] ? parseFloat(col[38]) : 0; // ADJUST IF FIRST COLLECTION CHANGES
                    // paymentCollection = col[39] ? parseFloat(col[39]) : 0; // ADJUST IF FIRST COLLECTION CHANGES
                    // cashCollections.push({
                    //     ...header,
                    //     excess: 0,
                    //     total: paymentCollection,
                    //     noOfPayments: startingNoOfPayments + 1,
                    //     mcbu: startingMcbu + mcbuCol, 
                    //     mcbuCol: mcbuCol,
                    //     mcbuWithdrawal: 0,
                    //     mcbuReturnAmt: 0,
                    //     mcbuInterest: 0,
                    //     loanBalance: startingLoanBalance - paymentCollection,
                    //     paymentCollection: paymentCollection,
                    //     dateAdded: collectionDate6 ? moment(collectionDate6).format("YYYY-MM-DD") : null
                    // });

                    // mcbuCol = col[40] ? parseFloat(col[40]) : 0; // ADJUST IF FIRST COLLECTION CHANGES
                    // paymentCollection = col[41] ? parseFloat(col[41]) : 0; // ADJUST IF FIRST COLLECTION CHANGES
                    // cashCollections.push({
                    //     ...header,
                    //     excess: 0,
                    //     total: paymentCollection,
                    //     noOfPayments: startingNoOfPayments + 1,
                    //     mcbu: startingMcbu + mcbuCol, 
                    //     mcbuCol: mcbuCol,
                    //     mcbuWithdrawal: 0,
                    //     mcbuReturnAmt: 0,
                    //     mcbuInterest: 0,
                    //     loanBalance: startingLoanBalance - paymentCollection,
                    //     paymentCollection: paymentCollection,
                    //     dateAdded: collectionDate7 ? moment(collectionDate7).format("YYYY-MM-DD") : null
                    // });

                    // mcbuCol = col[42] ? parseFloat(col[42]) : 0; // ADJUST IF FIRST COLLECTION CHANGES
                    // paymentCollection = col[43] ? parseFloat(col[43]) : 0; // ADJUST IF FIRST COLLECTION CHANGES
                    // cashCollections.push({
                    //     ...header,
                    //     excess: 0,
                    //     total: paymentCollection,
                    //     noOfPayments: startingNoOfPayments + 1,
                    //     mcbu: startingMcbu + mcbuCol, 
                    //     mcbuCol: mcbuCol,
                    //     mcbuWithdrawal: 0,
                    //     mcbuReturnAmt: 0,
                    //     mcbuInterest: 0,
                    //     loanBalance: startingLoanBalance - paymentCollection,
                    //     paymentCollection: paymentCollection,
                    //     dateAdded: collectionDate8 ? moment(collectionDate8).format("YYYY-MM-DD") : null
                    // });

                    // mcbuCol = col[44] ? parseFloat(col[44]) : 0; // ADJUST IF FIRST COLLECTION CHANGES
                    // paymentCollection = col[45] ? parseFloat(col[45]) : 0; // ADJUST IF FIRST COLLECTION CHANGES
                    // cashCollections.push({
                    //     ...header,
                    //     excess: 0,
                    //     total: paymentCollection,
                    //     noOfPayments: startingNoOfPayments + 1,
                    //     mcbu: startingMcbu + mcbuCol, 
                    //     mcbuCol: mcbuCol,
                    //     mcbuWithdrawal: 0,
                    //     mcbuReturnAmt: 0,
                    //     mcbuInterest: 0,
                    //     loanBalance: startingLoanBalance - paymentCollection,
                    //     paymentCollection: paymentCollection,
                    //     dateAdded: collectionDate9 ? moment(collectionDate9).format("YYYY-MM-DD") : null
                    // });

                    // mcbuCol = col[46] ? parseFloat(col[46]) : 0; // ADJUST IF FIRST COLLECTION CHANGES
                    // paymentCollection = col[47] ? parseFloat(col[47]) : 0; // ADJUST IF FIRST COLLECTION CHANGES
                    // cashCollections.push({
                    //     ...header,
                    //     excess: 0,
                    //     total: paymentCollection,
                    //     noOfPayments: startingNoOfPayments + 1,
                    //     mcbu: startingMcbu + mcbuCol, 
                    //     mcbuCol: mcbuCol,
                    //     mcbuWithdrawal: 0,
                    //     mcbuReturnAmt: 0,
                    //     mcbuInterest: 0,
                    //     loanBalance: startingLoanBalance - paymentCollection,
                    //     paymentCollection: paymentCollection,
                    //     dateAdded: collectionDate10 ? moment(collectionDate10).format("YYYY-MM-DD") : null
                    // });

                    // mcbuCol = col[48] ? parseFloat(col[48]) : 0; // ADJUST IF FIRST COLLECTION CHANGES
                    // paymentCollection = col[49] ? parseFloat(col[49]) : 0; // ADJUST IF FIRST COLLECTION CHANGES
                    // cashCollections.push({
                    //     ...header,
                    //     excess: 0,
                    //     total: paymentCollection,
                    //     noOfPayments: startingNoOfPayments + 1,
                    //     mcbu: startingMcbu + mcbuCol, 
                    //     mcbuCol: mcbuCol,
                    //     mcbuWithdrawal: 0,
                    //     mcbuReturnAmt: 0,
                    //     mcbuInterest: 0,
                    //     loanBalance: startingLoanBalance - paymentCollection,
                    //     paymentCollection: paymentCollection,
                    //     dateAdded: collectionDate11 ? moment(collectionDate11).format("YYYY-MM-DD") : null
                    // });

                    // mcbuCol = col[50] ? parseFloat(col[50]) : 0; // ADJUST IF FIRST COLLECTION CHANGES
                    // paymentCollection = col[51] ? parseFloat(col[51]) : 0; // ADJUST IF FIRST COLLECTION CHANGES
                    // cashCollections.push({
                    //     ...header,
                    //     excess: 0,
                    //     total: paymentCollection,
                    //     noOfPayments: startingNoOfPayments + 1,
                    //     mcbu: startingMcbu + mcbuCol, 
                    //     mcbuCol: mcbuCol,
                    //     mcbuWithdrawal: 0,
                    //     mcbuReturnAmt: 0,
                    //     mcbuInterest: 0,
                    //     loanBalance: startingLoanBalance - paymentCollection,
                    //     paymentCollection: paymentCollection,
                    //     dateAdded: collectionDate12 ? moment(collectionDate12).format("YYYY-MM-DD") : null
                    // });

                    // mcbuCol = col[52] ? parseFloat(col[52]) : 0; // ADJUST IF FIRST COLLECTION CHANGES
                    // paymentCollection = col[53] ? parseFloat(col[53]) : 0; // ADJUST IF FIRST COLLECTION CHANGES
                    // cashCollections.push({
                    //     ...header,
                    //     excess: 0,
                    //     total: paymentCollection,
                    //     noOfPayments: startingNoOfPayments + 1,
                    //     mcbu: startingMcbu + mcbuCol, 
                    //     mcbuCol: mcbuCol,
                    //     mcbuWithdrawal: 0,
                    //     mcbuReturnAmt: 0,
                    //     mcbuInterest: 0,
                    //     loanBalance: startingLoanBalance - paymentCollection,
                    //     paymentCollection: paymentCollection,
                    //     dateAdded: collectionDate13 ? moment(collectionDate13).format("YYYY-MM-DD") : null
                    // });

                    // mcbuCol = col[54] ? parseFloat(col[54]) : 0; // ADJUST IF FIRST COLLECTION CHANGES
                    // paymentCollection = col[55] ? parseFloat(col[55]) : 0; // ADJUST IF FIRST COLLECTION CHANGES
                    // cashCollections.push({
                    //     ...header,
                    //     excess: 0,
                    //     total: paymentCollection,
                    //     noOfPayments: startingNoOfPayments + 1,
                    //     mcbu: startingMcbu + mcbuCol, 
                    //     mcbuCol: mcbuCol,
                    //     mcbuWithdrawal: 0,
                    //     mcbuReturnAmt: 0,
                    //     mcbuInterest: 0,
                    //     loanBalance: startingLoanBalance - paymentCollection,
                    //     paymentCollection: paymentCollection,
                    //     dateAdded: collectionDate14 ? moment(collectionDate14).format("YYYY-MM-DD") : null
                    // });

                    // mcbuCol = col[56] ? parseFloat(col[56]) : 0; // ADJUST IF FIRST COLLECTION CHANGES
                    // paymentCollection = col[57] ? parseFloat(col[57]) : 0; // ADJUST IF FIRST COLLECTION CHANGES
                    // cashCollections.push({
                    //     ...header,
                    //     excess: 0,
                    //     total: paymentCollection,
                    //     noOfPayments: startingNoOfPayments + 1,
                    //     mcbu: startingMcbu + mcbuCol, 
                    //     mcbuCol: mcbuCol,
                    //     mcbuWithdrawal: 0,
                    //     mcbuReturnAmt: 0,
                    //     mcbuInterest: 0,
                    //     loanBalance: startingLoanBalance - paymentCollection,
                    //     paymentCollection: paymentCollection,
                    //     dateAdded: collectionDate15 ? moment(collectionDate15).format("YYYY-MM-DD") : null
                    // });

                    clients.push(client);
                    loans.push(loan);
                }
            }
        }
    }); 
    
    logger.debug({page: 'migrations', message: `Process Branch Groups Per LO`});
    logger.debug({page: 'migrations', message: `ClientList: ${clients.length}`});
    logger.debug({page: 'migrations', message: `LoanList: ${loans.length}`});
    // logger.debug({page: 'migrations', message: `CashCollectionList: ${cashCollections.length}`});

    logger.debug({page: 'migrations', message: `Getting LO Groups: ${loId}`});
    const groups = await db.collection('groups').find({ loanOfficerId: loId }).toArray();
    if (groups) {
        clients.map(async c => {
            let client = {...c};
            const clientId = client.tempId;
            delete client.tempId;
            let group = groups.find(group => group.name == client.groupName);
            if (group) {
                logger.debug({page: 'migrations', message: `Found Group: ${group.name}`});
                let groupId = group._id + '';
                client.groupId = groupId;
                let loan = loans.find(loan => loan.clientId == clientId);
                // const clientCashCollections = cashCollections.filter(cc => cc.clientId == clientId);
                const resp = await db.collection('client').insertOne({...client});
                if (resp.acknowledged) {
                    client._id = resp.insertedId + '';
                    if (loan) {
                        loan.clientId = client._id;
                        loan.groupId = groupId;
                        const loanResp = await db.collection('loans').insertOne({...loan});
                        if (loanResp.acknowledged) {
                            loan._id = loanResp.insertedId + '';
                            await updateGroup(loan, group);
                            // const finalCC = clientCashCollections.map(cashCollection => {
                            //     let cc = {...cashCollection};
                            //     cc.loanId = loan._id;
                            //     cc.clientId = client._id;
                            //     cc.groupId = groupId;

                            //     return cc;
                            // });

                            // await db.collection('cashCollections').insertMany(finalCC);
                        }
                    }
                }
            }
        });
    }
}

async function updateGroup(loan, group) {
    logger.debug({page: 'migrations', message: `Updating Group: ${group.name}`});
    const { db } = await connectToDatabase();

    group.noOfClients = group.noOfClients ? group.noOfClients : 0;

    group.availableSlots = group.availableSlots.filter(s => s !== loan.slotNo);
    group.noOfClients = group.noOfClients + 1;

    if (group.noOfClients === group.capacity) {
        group.status = 'full';
    }
    const groupId = group._id;
    delete group._id;
    await db.collection('groups').updateOne(
        {  _id: groupId },
        {
            $set: { ...group }
        }, 
        { upsert: false }
    );
}

const extractName = (name) => {
    if (name && name !== undefined) {
        let firstName;
        let middleName;
        let lastName;
        const arg = name.split(' ');
        if (arg.length == 2) {
            firstName = arg[0];
            lastName = arg[1];
        } else if (arg.length === 3) {
            firstName = arg[0]; 
            middleName = arg[1]; 
            lastName = arg[2];
        } else if (arg.length === 4) {
            firstName = arg[0] + ' ' + arg[1];
            middleName = arg[2];
            lastName = arg[3];
        } else if (arg.length === 5) {
            firstName = arg[0] + ' ' + arg[1] + ' ' + arg[1];
            middleName = arg[3]; 
            lastName = arg[4];
        }

        return { firstName, middleName, lastName };
    } else {
        return null;
    }
}

const parseDate = (date) => {
    let parsedDate;

    if (date && date !== undefined) {
        let arr = [];
        if (date.includes('-')) {
            arr = date.split('-');
        } else if (date.includes('/')) {
            arr = date.split('/');
        }

        logger.debug({page: 'migrations', message: `Raw Date: ${date}`});
        if (arr.length === 3) {
            const month = arr[0].length == 1 ? "0" + arr[0] : arr[0];
            const day = arr[1].length == 1 ? "0" + arr[1] : arr[1];
            const year = arr[2].length == 2 ? parseInt(arr[2]) !== 23 ? "19" + arr[2] : "20" + arr[2] : arr[2];

            parsedDate = year + "-" + month + "-" + day;
        } else {
            logger.error({page: 'migration', message: `Invalid Date: ${date} with ${arr.length}`});
        }
    }

    return parsedDate;
}

const saveFile = async (file, uid) => {
    if (file) {
        const data = fs.readFileSync(file.filepath);

        if (!fs.existsSync(`./public/migrations/`)) {
            fs.mkdirSync(`./public/migrations/`, { recursive: true });
        }

        if (fs.existsSync(`./public/migrations/${uid}/`)) {
            // check if file exists 
            fs.existsSync(`./public/migrations/${uid}/${file.originalFilename}`) && fs.unlinkSync(`./public/migrations/${uid}/${file.originalFilename}`);
        } else {
            fs.mkdirSync(`./public/migrations/${uid}/`);
        }

        fs.writeFileSync(`./public/migrations/${uid}/${file.originalFilename}`, data);
        await fs.unlinkSync(file.filepath);

        return uid + '/' + file.originalFilename;
    } else {
        return false;
    }
}

export const config = {
    api: {
        bodyParser: false
    }
}