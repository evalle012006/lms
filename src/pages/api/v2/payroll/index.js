import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { findUserById } from "@/lib/graph.functions";
import { createGraphType, queryQl, insertQl, } from "@/lib/graph/graph.util";
import { BRANCH_PAYROLL_FIELDS } from "@/lib/graph.fields";

const graph = new GraphProvider();

const BRANCH_PAYROLL_EMPLOYEE_FIELD_MAP = {
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

async function updateExistingPayroll({
    payrollId,
    preparedEmployees,
    userId,
}) {
    const employeeObjects = preparedEmployees.map((employee) => ({
        ...employee,
        payroll_id: payrollId,
    }));

    const UPDATE_EXISTING_PAYROLL = (i) => ({
        gql: `
            update_branch_payroll(
                where: {
                    id: { _eq: $payrollId_${i} }
                }
                _set: {
                    updated_by: $updatedBy_${i}
                }
            ) {
                affected_rows
            }

            delete_branch_payroll_employees(
                where: {
                    payroll_id: { _eq: $payrollId_${i} }
                }
            ) {
                affected_rows
            }

            insert_branch_payroll_employees(
                objects: $employees_${i}
            ) {
                affected_rows
            }
        `,

        parameters: [
            `$payrollId_${i}: uuid!`,
            `$updatedBy_${i}: String!`,
            `$employees_${i}: [branch_payroll_employees_insert_input!]!`,
        ],

        variables: {
            [`payrollId_${i}`]: payrollId,
            [`updatedBy_${i}`]: userId,
            [`employees_${i}`]: employeeObjects,
        },
    });

    const result = await graph.mutation(
        UPDATE_EXISTING_PAYROLL
    );

    if (result.errors?.length) {
        throw new Error(result.errors[0].message);
    }

    return result;
}

const TEXT_FIELDS = new Set([
    "familyName",
    "firstName",
    "middleName",
    "employeeId",
    "position",
    "dateRegularized",
]);

export default apiHandler({
    get: getPayroll,
    post: savePayroll,
    put: savePayroll,
});

async function authorizePayroll(req) {
    if (!req.auth?.sub) {
        return {
            error: true,
            status: 401,
            message: "Authentication required.",
        };
    }

    const user = await findUserById(req.auth.sub);

    if (!user) {
        return {
            error: true,
            status: 401,
            message: "User not found.",
        };
    }

    const roleRep = Number(user?.role?.rep);
    const roleShortCode = String(
        user?.role?.shortCode || ""
    ).toLowerCase();

    const isAdmin =
        roleRep === 1 ||
        roleShortCode === "admin";

    const isBranchManager =
        roleRep === 3 ||
        roleShortCode === "branch_manager";

    if (!isAdmin && !isBranchManager) {
        return {
            error: true,
            status: 403,
            message: "You do not have permission to manage payroll.",
        };
    }

    let branchId;

    if (isAdmin) {
        branchId =
            req.method === "GET"
                ? req.query.branchId
                : req.body?.branchId;
    } else {
        branchId = user.designatedBranchId;
    }

    if (!branchId) {
        return {
            error: true,
            status: 400,
            message: "Branch is required.",
        };
    }

    return {
        error: false,
        user,
        branchId,
        isAdmin,
        isBranchManager,
    };
}

function validatePeriod(month, year) {
    const m = Number(month);
    const y = Number(year);

    if (
        !Number.isInteger(m) ||
        m < 1 ||
        m > 12 ||
        !Number.isInteger(y) ||
        y < 2000 ||
        y > 2100
    ) {
        return null;
    }

    return {
        month: m,
        year: y,
    };
}

function prepareEmployee(employee, index) {
    const result = {
        row_order: index + 1,
    };

    for (const [frontendKey, databaseKey] of Object.entries(
        BRANCH_PAYROLL_EMPLOYEE_FIELD_MAP
    )) {
        const value = employee[frontendKey];

        if (TEXT_FIELDS.has(frontendKey)) {
            result[databaseKey] =
                value === undefined || value === null || value === ""
                    ? null
                    : String(value).trim();

            continue;
        }

        if (value === "" || value === null || value === undefined) {
            result[databaseKey] = 0;
            continue;
        }

        const number = Number(value);

        if (
            !Number.isFinite(number) ||
            Math.abs(number) > 999999999999.99 ||
            !/^-?\d+(\.\d{1,2})?$/.test(String(value))
        ) {
            throw new Error(`Invalid amount in ${frontendKey}, row ${index + 1}.`);
        }

        result[databaseKey] = number;
    }

    if (
        result.date_regularized &&
        !/^\d{4}-\d{2}-\d{2}$/.test(result.date_regularized)
    ) {
        throw new Error(`Invalid regularization date in row ${index + 1}.`);
    }

    return result;
}

async function getPayroll(req, res) {
    try {
        const auth = await authorizePayroll(req);

        if (auth.error) {
            return res.status(auth.status).json({
                error: true,
                message: auth.message,
            });
        }

        const period = validatePeriod(
            req.query.month,
            req.query.year
        );

        if (!period) {
            return res.status(400).json({
                error: true,
                message: "Invalid payroll month or year.",
            });
        }

        const PAYROLL_TYPE = createGraphType(
            "branch_payroll",
            BRANCH_PAYROLL_FIELDS
        )("branch_payroll");

        const result = await graph.query(
            queryQl(PAYROLL_TYPE, {
                where: {
                    branch_id: {
                        _eq: auth.branchId,
                    },
                    payroll_month: {
                        _eq: period.month,
                    },
                    payroll_year: {
                        _eq: period.year,
                    },
                },
                limit: 1,
            })
        );

        if (result.errors?.length) {
            throw new Error(result.errors[0].message);
        }

        const payroll = result.data?.branch_payroll?.[0] || null;

        return res.status(200).json({
            success: true,
            payroll,
        });
            } catch (error) {
            console.error("========== PAYROLL GET ERROR ==========");
            console.error(error);
            console.error("GraphQL errors:", error?.graphQLErrors);
            console.error("Network error:", error?.networkError);
            console.error("=======================================");

            return res.status(500).json({
                error: true,
                message: "Unable to load payroll.",
            });
        }
}

async function savePayroll(req, res) {
    try {
        const auth = await authorizePayroll(req);

        if (auth.error) {
            return res.status(auth.status).json({
                error: true,
                message: auth.message,
            });
        }

        const period = validatePeriod(
            req.body?.month,
            req.body?.year
        );

        if (!period) {
            return res.status(400).json({
                error: true,
                message: "Invalid payroll month or year.",
            });
        }

        const employees = req.body?.employees;

        if (!Array.isArray(employees) || employees.length === 0) {
            return res.status(400).json({
                error: true,
                message: "At least one employee is required.",
            });
        }

        if (employees.length > 500) {
            return res.status(400).json({
                error: true,
                message: "Too many payroll employees.",
            });
        }

        let preparedEmployees;

        try {
            preparedEmployees = employees.map(prepareEmployee);
        } catch (error) {
            return res.status(400).json({
                error: true,
                message: error.message,
            });
        }

        const PAYROLL_CHECK_TYPE = createGraphType(
            "branch_payroll",
            `
                id
            `
        )("branch_payroll");

        const existingResult = await graph.query(
            queryQl(PAYROLL_CHECK_TYPE, {
                where: {
                    branch_id: {
                        _eq: auth.branchId,
                    },
                    payroll_month: {
                        _eq: period.month,
                    },
                    payroll_year: {
                        _eq: period.year,
                    },
                },
                limit: 1,
            })
        );

        if (existingResult.errors?.length) {
            throw new Error(existingResult.errors[0].message);
        }

        const existingPayroll =
            existingResult.data?.branch_payroll?.[0] || null;

        if (existingPayroll) {
            await updateExistingPayroll({
                payrollId: existingPayroll.id,
                preparedEmployees,
                userId: auth.user._id,
            });

            return res.status(200).json({
                success: true,
                message: "Payroll updated successfully.",
                payroll: {
                    id: existingPayroll.id,
                    branch_id: auth.branchId,
                    payroll_month: period.month,
                    payroll_year: period.year,
                },
            });
        }

        const PAYROLL_INSERT_TYPE = createGraphType(
            "branch_payroll",
            `
                id
                branch_id
                payroll_month
                payroll_year
            `
        )("payroll_insert_result");

        const object = {
            branch_id: auth.branchId,
            payroll_month: period.month,
            payroll_year: period.year,
            created_by: auth.user._id,
            updated_by: auth.user._id,

            branch_payroll_employees: {
                data: preparedEmployees,
            },
        };

        const result = await graph.mutation(
            insertQl(PAYROLL_INSERT_TYPE, {
                objects: [object],
            })
        );

        if (result.errors?.length) {
            throw new Error(result.errors[0].message);
        }

        return res.status(200).json({
            success: true,
            message: "Payroll saved successfully.",
            payroll: result.data?.payroll_insert_result?.returning?.[0] || null,
        });
    } catch (error) {
        console.error("Payroll SAVE error:", error);

        if (
            error.message?.includes("branch_payroll_unique_month") ||
            error.message?.includes("Uniqueness violation")
        ) {
            return res.status(409).json({
                error: true,
                message:
                    "Payroll already exists for this branch and month.",
            });
        }

        console.error("========== PAYROLL SAVE ERROR ==========");
        console.error("Message:", error?.message);
        console.error("GraphQL errors:", error?.graphQLErrors);
        console.error("Network error:", error?.networkError);
        console.error("========================================");

        return res.status(500).json({
            error: true,
            message:
                process.env.NODE_ENV === "production"
                    ? "Unable to save payroll. Please contact the administrator."
                    : error?.graphQLErrors?.[0]?.message ||
                    error?.message ||
                    "Unable to save payroll.",
        });
    }
}