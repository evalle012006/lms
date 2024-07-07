export const SET_LOAN = 'SET_LOAN';
export const SET_LOAN_LIST = 'SET_LOAN_LIST';
export const SET_ADD_UPDATE_LOAN = 'SET_ADD_UPDATE_LOAN';
export const SET_FILTERED_LOAN_LIST = 'SET_FILTERED_LOAN_LIST';
export const SET_PENDING_LOAN = 'SET_PENDING_LOAN';
export const SET_PENDING_LOAN_LIST = 'SET_PENDING_LOAN_LIST';
export const SET_ADD_UPDATE_PENDING_LOAN = 'SET_ADD_UPDATE_PENDING_LOAN';
export const SET_FILTERED_PENDING_LOAN_LIST = 'SET_FILTERED_PENDING_LOAN_LIST';
export const SET_TOMORROW_LOAN = 'SET_TOMORROW_LOAN';
export const SET_TOMORROW_LOAN_LIST = 'SET_TOMORROW_LOAN_LIST';
export const SET_ADD_UPDATE_TOMORROW_LOAN = 'SET_ADD_UPDATE_TOMORROW_LOAN';
export const SET_FILTERED_TOMORROW_LOAN_LIST = 'SET_FILTERED_TOMORROW_LOAN_LIST';
export const SET_DUPLICATE_LOAN_LIST = 'SET_DUPLICATE_LOAN_LIST';

export const setLoan = (loan) => ({
    type: SET_LOAN,
    payload: loan
});

export const setLoanList = (loanList) => ({
    type: SET_LOAN_LIST,
    payload: loanList
});

export const setAddUpdateLoan = (loan) => ({
    type: SET_ADD_UPDATE_LOAN,
    payload: loan
});

export const setFilteredLoanList = (loanList) => ({
    type: SET_FILTERED_LOAN_LIST,
    payload: loanList
});

export const setPendingLoan = (loan) => ({
    type: SET_PENDING_LOAN,
    payload: loan
});

export const setPendingLoanList = (loanList) => ({
    type: SET_PENDING_LOAN_LIST,
    payload: loanList
});

export const setAddUpdatePendingLoan = (loan) => ({
    type: SET_ADD_UPDATE_PENDING_LOAN,
    payload: loan
});

export const setFilteredPendingLoanList = (loanList) => ({
    type: SET_FILTERED_PENDING_LOAN_LIST,
    payload: loanList
});

export const setTomorrowLoan = (loan) => ({
    type: SET_TOMORROW_LOAN,
    payload: loan
});

export const setTomorrowLoanList = (loanList) => ({
    type: SET_TOMORROW_LOAN_LIST,
    payload: loanList
});

export const setAddUpdateTomorrowLoan = (loan) => ({
    type: SET_ADD_UPDATE_TOMORROW_LOAN,
    payload: loan
});

export const setFilteredTomorrowLoanList = (loanList) => ({
    type: SET_FILTERED_TOMORROW_LOAN_LIST,
    payload: loanList
});

export const setDuplicateLoanList = (loanList) => ({
    type: SET_DUPLICATE_LOAN_LIST,
    payload: loanList
});