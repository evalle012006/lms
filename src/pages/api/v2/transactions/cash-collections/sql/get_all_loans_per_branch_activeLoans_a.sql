-- get_all_loans_per_branch_activeLoans_a
select o._id, to_jsonb(o.*) "data" from (
	select 
	l."branchId" as _id,
	sum(
		case
			when l.status != 'pending' and l.status != 'closed' then 1
			when l.status = 'pending' and l."loanCycle" > 1 and l."advanceTransaction" is not true then 1
			else 0
		end
	) "activeClients",
	
	sum(
		case 
			when l.status = 'active' then 1
			else 0
		end
	) "activeBorrowers",
	
	sum(
		case 
			when l.status = 'completed' and l.transferred is not true then 1
			else 0
		end
	) "pendingClients"
	
	from loans l 
	where l.status != 'reject'
	and (
		( l.status = 'closed' and l."fullPaymentDate"::date = {{curr_date}} and l."transferredReleased" is not true )
		or
		( l.status = 'closed' and l."closedDate"::date = {{curr_date}})
		or
		( l.status = 'closed' and l.transferred = true and l."transferredDate"::date = {{curr_date}})
		or
		( l.status in ('active', 'pending', 'completed'))
	)
	and l."branchId" = {{branch_id}}
	group by 1
) o