-- get_all_loans_per_branch_a_fullPayment
select o._id, to_jsonb(o.*) "data" from (
	select 
		l."branchId" _id,
		sum(coalesce(l.history->>'amountRelease', '0')::numeric) "fullPaymentAmount",
		count(l._id) "noOfFullPayment",
		sum(case when l."loanCycle" = 1 then 1 else 0 end) "newFullPayment",
		sum(case when l."loanCycle" > 1 then 1 else 0 end) "reFullPayment"
	from loans l 
	where 
		(
			(l.status = 'completed' or l.status = 'closed')
			and 
			l."loanBalance" <= 0
			and
			l."fullPaymentDate"::date = {{curr_date}}
		)
	and l."branchId" = {{branch_id}}
	group by 1
) o