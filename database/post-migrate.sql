update loans
set "activeLoan" = (
  case when occurence = 'weekly' then
         ("principalLoan" * 1.20) / 24
       when occurence = 'daily'
         then
         case when "loanTerms" = 60 then
                ("principalLoan" * 1.20) / 60
              else
                ("principalLoan" * 1.20) / 100
           end
    end
  )
where "activeLoan" is null or "activeLoan" = 0 and status = 'active';