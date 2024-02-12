import React, { useRef, useState } from 'react';
import Spinner from '@/components/Spinner';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import ReactToPrint from 'node_modules/react-to-print/lib/index';
import { PrinterIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import logo from "/public/images/logo.png";
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { formatPricePhp } from '@/lib/utils';

const ClientNDSPage = ({ data: [] }) => {
    const ndsFormRef = useRef();

    return (
        <div className='flex flex-col w-full p-12'>
            <div className='flex justify-end mr-8'>
                <ReactToPrint
                    trigger={() => <ButtonSolid label="Print" icon={[<PrinterIcon className="w-5 h-5" />, 'left']} width='!w-20'/> }
                    content={() => ndsFormRef.current }
                />
            </div>

            <NDSForm ref={ndsFormRef} data={data} />
        </div>
    )
}

const NDSForm = React.forwardRef((props, ref) => {
    const currentUser = useSelector(state => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const [loan, setLoan] = useState();
    const [branch, setBranch] = useState();
    const [client, setClient] = useState();
    const [clientAddress, setClientAddress] = useState();
    const [amortization, setAmortization] = useState([]);
    const [list, setList] = useData([]);

    const marginTop = "30px";
    const marginRight = "5px";
    const marginBottom= "20px";
    const marginLeft = "5px";

    const getPageMargins = () => {
        return `@page { margin: ${marginTop} ${marginRight} ${marginBottom} ${marginLeft} !important; }`;
    };

    useEffect(() => {
        if (props.data) {
            const arr = [];
            props.data.map(loan => {
                let loanDetails = {};
                const fullName = loan.client.firstName + ' ' + loan.client.lastName;
                const loanData = {...loan, principalLoanStr: formatPricePhp(loan.principalLoan), fullName: fullName };
                loanDetails.loan = loanData;
                loanDetails.branch = loan.branch.length > 0 ? loan.branch[0] : {}
                const clientData = { ...loan.client, fullName: fullName };
                loanDetails.client = clientData;
                let address = '';
                if (clientData.addressStreetNo) {
                    address = clientData.addressStreetNo;
                }
                if (clientData.addressBarangayDistrict) {
                    address += ', ' + clientData.addressBarangayDistrict;
                }
                if (clientData.addressMunicipalityCity) {
                    address += ', ' + clientData.addressMunicipalityCity;
                }
                if (clientData.addressProvince) {
                    address += ', ' + clientData.addressProvince;
                }

                loanDetails.clientAddress = address;

                let sched = [];
                const loanTerms = loanData.loanTerms;
                const interest = (loanData.principalLoan * 0.2);

                sched.push({ installment: '', loanRelease: loanData.principalLoan, serviceCharge: '', total: '', balance: loanData.principalLoan, interest: interest });
                let totalServiceCharge = 0;
                for (let i = 1; i <= loanTerms; i++) {
                    const prev = sched[i - 1];
                    const total = (loanData.principalLoan * 1.2) / loanTerms;
                    const serviceCharge = (prev.balance * 0.2) / 32.3339;
                    const principal = total - serviceCharge;
                    const balance = prev.balance - principal;
                    
                    totalServiceCharge += serviceCharge;

                    let data = {
                        installment: i,
                        loanRelease: '',
                        principal: Math.round(principal).toFixed(0),
                        serviceCharge: Math.round(serviceCharge).toFixed(0),
                        total: Math.round(total).toFixed(0),
                        balance: Math.round(balance).toFixed(0),
                        interest: ''
                    }

                    sched.push(data);
                }

                sched[1] = { ...sched[1], interest: Math.round(totalServiceCharge).toFixed(0) };

                loanDetails.amortization = sched;
                arr.push(loanDetails);
            });
        }
    }, [props]);
    return (
        <div ref={ref} className='min-h-screen w-full mt-4 p-8' style={{ fontSize: '9px' }}>
            <style>{getPageMargins()}</style>
            <div className='flex flex-row justify-center leading-3'>
                <div className='flex flex-col p-2' style={{ width: '50%' }}>
                    <div className='flex flex-row justify-between'>
                        <Image src={logo} className="overflow-hidden mr-4" width='60' height='60' />
                        <div className='flex flex-row text-center justify-between w-2/3'>
                            <div className='flex flex-col mr-4'>
                                <span className='font-bold' style={{ fontSize: '14px' }}>AmberCash PH micro Lending Corp</span>
                                <span>DISCLOSURE STATEMENT ON LOAN TRANSACTION</span>
                                <span style={{ fontStyle: 'italic' }}>(As Required under R.A. 3765, Truth in Lending Act)</span>
                            </div>
                            <span className='font-bold'>BRANCH COPY</span>
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
                                <span className='border-b border-gray-900 uppercase'>{ `${currentUser.firstName} ${currentUser.lastName}` }</span>
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
                                    { amortization.map((am, index) => {
                                        return (
                                            <tr key={index} style={{ textAlign: 'end' }}>
                                                <td className='border border-gray-900'>{ am.installment }</td>
                                                <td className='border border-gray-900'>{ am.loanRelease }</td>
                                                <td className='border border-gray-900'>{ am.principal }</td>
                                                <td className='border border-gray-900'>{ am.serviceCharge }</td>
                                                <td className='border border-gray-900'>{ am.total }</td>
                                                <td className='border border-gray-900'>{ am.balance }</td>
                                                <td>{ am.interest }</td>
                                            </tr>
                                        )
                                    }) }
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div className='flex flex-col p-2' style={{ width: '50%' }}>
                    <div className='flex flex-row justify-between'>
                        <Image src={logo} className="overflow-hidden mr-4" width='60' height='60' />
                        <div className='flex flex-row text-center justify-between w-2/3'>
                            <div className='flex flex-col mr-4'>
                                <span className='font-bold' style={{ fontSize: '14px' }}>AmberCash PH micro Lending Corp</span>
                                <span>DISCLOSURE STATEMENT ON LOAN TRANSACTION</span>
                                <span style={{ fontStyle: 'italic' }}>(As Required under R.A. 3765, Truth in Lending Act)</span>
                            </div>
                            <span className='font-bold'>BORROWER'S COPY</span>
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
                                <span className='border-b border-gray-900 uppercase'>{ `${currentUser.firstName} ${currentUser.lastName}` }</span>
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
                                    { amortization.map((am, index) => {
                                        return (
                                            <tr key={index} style={{ textAlign: 'end' }}>
                                                <td className='border border-gray-900'>{ am.installment }</td>
                                                <td className='border border-gray-900'>{ am.loanRelease }</td>
                                                <td className='border border-gray-900'>{ am.principal }</td>
                                                <td className='border border-gray-900'>{ am.serviceCharge }</td>
                                                <td className='border border-gray-900'>{ am.total }</td>
                                                <td className='border border-gray-900'>{ am.balance }</td>
                                                <td></td>
                                            </tr>
                                        )
                                    }) }
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
});

export default ClientNDSPage;