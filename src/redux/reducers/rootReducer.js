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

const rootReducer = combineReducers({
    los: los,
    cashCollection: cashCollection,
    loan: loan,
    client: client,
    group: group,
    role: role,
    branch: branch,
    user: user,
    holidays: holidays,
    transactionsSettings: transactionsSettings,
    systemSettings: systemSettings,
    global: global
});

export default rootReducer;
