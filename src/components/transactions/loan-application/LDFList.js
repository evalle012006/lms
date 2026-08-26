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

    // Column widths as % of the 75% left panel — must sum to 100
    // NO(2) SL(2) FullName(11) DOB(5) Group(5) Cycle(3) Principal(5) Release(5) ClientSig(9) LoanApp(4) BM(8) Cashier(8) Time(4) DesigLO(8) CI(8) = ~97 → padded to 100
    const colWidths = {
        no:          '2%',
        sl:          '2%',
        fullName:    '11%',
        dob:         '5%',
        group:       '5%',
        cycle:       '3%',
        principal:   '5%',
        release:     '5%',
        clientSig:   '9%',
        loanApp:     '4%',
        bm:          '9%',
        cashier:     '9%',
        time:        '4%',
        desigLO:     '9%',
        ci:          '9%',
    };

    return (
        <div ref={ref} className='media-to-print w-full mt-4 p-4' style={{ fontSize: '8px' }}>
            <style>{hideComponent()}</style>
            <style>{getPageMargins()}</style>
            <style>{`
                .ldf-table th, .ldf-table td { padding: 2px 3px !important; }
                .ldf-table { table-layout: fixed; border-collapse: collapse; }
            `}</style>
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
                {/* Branch left (75%) and Date right (25%) — same row, outside tables */}
                <div className='flex flex-row' style={{ width: '100%' }}>
                    <div style={{ width: '75%' }} className='flex flex-row ml-2 items-center'>
                        <span>Branch: </span>
                        <span className='underline font-bold ml-2'>{ currentBranch.name }</span>
                    </div>
                    <div style={{ width: '25%' }} className='flex flex-row justify-end items-center pr-1'>
                        <span>Date:&nbsp;</span>
                        <span
                            className='inline-block border-b border-gray-900 text-center'
                            style={{ minWidth: '140px' }}
                        >
                            {moment().format('MM/DD/YYYY hh:mm A')}
                        </span>
                    </div>
                </div>
                <div className='flex flex-row justify-center'>
                    {/* LEFT PANEL: main table at 75% */}
                    <div className='flex flex-col p-1' style={{ width: '75%' }}>
                        <div className='w-full'>
                            <div className='flex flex-col justify-between w-full'>
                                <table className='ldf-table w-full'>
                                    <colgroup>
                                        <col style={{ width: colWidths.no }} />
                                        <col style={{ width: colWidths.sl }} />
                                        <col style={{ width: colWidths.fullName }} />
                                        <col style={{ width: colWidths.dob }} />
                                        <col style={{ width: colWidths.group }} />
                                        <col style={{ width: colWidths.cycle }} />
                                        <col style={{ width: colWidths.principal }} />
                                        <col style={{ width: colWidths.release }} />
                                        <col style={{ width: colWidths.clientSig }} />
                                        <col style={{ width: colWidths.loanApp }} />
                                        <col style={{ width: colWidths.bm }} />
                                        <col style={{ width: colWidths.cashier }} />
                                        <col style={{ width: colWidths.time }} />
                                        <col style={{ width: colWidths.desigLO }} />
                                        <col style={{ width: colWidths.ci }} />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th className='border border-gray-900 text-center' rowSpan={2}>NO</th>
                                            <th className='border border-gray-900 text-center' rowSpan={2}>SL #</th>
                                            <th className='border border-gray-900 text-center' rowSpan={2}>Full Name of Clients</th>
                                            <th className='border border-gray-900 text-center' rowSpan={2}>Date of Birth</th>
                                            <th className='border border-gray-900 text-center' rowSpan={2}>Group Name</th>
                                            <th className='border border-gray-900 text-center' rowSpan={2}>Loan Cycle</th>
                                            <th className='border border-gray-900 text-center' colSpan={2}>Loan Disbursement</th>
                                            <th className='border border-gray-900 text-center' rowSpan={2}>Client&apos;s Signature Over Printed Name</th>
                                            <th className='border border-gray-900 text-center' rowSpan={2}>Loan App. #</th>
                                            <th className='border border-gray-900 text-center' colSpan={5}>SIGNATURE</th>
                                        </tr>
                                        <tr>
                                            <th className='border border-gray-900 text-center'>Principal Amount</th>
                                            <th className='border border-gray-900 text-center'>Loan w/ Service Charge</th>
                                            <th className='border border-gray-900 text-center'>BM &amp; Up Approved (Sig. Over Printed Name)</th>
                                            <th className='border border-gray-900 text-center'>Cashier In Charge (Sig. Over Printed Name)</th>
                                            <th className='border border-gray-900 text-center'>Time</th>
                                            <th className='border border-gray-900 text-center'>Designated LO (Sig. Over Printed Name)</th>
                                            <th className='border border-gray-900 text-center'>Person In-charge in C.I (Sig. Over Printed Name)</th>
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
                                                    <td className='border border-gray-900 text-right'>{ loan.loanDisbursementPrincipalAmount ? formatPricePhp(loan.loanDisbursementPrincipalAmount) : '' }</td>
                                                    <td className='border border-gray-900 text-right'>{ loan.loanDisbursementAmountRelease ? formatPricePhp(loan.loanDisbursementAmountRelease) : '' }</td>
                                                    <td className='border border-gray-900'></td>
                                                    <td className='border border-gray-900'></td>
                                                    <td className='border border-gray-900'></td>
                                                    <td className='border border-gray-900'></td>
                                                    <td className='border border-gray-900'></td>
                                                    <td className='border border-gray-900'>{ loan.designatedOfficer }</td>
                                                    <td className='border border-gray-900'></td>
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
                                <span>You can encode information in white cells only otherwise are formulated and can&apos;t be encoded!!</span>
                            </div>
                        </div>
                    </div>
                    {/* RIGHT PANEL: summary at 25% — Date removed from here */}
                    <div className='flex flex-col p-1' style={{ width: '25%' }}>
                        <div className='w-full flex flex-col'>
                            <div className='flex flex-col justify-between w-full'>
                                <table className='table-auto w-full'>
                                    <thead>
                                        <tr>
                                            <th className='border border-gray-900 w-8' colSpan={4}>Summary of Release</th>
                                        </tr>
                                        <tr>
                                            <th className='border border-gray-900 w-12'>LO&apos;s</th>
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
                                        <tr className='text-center h-4'>
                                            <td className='text-[8px]'>Cashier in Charge Cash Count Consolidation Signature</td>
                                            <td className='text-[8px]'>Cashier in Charge Release Signature</td>
                                        </tr>
                                        <tr className='h-8'>
                                            <td className='border border-gray-900'></td>
                                            <td className='border border-gray-900'></td>
                                        </tr>
                                        <tr className='text-center h-4'>
                                            <td className='text-[8px]'>Branch Head Signature</td>
                                            <td className='text-[8px]'>Asst. Branch Manager Signature</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div className='flex flex-col mt-2'>
                                <span>NOTE: PRINT IN LEGAL</span>
                                <span>SIZE &quot;8.5 x 13&quot;</span>
                            </div>
                            <div className='flex flex-col mt-2 text-[8px]'>
                                <span className='font-bold'>REMINDERS:</span>
                                <span>- Under no circumstances should any document be signed by individuals who are not assigned to the transaction.</span>
                                <span>- I hereby certify that the signature on the above document was executed with my full knowledge, consent, and understanding.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
});

export default LDFListPage;