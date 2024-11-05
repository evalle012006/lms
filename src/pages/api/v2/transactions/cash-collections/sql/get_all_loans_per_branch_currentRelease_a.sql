-- get_all_loans_per_branch_a_currentRelease
select o._id, to_jsonb(o.*) "data" from (
		select 
			l."branchId" _id,
			sum(case  when l.transfer is not true then l."amountRelease" else 0 end ) "currentReleaseAmount",
			sum(case  when l.transfer is not true then 1 else 0 end ) "noOfCurrentRelease",
			sum(case  when l."loanCycle" = 1 then 1 else 0 end ) "newCurrentRelease",
			sum(case  when l."loanCycle" > 1 then 1 else 0 end ) "reCurrentRelease"
		from loans l 
		where l."dateGranted"::date = {{curr_date}}
		and l.status = 'active'
		and l."branchId" = {{branch_id}}
		group by 1
) o