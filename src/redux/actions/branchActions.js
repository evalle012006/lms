export const SET_BRANCH = 'SET_BRANCH';
export const SET_BRANCH_LIST = 'SET_BRANCH_LIST';
export const SET_ADD_UPDATE_BRANCH = 'SET_ADD_UPDATE_BRANCH';

export const setBranch = (branch) => ({
    type: SET_BRANCH,
    payload: branch
});

export const setBranchList = (branchList) => ({
    type: SET_BRANCH_LIST,
    payload: branchList
});

export const setAddUpdateBranch = (branch) => ({
    type: SET_ADD_UPDATE_BRANCH,
    payload: branch
});