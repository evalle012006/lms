create function public.cashcollection_mispayment_int(c_row "cashCollections") returns integer
  stable
  language sql
as
$$
SELECT c_row.mispayment::int
$$;

create function public.cashcollection_net_loan_balance(c_row "cashCollections") returns integer
  stable
  language sql
as
$$
SELECT COALESCE(c_row."loanBalance"::int, 0) - COALESCE(c_row."mcbu"::int, 0)
$$;

create function public.to_timestamptz_or_null(v_input text) returns timestamp with time zone
  language plpgsql
as
$$
declare v_timestamp timestamptz default null;
begin
  begin
    v_timestamp := v_input::timestamptz;
  exception when others then
    raise notice 'Invalid timestamptz value: "%".  Returning NULL.', v_input;
    return null;
  end;
  return v_timestamp;
end;
$$;

create function public.to_numeric_or_null(v_input text) returns numeric
  language plpgsql
as
$$
declare v_numeric numeric default null;
begin
  begin
    v_numeric := v_input::numeric;
  exception when others then
    raise notice 'Invalid numeric value: "%".  Returning NULL.', v_input;
    return null;
  end;
  return v_numeric;
end;
$$;

create function public.to_jsonb_or_null(v_input text) returns jsonb
  language plpgsql
as
$$
declare v_jsonb jsonb default null;
begin
  begin
    v_jsonb := v_input::jsonb;
  exception when others then
    raise notice 'Invalid jsonb value: "%".  Returning NULL.', v_input;
    return null;
  end;
  return v_jsonb;
end;
$$;

create function public.cashcollection_remarks_value(c_row "cashCollections") returns character varying
  stable
  language sql
as
$$
SELECT c_row.remarks->>'value'
$$;

alter function public.cashcollection_remarks_value("cashCollections") owner to postgres;

create function public.to_timetz_or_null(v_input text) returns timetz
  language plpgsql
as
$$
declare v_time timetz default null;
begin
  begin
    v_time := v_input::timetz;
  exception when others then
    raise notice 'Invalid timetz value: "%".  Returning NULL.', v_input;
    return null;
  end;
  return v_time;
end;
$$;
