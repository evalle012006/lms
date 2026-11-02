import React, { useEffect, useMemo, useState } from "react";
import { fetchWrapper } from "@/lib/fetch-wrapper";

const createEmptyEmployee = () => ({
  id: `${Date.now()}-${Math.random()}`,

  familyName: "",
  firstName: "",
  middleName: "",
  employeeId: "",
  position: "",
  dateRegularized: "",

  basicSalary: "",
  ecola: "",

  employerHDMF: "",
  employerSSS: "",
  employerPH: "",

  employeeHDMF: "",
  employeeSSS: "",
  employeePH: "",

  withholdingTax: "",
  utilityCharge: "",
  cbu: "",
  cashBond: "",
  salaryAdvance: "",
  specialAdvance: "",
  cashAdvance: "",
  otherReceivables: "",
  pagibigMPL: "",
  sssLoan: "",
  staffAccountsPayable: "",
});

const PAYROLL_FIELD_MAP = {
    familyName: "family_name",
    firstName: "first_name",
    middleName: "middle_name",
    employeeId: "employee_id",
    position: "position",
    dateRegularized: "date_regularized",

    basicSalary: "basic_salary",
    ecola: "ecola",

    employerHDMF: "employer_hdmf",
    employerSSS: "employer_sss",
    employerPH: "employer_ph",

    employeeHDMF: "employee_hdmf",
    employeeSSS: "employee_sss",
    employeePH: "employee_ph",

    withholdingTax: "withholding_tax",
    utilityCharge: "utility_charge",
    cbu: "cbu",
    cashBond: "cash_bond",

    salaryAdvance: "salary_advance",
    specialAdvance: "special_advance",
    cashAdvance: "cash_advance",
    otherReceivables: "other_receivables",

    pagibigMPL: "pagibig_mpl",
    sssLoan: "sss_loan",
    staffAccountsPayable: "staff_accounts_payable",
};

