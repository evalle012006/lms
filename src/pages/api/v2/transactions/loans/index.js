import { apiHandler } from "@/services/api-handler";
import logger from "@/logger";
import moment from "moment";
import { getCurrentDate } from "@/lib/date-utils";
import { createGraphType, queryQl, updateQl } from "@/lib/graph/graph.util";
import {
  BRANCH_FIELDS, CASH_COLLECTIONS_FIELDS,
  CLIENT_FIELDS,
  GROUP_FIELDS,
  LOAN_FIELDS,
} from "@/lib/graph.fields";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { filterGraphFields } from '@/lib/graph.functions';
import { savePendingLoans } from "../cash-collections/update-pending-loans";

const fields = `
  ${LOAN_FIELDS}
  branch { ${BRANCH_FIELDS} }
  group { ${GROUP_FIELDS} }
  client { ${CLIENT_FIELDS} }
`;

const loanType = createGraphType("loans", fields)();
// CHANGED: also fetch loanFor + dateOfRelease so we can detect a release change
const loanMinType = createGraphType("loans", "groupId slotNo status loanFor dateOfRelease")();
const cashCollectionsType = createGraphType("cashCollections", "_id")();
const cashCollectionsTypeFull = createGraphType("cashCollections", CASH_COLLECTIONS_FIELDS)
const groupType = createGraphType("groups", GROUP_FIELDS)();
const graph = new GraphProvider();

// NEW: normalise any date-ish value to YYYY-MM-DD (null-safe)
const normDate = (d) => (d ? moment(d).format('YYYY-MM-DD') : null);

export default apiHandler({
  get: getLoan,
  post: updateLoan,
});

async function getLoan(req, res) {
  const { _id } = req.query;
  const loan = await graph
    .query(queryQl(loanType, { where: { _id: { _eq: _id } } }))
    .then((res) => res.data?.loans?.[0])
    .then((loan) => ({ ...loan, branch: [loan.branch] }));

  res.send({ success: true, loan });
}

