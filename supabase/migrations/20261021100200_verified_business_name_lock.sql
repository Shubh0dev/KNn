-- Once a business is verified, its name can only be changed by staff with the
-- businesses.verify permission. Prevents a verified badge being reused for a
-- different business identity. Enforced in the database, not just the form.
create function private.businesses_lock_verified_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.verification_status = 'verified'
     and new.name is distinct from old.name
     and (select auth.uid()) is not null
     and not private.has_permission('businesses.verify')
  then
    raise exception 'The name of a verified business can only be changed by KashiNagri support'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger businesses_lock_verified_name
  before update of name on public.businesses
  for each row execute function private.businesses_lock_verified_name();

revoke all on function private.businesses_lock_verified_name() from public;
