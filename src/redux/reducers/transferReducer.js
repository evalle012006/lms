import { SET_ADD_UPDATE_TRANSFER, SET_APPROVED_TRANSFER_LIST, SET_PENDING_TRANSFER_LIST, SET_TRANSFER, SET_TRANSFER_HISTORY_BRANCH_BRANCH, SET_TRANSFER_HISTORY_LO_LO } from "../actions/transferActions";


const initialTransferState = {
    data: {},
    addUpdate: {},
    pendingList: [],
    approvedList: [],
    historyLoToLo: [],
    historyBranchToBranch: []
};

const branchReducer = (state = initialTransferState, action) => {
    switch (action.type) {
        case SET_TRANSFER:
            return { ...state, data: action.payload }
        case SET_PENDING_TRANSFER_LIST:
            return { ...state, pendingList: action.payload }
        case SET_APPROVED_TRANSFER_LIST:
            return { ...state, approvedList: action.payload }
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