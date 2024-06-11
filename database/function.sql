CREATE FUNCTION cashcollection_mispayment_int(c_row "cashCollections")
RETURNS INT AS $$
  SELECT c_row.mispayment::int
$$ LANGUAGE sql STABLE;


CREATE FUNCTION cashcollection_net_loan_balance(c_row "cashCollections")
RETURNS INT AS $$
  SELECT COALESCE(c_row."loanBalance"::int, 0) - COALESCE(c_row."mcbu"::int, 0)
$$ LANGUAGE sql STABLE;