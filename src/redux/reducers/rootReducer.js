import { combineReducers } from 'redux';
import branch from './branchReducer';
import user from './userReducer';
import systemSettings from './systemReducer';
import global from './globalReducer';

const rootReducer = combineReducers({
    branch: branch,
    user: user,
    systemSettings: systemSettings,
    global: global
});

export default rootReducer;