const mapPayrollEmployee = (record) => {
    const employee = createEmptyEmployee();

    employee.id = record.id || employee.id;

    Object.entries(PAYROLL_FIELD_MAP).forEach(
        ([frontendKey, databaseKey]) => {
            employee[frontendKey] =
                record[databaseKey] ?? "";
        }
    );

    return employee;
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const calculateEmployee = (employee) => {
  const totalCompensation =
    toNumber(employee.basicSalary) +
    toNumber(employee.ecola);

  const totalER =
    toNumber(employee.employerHDMF) +
    toNumber(employee.employerSSS) +
    toNumber(employee.employerPH);

  const totalEE =
    toNumber(employee.employeeHDMF) +
    toNumber(employee.employeeSSS) +
    toNumber(employee.employeePH);

  const otherDeductions =
    toNumber(employee.withholdingTax) +
    toNumber(employee.utilityCharge) +
    toNumber(employee.cbu) +
    toNumber(employee.cashBond) +
    toNumber(employee.salaryAdvance) +
    toNumber(employee.specialAdvance) +
    toNumber(employee.cashAdvance) +
    toNumber(employee.otherReceivables) +
    toNumber(employee.pagibigMPL) +
    toNumber(employee.sssLoan) +
    toNumber(employee.staffAccountsPayable);

  const totalDeduction = totalEE + otherDeductions;
  const totalNetPay = totalCompensation - totalDeduction;
  const payment10th = Math.round(totalNetPay * 50) / 100;

  const payment25th =
    Math.round(totalNetPay * 100) / 100 - payment10th;

  return {
    totalCompensation,
    totalER,
    totalEE,
    totalDeduction,
    totalNetPay,
    payment10th,
    payment25th,
  };
};

const money = (value) =>
  toNumber(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const staffColumns = [
  { key: "familyName", label: "Family Name", type: "text" },
  { key: "firstName", label: "First Given Name", type: "text" },
  { key: "middleName", label: "Middle Name", type: "text" },
  { key: "employeeId", label: "ID #", type: "text" },
  { key: "position", label: "Position", type: "text" },
  { key: "dateRegularized", label: "Date Regularized", type: "date" },
];

const compensationColumns = [
  { key: "basicSalary", label: "Basic Salary" },
  { key: "ecola", label: "ECOLA" },
  { key: "totalCompensation", label: "Total Compensation", computed: true },
];

const employerColumns = [
  { key: "employerHDMF", label: "HDMF" },
  { key: "employerSSS", label: "SSS" },
  { key: "employerPH", label: "PH" },
  { key: "totalER", label: "Total ER", computed: true },
];

const employeeColumns = [
  { key: "employeeHDMF", label: "HDMF" },
  { key: "employeeSSS", label: "SSS" },
  { key: "employeePH", label: "PH" },
  { key: "totalEE", label: "Total EE", computed: true },
];

const deductionColumns = [
  { key: "withholdingTax", label: "Withholding Tax" },
  { key: "utilityCharge", label: "Utility Charge (EE)" },
  { key: "cbu", label: "CBU" },
  { key: "cashBond", label: "Cash Bond" },
  { key: "salaryAdvance", label: "Salary Advance" },
  { key: "specialAdvance", label: "Special Advance" },
  { key: "cashAdvance", label: "Cash Advance" },
  { key: "otherReceivables", label: "Other Receivables" },
  { key: "pagibigMPL", label: "Pag-ibig MPL" },
  { key: "sssLoan", label: "SSS Loan" },
  { key: "staffAccountsPayable", label: "Staff Accounts Payable" },
];

const summaryColumns = [
  {
    key: "totalDeduction",
    label: "Total Deductions",
    computed: true,
  },
  {
    key: "totalNetPay",
    label: "Total Net Pay for the Month",
    computed: true,
  },
  {
    key: "payment10th",
    label: "Every 10th Day of the Month",
    computed: true,
  },
  {
    key: "payment25th",
    label: "Every 25th Day of the Month",
    computed: true,
  },
];

const numericColumns = [
  ...compensationColumns,
  ...employerColumns,
  ...employeeColumns,
  ...deductionColumns,
  ...summaryColumns,
];

const Payroll = ({
    branchId,
    branchName,
    currentUser,
    selectedDate,
}) => {
  const [employees, setEmployees] = useState([
    createEmptyEmployee(),
  ]);

  const [payrollMonth, setPayrollMonth] = useState(
    new Date().getMonth() + 1
  );

  const [payrollYear, setPayrollYear] = useState(
    new Date().getFullYear()
  );

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [payrollExists, setPayrollExists] = useState(false);
  const [payrollLoaded, setPayrollLoaded] = useState(false);

    useEffect(() => {
      if (!branchId || !payrollMonth || !payrollYear) {
          return;
      }

      let cancelled = false;

      const loadPayroll = async () => {
          setLoading(true);
          setPayrollLoaded(false);
          setError("");
          setMessage("");

          try {
              const params = new URLSearchParams({
                  branchId: String(branchId),
                  month: String(payrollMonth),
                  year: String(payrollYear),
              });

              const result = await fetchWrapper.get(
                  `/api/v2/payroll?${params.toString()}`
              );

              if (result?.error) {
                  throw new Error(
                      result.message || "Unable to load payroll."
                  );
              }

              if (cancelled) return;

              if (result.payroll) {
                const records =
                    result.payroll.branch_payroll_employees || [];

                setEmployees(
                    records.length
                        ? records.map(mapPayrollEmployee)
                        : [createEmptyEmployee()]
                );

                setPayrollExists(true);
            } else {
                setEmployees([createEmptyEmployee()]);
                setPayrollExists(false);
            }

            setPayrollLoaded(true);
          } catch (err) {
              if (!cancelled) {
                  setError(
                      typeof err === "string"
                          ? err
                          : err?.message || "Something went wrong."
                  );
                  setPayrollExists(false);
              }
          } finally {
              if (!cancelled) {
                  setLoading(false);
              }
          }
      };

      loadPayroll();

      return () => {
          cancelled = true;
      };
  }, [branchId, payrollMonth, payrollYear]);

  const handleSavePayroll = async () => {
    if (!branchId) {
        setError("Please select a branch.");
        return;
    }

    if (loading || saving || !payrollLoaded) {
        setError("Please wait until payroll loads successfully.");
        return;
    }

    const hasBlankEmployee = employees.some((employee) => {
        return (
            !String(employee.familyName || "").trim() ||
            !String(employee.firstName || "").trim()
        );
    });

    if (hasBlankEmployee) {
        setError(
            "Please enter the Family Name and First Given Name for every employee."
        );
        return;
    }

    if (payrollExists) {
        setError(
            "Updating existing payroll is not enabled in the backend yet."
        );
        return;
    }

    if (
        !window.confirm(
            `Save payroll for ${branchName || "selected branch"}?`
        )
    ) {
        return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
        const result = await fetchWrapper.post("/api/v2/payroll", {
            branchId,
            month: Number(payrollMonth),
            year: Number(payrollYear),
            employees: employees.map((employee) => {
                const { id, ...fields } = employee;
                return fields;
            }),
        });

        if (result?.error) {
            throw new Error(
                result.message || "Unable to save payroll."
            );
        }

        setPayrollExists(true);
        setMessage("Payroll saved successfully.");
    } catch (err) {
        setError(
            typeof err === "string"
                ? err
                : err?.message || "Something went wrong."
        );
    } finally {
        setSaving(false);
    }
};

  

  const updateEmployee = (id, field, value) => {
    setEmployees((previous) =>
      previous.map((employee) =>
        employee.id === id
          ? { ...employee, [field]: value }
          : employee
      )
    );
  };

  const addEmployee = () => {
    setEmployees((previous) => [
      ...previous,
      createEmptyEmployee(),
    ]);
  };

  const removeEmployee = (id) => {
    if (!window.confirm("Remove this payroll row?")) {
      return;
    }

    setEmployees((previous) =>
      previous.filter((employee) => employee.id !== id)
    );
  };

  const calculatedEmployees = useMemo(
    () =>
      employees.map((employee) => ({
        ...employee,
        ...calculateEmployee(employee),
      })),
    [employees]
  );

  const totals = useMemo(() => {
    const result = {};

    numericColumns.forEach((column) => {
      result[column.key] = calculatedEmployees.reduce(
        (sum, employee) =>
          sum + toNumber(employee[column.key]),
        0
      );
    });

    return result;
  }, [calculatedEmployees]);

  const renderInput = (employee, column) => {
    if (column.computed) {
      return (
        <div className="px-2 py-2 text-right font-semibold">
          {money(employee[column.key])}
        </div>
      );
    }

    return (
      <input
        type={column.type || "number"}
        step={column.type ? undefined : "0.01"}
        value={employee[column.key] ?? ""}
        onChange={(event) =>
          updateEmployee(
            employee.id,
            column.key,
            event.target.value
          )
        }
        className="w-full min-w-[110px] bg-transparent px-2 py-2 text-sm outline-none focus:bg-yellow-50"
      />
    );
  };

  const renderCells = (employee, columns) =>
    columns.map((column) => (
      <td
        key={column.key}
        className={`border border-gray-300 ${
          column.computed
            ? "bg-gray-100"
            : "bg-blue-50"
        }`}
      >
        {renderInput(employee, column)}
      </td>
    ));

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div>
            <h2 className="text-lg font-bold">
                Payroll — Salaries and Wages
            </h2>

            <p className="mt-1 text-sm text-gray-600">
                Branch:{" "}
                <span className="font-semibold text-gray-800">
                    {branchName || "No Assigned Branch"}
                </span>
            </p>
        </div>

          <p className="text-sm text-gray-500">
            Manual payroll entry with automatic calculations
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
              type="button"
              onClick={addEmployee}
              disabled={
                  loading ||
                  saving ||
                  payrollExists ||
                  !branchId ||
                  !payrollLoaded
              }
              className={`rounded px-4 py-2 text-sm text-white ${
                  loading || saving || payrollExists || !branchId || !payrollLoaded
                      ? "cursor-not-allowed bg-gray-400"
                      : "bg-blue-600 hover:bg-blue-700"
              }`}
          >
              + Add Staff
          </button>

          <button
            type="button"
            onClick={handleSavePayroll}
            disabled={
                loading ||
                saving ||
                payrollExists ||
                !branchId ||
                !payrollLoaded
            }
            className={`rounded px-4 py-2 text-sm text-white ${
                loading || saving || payrollExists || !branchId || !payrollLoaded
                    ? "cursor-not-allowed bg-gray-400"
                    : "bg-green-600 hover:bg-green-700"
            }`}
        >
            {saving
                ? "Saving..."
                : loading
                ? "Loading..."
                : payrollExists
                ? "Payroll Already Saved"
                : "Save Payroll"}
        </button>
        </div>
      </div>

        {message && (
            <div className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
                {message}
            </div>
        )}

        {error && (
            <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                {error}
            </div>
        )}

      <div className="mb-4 flex flex-wrap gap-4 rounded border bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-semibold">
            Payroll Month
          </label>

          <select
            value={payrollMonth}
            onChange={(event) =>
              setPayrollMonth(Number(event.target.value))
            }
            className="rounded border px-3 py-2 text-sm"
          >
            {Array.from({ length: 12 }, (_, index) => (
              <option key={index + 1} value={index + 1}>
                {new Date(2026, index, 1).toLocaleString(
                  "en-US",
                  { month: "long" }
                )}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold">
            Payroll Year
          </label>

          <input
            type="number"
            value={payrollYear}
            onChange={(event) =>
              setPayrollYear(event.target.value)
            }
            className="w-28 rounded border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <fieldset disabled={loading || saving || payrollExists}>
      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-max min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-white">
              <th
                colSpan={35}
                className="border border-gray-300 py-4 text-center text-xl font-bold"
              >
                AmberCash PH Micro Lending Corp.
                <div className="mt-1 text-sm font-semibold">
                  SALARIES AND WAGES
                </div>
              </th>
            </tr>

            <tr className="bg-gray-200 text-center">
              <th rowSpan={2} className="border px-2">
                SL#
              </th>

              <th colSpan={staffColumns.length} className="border py-2">
                STAFF INFORMATION
              </th>

              <th colSpan={compensationColumns.length} className="border">
                COMPENSATION
              </th>

              <th colSpan={employerColumns.length} className="border">
                EMPLOYER'S CONTRIBUTION
              </th>

              <th colSpan={employeeColumns.length} className="border">
                EMPLOYEE'S CONTRIBUTION
              </th>

              <th colSpan={deductionColumns.length} className="border">
                OTHER STAFF ADVANCES AND DEDUCTIONS
              </th>

              <th colSpan={summaryColumns.length} className="border">
                PAYROLL SUMMARY
              </th>

              <th rowSpan={2} className="border px-3">
                SIGNATURE
              </th>

              <th rowSpan={2} className="border px-3">
                ACTION
              </th>
            </tr>

            <tr className="bg-gray-100">
              {[
                ...staffColumns,
                ...compensationColumns,
                ...employerColumns,
                ...employeeColumns,
                ...deductionColumns,
                ...summaryColumns,
              ].map((column) => (
                <th
                  key={column.key}
                  className="min-w-[110px] border border-gray-300 px-2 py-3 text-center"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {calculatedEmployees.map((employee, index) => (
              <tr key={employee.id}>
                <td className="border px-3 text-center">
                  {index + 1}
                </td>

                {renderCells(employee, staffColumns)}
                {renderCells(employee, compensationColumns)}
                {renderCells(employee, employerColumns)}
                {renderCells(employee, employeeColumns)}
                {renderCells(employee, deductionColumns)}
                {renderCells(employee, summaryColumns)}

                <td className="min-w-[150px] border border-gray-300 bg-white px-3"></td>
                <td className="border px-2 text-center">
                  <button
                    type="button"
                    onClick={() => removeEmployee(employee.id)}
                    className="rounded bg-red-500 px-3 py-1 text-white hover:bg-red-600"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="bg-orange-100 font-bold">
              <td
                colSpan={staffColumns.length + 1}
                className="border px-3 py-3 text-center"
              >
                TOTAL
              </td>

              {numericColumns.map((column) => (
                <td
                  key={column.key}
                  className="border px-2 py-3 text-right text-red-600"
                >
                  {money(totals[column.key])}
                </td>
              ))}

              <td className="border" />
              <td className="border" />
            </tr>
          </tfoot>
        </table>
      </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap gap-2"></div>

      <p className="mt-3 text-xs text-gray-500">
          Payroll records are loaded from and saved to the LMS database.
          Existing payroll records are currently read-only until
          the update functionality is completed.
      </p>
    </div>
  );
};

export default Payroll;