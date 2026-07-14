const { createClient } = require('@supabase/supabase-js');

const LOCAL_ONLY_CONFIRMATION = 'YES_I_UNDERSTAND_LOCAL_ONLY';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

// Keep this list aligned with the current app_role enum in supabase/migrations/0001_initial_schema.sql.
// Do not add roles here without a matching DB enum value.
const SUPPORTED_APP_ROLES = new Set([
  'platform_owner',
  'platform_admin',
  'clinic_owner',
  'clinic_admin',
  'doctor',
  'registrar',
  'cashier',
  'marketer',
  'support',
]);

function requireSupportedRole(role, fixtureEmail) {
  if (!SUPPORTED_APP_ROLES.has(role)) {
    throw new Error(`Fixture ${fixtureEmail} requested unsupported role: ${role}`);
  }
}

function buildPersonas() {
  const personas = [
    {
      email: 'qa.admin.a@example.local',
      firstName: 'QA Admin',
      lastName: 'A',
      memberships: [{ tenantId: TENANT_A, role: 'clinic_admin' }],
    },
    {
      email: 'qa.doctor.a@example.local',
      firstName: 'QA Doctor',
      lastName: 'A',
      memberships: [{ tenantId: TENANT_A, role: 'doctor' }],
    },
    {
      email: 'qa.admin.b@example.local',
      firstName: 'QA Admin',
      lastName: 'B',
      memberships: [{ tenantId: TENANT_B, role: 'clinic_admin' }],
    },
    {
      email: 'qa.notenant@example.local',
      firstName: 'QA NoTenant',
      lastName: 'User',
      memberships: [],
    },
    {
      email: 'qa.platform.admin@example.local',
      firstName: 'QA Platform',
      lastName: 'Admin',
      platformStatus: 'active',
      memberships: [],
    },
    {
      email: 'qa.platform.disabled@example.local',
      firstName: 'QA Platform',
      lastName: 'Disabled',
      platformStatus: 'disabled',
      memberships: [],
    },
    {
      email: 'qa.owner.a@example.local',
      firstName: 'QA Owner',
      lastName: 'A',
      memberships: [{ tenantId: TENANT_A, role: 'clinic_owner' }],
    },
    {
      email: 'qa.owner.b@example.local',
      firstName: 'QA Owner',
      lastName: 'B',
      memberships: [{ tenantId: TENANT_B, role: 'clinic_owner' }],
    },
    {
      email: 'qa.owner.c@example.local',
      firstName: 'QA Owner',
      lastName: 'C',
      memberships: [],
    },
    {
      email: 'qa.multitenant@example.local',
      firstName: 'QA Multi',
      lastName: 'Tenant',
      memberships: [
        { tenantId: TENANT_A, role: 'clinic_admin' },
        { tenantId: TENANT_B, role: 'doctor' },
      ],
    },
  ];

  // The current DB enum uses registrar, not receptionist. Keep the requested QA email
  // so browser smoke can still validate the visible “Регистратор” role label.
  const receptionistRole = SUPPORTED_APP_ROLES.has('receptionist') ? 'receptionist' : 'registrar';
  if (SUPPORTED_APP_ROLES.has(receptionistRole)) {
    personas.push({
      email: 'qa.receptionist.a@example.local',
      firstName: 'QA Receptionist',
      lastName: 'A',
      memberships: [{ tenantId: TENANT_A, role: receptionistRole }],
    });
  }

  if (SUPPORTED_APP_ROLES.has('cashier')) {
    personas.push({
      email: 'qa.cashier.a@example.local',
      firstName: 'QA Cashier',
      lastName: 'A',
      memberships: [{ tenantId: TENANT_A, role: 'cashier' }],
    });
  }

  for (const persona of personas) {
    for (const membership of persona.memberships) {
      requireSupportedRole(membership.role, persona.email);
    }
  }

  return personas;
}