async function updateLoan(req, res) {
  const { _id: loanId, group, ...loan } = req.body;

  logger.debug({ page: `Updating Loan: ${loan.clientId}`, data: loan });

  const user_id = req?.auth?.sub;
  const currentDate = moment(getCurrentDate()).format('YYYY-MM-DD')

  // Normalize slotNo type up front — the rest of this file (and the group
  // comparisons below) assume an integer, but req.body can hand us a string.
  const newSlotNo = loan.slotNo ? parseInt(loan.slotNo) : null;
  loan.slotNo = newSlotNo;

  // ── Fetch the loan's CURRENT group/slot before we overwrite anything ──────
  // This is the only way to know whether the edit is actually moving the
  // client to a different group/slot, since req.body only carries the target.
  const [existingLoan] = (await graph.query(
    queryQl(loanMinType, { where: { _id: { _eq: loanId } } })
  )).data?.loans ?? [];

  const oldGroupId = existingLoan?.groupId ?? null;
  const oldSlotNo  = existingLoan?.slotNo ?? null;
  const newGroupId = loan.groupId ?? null;

  const groupChanged = existingLoan
    && (oldGroupId !== newGroupId || oldSlotNo !== newSlotNo);

  // NEW: did this edit change the release date / release day?
  // Compare against the effective new values so a partial payload is not
  // mistaken for a change.
  const newLoanFor = loan.loanFor ?? existingLoan?.loanFor;
  const newDateOfRelease = normDate(loan.dateOfRelease ?? existingLoan?.dateOfRelease);
  const releaseChanged = !!existingLoan && (
    newLoanFor !== existingLoan.loanFor
    || newDateOfRelease !== normDate(existingLoan.dateOfRelease)
  );

  // ── Pre-fetch and validate group capacity BEFORE mutating the loan ────────
  // If the destination group is full, we bail out here — no loan or group
  // record should be touched.
  let oldGroup = null;
  let newGroup = null;

  if (groupChanged) {
    if (oldGroupId) {
      const [g] = (await graph.query(
        queryQl(groupType, { where: { _id: { _eq: oldGroupId } } })
      )).data?.groups ?? [];
      oldGroup = g ?? null;
    }

    if (newGroupId === oldGroupId) {
      // Same group, different slot — reuse the same fetched row for both sides
      newGroup = oldGroup;
    } else if (newGroupId) {
      const [g] = (await graph.query(
        queryQl(groupType, { where: { _id: { _eq: newGroupId } } })
      )).data?.groups ?? [];
      newGroup = g ?? null;
    }

    if (newGroup && newGroupId !== oldGroupId) {
      const wouldBeFull = newGroup.status === 'full'
        || newGroup.noOfClients >= newGroup.capacity;
      if (wouldBeFull) {
        res.send({
          error: true,
          message: `"${newGroup.name}" is already full. Please select another group.`
        });
        return;
      }
    }

    if (newGroup && newSlotNo != null && !newGroup.availableSlots.includes(newSlotNo)
        && !(newGroupId === oldGroupId && newSlotNo === oldSlotNo)) {
      res.send({
        error: true,
        message: `Slot ${newSlotNo} is not available in "${newGroup.name}".`
      });
      return;
    }
  }

  const groupCashCollections = (await graph.query(queryQl(cashCollectionsTypeFull(), {
        where: {
          groupId: { _eq: loan.groupId },
          dateAdded: { _eq: currentDate },
        }
  }))).data?.cashCollections;

  const groupStatus = groupCashCollections.length === 0 || groupCashCollections.some(cc => cc.groupStatus === 'pending') ? 'pending' : 'closed';
  const hasExistingCC = groupCashCollections.some(cc => cc.clientId === loan.clientId && cc.status === 'completed');

  // NEW: only run release-day processing when the loan releases today.
  // A future release is processed by the LOR save on its release date.
  const releasesToday = newLoanFor === 'today'
    || (newLoanFor === 'tomorrow' && newDateOfRelease === currentDate);

  // CHANGED: group-closed check moved BEFORE any mutation, with a return.
  // Previously the loan was already saved when this error was sent, and the
  // handler then fell through to a second res.send.
  if (hasExistingCC && releasesToday && groupStatus === 'closed') {
    res.send({ error: true, message: 'This client has a completed loan but the group transaction was already closed!' });
    return;
  }

  // the mixed type from mongo during migration
  let updatedLoan = { ...loan };
  updatedLoan.coMaker = loan.coMaker?.toString() || null;
  updatedLoan.coMakerId = loan.coMakerId || null;
  updatedLoan.modifiedBy = user_id;
  updatedLoan.modifiedDateTime = new Date().toISOString();

  const loanResp = await graph.mutation(
    updateQl(loanType, {
      where: { _id: { _eq: loanId } },
      set: filterGraphFields(LOAN_FIELDS, { ...updatedLoan }),
    })
  );

  // CHANGED: keep the open cash-collection rows in sync with the loan.
  // Always refresh the release amount; when the release day/date changed,
  // carry loanFor + dateOfRelease through as well.
  const ccSet = { currentReleaseAmount: loan.amountRelease };

  if (releaseChanged) {
    ccSet.loanFor = newLoanFor;
    ccSet.dateOfRelease = newDateOfRelease;

    // audit trail — editHistory is empty and this API doesn't write loans_history
    logger.info({
      page: `Loan release changed: ${loan.clientId}`,
      user_id,
      loanId,
      from: { loanFor: existingLoan.loanFor, dateOfRelease: existingLoan.dateOfRelease },
      to:   { loanFor: newLoanFor, dateOfRelease: newDateOfRelease },
    });
  }

  await graph.mutation(
    updateQl(cashCollectionsType, {
      where: {
        loanId: { _eq: loanId },
        status: { _in: ["tomorrow", "pending"] },
      },
      set: filterGraphFields(CASH_COLLECTIONS_FIELDS, ccSet),
    })
  );

  // ── Reconcile group slot bookkeeping now that the loan update succeeded ──
  if (groupChanged) {
    if (newGroupId === oldGroupId && newGroup) {
      // Same group, slot swap only — noOfClients unchanged
      let availableSlots = [...(newGroup.availableSlots || [])];
      if (oldSlotNo != null && !availableSlots.includes(oldSlotNo)) availableSlots.push(oldSlotNo);
      if (newSlotNo != null) availableSlots = availableSlots.filter(s => s !== newSlotNo);
      availableSlots.sort((a, b) => a - b);

      await graph.mutation(
        updateQl(groupType, {
          where: { _id: { _eq: newGroupId } },
          set: { availableSlots },
        })
      );
    } else {
      // Different group — release old slot, occupy new slot
      if (oldGroup) {
        let availableSlots = [...(oldGroup.availableSlots || [])];
        if (oldSlotNo != null && !availableSlots.includes(oldSlotNo)) availableSlots.push(oldSlotNo);
        availableSlots.sort((a, b) => a - b);
        const noOfClients = Math.max((oldGroup.noOfClients || 0) - 1, 0);

        await graph.mutation(
          updateQl(groupType, {
            where: { _id: { _eq: oldGroupId } },
            set: {
              availableSlots,
              noOfClients,
              status: noOfClients >= oldGroup.capacity ? 'full' : 'available',
            },
          })
        );
      }

      if (newGroup) {
        const availableSlots = (newGroup.availableSlots || []).filter(s => s !== newSlotNo);
        const noOfClients = (newGroup.noOfClients || 0) + 1;

        await graph.mutation(
          updateQl(groupType, {
            where: { _id: { _eq: newGroupId } },
            set: {
              availableSlots,
              noOfClients,
              status: noOfClients >= newGroup.capacity ? 'full' : 'available',
            },
          })
        );
      }
    }
  }

  // CHANGED: gated on releasesToday; the group-closed case already returned above
  if (hasExistingCC && releasesToday) {
    await savePendingLoans(user_id, [updatedLoan], loanId);
  }

  res.send({ success: true, loan: loanResp });
}