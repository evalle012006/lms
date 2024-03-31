import { combineReducers } from 'redux';
import los from './losReducer';
import cashCollection from './cashCollectionReducer';
import loan from './loanReducer';
import client from './clientReducer';
import group from './groupReducer';
import role from './roleReducer';
import branch from './branchReducer';
import user from './userReducer';
import holidays from './holidayReducer';
import transactionsSettings from './transactionsReducer';
import systemSettings from './systemReducer';
import global from './globalReducer';
import transfer from './transferReducer';
import badDebtCollection from './badDebtCollectionReducer';
import area from './areaReducer';
import region from './regionReducer';
import division from './divisionReducer';

const rootReducer = combineReducers({
    badDebtCollection: badDebtCollection,
    transfer: transfer,
    los: los,
    cashCollection: cashCollection,
    loan: loan,
    client: client,
    group: group,
    division: division,
    region: region,
    area: area,
    branch: branch,
    user: user,
    role: role,
    holidays: holidays,
    transactionsSettings: transactionsSettings,
    systemSettings: systemSettings,
    global: global
});

export default rootReducer;
