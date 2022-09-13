export const SET_LOAN = 'SET_LOAN';
export const SET_LOAN_LIST = 'SET_LOAN_LIST';
export const SET_ADD_UPDATE_LOAN = 'SET_ADD_UPDATE_LOAN';

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