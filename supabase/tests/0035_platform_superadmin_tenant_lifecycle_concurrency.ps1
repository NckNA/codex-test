$ErrorActionPreference = 'Stop'

$container = (docker ps --format '{{.Names}}' | Where-Object { $_ -like 'supabase_db_*' } | Select-Object -First 1)
if (-not $container) { throw 'Local Supabase DB container is not running.' }

$admin = '35500000-0000-4000-8000-000000000001'
$owner1 = '35510000-0000-4000-8000-000000000001'
$owner2 = '35510000-0000-4000-8000-000000000002'
$owner3 = '35510000-0000-4000-8000-000000000003'
$deadlocks = 0
$replays = 0
$conflicts = 0

function Invoke-Sql([string]$sql) {
  $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  $output = $sql | & docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q 2>&1
  $code = [int]$LASTEXITCODE; $ErrorActionPreference = $old
  if ($code -ne 0) { throw "SQL failed:`n$($output -join "`n")" }
  return ($output -join "`n")
}

function Invoke-Scalar([string]$sql) {
  $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  $output = & docker exec $container psql -U postgres -d postgres -Atq -v ON_ERROR_STOP=1 -c $sql 2>&1
  $code = [int]$LASTEXITCODE; $ErrorActionPreference = $old
  if ($code -ne 0) { throw "Scalar SQL failed: $sql`n$($output -join "`n")" }
  return (($output | Where-Object { $_ -ne $null -and $_.ToString().Trim() -ne '' } | Select-Object -Last 1).ToString().Trim())
}

function Invoke-ConcurrentPair([string]$sqlA, [string]$sqlB) {
  $jobA = Start-Job -ScriptBlock {
    param($containerName,$sql)
    $old=$ErrorActionPreference; $ErrorActionPreference='Continue'
    $out=$sql | & docker exec -i $containerName psql -U postgres -d postgres -Atq -v ON_ERROR_STOP=1 2>&1
    $code=[int]$LASTEXITCODE; $ErrorActionPreference=$old
    [pscustomobject]@{ Code=$code; Text=($out -join "`n") }
  } -ArgumentList $container,$sqlA
  $jobB = Start-Job -ScriptBlock {
    param($containerName,$sql)
    $old=$ErrorActionPreference; $ErrorActionPreference='Continue'
    $out=$sql | & docker exec -i $containerName psql -U postgres -d postgres -Atq -v ON_ERROR_STOP=1 2>&1
    $code=[int]$LASTEXITCODE; $ErrorActionPreference=$old
    [pscustomobject]@{ Code=$code; Text=($out -join "`n") }
  } -ArgumentList $container,$sqlB
  Wait-Job $jobA,$jobB | Out-Null
  $results=@((Receive-Job $jobA),(Receive-Job $jobB)); Remove-Job $jobA,$jobB
  foreach($result in $results){ if($result.Text -match 'deadlock detected'){ $script:deadlocks++ } }
  return $results
}

function Assert-True([bool]$condition,[string]$message){ if(-not $condition){ throw "ASSERTION FAILED: $message" } }
function Auth-Sql([string]$body){ return "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$admin',true); SELECT set_config('request.jwt.claim.role','authenticated',true); $body COMMIT;" }
function Create-Sql([string]$name,[string]$owner,[string]$key){ return (Auth-Sql "SELECT public.create_platform_tenant('$name','$owner','2026-01-01T00:00:00Z','2027-12-31T00:00:00Z','2028-01-07T00:00:00Z','$key');") }
function Call-Sql([string]$body){ return (Auth-Sql "SELECT $body;") }

$cleanup=@"
SELECT set_config('app.platform_test_cleanup','on',false);
DELETE FROM public.activity_events WHERE tenant_id IN (SELECT id FROM public.tenants WHERE name LIKE 'Lifecycle Concurrency %');
DELETE FROM public.audit_events WHERE tenant_id IN (SELECT id FROM public.tenants WHERE name LIKE 'Lifecycle Concurrency %');
DELETE FROM public.platform_tenant_operations WHERE actor_user_id='$admin' OR tenant_id IN (SELECT id FROM public.tenants WHERE name LIKE 'Lifecycle Concurrency %');
DELETE FROM public.patients WHERE tenant_id IN (SELECT id FROM public.tenants WHERE name LIKE 'Lifecycle Concurrency %');
DELETE FROM public.tenant_users WHERE tenant_id IN (SELECT id FROM public.tenants WHERE name LIKE 'Lifecycle Concurrency %');
DELETE FROM public.tenant_subscription_periods WHERE tenant_id IN (SELECT id FROM public.tenants WHERE name LIKE 'Lifecycle Concurrency %');
DELETE FROM public.tenant_lifecycle WHERE tenant_id IN (SELECT id FROM public.tenants WHERE name LIKE 'Lifecycle Concurrency %');
DELETE FROM public.tenants WHERE name LIKE 'Lifecycle Concurrency %';
DELETE FROM public.platform_administrators WHERE user_id='$admin';
DELETE FROM auth.users WHERE id IN ('$admin','$owner1','$owner2','$owner3');
"@
Invoke-Sql $cleanup | Out-Null

$setup=@"
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
('$admin','00000000-0000-0000-0000-000000000000','authenticated','authenticated','platform-concurrency-admin@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
('$owner1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','platform-concurrency-owner1@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
('$owner2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','platform-concurrency-owner2@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
('$owner3','00000000-0000-0000-0000-000000000000','authenticated','authenticated','platform-concurrency-owner3@example.local','x',now(),'{"provider":"email"}','{}',now(),now());
INSERT INTO public.profiles(id,first_name) VALUES ('$admin','Platform'),('$owner1','Owner1'),('$owner2','Owner2'),('$owner3','Owner3');
INSERT INTO public.platform_administrators(user_id,status,display_name) VALUES ('$admin','active','Concurrency Admin');
"@
Invoke-Sql $setup | Out-Null

try {
  # A. Same create key: one tenant and one audit/activity pair, second result replayed.
  $createPair=Invoke-ConcurrentPair (Create-Sql 'Lifecycle Concurrency A' $owner1 'same-create-key') (Create-Sql 'Lifecycle Concurrency A' $owner1 'same-create-key')
  Assert-True (($createPair | Where-Object Code -eq 0).Count -eq 2) ("A both identical create requests return safely. A=$($createPair[0].Code):$($createPair[0].Text) B=$($createPair[1].Code):$($createPair[1].Text)")
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.tenants WHERE name='Lifecycle Concurrency A'") -eq '1') 'A one tenant'
  $tenantA=Invoke-Scalar "SELECT id FROM public.tenants WHERE name='Lifecycle Concurrency A'"
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.tenant_lifecycle WHERE tenant_id='$tenantA'") -eq '1') 'A one lifecycle'
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.tenant_subscription_periods WHERE tenant_id='$tenantA' AND superseded_at IS NULL") -eq '1') 'A one current subscription'
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.tenant_users WHERE tenant_id='$tenantA' AND role='clinic_owner' AND membership_status='active'") -eq '1') 'A one owner membership'
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.audit_events WHERE tenant_id='$tenantA' AND action='platform_tenant_created'") -eq '1') 'A one audit'
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.activity_events WHERE tenant_id='$tenantA' AND type='platform_tenant_created'") -eq '1') 'A one activity'
  $replays += @($createPair | Where-Object { $_.Text -match '"replay"\s*:\s*true' }).Count

  # B. Duplicate tenant identity with different keys: one deterministic winner, no orphan rows.
  $duplicatePair=Invoke-ConcurrentPair (Create-Sql 'Lifecycle Concurrency Duplicate' $owner1 'duplicate-a') (Create-Sql '  lifecycle   concurrency duplicate  ' $owner2 'duplicate-b')
  Assert-True (@($duplicatePair | Where-Object Code -eq 0).Count -eq 1) ("B one duplicate identity winner. A=$($duplicatePair[0].Code):$($duplicatePair[0].Text) B=$($duplicatePair[1].Code):$($duplicatePair[1].Text)")
  $conflicts += @($duplicatePair | Where-Object Code -ne 0).Count
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.tenants WHERE lower(regexp_replace(btrim(name),'\s+',' ','g'))='lifecycle concurrency duplicate'") -eq '1') 'B one identity'
  $tenantB=Invoke-Scalar "SELECT id FROM public.tenants WHERE lower(regexp_replace(btrim(name),'\s+',' ','g'))='lifecycle concurrency duplicate'"
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.tenant_lifecycle WHERE tenant_id='$tenantB'") -eq '1') 'B no orphan lifecycle'
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.tenant_users WHERE tenant_id='$tenantB' AND role='clinic_owner' AND membership_status='active'") -eq '1') 'B winner has owner'

  # C. Concurrent owner removals: at least one active owner survives.
  Invoke-Sql (Call-Sql "public.add_platform_tenant_owner('$tenantA','$owner2','add-owner2')") | Out-Null
  $removePair=Invoke-ConcurrentPair (Call-Sql "public.remove_platform_tenant_owner('$tenantA','$owner1','remove-owner1')") (Call-Sql "public.remove_platform_tenant_owner('$tenantA','$owner2','remove-owner2')")
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.tenant_users WHERE tenant_id='$tenantA' AND role='clinic_owner' AND membership_status='active'") -ge '1') 'C final owner protected'
  $conflicts += @($removePair | Where-Object Code -ne 0).Count

  # D. Add owner versus remove current owner preserves owner invariant.
  $remaining=Invoke-Scalar "SELECT user_id FROM public.tenant_users WHERE tenant_id='$tenantA' AND role='clinic_owner' AND membership_status='active' LIMIT 1"
  $addRemovePair=Invoke-ConcurrentPair (Call-Sql "public.add_platform_tenant_owner('$tenantA','$owner3','race-add-owner3')") (Call-Sql "public.remove_platform_tenant_owner('$tenantA','$remaining','race-remove-remaining')")
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.tenant_users WHERE tenant_id='$tenantA' AND role='clinic_owner' AND membership_status='active'") -ge '1') 'D owner invariant preserved'
  $conflicts += @($addRemovePair | Where-Object Code -ne 0).Count

  # E. Two extensions converge on the maximum expiry with one current period.
  $extensionPair=Invoke-ConcurrentPair (Call-Sql "public.extend_tenant_subscription('$tenantA',now()+interval '500 days',now()+interval '507 days','renewal','extend-500')") (Call-Sql "public.extend_tenant_subscription('$tenantA',now()+interval '600 days',now()+interval '607 days','renewal','extend-600')")
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.tenant_subscription_periods WHERE tenant_id='$tenantA' AND superseded_at IS NULL") -eq '1') 'E one current subscription'
  Assert-True ((Invoke-Scalar "SELECT subscription_expires_at > now()+interval '590 days' FROM public.tenant_lifecycle WHERE tenant_id='$tenantA'") -eq 't') 'E maximum extension wins'
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.tenant_subscription_periods WHERE tenant_id='$tenantA'") -ge '2') 'E history preserved'
  $conflicts += @($extensionPair | Where-Object Code -ne 0).Count

  # F. Suspend versus resume leaves a consistent state/version.
  $versionBefore=[int](Invoke-Scalar "SELECT lifecycle_version FROM public.tenant_lifecycle WHERE tenant_id='$tenantA'")
  $suspendResumePair=Invoke-ConcurrentPair (Call-Sql "public.suspend_tenant('$tenantA','administrative',NULL,now()+interval '2 days','race-suspend')") (Call-Sql "public.resume_tenant('$tenantA','resolved','race-resume')")
  $statusF=Invoke-Scalar "SELECT status FROM public.tenant_lifecycle WHERE tenant_id='$tenantA'"
  Assert-True ($statusF -in @('active','suspended')) 'F status is valid'
  Assert-True ([int](Invoke-Scalar "SELECT lifecycle_version FROM public.tenant_lifecycle WHERE tenant_id='$tenantA'") -gt $versionBefore) 'F version advanced'
  Assert-True ((Invoke-Scalar "SELECT (status='suspended' AND suspended_at IS NOT NULL) OR (status='active' AND suspended_at IS NULL) FROM public.tenant_lifecycle WHERE tenant_id='$tenantA'") -eq 't') 'F no mixed state'
  $conflicts += @($suspendResumePair | Where-Object Code -ne 0).Count

  # G. Explicit suspension remains after concurrent subscription extension.
  Invoke-Sql (Call-Sql "public.suspend_tenant('$tenantA','administrative',NULL,NULL,'suspend-before-extension')") | Out-Null
  $suspendExtendPair=Invoke-ConcurrentPair (Call-Sql "public.suspend_tenant('$tenantA','administrative',NULL,NULL,'race-suspend-again')") (Call-Sql "public.extend_tenant_subscription('$tenantA',now()+interval '700 days',now()+interval '707 days','renewal','race-extend-suspended')")
  Assert-True ((Invoke-Scalar "SELECT status FROM public.tenant_lifecycle WHERE tenant_id='$tenantA'") -eq 'suspended') 'G extension does not bypass suspension'
  $conflicts += @($suspendExtendPair | Where-Object Code -ne 0).Count

  # H. Archive versus resume: archive wins safely.
  $archiveResumePair=Invoke-ConcurrentPair (Call-Sql "public.archive_tenant('$tenantA','customer_closed',true,'race-archive-resume')") (Call-Sql "public.resume_tenant('$tenantA','resolved','race-resume-archive')")
  Assert-True ((Invoke-Scalar "SELECT status FROM public.tenant_lifecycle WHERE tenant_id='$tenantA'") -eq 'archived') 'H archive wins'
  Assert-True ((Invoke-Scalar "SELECT allowed FROM public.tenant_operational_access_allowed('$tenantA','$owner3','clinic')") -eq 'f') 'H archived access blocked'
  $conflicts += @($archiveResumePair | Where-Object Code -ne 0).Count

  # I. Archive versus extension cannot reactivate an archived tenant.
  $archiveExtendPair=Invoke-ConcurrentPair (Call-Sql "public.archive_tenant('$tenantA','customer_closed',true,'race-archive-replay')") (Call-Sql "public.extend_tenant_subscription('$tenantA',now()+interval '900 days',now()+interval '907 days','renewal','race-extend-archived')")
  Assert-True ((Invoke-Scalar "SELECT status FROM public.tenant_lifecycle WHERE tenant_id='$tenantA'") -eq 'archived') 'I archived tenant remains archived'
  $conflicts += @($archiveExtendPair | Where-Object Code -ne 0).Count

  # J. Expiration boundary blocks an authenticated mutation from an old tab.
  Invoke-Sql (Create-Sql 'Lifecycle Concurrency Expiry' $owner1 'create-expiry') | Out-Null
  $tenantExpiry=Invoke-Scalar "SELECT id FROM public.tenants WHERE name='Lifecycle Concurrency Expiry'"
  Invoke-Sql "INSERT INTO public.patients(id,tenant_id,full_name) VALUES ('35520000-0000-4000-8000-000000000001','$tenantExpiry','Boundary Patient'); UPDATE public.tenant_lifecycle SET status='active',subscription_expires_at=now()-interval '2 seconds',grace_expires_at=now()-interval '1 second' WHERE tenant_id='$tenantExpiry';" | Out-Null
  $mutationResult=Invoke-ConcurrentPair ("BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$owner1',true); UPDATE public.patients SET full_name='Denied A' WHERE tenant_id='$tenantExpiry'; COMMIT;") ("BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$owner1',true); UPDATE public.patients SET full_name='Denied B' WHERE tenant_id='$tenantExpiry'; COMMIT;")
  $successfulChanges = @($mutationResult | Where-Object { $_.Code -eq 0 -and $_.Text -match 'UPDATE\s+[1-9]' }).Count
  Assert-True ($successfulChanges -eq 0) ("J expired mutations denied. A=$($mutationResult[0].Code):$($mutationResult[0].Text) B=$($mutationResult[1].Code):$($mutationResult[1].Text)")
  Assert-True ((Invoke-Scalar "SELECT full_name FROM public.patients WHERE tenant_id='$tenantExpiry'") -eq 'Boundary Patient') 'J data unchanged'
  $conflicts += @($mutationResult | Where-Object { $_.Code -ne 0 -or $_.Text -match 'UPDATE\s+0' }).Count

  # K. Same operation key is independent across tenants.
  Invoke-Sql (Create-Sql 'Lifecycle Concurrency C' $owner2 'create-c') | Out-Null
  $tenantC=Invoke-Scalar "SELECT id FROM public.tenants WHERE name='Lifecycle Concurrency C'"
  $crossTenantPair=Invoke-ConcurrentPair (Call-Sql "public.suspend_tenant('$tenantB','administrative',NULL,NULL,'shared-operation-key')") (Call-Sql "public.suspend_tenant('$tenantC','administrative',NULL,NULL,'shared-operation-key')")
  Assert-True (($crossTenantPair | Where-Object Code -eq 0).Count -eq 2) 'K same key independent across tenants'
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.platform_tenant_operations WHERE operation_key='shared-operation-key'") -eq '2') 'K two scoped operations'

  # Final counters and invariants.
  $tenants=[int](Invoke-Scalar "SELECT count(*) FROM public.tenants WHERE name LIKE 'Lifecycle Concurrency %'")
  $lifecycleRows=[int](Invoke-Scalar "SELECT count(*) FROM public.tenant_lifecycle tl JOIN public.tenants t ON t.id=tl.tenant_id WHERE t.name LIKE 'Lifecycle Concurrency %'")
  $currentSubscriptions=[int](Invoke-Scalar "SELECT count(*) FROM public.tenant_subscription_periods p JOIN public.tenants t ON t.id=p.tenant_id WHERE t.name LIKE 'Lifecycle Concurrency %' AND p.superseded_at IS NULL")
  $subscriptionHistory=[int](Invoke-Scalar "SELECT count(*) FROM public.tenant_subscription_periods p JOIN public.tenants t ON t.id=p.tenant_id WHERE t.name LIKE 'Lifecycle Concurrency %'")
  $ownerMemberships=[int](Invoke-Scalar "SELECT count(*) FROM public.tenant_users u JOIN public.tenants t ON t.id=u.tenant_id WHERE t.name LIKE 'Lifecycle Concurrency %' AND u.role='clinic_owner' AND u.membership_status='active'")
  $operations=[int](Invoke-Scalar "SELECT count(*) FROM public.platform_tenant_operations o LEFT JOIN public.tenants t ON t.id=o.tenant_id WHERE t.name LIKE 'Lifecycle Concurrency %' OR (o.tenant_id IS NULL AND o.operation_type='tenant_create')")
  $suspensions=[int](Invoke-Scalar "SELECT count(*) FROM public.audit_events a JOIN public.tenants t ON t.id=a.tenant_id WHERE t.name LIKE 'Lifecycle Concurrency %' AND a.action='platform_tenant_suspended'")
  $resumes=[int](Invoke-Scalar "SELECT count(*) FROM public.audit_events a JOIN public.tenants t ON t.id=a.tenant_id WHERE t.name LIKE 'Lifecycle Concurrency %' AND a.action='platform_tenant_resumed'")
  $archived=[int](Invoke-Scalar "SELECT count(*) FROM public.tenant_lifecycle tl JOIN public.tenants t ON t.id=tl.tenant_id WHERE t.name LIKE 'Lifecycle Concurrency %' AND tl.status='archived'")
  $audit=[int](Invoke-Scalar "SELECT count(*) FROM public.audit_events a JOIN public.tenants t ON t.id=a.tenant_id WHERE t.name LIKE 'Lifecycle Concurrency %' AND a.action LIKE 'platform_tenant_%'")
  $activity=[int](Invoke-Scalar "SELECT count(*) FROM public.activity_events a JOIN public.tenants t ON t.id=a.tenant_id WHERE t.name LIKE 'Lifecycle Concurrency %' AND a.type LIKE 'platform_tenant_%'")
  $ownerless=[int](Invoke-Scalar "SELECT count(*) FROM public.tenant_lifecycle tl WHERE tl.status='active' AND NOT EXISTS (SELECT 1 FROM public.tenant_users u WHERE u.tenant_id=tl.tenant_id AND u.role='clinic_owner' AND u.membership_status='active')")
  $withoutLifecycle=[int](Invoke-Scalar "SELECT count(*) FROM public.tenants t LEFT JOIN public.tenant_lifecycle tl ON tl.tenant_id=t.id WHERE tl.tenant_id IS NULL")
  $multipleCurrent=[int](Invoke-Scalar "SELECT count(*) FROM (SELECT tenant_id FROM public.tenant_subscription_periods WHERE superseded_at IS NULL GROUP BY tenant_id HAVING count(*)>1)x")
  $archivedOperational=[int](Invoke-Scalar "SELECT count(*) FROM public.tenant_lifecycle tl WHERE tl.status='archived' AND (SELECT allowed FROM public.tenant_operational_access_allowed(tl.tenant_id,NULL,'clinic'))")
  $crossTenantMutations=[int](Invoke-Scalar "SELECT count(*) FROM public.platform_tenant_operations o WHERE o.tenant_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.tenants t WHERE t.id=o.tenant_id)")
  $auditActivityMismatch=[math]::Abs($audit-$activity)

  Assert-True ($ownerless -eq 0) 'ownerless active tenants = 0'
  Assert-True ($withoutLifecycle -eq 0) 'tenants without lifecycle = 0'
  Assert-True ($multipleCurrent -eq 0) 'multiple current subscriptions = 0'
  Assert-True ($archivedOperational -eq 0) 'archived operational access = 0'
  Assert-True ($crossTenantMutations -eq 0) 'cross-tenant lifecycle mutations = 0'
  Assert-True ($auditActivityMismatch -eq 0) 'audit/activity mismatch = 0'
  Assert-True ($deadlocks -eq 0) 'deadlocks = 0'

  [ordered]@{
    tenants=$tenants; lifecycleRows=$lifecycleRows; currentSubscriptions=$currentSubscriptions;
    subscriptionHistoryRows=$subscriptionHistory; ownerMemberships=$ownerMemberships;
    operations=$operations; operationReplays=$replays; conflicts=$conflicts;
    suspensions=$suspensions; resumes=$resumes; archivedTenants=$archived;
    auditEvents=$audit; activityEvents=$activity; deadlocks=$deadlocks;
    invariants=[ordered]@{ ownerlessActiveTenants=$ownerless; tenantsWithoutLifecycle=$withoutLifecycle; multipleCurrentSubscriptions=$multipleCurrent; archivedOperationalAccess=$archivedOperational; crossTenantLifecycleMutations=$crossTenantMutations; auditActivityMismatch=$auditActivityMismatch }
  } | ConvertTo-Json -Depth 4
}
finally {
  Invoke-Sql $cleanup | Out-Null
}
