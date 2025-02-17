import React, { useRef, useState } from 'react';
import Image from 'next/image';
import logo from "/public/images/logo.png";
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { formatPricePhp } from '@/lib/utils';
import moment from 'moment';

const LDFListPage = React.forwardRef((props, ref) => {
    const currentUser = useSelector(state => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const currentBranch = useSelector(state => state.branch.data);
    
    const [list, setList] = useState([]);
    const [summaryList, setSummaryList] = useState([]);

    const marginTop = "30px";
    const marginRight = "5px";
    const marginBottom= "20px";
    const marginLeft = "5px";

    const getPageMargins = () => {
        return `@page { margin: ${marginTop} ${marginRight} ${marginBottom} ${marginLeft} !important; }`;
    };

    const hideComponent = () => {
        return `@media screen { .media-to-print { display: none; } }`;
    }

    useEffect(() => {
        console.log(props.data)
        if (props.data) {
            let dataList = props.data;
            const arr = [];
            const hasSelected = props.data.filter(d => d.selected);
            if (hasSelected.length > 0) {
                dataList = hasSelected;
            }
            dataList.map((loan, index) => {
                let loanDetails = {};
                loanDetails.slotNo = loan.slotNo;
                const clientData = { ...loan.client, fullName: fullName };
                let fullName = clientData.fullName ? clientData.fullName : clientData.firstName + ' ' + clientData.lastName;
                loanDetails.fullName = fullName;
                loanDetails.dob = clientData.birthdate;
                const groupData = loan.group;
                loanDetails.groupName = groupData.name;
                loanDetails.loanCycle = loan.loanCycle;
                loanDetails.businessType = ''; // NO DATA
                loanDetails.loanDisbursementDate = currentDate;
                loanDetails.loanDisbursementPrincipalAmount = loan.principalLoan;
                loanDetails.loanDisbursementAmountRelease = loan.amountRelease;
                const loanOfficer = loan.loanOfficer;
                loanDetails.designatedOfficer = 'LO ' + loanOfficer?.loNo;
                // const month = moment().month() + 1;
                // const monthStr = month < 10 ? '0' + month : month;
                // loanDetails.loanApplicationNo = loanDetails.designatedOfficer + '-' + monthStr + 
                loanDetails.loNo = loanOfficer?.loNo;
                loanDetails.ciName = loan.ciName ? loan.ciName : clientData?.ciName;
                
                arr.push(loanDetails);
            });

            const noOfLo = currentBranch ? currentBranch?.noOfLO?.count : 10;
            let summary = [];
            for (let i = 0; i < noOfLo; i++) {
                summary.push({
                    lo: 'LO ' + (i + 1),
                    noOfRelease: 0,
                    amountPrincipal: 0,
                    amountRelease: 0,
                    total: false
                });
            }

            let totalRelease = 0;
            let totalAmountPrincipal = 0;
            let totalAmountRelease = 0;
            arr.map(loan => {
                const currentLOIdx = summary.findIndex(s => s.lo == loan.designatedOfficer);
                if (currentLOIdx > -1) {
                    let temp = {...summary[currentLOIdx]};
                    temp.noOfRelease += 1;
                    temp.amountPrincipal += loan.loanDisbursementPrincipalAmount;
                    temp.amountRelease += loan.loanDisbursementAmountRelease;
                    summary[currentLOIdx] = temp;
                    totalRelease += 1;
                    totalAmountPrincipal += loan.loanDisbursementPrincipalAmount;
                    totalAmountRelease += loan.loanDisbursementAmountRelease;
                }
            });

            if (totalRelease < 15) {
                const additional = 15 - totalRelease;
                const arraySize = arr.length;
                const totalLength = arraySize + additional;
                for (let i = arraySize + 1; i <= totalLength; i++) {
                    arr.push({
                        slotNo: '',
                        fullName: '',
                        dob: '',
                        groupName: '',
                        loanCycle: '',
                        businessType: '',
                        loanDisbursementDate: '',
                        loanDisbursementPrincipalAmount: '',
                        loanDisbursementAmountRelease: '',
                        designatedOfficer: ''
                    });
                }
            }

            summary.push({
                lo: 'TOTAL',
                noOfRelease: totalRelease,
                amountPrincipal: totalAmountPrincipal,
                amountRelease: totalAmountRelease,
                total: true
            });

            arr.sort((a, b) => { return a.loNo - b.loNo });

            setList(arr);
            setSummaryList(summary);
        }
    }, [props, currentBranch]);
    return (
        <div ref={ref} className='media-to-print min-h-screen w-full mt-4 p-8' style={{ fontSize: '9px' }}>
            <style>{hideComponent()}</style>
            <style>{getPageMargins()}</style>
            <style type="text/css" media="print">{"\
                @page {\ size: landscape;\ }\
            "}</style>
            <div className='flex flex-col justify-center leading-3'>
                <div className='flex flex-row justify-center'>
                    <Image alt="ambercashph logo" src={logo} className="overflow-hidden mr-4" width='80' height='60' />
                    <div className='flex flex-row text-center justify-between'>
                        <div className='flex flex-col mr-4'>
                            <span className='font-bold my-4' style={{ fontSize: '14px' }}>AmberCash PH Micro Lending Corp</span>
                            <span className='font-bold' style={{ fontSize: '16px' }}>LOAN DISBURSEMENT FORM</span>
                        </div>
                    </div>
                    <Image alt="ambercashph logo" src={logo} className="overflow-hidden mr-4" width='80' height='60' />
                </div>
                <div className='flex flex-row ml-2'>
                    <span>Branch: </span>
                    <span className='underline font-bold ml-2'>{ currentBranch.name }</span>
                </div>
                <div className='flex flex-row justify-center'>
                    <div className='flex flex-col p-2' style={{ width: '75%' }}>
                        <div className='w-full'>
                            <div className='flex flex-col justify-between w-full'>
                                <table className='table-auto w-full border-collapse'>
                                    <thead>
                                        <tr>
                                            <th className='border border-gray-900 w-8' rowSpan={2}>NO</th>
                                            <th className='border border-gray-900 w-8' rowSpan={2}>SL #</th>
                                            <th className='border border-gray-900 w-40' rowSpan={2}>Full Name of Clients</th>
                                            <th className='border border-gray-900 w-16' rowSpan={2}>Date of Birth</th>
                                            <th className='border border-gray-900 w-12' rowSpan={2}>Group Name</th>
                                            <th className='border border-gray-900 w-10' rowSpan={2}>Loan Cycle</th>
                                            {/* <th className='border border-gray-900 w-12' rowSpan={2}>Business Type</th> */}
                                            <th className='border border-gray-900 w-12' colSpan={3}>Loan Disbursement</th>
                                            <th className='border border-gray-900 w-52' rowSpan={2}>Client's Signature Over Printed Name</th>
                                            <th className='border border-gray-900 w-12' rowSpan={2}>Loan App. #</th>
                                            <th className='border border-gray-900 w-12' colSpan={3}>Signatures</th>
                                            <th className='border border-gray-900 w-8' rowSpan={2}>Designated LO</th>
                                        </tr>
                                        <tr>
                                            <th className='border border-gray-900 w-16'>Date</th>
                                            <th className='border border-gray-900 w-15'>Principal Amount</th>
                                            <th className='border border-gray-900 w-15'>Loan w/ Service Charge</th>
                                            <th className='border border-gray-900 w-12'>LO</th>
                                            <th className='border border-gray-900 w-12'>Person in-charge in CI</th>
                                            <th className='border border-gray-900 w-12'>Approved by</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        { list.map((loan, index) => {
                                            return (
                                                <tr key={index} className={`${loan.slotNo && 'leading-8'}`}>
                                                    <td className='border border-gray-900 text-center'>{ index + 1 }</td>
                                                    <td className='border border-gray-900 text-center'>{ loan.slotNo }</td>
                                                    <td className='border border-gray-900'>{ loan.fullName }</td>
                                                    <td className='border border-gray-900 text-center'>{ loan.dob }</td>
                                                    <td className='border border-gray-900'>{ loan.groupName }</td>
                                                    <td className='border border-gray-900 text-center'>{ loan.loanCycle }</td>
                                                    {/* <td className='border border-gray-900'>{ loan.businessType }</td> */}
                                                    <td className='border border-gray-900 text-center'>{ loan.loanDisbursementDate }</td>
                                                    <td className='border border-gray-900 text-right'>{ loan.loanDisbursementPrincipalAmount ? formatPricePhp(loan.loanDisbursementPrincipalAmount) : '' }</td>
                                                    <td className='border border-gray-900 text-right'>{ loan.loanDisbursementAmountRelease ? formatPricePhp(loan.loanDisbursementAmountRelease) : '' }</td>
                                                    <td className='border border-gray-900'></td>
                                                    <td className='border border-gray-900'></td>
                                                    <td className='border border-gray-900'></td>
                                                    <td className='border border-gray-900'>{ loan?.ciName }</td>
                                                    <td className='border border-gray-900'></td>
                                                    <td className='border border-gray-900'>{ loan.designatedOfficer }</td>
                                                </tr>
                                            )
                                        }) }
                                    </tbody>
                                </table>
                            </div>
                            <div className='flex flex-row justify-between w-full mt-2'>
                                <span className='font-bold text-xs'>Note:</span>
                                <div className='flex flex-col text-[9px]'>
                                    <span>* Daily loan releases must be balanced with the DCS and cashbook;</span>
                                    <span>* Use RED ink ballpen for grand total releases and in loan application number column</span>
                                    <span>* CODE for Loan Application Number: (LO1-MONTH-provided release #) * e.g. (LO1-06-001)</span>
                                </div>
                                <span className='font-bold text-xs'>Note:</span>
                                <span>You can encode information in white cells only otherwise are formulated and can't be encoded!!</span>
                            </div>
                        </div>
                    </div>
                    <div className='flex flex-col p-2' style={{ width: '25%' }}>
                        <div className='w-full flex flex-col'>
                            <div className='flex flex-col justify-between w-full'>
                                <table className='table-auto w-full'>
                                    <thead>
                                        <tr>
                                            <th className='border border-gray-900 w-8' colSpan={4}>Summary of Release</th>
                                        </tr>
                                        <tr>
                                            <th className='border border-gray-900 w-12'>LO's</th>
                                            <th className='border border-gray-900 w-12'>No Rel.</th>
                                            <th className='border border-gray-900 w-15'>Amount Principal</th>
                                            <th className='border border-gray-900 w-15'>Loan w/ Service Charge</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        { summaryList.map((summary, index) => {
                                            return (
                                                <tr key={index}>
                                                    <td className={`border border-gray-900 text-left ${summary.total && 'text-red-500 font-bold'}`}>{ summary.lo }</td>
                                                    <td className={`border border-gray-900 text-center ${summary.total && 'text-red-500 font-bold'}`}>{ summary.noOfRelease }</td>
                                                    <td className={`border border-gray-900 text-right ${summary.total && 'text-red-500 font-bold'}`}>{ formatPricePhp(summary.amountPrincipal) }</td>
                                                    <td className={`border border-gray-900 text-right ${summary.total && 'text-red-500 font-bold'}`}>{ formatPricePhp(summary.amountRelease) }</td>
                                                </tr>
                                            )
                                        }) }
                                        <tr className='h-8'>
                                            <td className='border border-gray-900' colSpan={3}></td>
                                            <td className='border border-gray-900'></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div className='flex flex-col justify-between w-full mt-1'>
                                <table className='table-auto w-full'>
                                    <tbody>
                                        <tr className='text-center my-4 h-4'>
                                            <td>Cashier In-Charge Signature</td>
                                            <td>Cashier In-Charge Signature</td>
                                        </tr>
                                        <tr className='h-8'>
                                            <td className='border border-gray-900'></td>
                                            <td className='border border-gray-900'></td>
                                        </tr>
                                        <tr className='text-center my-4 h-4'>
                                            <td>BM Signature</td>
                                            <td>BM Signature</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div className='flex flex-col mt-2'>
                                <span>NOTE: PRINT IN LEGAL</span>
                                <span>SIZE "8.5 x 13"</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
});

export default LDFListPage;