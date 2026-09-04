import { createClient } from 'npm:@supabase/supabase-js@2.57.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const roles = new Set(['dean','academic_director','chair','program_lead','instructor','research_lead','graduate_supervisor']);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
    const secretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
    const authorization = request.headers.get('Authorization');
    if (!url || !publishableKey || !secretKey || !authorization) return json({ error: 'Unauthorized' }, 401);

    const callerClient = createClient(url, publishableKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);
    const { data: caller } = await admin.from('profiles').select('role,is_active').eq('id', user.id).single();
    if (!caller?.is_active || caller.role !== 'dean') return json({ error: 'Dean access required' }, 403);

    const body = await request.json();
    if (!['invite','update-access','activate','deactivate'].includes(body.action)) return json({ error: 'Unsupported action' }, 400);
    if (body.role && !roles.has(body.role)) return json({ error: 'Invalid role' }, 400);

    let targetId = body.userId as string | undefined;
    let unitId: string | null = null;
    if (body.organizationUnit) {
      const { data: unit } = await admin.from('organization_units').select('id').eq('name', body.organizationUnit).single();
      if (!unit) return json({ error: 'Unknown organizational unit' }, 400);
      unitId = unit.id;
    }

    if (body.action === 'invite') {
      if (!body.email || !body.fullName || !body.role) return json({ error: 'email, fullName, and role are required' }, 400);
      const { data, error } = await admin.auth.admin.inviteUserByEmail(body.email, { data: { full_name: body.fullName }, redirectTo: body.redirectTo });
      if (error) return json({ error: error.message }, 400);
      targetId = data.user.id;
      const { error: profileError } = await admin.from('profiles').update({ full_name: body.fullName, email: body.email, role: body.role, organization_unit_id: unitId, is_active: true }).eq('id', targetId);
      if (profileError) return json({ error: profileError.message }, 500);
    } else if (body.action === 'update-access') {
      if (!targetId || !body.role) return json({ error: 'userId and role are required' }, 400);
      const { error } = await admin.from('profiles').update({ role: body.role, organization_unit_id: unitId }).eq('id', targetId);
      if (error) return json({ error: error.message }, 500);
    } else {
      if (!targetId) return json({ error: 'userId is required' }, 400);
      if (targetId === user.id && body.action === 'deactivate') return json({ error: 'You cannot deactivate your own account' }, 400);
      const { error } = await admin.from('profiles').update({ is_active: body.action === 'activate' }).eq('id', targetId);
      if (error) return json({ error: error.message }, 500);
    }

    await admin.from('audit_events').insert({ actor_id: user.id, action: `user.${body.action}`, entity_type: 'profile', entity_id: targetId, details: { role: body.role ?? null, organization_unit_id: unitId } });
    return json({ ok: true, userId: targetId });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
