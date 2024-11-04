-- get_all_loans_per_branch_a
select o._id, to_jsonb(o.*) "data" from (
	select 
		b.*, 
		coalesce(jsonb_agg(bc.*) FILTER (WHERE bc._id IS NOT NULL), '[]' ) as "cashOnHand"
	from branches b 
	left join lateral (
    	select bc.* from public."branchCOH" bc
    	where bc."branchId" = {{branch_id}} and bc."dateAdded"::date = {{curr_date}}
    ) bc on true
	group by b._id
) o