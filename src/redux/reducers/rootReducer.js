import { combineReducers } from 'redux';
import group from './groupReducer';
import role from './roleReducer';
import branch from './branchReducer';
import user from './userReducer';
import systemSettings from './systemReducer';
import global from './globalReducer';

const rootReducer = combineReducers({
    group: group,
    role: role,
    branch: branch,
    user: user,
    systemSettings: systemSettings,
    global: global
});

export default rootReducer;
