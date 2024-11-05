
-- get_all_loans_per_branch_a_cashCollections
select o._id, to_jsonb(o.*) "data" from (
	select 
		cc."branchId" as _id,
		sum(case when cc.mispayment = true then 1 else 0 end) as mispayment,
		sum(case
			when cc.remarks->>'value' = 'delinquent'
				or cc.remarks->>'value' = 'delinquent-mcbu'
				or cc.remarks->>'value' = 'excused advance payment'
				or cc.remarks->>'value' like 'excused-%'
			then coalesce(cc."prevData"->>'activeLoan'::text, '0')::numeric
			else 0
		end) as "loanTarget",
		sum(coalesce (cc."paymentCollection", 0)) as collection,
		sum(coalesce(cc.excess, 0)) as excess,
		sum(coalesce(cc.total, 0)) as total,
		sum(case when cc.remarks->>'value' like 'offset%' then 1 else 0 end) as "offsetPerson",
		sum(coalesce (cc.mcbu, 0)) as mcbu,
		sum(coalesce (cc."mcbuCol", 0)) as "mcbuCol",
		sum(case
				when cc.occurence = 'weekly' and cc."groupDay" = {{day_name}} 
				then
				case
					when cc.remarks->>'value' = 'delinquent'
						or cc.remarks->>'value' = 'delinquent-mcbu'
						or cc.remarks->>'value' like 'excused-%'
						or cc.remarks->>'value' like 'offset%'
					then 0
					else 50
				end
				else 0
		end) as "mcbuTarget",
		sum(coalesce (cc."mcbuWithdrawal", 0)) as "mcbuWithdrawal",
		sum(case when cc.remarks->>'value' like 'offset%' and cc."mcbuReturnAmt" > 0 then 1 else 0 end) as "mcbuReturnNo",
		sum(coalesce (cc."mcbuReturnAmt", 0)) as "mcbuReturnAmt",
		sum(coalesce (cc."mcbuInterest", 0)) as "mcbuInterest",
		sum(case when cc.transfer  = true then 1 else 0 end) as transfer,
		sum(case when cc.transferred  = true then 1 else 0 end) as transferred,
		coalesce (array_to_json(array_agg(distinct cc."groupStatus") FILTER (WHERE cc.status != 'pending' OR (cc.status != 'tomorrow' AND cc."loanCycle" != 1)))::jsonb, '[]'::jsonb) "groupStatusArr",
		coalesce (array_to_json(array_agg(distinct cc.draft) filter (WHERE cc.draft is not null))::jsonb, '[]'::jsonb) "hasDraftsArr"
	from "cashCollections" cc 
	where cc."dateAdded"::date = {{curr_date}} 
	and cc.status != 'pending' 
	and cc.status != 'reject'
	-- and cc.draft = false
	and cc."branchId" = {{branch_id}}
	group by 1
) o