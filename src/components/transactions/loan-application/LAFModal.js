import React, { useRef } from 'react';
import { X, Printer, Download } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import moment from 'moment';

const LAFModal = ({ isOpen, onClose, loanData }) => {
  const componentRef = useRef();

  // Print handler using react-to-print
  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    documentTitle: `LAF-${loanData?.pnNumber || loanData?.id || 'document'}`,
    pageStyle: `
      @page {
        size: A4;
        margin: 10mm;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    `,
  });

  // PDF Download handler
  const handleDownloadPDF = async () => {
    try {
      // Dynamically import html2pdf only on client side
      const html2pdf = (await import('html2pdf.js')).default;
      
      const element = componentRef.current;
      
      const opt = {
        margin: 10,
        filename: `LAF-${loanData.pnNumber || loanData.id || 'document'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: false,
          allowTaint: true,
          letterRendering: true,
          logging: false,
          imageTimeout: 0,
          removeContainer: true
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      // Wait a bit for images to load
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. The document will be generated without some images.');
    }
  };

  if (!isOpen || !loanData) return null;

  // Extract data from the loan structure
  const client = loanData.client || {};
  const branch = loanData.branch?.[0] || {};
  const group = loanData.group || {};
  const loanOfficer = loanData.loanOfficer || {};
  
  const serviceChargeRate = 0.20;
  const totalAmount = loanData.principalLoan * (1 + serviceChargeRate);
  const totalAmountWords = numberToWords(totalAmount);

  // Profile picture - use client.profile or loanData.profile, fallback to placeholder
  const profilePicture = client.profile || loanData.profile;
  
  // Build guarantor name
  const guarantorFullName = [
    loanData.guarantorFirstName,
    loanData.guarantorMiddleName,
    loanData.guarantorLastName
  ].filter(Boolean).join(' ') || 'N/A';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto no-print">
      <div className="min-h-screen px-4 py-8">
        <div className="relative bg-white max-w-4xl mx-auto rounded-lg shadow-xl">
          {/* Header with close, download and print buttons */}
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center no-print z-10">
            <h2 className="text-xl font-semibold">Loan Agreement Form</h2>
            <div className="flex gap-2">
              {/* <button
                onClick={handleDownloadPDF}
                className="p-2 hover:bg-gray-100 rounded-lg transition flex items-center gap-2 px-3"
                title="Download PDF"
              >
                <Download className="w-5 h-5" />
                <span className="text-sm">PDF</span>
              </button> */}
              <button
                onClick={handlePrint}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                title="Print"
              >
                <Printer className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Form content - wrapped in ref for printing/PDF */}
          <div ref={componentRef} className="p-8 bg-white printable-content">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-4 mt-10">
                <div className="w-24 h-24 flex items-center justify-center">
                  <img 
                    src="/images/logo.png" 
                    alt="AmberCash Logo" 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div className="w-16 h-16 bg-blue-600 rounded-full hidden items-center justify-center text-white font-bold text-2xl">
                    AC
                  </div>
                </div>
                <div>
                  <h1 className="text-xl font-bold">AmberCash PH Micro Lending Corp.</h1>
                  <p className="text-sm text-gray-600">Phase 4, A&W Subdivision, Zone 7, Guiwan, Zamboanga City</p>
                  <p className="text-sm text-gray-600">Zamboanga Del Sur 7000 Philippines</p>
                </div>
              </div>
              <div className="border-2 border-gray-400 w-64 h-44 flex items-center justify-center text-xs text-gray-500 overflow-hidden bg-gray-50">
                {profilePicture ? (
                  <img 
                    src={profilePicture} 
                    alt="Borrower" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = `
                        <div class="flex flex-col items-center justify-center text-center p-2">
                          <svg class="w-16 h-16 text-gray-300 mb-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                          </svg>
                          <span class="text-gray-400">Borrower Photo<br />(1.5X3)</span>
                        </div>
                      `;
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-2">
                    <svg className="w-16 h-16 text-gray-300 mb-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-400">Borrower Photo<br />(1.5X3)</span>
                  </div>
                )}
              </div>
            </div>

            <h2 className="text-2xl font-bold text-center mb-8 mt-8">LOAN AGREEMENT FORM</h2>

            {/* Borrower's Information */}
            <div className="mb-6">
              <div className="bg-gray-200 px-4 py-2 font-semibold mb-2 flex justify-between">
                <span>Borrower's Information</span>
                <span>Date Filed: {loanData.dateAdded ? moment(loanData.dateAdded).format('YYYY-MM-DD') : moment(loanData.insertedDateTime).format('YYYY-MM-DD')}</span>
              </div>
              <table className="w-full border-collapse border border-gray-400 text-sm">
                <tbody>
                  <tr>
                    <td className="border border-gray-400 px-2 py-1">
                      <span className="font-semibold">Name:</span> {loanData.fullName || client.fullName}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      <span className="font-semibold">Birth Date:</span> {client.birthdate ? moment(client.birthdate).format('YYYY-MM-DD') : ''}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      <span className="font-semibold">Age:</span> {client.birthdate ? moment().diff(moment(client.birthdate), 'years') : ''}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      <span className="font-semibold">Civil Status:</span> {client.civilStatus || ''}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-400 px-2 py-1" colSpan="2">
                      <span className="font-semibold">Complete Address:</span> {client.address || ''}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      <span className="font-semibold">Yrs. of Stay:</span> {client.yearsOfStay || ''}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      <span className="font-semibold">Contact No.:</span> {client.contactNumber || client.mobileNumber || ''}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-400 px-2 py-1">
                      <span className="font-semibold">Business:</span> {client.business || ''}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      <span className="font-semibold">Daily Income:</span>
                    </td>
                    <td className="border border-gray-400 px-2 py-1" colSpan="2">
                      <span className="font-semibold">Loan Purpose:</span> {loanData.loanPurpose || client.loanPurpose || 'Business Capital'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Guarantor's Information */}
            <div className="mb-6">
              <div className="bg-gray-200 px-4 py-2 font-semibold mb-2">Guarantor's Information</div>
              <table className="w-full border-collapse border border-gray-400 text-sm">
                <tbody>
                  <tr>
                    <td className="border border-gray-400 px-2 py-1">
                      <span className="font-semibold">Name:</span> {guarantorFullName}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      <span className="font-semibold">Birth Date:</span> {loanData.guarantorBirthDate || client.guarantorBirthDate || ''}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      <span className="font-semibold">Age:</span> {loanData.guarantorAge || client.guarantorAge || ''}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      <span className="font-semibold">Civil Status:</span> {loanData.guarantorCivilStatus || client.guarantorCivilStatus || ''}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-400 px-2 py-1" colSpan="3">
                      <span className="font-semibold">Complete Address:</span> {loanData.guarantorAddress || client.guarantorAddress || client.address || ''}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      <span className="font-semibold">Contact No.:</span> {loanData.guarantorContactNo || client.guarantorContactNo || ''}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-400 px-2 py-1">
                      <span className="font-semibold">Work/Business:</span> {loanData.guarantorWorkBusiness || client.guarantorWorkBusiness || ''}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      <span className="font-semibold">Daily Income:</span>
                    </td>
                    <td className="border border-gray-400 px-2 py-1" colSpan="2">
                      <span className="font-semibold">Relation to Borrower:</span> {loanData.guarantorRelation || client.guarantorRelation || ''}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Previous Loan & Current Loan Info */}
            <table className="w-full border-collapse border border-gray-400 text-sm mb-6">
              <tbody>
                <tr>
                  <td className="border border-gray-400 px-2 py-1">
                    <span className="font-semibold">Previous Loan:</span> {loanData.prevLoanId ? 'Yes' : 'N/A'}
                  </td>
                  <td className="border border-gray-400 px-2 py-1">
                    <span className="font-semibold">Group Name:</span> {loanData.groupName || group.name}
                  </td>
                  <td className="border border-gray-400 px-2 py-1">
                    <span className="font-semibold">Passbook #:</span> {loanData.passbookNo || client.passbookNo || ''}
                  </td>
                  <td className="border border-gray-400 px-2 py-1">
                    <span className="font-semibold">Loan Cycle:</span> {loanData.loanCycle}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="mb-6 text-sm">
              <div className="flex gap-8">
                <div><span className="font-semibold">Date of Release:</span> {loanData.dateOfRelease ? moment(loanData.dateOfRelease).format('YYYY-MM-DD') : ''}</div>
                <div><span className="font-semibold">Loan Application No.:</span> {loanData.pnNumber || 'N/A'}</div>
                <div><span className="font-semibold">Approved Loan:</span> ₱{loanData.principalLoan?.toLocaleString()}</div>
              </div>
            </div>

            {/* Promissory Note */}
            <div className="mb-6 page-break-avoid">
              <h3 className="text-center font-bold text-lg mb-3">PROMISSORY NOTE</h3>
              <p className="text-sm text-justify leading-relaxed">
                I, the undersigned promise to pay the <span className="font-semibold">AmberCash PH Micro Lending Corp.</span> indicated above loan approval together with the <span className="font-semibold">service charge of 20%</span> with the sum of <span className="font-semibold underline">{totalAmountWords}</span> Pesos (Php.<span className="font-semibold underline">{totalAmount.toLocaleString()}</span>) payable in <span className="font-semibold">60 Days</span> until the whole sum of the principal together with the service charge have been paid in full, in equal regular daily installment without delay. In case of my default payment, I allow <span className="font-semibold">AmberCash PH Micro Lending Corp.</span> to take any legal necessary action from my assets to serve as my payment. And I agree with my full knowledge and ability that until the principal and service charge owed under this note are paid in full.
              </p>
            </div>

            {/* Terms & Conditions */}
            <div className="mb-6 page-break-avoid">
              <h3 className="text-center font-bold text-lg mb-3">TERMS & CONDITIONS</h3>
              <ol className="text-sm space-y-2 list-decimal list-inside">
                <li>As member of <span className="font-semibold">AmberCash PH Micro Lending Corp.</span> you must obey all rules and regulations related hereto and to the loan provided by the Corporation.</li>
                <li>Promise to pay the loan in full without fail.</li>
                <li>All clients can avail their succeeding loan depending on their performance in <span className="font-semibold">AmberCash PH Micro Lending Corp.</span></li>
                <li>No objection shall be raised on this regard by its successors or by member itself, and if the Lender/company prevails in a lawsuit to collect on this note, borrower will pay Lender's court cost, collection agency cost and attorney fees in an amount the court finds to be reasonable.</li>
                <li>Must also agree that no delay or omission on part of the holder of this note in exercising any right hereunder shall operate as a waiver of any such right or of any other right of such holder, nor shall any delay.</li>
                <li>The rights and remedies of the payee shall be cumulative and may be pursued singly, successively, or together, in the sole discretion of the payee.</li>
                <li>The undersigned and all other parties to this note, whether the guarantors and the co-maker will hereby agree to remain fully liable and clearly understood hereunder until this note shall be fully paid and waive presentment, protest and further agree to remain bound, notwithstanding any extension, renewal or modification.</li>
                <li>Upon application, the member agrees to pay a Center Service Fee (CSF) of PHP 5 at every group meeting or on a daily basis. This CSF is non-refundable and is intended to cover group meeting expenses like electricity cost, maintenance of the place and support the time and effort provided by the group leader in facilitating the collection process.</li>
                <li>As a member, you agree to abide by the terms and conditions set by AmberCash PH Micro Lending Corp.</li>
              </ol>
              <p className="text-sm mt-4 text-justify">
                This promissory note was made to govern and imposed in accordance with the policy of the <span className="font-semibold">AmberCash PH Micro Lending Corp.</span> and hereby execute this note as primary guarantee.
              </p>
            </div>

            {/* Signature Section */}
            <div className="mb-6">
              <div className="flex justify-between items-end mb-8">
                <div className="text-center">
                  <p className="text-xs font-semibold uppercase mb-1">{loanData.fullName || client.fullName}</p>
                  <div className="border-t-2 border-gray-800 w-64 mb-1"></div>
                  <p className="text-sm font-semibold">Borrower</p>
                  <p className="text-xs">(Signature over printed name)</p>
                </div>
                <div className="text-center">
                  <div className="border-2 border-gray-800 w-32 h-32 flex items-center justify-center mb-1">
                    <span className="text-xs text-gray-500">Thumb Mark</span>
                  </div>
                  <p className="text-sm font-semibold">Right Thumb Mark</p>
                </div>
              </div>

              {/* Co-maker and Guarantor Section */}
              <h3 className="text-center font-bold text-lg mb-3">Co-maker and Guarantor's Contract of Agreement</h3>
              <p className="text-sm text-justify mb-6 leading-relaxed">
                We, the Co-maker and Guarantor confirm that the borrower (Ms./Mrs./Mr.)<span className="underline">{loanData.fullName || client.fullName}</span>, a residence of <span className="underline">{client.address || ''}</span>, received the exact amount <span className="underline font-semibold">₱{totalAmount.toLocaleString()}</span> (loan w/ s/c) pesos from <span className="font-semibold">AmberCash PH Micro Lending Corp.</span> representing as her loan proceeds. On the event of default payment, We, as co-maker and guarantor agreed to be completely liable and promise to pay the exact amount received by the borrower until the outstanding balance will be fully paid. In case we fail to fulfill our obligations and responsibilities, the <span className="font-semibold">AmberCash PH Micro Lending Corp.</span> has the right to take any legal action against us to recover the loan balances.
              </p>

              <div className="flex justify-around mb-8">
                <div className="text-center">
                  <div className="h-[5.5rem]"></div>
                  <p className="text-xs mt-1 font-semibold"></p>
                  <div className="border-t-2 border-gray-800 w-56 mb-1"></div>
                  <p className="text-sm font-semibold">Co-Maker</p>
                  <p className="text-xs">(Signature over printed name)</p>
                </div>
                <div className="text-center">
                  <div className="h-16"></div>
                  <p className="text-xs mt-2 font-semibold uppercase">{guarantorFullName}</p>
                  <div className="border-t-2 border-gray-800 w-56 mb-1"></div>
                  <p className="text-sm font-semibold">Guarantor</p>
                  <p className="text-xs">(Signature over printed name)</p>
                </div>
              </div>

              {/* Group Leader Section */}
              <h3 className="text-center font-bold text-lg mb-3">Group Leader's Promissory Note</h3>
              <p className="text-sm text-justify mb-4 leading-relaxed">
                I, <span className="underline">{client.groupLeaderName || '__________________'}</span>, hereby recommend (Ms./Mrs./Mr.) <span className="underline">{client.fullName || loanData.fullName}</span> for loan approval and affirm that I am endorsing this application in good faith. By signing this document, I acknowledge my role in supporting the applicant's compliance with AmberCash PH's policies and repayment obligations.
              </p>

              <div className="text-center mb-8">
                <div className="border-t-2 border-gray-800 w-64 mx-auto mb-1 mt-16"></div>
                <p className="text-sm font-semibold">GL Signature over printed name</p>
              </div>

              {/* Approval Section */}
              <div className="flex justify-between mt-12">
                <div className="text-center">
                  <p className="text-sm font-semibold mb-8">Recommended By:</p>
                  <div className="h-16"></div>
                  <p className="text-xs mt-1 font-semibold">{loanData.loanOfficerName || (loanOfficer.firstName && loanOfficer.lastName ? loanOfficer.firstName + ' ' + loanOfficer.lastName : '')}</p>
                  <div className="border-t-2 border-gray-800 w-48 mb-1"></div>
                  <p className="text-xs">Loan Officer's name and signature</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold mb-8">CI&BI By:</p>
                  <div className="h-16"></div>
                  <p className="text-xs mt-1 font-semibold">{loanData.ciName || client.ciName || ''}</p>
                  <div className="border-t-2 border-gray-800 w-48 mb-1"></div>
                  <p className="text-xs">Branch Manager/Supervisor</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold mb-8">Approved By:</p>
                  <div className="h-16"></div>
                  <p className="text-xs mt-1 font-semibold">{branch.name ? 'BM - ' + branch.name : ''}</p>
                  <div className="border-t-2 border-gray-800 w-48 mb-1"></div>
                  <p className="text-xs">Branch Manager/Area Manager</p>
                </div>
              </div>
            </div>

            {/* Note at bottom */}
            <div className="text-xs italic text-gray-600 mt-6 border-t pt-4">
              <span className="font-semibold">Note:</span> Client/ Borrower's Guarantor should be the husband/wife if married and immediate family member or nearest family member if single, widowed. Qualified Guarantor's must have an existing daily income (work/business).
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .page-break-avoid {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        
        @media print {
          /* Hide everything except printable content */
          .no-print {
            display: none !important;
          }
          
          /* Ensure printable content is visible */
          .printable-content {
            display: block !important;
            visibility: visible !important;
            position: static !important;
            margin: 0 !important;
            padding: 12mm !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          
          /* Page break settings */
          .page-break-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          
          /* Reset any modal/overlay styles for printing */
          body {
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
};

// Helper function to convert number to words
function numberToWords(num) {
  if (num === 0) return "Zero";
  
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  
  function convertHundreds(n) {
    let str = "";
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 10 && n < 20) {
      str += teens[n - 10] + " ";
    } else {
      if (n >= 20) {
        str += tens[Math.floor(n / 10)] + " ";
        n %= 10;
      }
      if (n > 0) {
        str += ones[n] + " ";
      }
    }
    return str.trim();
  }
  
  let result = "";
  if (num >= 1000000) {
    result += convertHundreds(Math.floor(num / 1000000)) + " Million ";
    num %= 1000000;
  }
  if (num >= 1000) {
    result += convertHundreds(Math.floor(num / 1000)) + " Thousand ";
    num %= 1000;
  }
  if (num > 0) {
    result += convertHundreds(num);
  }
  
  return result.trim();
}

export default LAFModal;