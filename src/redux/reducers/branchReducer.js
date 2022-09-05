import { SET_ADD_UPDATE_BRANCH, SET_BRANCH, SET_BRANCH_LIST } from "../actions/branchActions";

const initialBranchState = {
    data: {},
    addUpdate: {},
    list: []
};

const branchReducer = (state = initialBranchState, action) => {
    switch (action.type) {
        case SET_BRANCH:
            return { ...state, data: action.payload }
        case SET_BRANCH_LIST:
            return { ...state, list: action.payload }
        case SET_ADD_UPDATE_BRANCH:
            return { ...state, addUpdate: action.payload }
        default:
            return { ...state }
    }
};

export default branchReducer;