const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function run() {
  const isDryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const password = process.env.QA_USER_PASSWORD;
  const allowSeed = process.env.ALLOW_LOCAL_QA_USER_SEED;

  // 1. Env validation
  if (!url || !key || !password || !allowSeed) {
    console.error('ERROR: Missing required environment variables.');
    console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, QA_USER_PASSWORD, ALLOW_LOCAL_QA_USER_SEED');
    process.exit(1);
  }

  if (allowSeed !== 'YES_I_UNDERSTAND_LOCAL_ONLY') {
    console.error('ERROR: ALLOW_LOCAL_QA_USER_SEED must be exactly "YES_I_UNDERSTAND_LOCAL_ONLY"');
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: NODE_ENV is set to production. Aborting.');
    process.exit(1);
  }

  // 2. URL safety validation
  const lowerUrl = url.toLowerCase();
  const isLocalhost = lowerUrl.startsWith('http://127.0.0.1') || lowerUrl.startsWith('http://localhost');
  if (!isLocalhost || lowerUrl.includes('.supabase.co')) {
    console.error(`ERROR: SUPABASE_URL (${url}) appears to be non-local or production. Only loopback http URLs are allowed.`);
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';

  const personas = [
    {
      email: 'qa.admin.a@example.local',
      firstName: 'QA Admin',
      lastName: 'A',
      memberships: [{ tenantId: tenantA, role: 'clinic_admin' }]
    },
    {
      email: 'qa.doctor.a@example.local',
      firstName: 'QA Doctor',
      lastName: 'A',
      memberships: [{ tenantId: tenantA, role: 'doctor' }]
    },
    {
      email: 'qa.admin.b@example.local',
      firstName: 'QA Admin',
      lastName: 'B',
      memberships: [{ tenantId: tenantB, role: 'clinic_admin' }]
    },
    {
      email: 'qa.notenant@example.local',
      firstName: 'QA NoTenant',
      lastName: 'User',
      memberships: []
    },
    {
      email: 'qa.multitenant@example.local',
      firstName: 'QA Multi',
      lastName: 'Tenant',
      memberships: [
        { tenantId: tenantA, role: 'clinic_admin' },
        { tenantId: tenantB, role: 'doctor' }
      ]
    }
  ];

  if (isDryRun) {
    console.log('--- DRY RUN MODE ---');
    console.log('Environment is valid and local.');
    console.log(`Will process ${personas.length} personas:`);
    for (const p of personas) {
      console.log(`- ${p.email}: ${p.memberships.length} memberships`);
    }
    console.log('Exiting dry run.');
    process.exit(0);
  }

  console.log('Starting local QA user fixture creation...');

  let createdCount = 0;
  let reusedCount = 0;
  let profilesUpserted = 0;
  let tenantUsersInserted = 0;

  for (const persona of personas) {
    console.log(`Processing ${persona.email}...`);
    
    // Auth user creation or reuse
    let userId;
    const { data: existingUserResp, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) {
      console.error('  Failed to list users:', listErr.message);
      process.exit(1);
    }
    const existing = existingUserResp.users.find(u => u.email === persona.email);

    if (existing) {
      console.log('  Reusing existing auth user...');
      userId = existing.id;
      reusedCount++;
      // Admin API doesn't have an easy "ensure confirmed" update without re-sending invite if it was already confirmed,
      // but listUsers includes confirmation status. We will just ensure password works by updating it.
      await supabase.auth.admin.updateUserById(userId, { password, email_confirm: true });
    } else {
      console.log('  Creating new auth user...');
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: persona.email,
        password: password,
        email_confirm: true
      });
      if (createErr) {
        console.error('  Failed to create user:', createErr.message);
        continue;
      }
      userId = newUser.user.id;
      createdCount++;
    }

    // Upsert Profile
    console.log('  Upserting profile...');
    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        first_name: persona.firstName,
        last_name: persona.lastName
      });
    
    if (profileErr) {
      console.error('  Failed to upsert profile:', profileErr.message);
      continue;
    }
    profilesUpserted++;

    // Tenant Memberships
    console.log('  Resetting tenant memberships...');
    await supabase.from('tenant_users').delete().eq('user_id', userId);

    if (persona.memberships.length > 0) {
      console.log(`  Inserting ${persona.memberships.length} memberships...`);
      const inserts = persona.memberships.map(m => ({
        user_id: userId,
        tenant_id: m.tenantId,
        role: m.role
      }));
      const { error: tenantErr } = await supabase.from('tenant_users').insert(inserts);
      if (tenantErr) {
        console.error('  Failed to insert tenant_users:', tenantErr.message);
      } else {
        tenantUsersInserted += inserts.length;
      }
    } else {
      console.log('  No tenant memberships required.');
    }
  }

  console.log('\n--- QA USER FIXTURE SUMMARY ---');
  console.log(`Users created:          ${createdCount}`);
  console.log(`Users reused:           ${reusedCount}`);
  console.log(`Profiles upserted:      ${profilesUpserted}`);
  console.log(`Tenant uses inserted:   ${tenantUsersInserted}`);
  console.log('\nMemberships:');
  console.log('qa.admin.a@example.local       => Demo Clinic A / clinic_admin');
  console.log('qa.doctor.a@example.local      => Demo Clinic A / doctor');
  console.log('qa.admin.b@example.local       => Demo Clinic B / clinic_admin');
  console.log('qa.notenant@example.local      => no tenant');
  console.log('qa.multitenant@example.local   => Demo Clinic A / clinic_admin + Demo Clinic B / doctor');
  console.log('------------------------------');
}

run().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
