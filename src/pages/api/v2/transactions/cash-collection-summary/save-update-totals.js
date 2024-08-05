import { apiHandler } from "@/services/api-handler";
import {
  findCashCollections,
  findLosTotals,
  findUsers,
} from "@/lib/graph.functions";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, insertQl, updateQl } from "@/lib/graph/graph.util";
import { generateUUID } from "@/lib/utils";

const graph = new GraphProvider();
const losTotalsType = createGraphType('losTotals', '_id')();

export default apiHandler({
    post: processLOSTotals
});

async function processLOSTotals(req, res) {
    const data = req.body;

    const lo = await findUsers({ _id: { _eq: data.userId } });
    let officeType;
    if (lo.length > 0) {
        if (lo[0].role.rep == 4) {
            officeType = parseInt(lo[0].loNo) < 11 ? 'main' : 'ext';
        }
    }

    let response;
    switch (data.losType) {
        case 'year-end':
            response = await saveUpdateYearEnd(data, officeType);
            break;
        case 'daily':
            const filter = (data.data.day !== data.currentDate);
            const cashCollections = await findCashCollections({
              loId: { _eq: data.userId },
              dateAdded: { _eq: data.data.day },
              occurence: { _eq: data.occurence }
            });

            if (cashCollections.length === 0) {
                response = { error: true, message: "One or more group/s have no transaction for today."};
            } else {
                response = await saveUpdateDaily(data, filter, officeType);
            }
            break;
        case 'commulative':
            response = await saveUpdateCommulative(data, officeType);
            break;
        default:
            break;
    }

    res.send(response);
}


async function saveUpdateYearEnd(total, officeType) {
    const currentDateStr = total.currentDate;
    let resp;

    let losTotal = await findLosTotals({
      userId: { _eq: total.userId },
      month: { _eq: 12 },
      year: { _eq: total.year },
      losType: { _eq: 'year-end' },
      occurence: { _eq: total.occurence }
    });

    if (losTotal.length > 0) {
        losTotal = losTotal[0];
        resp = await graph.mutation(updateQl(
          losTotalsType,
          {
            where: { _id: { _eq: losTotal._id } },
            set: {
              ...losTotal,
              data: total.data,
              dateModified: currentDateStr
            }
          }
        )).then(res => res.data);
    } else {
        const finalData = {...total};
        delete finalData.currentDate;
        resp = await graph.mutation(insertQl(
          losTotalsType,
          {
            objects: [{ ...finalData, dateAdded: currentDateStr, officeType: officeType }]
          }
        )).then(res => res.data);
    }

    return { success: true, response: resp };
}


async function saveUpdateDaily(total, filter, officeType) {
    const currentDateStr = total.currentDate;
    let resp;

    let losTotal = await findLosTotals({
      userId: { _eq: total.userId },
      dateAdded: { _eq: total.data.day },
      losType: { _eq: 'daily' },
      occurence: { _eq: total.occurence }
    });

    if (filter) {
        if (losTotal.length > 0) {
            losTotal = losTotal[0];
            await graph.mutation(updateQl(losTotalsType, {
              where: { _id: { _eq: losTotal._id } },
              set: {
                ...losTotal,
                data: total.data,
                dateModified: total.data.day,
                modifiedBy: 'admin',
                modifiedDate: currentDateStr
              }
            }));
        } else {
            const finalData = {...total};
            delete finalData.currentDate;
            await graph.mutation(insertQl(losTotalsType, {
              objects: [{
                _id: generateUUID(),
                ...finalData,
                dateAdded: total.data.day,
                insertedBy: 'admin',
                insertedDate: currentDateStr,
                officeType: officeType
              }]
            }));
        }
    } else {
        if (losTotal.length > 0) {
            losTotal = losTotal[0];
            await graph.mutation(updateQl(losTotalsType, {
              where: { _id: { _eq: losTotal._id } },
              set: {
                ...losTotal,
                data: total.data,
                dateModified: currentDateStr
              }
            }));
        } else {
            const finalData = {...total};
            delete finalData.currentDate;
            await graph.mutation(insertQl(losTotalsType, {
              objects: [{
                _id: generateUUID(),
                ...finalData,
                dateAdded: currentDateStr,
                officeType: officeType
              }]
            }))
        }
    }

    return { success: true, response: resp };
}

async function saveUpdateCommulative(total, officeType) {
    const currentDateStr = total.currentDate;
    let resp;
    let loGroup = officeType;

    if (officeType === null || officeType === undefined) { // it means it is BM
        loGroup = total.officeType;
    }

    let losTotal = await findLosTotals({
      userId: { _eq: total.userId },
      month: { _eq: total.month },
      year: { _eq: total.year },
      losType: { _eq: "commulative" },
      officeType: { _eq: loGroup },
    });

    if (losTotal.length > 0) {
        losTotal = losTotal[0];
        if (losTotal.hasOwnProperty('insertedBy') && losTotal.insertedBy === 'migration') {
            // don't override...
        } else {
            await graph.mutation(updateQl(losTotalsType, {
              where: { _id: { _eq: losTotal._id } },
              set: {
                ...losTotal,
                data: total.data,
                dateModified: currentDateStr
              }
            }));
        }
    } else {
        const finalData = {...total};
        delete finalData.currentDate;
        await graph.mutation(insertQl(losTotalsType, {
          objects: [{
            _id: generateUUID(),
            ...finalData,
            dateAdded: currentDateStr
          }]
        }))
    }

    return  { success: true, response: resp };
}