async function findAuthUserByEmail(supabase, email) {
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const users = data?.users ?? [];
    const existing = users.find(user => user.email === email);
    if (existing) {
      return existing;
    }

    if (users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

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

  if (allowSeed !== LOCAL_ONLY_CONFIRMATION) {
    console.error(`ERROR: ALLOW_LOCAL_QA_USER_SEED must be exactly "${LOCAL_ONLY_CONFIRMATION}"`);
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: NODE_ENV is set to production. Aborting.');
    process.exit(1);
  }

  // 2. URL safety validation
  try {
    const parsedUrl = new URL(url);
    const validHostnames = ['localhost', '127.0.0.1', '::1'];

    if (parsedUrl.protocol !== 'http:') {
      console.error('ERROR: SUPABASE_URL must use http: protocol for local dev.');
      process.exit(1);
    }

    if (!validHostnames.includes(parsedUrl.hostname)) {
      console.error('ERROR: SUPABASE_URL hostname must be localhost or 127.0.0.1.');
      process.exit(1);
    }

    if (parsedUrl.hostname.endsWith('.supabase.co')) {
      console.error('ERROR: SUPABASE_URL appears to be a production Supabase URL.');
      process.exit(1);
    }
  } catch (err) {
    console.error('ERROR: Invalid SUPABASE_URL provided.');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const personas = buildPersonas();

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
  let passwordUpdatedCount = 0;
  let profilesUpserted = 0;
  let tenantUsersInserted = 0;
  let platformAdministratorsUpserted = 0;

  for (const persona of personas) {
    console.log(`Processing ${persona.email}...`);

    // Auth user creation or reuse. Existing users are intentionally password-reset
    // to QA_USER_PASSWORD so local browser smoke has reliable credentials.
    let userId;
    const existing = await findAuthUserByEmail(supabase, persona.email);

    if (existing) {
      console.log('  Reusing existing auth user and resetting local QA password...');
      userId = existing.id;
      reusedCount++;
      const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
      if (updateErr) {
        console.error('  Failed to update user:', updateErr.message);
        process.exit(1);
      }
      passwordUpdatedCount++;
    } else {
      console.log('  Creating new auth user...');
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: persona.email,
        password,
        email_confirm: true,
      });
      if (createErr) {
        console.error('  Failed to create user:', createErr.message);
        process.exit(1);
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
        last_name: persona.lastName,
      });

    if (profileErr) {
      console.error('  Failed to upsert profile:', profileErr.message);
      process.exit(1);
    }
    profilesUpserted++;

    // Tenant Memberships
    console.log('  Resetting tenant memberships...');
    const { error: deleteErr } = await supabase.from('tenant_users').delete().eq('user_id', userId);
    if (deleteErr) {
      console.error('  Failed to reset tenant memberships:', deleteErr.message);
      process.exit(1);
    }

    if (persona.memberships.length > 0) {
      console.log(`  Inserting ${persona.memberships.length} memberships...`);
      const inserts = persona.memberships.map(m => ({
        user_id: userId,
        tenant_id: m.tenantId,
        role: m.role,
      }));
      const { error: tenantErr } = await supabase.from('tenant_users').insert(inserts);
      if (tenantErr) {
        console.error('  Failed to insert tenant_users:', tenantErr.message);
        process.exit(1);
      } else {
        tenantUsersInserted += inserts.length;
      }
    } else {
      console.log('  No tenant memberships required.');
    }

    if (persona.platformStatus) {
      console.log(`  Upserting platform administrator status: ${persona.platformStatus}...`);
      const { error: platformError } = await supabase.from('platform_administrators').upsert({
        user_id: userId,
        status: persona.platformStatus,
        display_name: `${persona.firstName} ${persona.lastName}`,
        disabled_at: persona.platformStatus === 'disabled' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      });
      if (platformError) {
        console.error('  Failed to upsert platform administrator:', platformError.message);
        process.exit(1);
      }
      platformAdministratorsUpserted++;
    }
  }

  const subscriptionStartedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const subscriptionExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const graceExpiresAt = new Date(Date.now() + 372 * 24 * 60 * 60 * 1000).toISOString();

  const lifecycleFixtures = [
    { tenantId: TENANT_A, status: 'active', suspendedAt: null, reason: null, note: null },
    { tenantId: TENANT_B, status: 'suspended', suspendedAt: new Date().toISOString(), reason: 'administrative', note: 'Local browser fixture' },
  ];

  for (const fixture of lifecycleFixtures) {
    const { error: lifecycleError } = await supabase.from('tenant_lifecycle').update({
      status: fixture.status,
      subscription_started_at: subscriptionStartedAt,
      subscription_expires_at: subscriptionExpiresAt,
      grace_expires_at: graceExpiresAt,
      suspended_at: fixture.suspendedAt,
      suspended_until: null,
      suspension_reason_code: fixture.reason,
      suspension_note: fixture.note,
      resumed_at: null,
      expired_at: null,
      archived_at: null,
      updated_at: new Date().toISOString(),
    }).eq('tenant_id', fixture.tenantId);
    if (lifecycleError) {
      console.error('Failed to update tenant lifecycle fixture:', lifecycleError.message);
      process.exit(1);
    }

    const { error: tenantStatusError } = await supabase.from('tenants').update({
      status: fixture.status,
      updated_at: new Date().toISOString(),
    }).eq('id', fixture.tenantId);
    if (tenantStatusError) {
      console.error('Failed to update tenant status fixture:', tenantStatusError.message);
      process.exit(1);
    }

    const { error: subscriptionError } = await supabase.from('tenant_subscription_periods').update({
      starts_at: subscriptionStartedAt,
      expires_at: subscriptionExpiresAt,
      grace_expires_at: graceExpiresAt,
      status: 'active',
      reason_code: 'local_qa_fixture',
    }).eq('tenant_id', fixture.tenantId).is('superseded_at', null);
    if (subscriptionError) {
      console.error('Failed to update subscription fixture:', subscriptionError.message);
      process.exit(1);
    }
  }

  console.log('\n--- QA USER FIXTURE SUMMARY ---');
  console.log(`Users created:          ${createdCount}`);
  console.log(`Users reused:           ${reusedCount}`);
  console.log(`Passwords reset:        ${passwordUpdatedCount}`);
  console.log(`Profiles upserted:      ${profilesUpserted}`);
  console.log(`Tenant users inserted:  ${tenantUsersInserted}`);
  console.log(`Platform admins upserted: ${platformAdministratorsUpserted}`);
  console.log('\nMemberships:');
  console.log('qa.admin.a@example.local          => Demo Clinic A / clinic_admin');
  console.log('qa.doctor.a@example.local         => Demo Clinic A / doctor');
  console.log('qa.admin.b@example.local          => Demo Clinic B / clinic_admin');
  console.log('qa.notenant@example.local         => no tenant');
  console.log('qa.platform.admin@example.local   => platform_superadmin active / no tenant');
  console.log('qa.platform.disabled@example.local=> platform_superadmin disabled / no tenant');
  console.log('qa.owner.a@example.local          => Demo Clinic A / clinic_owner');
  console.log('qa.owner.b@example.local          => Demo Clinic B / clinic_owner');
  console.log('qa.owner.c@example.local          => no tenant (tenant-create target)');
  console.log('qa.multitenant@example.local      => Demo Clinic A / clinic_admin + Demo Clinic B / doctor');
  console.log('qa.receptionist.a@example.local   => Demo Clinic A / registrar');
  console.log('qa.cashier.a@example.local        => Demo Clinic A / cashier');
  console.log('------------------------------');
}

run().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
