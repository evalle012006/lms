import { SET_ADD_UPDATE_TRANSFER, SET_TRANSFER, SET_TRANSFER_HISTORY_BRANCH_BRANCH, SET_TRANSFER_HISTORY_LO_LO, SET_TRANSFER_LIST } from "../actions/transferActions";


const initialTransferState = {
    data: {},
    addUpdate: {},
    list: [],
    historyLoToLo: [],
    historyBranchToBranch: []
};

const branchReducer = (state = initialTransferState, action) => {
    switch (action.type) {
        case SET_TRANSFER:
            return { ...state, data: action.payload }
        case SET_TRANSFER_LIST:
            return { ...state, list: action.payload }
        case SET_ADD_UPDATE_TRANSFER:
            return { ...state, addUpdate: action.payload }
        case SET_TRANSFER_HISTORY_LO_LO:
            return { ...state, historyLoToLo: action.payload }
        case SET_TRANSFER_HISTORY_BRANCH_BRANCH:
            return { ...state, historyBranchToBranch: action.payload }
        default:
            return { ...state }
    }
};

export default branchReducer;