import React, { useRef, useState } from 'react';
import Spinner from '@/components/Spinner';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import ReactToPrint from 'node_modules/react-to-print/lib/index';
import { PrinterIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import logo from "/public/images/logo.png";
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { formatPricePhp } from '@/lib/utils';
import { useRouter } from 'node_modules/next/router';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import Layout from '@/components/Layout';
import { setBranch } from '@/redux/actions/branchActions';

const ClientNDSPage = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const [loading, setLoading] = useState(true);
    const ndsFormRef = useRef();

    const [currentBranch, setCurrentBranch] = useState();

    const router = useRouter();
    const { uuid } = router.query;

    const [loan, setLoan] = useState();

    useEffect(() => {
        let mounted = true;
        const getLoan = async () => {
            const response = await fetchWrapper.get(getApiBaseUrl() + 'transactions/loans?' + new URLSearchParams({ _id: uuid }));

            if (response.success) {
                setLoan(response.loan);
            }

            setLoading(false);
        }

        const getCurrentBranch = async () => {
            const apiUrl = `${getApiBaseUrl()}branches?`;
            const params = { _id: currentUser.designatedBranchId, date: currentDate };
            const response = await fetchWrapper.get(apiUrl + new URLSearchParams(params));
            if (response.success) {
                setCurrentBranch(response.branch);
                dispatch(setBranch(response.branch));
            } else {
                toast.error('Error while loading data');
            }
        }

        if (currentUser.role.rep >= 3 && currentDate) {
            getCurrentBranch();
        }

        mounted && uuid && getLoan();

        return (() => {
            mounted = false;
        });
    }, [uuid, currentUser, currentDate]);

    return (
        <React.Fragment>
            {loading ? (
                    <Spinner />
            ): (
                <div className='flex flex-col w-full p-12'>
                    <div className='hidden'>
                        <Layout />
                    </div>
                    <div className='flex justify-end mr-8'>
                        <ReactToPrint
                            trigger={() => <ButtonSolid label="Print" icon={[<PrinterIcon className="w-5 h-5" />, 'left']} width='!w-20'/> }
                            content={() => ndsFormRef.current }
                        />
                    </div>

                    <NDSForm ref={ndsFormRef} loan={loan} currentBranch={currentBranch} currentDate={currentDate} />
                </div>
            )}
        </React.Fragment>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Amortization helpers
// ─────────────────────────────────────────────────────────────────────────────

// Solves the per-period rate r for a level-payment schedule whose final
// installment carries zero service charge (same shape the NDS has always used).
// Condition: the balance after installment N-1 must equal the level payment T,
// so the last installment clears the loan to exactly 0.
// This replaces the old hardcoded 32.3339 divisor, which was only accurate for
// one (terms, rate) combination and left a residual of about -0.51 at 60 terms / 1.2.
const solvePeriodRate = (principal, rate, terms) => {
    if (!(rate > 1) || terms < 2) return 0;
    const T = (principal * rate) / terms;
    const f = (r) =>
        principal * Math.pow(1 + r, terms - 1)
        - T * ((Math.pow(1 + r, terms - 1) - 1) / r)
        - T;
    let lo = 1e-9, hi = 1;
    for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2;
        if (f(mid) > 0) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
};

// Builds the NDS schedule. The exact (unrounded) balance is carried internally;
// displayed columns are derived from rounded values so that every row sums to the
// installment total, principal sums to exactly principalLoan, service charge sums to
// exactly (amountRelease - principalLoan), and the final balance is 0.
//   daily  : declining-balance split between principal and service charge
//   weekly : flat principal (principal / terms), service charge = total - principal
// Any occurence other than 'daily' follows the weekly (flat) path.
const buildAmortization = ({ principalLoan, amountRelease, loanTerms, occurence }) => {
    if (!principalLoan || !amountRelease || !loanTerms) return [];

    const rate = amountRelease / principalLoan;
    const isDaily = occurence == 'daily';
    const total = amountRelease / loanTerms;
    const totalR = Math.round(total);
    const periodRate = isDaily ? solvePeriodRate(principalLoan, rate, loanTerms) : 0;

    const initialBalance = isDaily ? principalLoan : amountRelease;
    const interest = Math.round(principalLoan * (rate - 1));

    const sched = [{
        installment: '',
        loanRelease: principalLoan,
        serviceCharge: '',
        total: '',
        balance: initialBalance,
        balanceStr: Math.round(initialBalance).toFixed(0),
        interest: interest
    }];

    let totalServiceCharge = 0;
    let prevRoundedBalance = Math.round(initialBalance); // daily: rounded principal balance
    let prevCumPrincipal = 0;                            // weekly: rounded cumulative principal

    for (let i = 1; i <= loanTerms; i++) {
        const prev = sched[i - 1];
        let balance;
        let principalR;

        if (isDaily) {
            balance = i == loanTerms
                ? prev.balance - total
                : prev.balance * (1 + periodRate) - total;
            const roundedBalance = Math.round(balance);
            principalR = prevRoundedBalance - roundedBalance;
            prevRoundedBalance = roundedBalance;
        } else {
            balance = prev.balance - total;
            const cumPrincipal = Math.round((i * principalLoan) / loanTerms);
            principalR = cumPrincipal - prevCumPrincipal;
            prevCumPrincipal = cumPrincipal;
        }

        const serviceChargeR = totalR - principalR;
        totalServiceCharge += serviceChargeR;

        sched.push({
            installment: i,
            loanRelease: '',
            principal: principalR.toFixed(0),
            serviceCharge: serviceChargeR.toFixed(0),
            total: totalR.toFixed(0),
            balance: balance,
            balanceStr: Math.round(balance).toFixed(0),
            interest: ''
        });
    }

    sched[1] = { ...sched[1], interest: totalServiceCharge.toFixed(0) };
    return sched;
};

// ─────────────────────────────────────────────────────────────────────────────
// NDS form
// ─────────────────────────────────────────────────────────────────────────────

const NDSForm = React.forwardRef((props, ref) => {
    const { currentBranch, currentDate } = props;
    // Fallback only — used when a legacy loan record has no amountRelease/loanBalance
    // saved on it at all. Normal path derives the rate from the loan record itself
    // (see buildAmortization) so reprints stay stable even if global settings change
    // later. Do NOT swap this for a live read on every render.
    const transactionSettings = useSelector(state => state.transactionsSettings.data);
    const [loan, setLoan] = useState();
    const [branch, setBranch] = useState();
    const [client, setClient] = useState();
    const [clientAddress, setClientAddress] = useState();
    const [amortization, setAmortization] = useState([]);
    const [branchManager, setBranchManager] = useState();

    const marginTop = "30px";
    const marginRight = "5px";
    const marginBottom= "20px";
    const marginLeft = "5px";

    const getPageMargins = () => {
        return `@page { margin: ${marginTop} ${marginRight} ${marginBottom} ${marginLeft} !important; }`;
    };

    useEffect(() => {
        if (props.loan) {
            const fullName = props.loan.client.firstName + ' ' + props.loan.client.lastName;

            const amountRelease = props.loan.amountRelease
                || props.loan.loanBalance
                || (props.loan.principalLoan * (transactionSettings?.serviceChargeRate || 1.2));

            const loanData = {
                ...props.loan,
                principalLoanStr: formatPricePhp(props.loan.principalLoan),
                amountReleaseStr: formatPricePhp(amountRelease),
                fullName: fullName
            };
            setLoan(loanData);
            setBranch(props.loan.branch.length > 0 ? props.loan.branch[0] : {});
            const clientData = { ...props.loan.client, fullName: fullName };
            setClient(clientData);
            let address = '';
            if (clientData.addressStreetNo) address = clientData.addressStreetNo;
            if (clientData.addressBarangayDistrict) address += ', ' + clientData.addressBarangayDistrict;
            if (clientData.addressMunicipalityCity) address += ', ' + clientData.addressMunicipalityCity;
            if (clientData.addressProvince) address += ', ' + clientData.addressProvince;
            setClientAddress(address);

            setAmortization(buildAmortization({
                principalLoan: loanData.principalLoan,
                amountRelease,
                loanTerms: loanData.loanTerms,
                occurence: loanData.occurence
            }));
        }
    }, [props, transactionSettings]);

    useEffect(() => {
        console.log('currentBranch', currentBranch);
        if (currentBranch) {
            setBranchManager(`${currentBranch?.branchManager?.firstName} ${currentBranch?.branchManager?.lastName}`);
        }
    }, [currentBranch]);

    const copyProps = { loan, branch, clientAddress, branchManager, currentDate, amortization };

    return (
        <div ref={ref} className='min-h-screen w-full mt-4 p-8' style={{ fontSize: '9px' }}>
            <style>{getPageMargins()}</style>
            <div className='flex flex-row justify-center leading-3'>
                <NDSCopy label="BRANCH COPY" showInterest {...copyProps} />
                <NDSCopy label="BORROWER'S COPY" {...copyProps} />
            </div>
        </div>
    )
});

// One copy of the disclosure statement. The Branch Copy additionally shows the
// interest column (right of the amortization table); the Borrower's Copy does not.
const NDSCopy = ({ label, showInterest = false, loan, branch, clientAddress, branchManager, currentDate, amortization }) => (
    <div className='flex flex-col p-2' style={{ width: '50%' }}>
        <div className='flex flex-row justify-between'>
            <Image src={logo} className="overflow-hidden mr-4" width='80' height='60' />
            <div className='flex flex-row text-center justify-between w-2/3'>
                <div className='flex flex-col mr-4'>
                    <span className='font-bold' style={{ fontSize: '14px' }}>AmberCash PH micro Lending Corp</span>
                    <span>DISCLOSURE STATEMENT ON LOAN TRANSACTION</span>
                    <span style={{ fontStyle: 'italic' }}>(As Required under R.A. 3765, Truth in Lending Act)</span>
                </div>
                <span className='font-bold'>{ label }</span>
            </div>
        </div>
        <div className='w-full mt-2'>
            <table className='table-auto border border-gray-900 w-full'>
                <tbody>
                    <tr>
                        <td className='border border-gray-900'>Borrower:</td>
                        <td className='font-bold border border-gray-900 uppercase'>{ loan?.fullName }</td>
                        <td>Branch:</td>
                        <td className='font-bold border border-gray-900 uppercase'>{ `${branch?.code} ${branch?.name}` }</td>
                    </tr>
                    <tr>
                        <td className='border border-gray-900'>Address: </td>
                        <td colSpan={3} className='border border-gray-900'>{ clientAddress }</td>
                    </tr>
                </tbody>
            </table>
            <table className='table-auto w-full font-bold'>
                <tbody>
                    <tr>
                        <td>1. LOAN AMOUNT</td>
                        <td className='flex justify-end'>{ loan?.principalLoanStr }</td>
                    </tr>
                    <tr>
                        <td>2. OTHER CHARGES/DEDUCTIONS COLLECTED</td>
                        <td className='flex justify-end'>None</td>
                    </tr>
                    <tr>
                        <td>3. NET PROCEEDS OF LOAN (Item 1 less Item 2)</td>
                        <td className='flex justify-end'>{ loan?.principalLoanStr }</td>
                    </tr>
                    <tr>
                        <td>4. SCHEDULE OF PAYMENTS <span style={{ fontStyle: 'italic' }}>(please see below amortization schedule)</span></td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>5. ANNUAL EFFECTIVE INTEREST RATE</td>
                        <td className='flex justify-end'>32%</td>
                    </tr>
                </tbody>
            </table>
            <div className='flex flex-row font-bold mt-1'>
                <span>CERTIFIED CORRECT:</span>
                <div className='flex flex-col ml-2'>
                    <span>I acknowledge receipt of a copy of this statement</span>
                    <span>prior to the consummation of the credit</span>
                </div>
            </div>
            <div className='flex flex-row justify-between mt-4 text-center items-center font-bold border-b-4 border-gray-900'>
                <div className='flex flex-col'>
                    <span className='border-b border-gray-900 uppercase'>{ branchManager }</span>
                    <span style={{ fontStyle: 'italic' }}>Branch Manager</span>
                </div>
                <div className='flex flex-col'>
                    <span className='border-b border-gray-900 uppercase'>{ loan?.fullName }</span>
                    <span style={{ fontStyle: 'italic' }}>Borrower</span>
                </div>
                <div className='flex flex-col'>
                    <span className='border-b border-gray-900 uppercase'>{ currentDate }</span>
                    <span style={{ fontStyle: 'italic' }}>Date</span>
                </div>
            </div>
            <div className='flex flex-col justify-between w-full'>
                <span className='uppercase font-bold text-lg underline text-center items-center'>AMORTIZATION SCHEDULE</span>
                <table className='table-fixed w-full'>
                    <thead>
                        <tr>
                            <th className='border border-gray-900 w-8'>Install ment</th>
                            <th className='border border-gray-900 w-12'>Loan Release</th>
                            <th className='border border-gray-900 w-12'>Principal</th>
                            <th className='border border-gray-900 w-10'>Service Charge</th>
                            <th className='border border-gray-900 w-10'>Total</th>
                            <th className='border border-gray-900 w-12'>O/S Balance</th>
                            <th className='w-12'></th>
                        </tr>
                    </thead>
                    <tbody>
                        { amortization.map((am, index) => (
                            <tr key={index} style={{ textAlign: 'end' }}>
                                <td className='border border-gray-900'>{ am.installment }</td>
                                <td className='border border-gray-900'>{ am.loanRelease }</td>
                                <td className='border border-gray-900'>{ am.principal }</td>
                                <td className='border border-gray-900'>{ am.serviceCharge }</td>
                                <td className='border border-gray-900'>{ am.total }</td>
                                <td className='border border-gray-900'>{ am.balanceStr }</td>
                                <td>{ showInterest ? am.interest : '' }</td>
                            </tr>
                        )) }
                    </tbody>
                </table>
            </div>
        </div>
    </div>
);

export default ClientNDSPage;