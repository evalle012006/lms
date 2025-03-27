import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { queryQl } from "@/lib/graph/graph.util";
import { 
  createMcbuWithdrawalsTypes, 
  adminFields,
  divisionFields,
  regionFields,
  areaFields,
  branchFields,
  loanOfficerFields,
  groupFields,
  toMcbuWithdrawalDto 
} from "./common";

const graph = new GraphProvider();

export default apiHandler({
  get: list,
});

async function list(req, res) {
    const { 
        admin = null,
        division_id = null, 
        region_id = null, 
        area_id = null, 
        branch_id = null, 
        lo_id = null, 
        group_id = null, 
        dateFilter 
    } = req.query;
    
    let filter = {};
    let fieldsToUse = adminFields; // Default to admin fields

    // Build filter by combining all provided parameters
    if (division_id) {
        filter.division_id = { _eq: division_id };
        fieldsToUse = divisionFields;
    }
    
    if (region_id) {
        filter.region_id = { _eq: region_id };
        fieldsToUse = regionFields;
    }
    
    if (area_id) {
        filter.area_id = { _eq: area_id };
        fieldsToUse = areaFields;
    }
    
    if (branch_id) {
        filter.branch_id = { _eq: branch_id };
        fieldsToUse = branchFields;
    }
    
    if (lo_id) {
        filter.lo_id = { _eq: lo_id };
        fieldsToUse = loanOfficerFields;
    }
    
    if (group_id) {
        filter.group_id = { _eq: group_id };
        fieldsToUse = groupFields;
    }

    // Add date filter if provided
    if (dateFilter) {
        const [from_dt, to_dt] = dateFilter.split(',');
        filter.inserted_date = {
            _gte: from_dt,
            _lte: to_dt,
        };
    }

    let graphRes;
    
    // For admin level without filter or date filter
    if (admin && Object.keys(filter).length === 0) {
        // Admin query without filters
        graphRes = await graph.query(
            queryQl(createMcbuWithdrawalsTypes(fieldsToUse))
        );
    } else {
        // Query with filters
        graphRes = await graph.query(
            queryQl(createMcbuWithdrawalsTypes(fieldsToUse), {
                where: filter,
            })
        );
    }

    res.send({
        success: true,
        data: graphRes?.data?.mcbu_withdrawals?.map(toMcbuWithdrawalDto) ?? [],
    });
}