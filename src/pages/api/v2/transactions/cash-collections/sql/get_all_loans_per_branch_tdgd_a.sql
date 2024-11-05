-- get_all_loans_per_branch_a_tdgd
select o._id, to_jsonb(o.*) "data" from (
	select cc.*, jsonb_agg(o.*) "data" from public."cashCollections" cc
	left join lateral (
		select 
			cd."branchId",
			sum(coalesce (cd."pastDue", 0)) "pastDue",
			sum(case when coalesce (cd."pastDue", 0) > 0 then 1 else 0 end) "noPastDue",
			coalesce(jsonb_agg(cd."amountRelease")->>-1, '0')::numeric "amountRelease",
			coalesce(jsonb_agg(cd."loanBalance")->>-1, '0')::numeric "loanBalance",
			coalesce(jsonb_agg(cd."amountRelease")->>-1, '0')::numeric - coalesce(jsonb_agg(cd."loanBalance")->>-1, '0')::numeric "actualCollection"
		from public."cashCollections" cd 
		where cd."oldLoanId" = cc."loanId"
		group by 1
	) o ON true
	where cc."branchId" = {{branch_id}}
	and cc.transferred = true
	and cc.occurence = 'daily'
	and cc."dateAdded"::date = {{curr_date}}
	group by cc._id
) o