-- Security advisor fixes: SECURITY DEFINER functions should not be callable
-- through the public RPC API.
-- handle_new_user only runs from the auth trigger — nobody needs EXECUTE.
-- is_admin keeps EXECUTE for authenticated because RLS policies evaluate it
-- as the querying role (it only returns the caller's own flag).

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
