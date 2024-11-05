-- get_all_loans_per_branch_a_loans
select o._id, to_jsonb(o.*) "data" from (
	select 
		l."branchId" _id,
		sum(case
			when l.status != 'pending' and l.status != 'closed' then l.mispayment
			when l.status = 'closed' and l."fullPaymentDate"::date = {{curr_date}} then l.mispayment
			else 0
		end) as mispayment,
		
		sum(case
			when l.status != 'pending' and l.status != 'closed' then l."amountRelease"
			else 0
		end) as "totalRelease",
		
		sum(case
			when l.status != 'pending' and l.status != 'closed' then l."loanBalance"
			else 0
		end) as "totalLoanBalance",
		
		0 as collection,
		0 as excess,
		0 as total,
		sum(coalesce(l."pastDue", 0)) "pastDue",
		sum(
			case
				when l."pastDue" > 0 then 1
				else 0
			end
		) "noPastDue",
		sum(coalesce(l.mcbu, 0)) mcbu,
		sum(coalesce(l."mcbuInterest", 0)) "mcbuInterest",
		coalesce (array_to_json(array_agg(distinct l."loId") filter (WHERE l."loId" is not null))::jsonb, '[]'::jsonb) "loIds",
		sum(
			case 
				when l.status = 'pending' then 0
				when l.occurence = 'weekly' and l."groupDay" = {{day_name}} then
					case
						when l."activeLoan" = 0 and l."fullPaymentDate"::date = {{curr_date}} then coalesce(l.history->>'activeLoan'::text, '0')::numeric
						else l."activeLoan"
					end
				when l.occurence = 'daily' then
					case
						when l."activeLoan" = 0 and l."fullPaymentDate"::date = {{curr_date}} then coalesce(l.history->>'activeLoan'::text, '0')::numeric
						else l."activeLoan"
					end
				else 0
					
			end
			
		) "loanTarget"
		
	from loans l 
	where l."startDate"::date <= {{curr_date}}
	and (
		l.status = 'active'
		or
		l.status = 'completed'
		or (
				
			(l.status = 'closed' and l."fullPaymentDate"::date = {{curr_date}} and l."transferredReleased" is not true)
			or 
			(l.status = 'closed' and l."closedDate"::date = {{curr_date}})
			or
			(l.status = 'closed' and l."transferredDate"::date = {{curr_date}} and l.transferred = true)
		)
	)
	and l."branchId" = {{branch_id}}
	group by 1
) o