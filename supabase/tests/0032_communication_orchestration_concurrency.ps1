$ErrorActionPreference = 'Stop'

# COMMUNICATION-ORCHESTRATION-FOUNDATION-001 local-only concurrency validation.
# No external provider, amoCRM, SMS, WhatsApp or email request is made.
$container = (docker ps --format '{{.Names}}' | Where-Object { $_ -like 'supabase_db_*' } | Select-Object -First 1)
if (-not $container) { throw 'Local Supabase DB container is not running.' }

$tenantA = 'f3210000-0000-4000-8000-000000000001'
$tenantB = 'f3210000-0000-4000-8000-000000000002'
$adminA = 'f3220000-0000-4000-8000-000000000001'
$adminB = 'f3220000-0000-4000-8000-000000000002'
$patientA = 'f3230000-0000-4000-8000-000000000001'
$patientB = 'f3230000-0000-4000-8000-000000000002'
$doctorA = 'f3240000-0000-4000-8000-000000000001'
$doctorB = 'f3240000-0000-4000-8000-000000000002'
$contactA = 'f3260000-0000-4000-8000-000000000001'
$contactB = 'f3260000-0000-4000-8000-000000000002'

function Invoke-Sql([string]$sql) {
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = $sql | & docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q 2>&1
  $code = $LASTEXITCODE
  $ErrorActionPreference = $old
  if ($code -ne 0) { throw "SQL failed:`n$($output -join "`n")" }
  return $output
}

function Invoke-Scalar([string]$sql) {
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = & docker exec $container psql -U postgres -d postgres -Atq -v ON_ERROR_STOP=1 -c $sql 2>&1
  $code = $LASTEXITCODE
  $ErrorActionPreference = $old
  if ($code -ne 0) { throw "Scalar SQL failed: $sql`n$($output -join "`n")" }
  return (($output | Where-Object { $_ -ne $null -and $_.ToString().Trim() -ne '' } | Select-Object -Last 1).ToString().Trim())
}

function Invoke-ConcurrentPair([string]$sqlA, [string]$sqlB) {
  $jobA = Start-Job -ScriptBlock {
    param($containerName, $sql)
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $output = $sql | & docker exec -i $containerName psql -U postgres -d postgres -Atq -v ON_ERROR_STOP=1 2>&1
    $code = [int]$LASTEXITCODE
    $ErrorActionPreference = $old
    [pscustomobject]@{ Code = $code; Text = ($output -join "`n") }
  } -ArgumentList $container, $sqlA
  $jobB = Start-Job -ScriptBlock {
    param($containerName, $sql)
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $output = $sql | & docker exec -i $containerName psql -U postgres -d postgres -Atq -v ON_ERROR_STOP=1 2>&1
    $code = [int]$LASTEXITCODE
    $ErrorActionPreference = $old
    [pscustomobject]@{ Code = $code; Text = ($output -join "`n") }
  } -ArgumentList $container, $sqlB
  Wait-Job $jobA, $jobB | Out-Null
  $results = @((Receive-Job $jobA), (Receive-Job $jobB))
  Remove-Job $jobA, $jobB
  return $results
}

function AuthContext([string]$userId) {
  return "BEGIN; SET LOCAL ROLE authenticated; SET LOCAL `"request.jwt.claim.sub`"='$userId'; "
}

function AppointmentId([int]$number, [bool]$tenantBValue = $false) {
  $suffix = if ($tenantBValue) { 100 + $number } else { $number }
  return ('f3250000-0000-4000-8000-{0:d12}' -f $suffix)
}

function JobId([int]$number, [bool]$tenantBValue = $false) {
  $suffix = if ($tenantBValue) { 100 + $number } else { $number }
  return ('f3270000-0000-4000-8000-{0:d12}' -f $suffix)
}

function PrepareSql([string]$tenantId, [string]$userId, [string]$jobId, [string]$key) {
  return (AuthContext $userId) + @"
SELECT r->>'replayed'
FROM (
  SELECT public.prepare_communication_operation(
    '$tenantId', '$jobId', 'sms', '$key',
    (SELECT updated_at FROM public.appointment_reminder_jobs WHERE tenant_id='$tenantId' AND id='$jobId'),
    (SELECT a.updated_at FROM public.appointments a JOIN public.appointment_reminder_jobs j ON j.appointment_id=a.id AND j.tenant_id=a.tenant_id WHERE j.tenant_id='$tenantId' AND j.id='$jobId')
  ) r
) q;
COMMIT;
"@
}

function ConsentWithdrawSql([string]$key) {
  return (AuthContext $adminA) + "SELECT public.set_patient_communication_consent('$tenantA','$patientA','sms','withdrawn','patient_written','Concurrent withdrawal','$key'); COMMIT;"
}

function SuppressSql([string]$key) {
  return (AuthContext $adminA) + "SELECT public.set_patient_communication_suppression('$tenantA','$patientA','sms',true,'patient_request','$key'); COMMIT;"
}

function RouteUpdateSql([string]$key) {
  return (AuthContext $adminA) + @"
SELECT public.create_or_update_communication_route(
  '$tenantA',
  (SELECT id FROM public.communication_routes WHERE tenant_id='$tenantA' AND channel='sms' AND enabled ORDER BY priority,id LIMIT 1),
  'sms','mock',true,50,
  (SELECT updated_at FROM public.communication_routes WHERE tenant_id='$tenantA' AND channel='sms' AND enabled ORDER BY priority,id LIMIT 1),
  '$key'
);
COMMIT;
"@
}

function SimulateSql([string]$operationId, [string]$scenario, [string]$key) {
  return (AuthContext $adminA) + @"
SELECT r->>'replayed'
FROM (
  SELECT public.simulate_communication_operation(
    '$tenantA','$operationId','$scenario','$key',
    (SELECT updated_at FROM public.communication_operations WHERE tenant_id='$tenantA' AND id='$operationId')
  ) r
) q;
COMMIT;
"@
}

function Count-Deadlocks([object[]]$results) {
  return @($results | Where-Object { $_.Text -match 'deadlock detected' }).Count
}

$cleanup = @"
DELETE FROM public.tenants WHERE id IN ('$tenantA'::uuid,'$tenantB'::uuid);
DELETE FROM auth.users WHERE id IN ('$adminA'::uuid,'$adminB'::uuid);
"@

$appointmentValues = @()
$jobValues = @()
foreach ($n in 1..12) {
  $appointment = AppointmentId $n
  $job = JobId $n
  $appointmentValues += "('$appointment','$tenantA','$patientA','$doctorA','A1','Orchestration concurrency','new','2099-08-{0:d2} 10:00+00','2099-08-{0:d2} 11:00+00')" -f $n
  $jobValues += "('$job','$tenantA','$appointment','$patientA','confirmation_request','manual','2099-08-{0:d2} 08:00+00','scheduled',(SELECT updated_at FROM public.appointments WHERE id='$appointment'),1,encode(extensions.digest('orch-conc-plan-$n','sha256'),'hex'),encode(extensions.digest('orch-conc-payload-$n','sha256'),'hex'),100,'2099-08-{0:d2} 08:00+00','{{}}')" -f $n
}
$appointmentValues += "('$(AppointmentId 1 $true)','$tenantB','$patientB','$doctorB','B1','Orchestration concurrency B','new','2099-09-01 10:00+00','2099-09-01 11:00+00')"
$jobValues += "('$(JobId 1 $true)','$tenantB','$(AppointmentId 1 $true)','$patientB','confirmation_request','manual','2099-09-01 08:00+00','scheduled',(SELECT updated_at FROM public.appointments WHERE id='$(AppointmentId 1 $true)'),1,encode(extensions.digest('orch-conc-plan-b','sha256'),'hex'),encode(extensions.digest('orch-conc-payload-b','sha256'),'hex'),100,'2099-09-01 08:00+00','{}')"

$setup = @"
BEGIN;
$cleanup
INSERT INTO public.tenants(id,name,timezone) VALUES
 ('$tenantA','Orchestration concurrency A','Asia/Almaty'),
 ('$tenantB','Orchestration concurrency B','Asia/Almaty');
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
 ('$adminA','00000000-0000-0000-0000-000000000000','authenticated','authenticated','orch-conc-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
 ('$adminB','00000000-0000-0000-0000-000000000000','authenticated','authenticated','orch-conc-b@example.local','x',now(),'{"provider":"email"}','{}',now(),now());
INSERT INTO public.profiles(id) VALUES ('$adminA'),('$adminB');
INSERT INTO public.tenant_users(tenant_id,user_id,role) VALUES
 ('$tenantA','$adminA','clinic_admin'),('$tenantB','$adminB','clinic_admin');
INSERT INTO public.patients(id,tenant_id,full_name,source,status) VALUES
 ('$patientA','$tenantA','Orchestration Concurrent A','phone','active'),
 ('$patientB','$tenantB','Orchestration Concurrent B','phone','active');
INSERT INTO public.doctors(id,tenant_id,full_name,specialization,cabinet,color,active) VALUES
 ('$doctorA','$tenantA','Doctor A','General','A1','#111111',true),
 ('$doctorB','$tenantB','Doctor B','General','B1','#222222',true);
INSERT INTO public.appointments(id,tenant_id,patient_id,doctor_id,cabinet,service,status,start_time,end_time) VALUES
 $($appointmentValues -join ",`n");
INSERT INTO public.patient_communication_contacts(
 id,tenant_id,patient_id,contact_type,contact_value_raw,contact_value_normalized,is_primary,is_verified,verification_source,owner_type,language
) VALUES
 ('$contactA','$tenantA','$patientA','phone','+77004445566','+77004445566',true,true,'patient_confirmed','patient','ru'),
 ('$contactB','$tenantB','$patientB','phone','+77005556677','+77005556677',true,true,'patient_confirmed','patient','ru');
UPDATE public.patient_communication_preferences
 SET preferred_channel='sms',sms_consent_state='granted',sms_suppressed=false,global_suppression=false
 WHERE tenant_id='$tenantA' AND patient_id='$patientA';
UPDATE public.patient_communication_preferences
 SET preferred_channel='sms',sms_consent_state='granted',sms_suppressed=false,global_suppression=false
 WHERE tenant_id='$tenantB' AND patient_id='$patientB';
INSERT INTO public.patient_communication_consent_events(
 tenant_id,patient_id,channel,previous_state,new_state,source,actor_user_id,reason,operation_key,fingerprint
) VALUES
 ('$tenantA','$patientA','sms','unknown','granted','patient_written','$adminA','concurrency','orch-conc-consent-a',repeat('a',64)),
 ('$tenantB','$patientB','sms','unknown','granted','patient_written','$adminB','concurrency','orch-conc-consent-b',repeat('b',64));
INSERT INTO public.appointment_reminder_jobs(
 id,tenant_id,appointment_id,patient_id,reminder_type,execution_mode,due_at,state,appointment_updated_at,
 policy_version,plan_key,payload_fingerprint,priority,original_due_at,metadata
) VALUES
 $($jobValues -join ",`n");
COMMIT;
"@
Invoke-Sql $setup | Out-Null

# Create tenant-local simulation routes.
Invoke-Sql ((AuthContext $adminA) + "SELECT public.create_or_update_communication_route('$tenantA',NULL,'sms','mock',true,100,NULL,'orch-conc-route-a'); COMMIT;") | Out-Null
Invoke-Sql ((AuthContext $adminB) + "SELECT public.create_or_update_communication_route('$tenantB',NULL,'sms','mock',true,100,NULL,'orch-conc-route-b'); COMMIT;") | Out-Null

$allResults = @()

# A. Same preparation key: one insert and one replay.
$resultsA = Invoke-ConcurrentPair `
  (PrepareSql $tenantA $adminA (JobId 1) 'orch-conc-prepare-same') `
  (PrepareSql $tenantA $adminA (JobId 1) 'orch-conc-prepare-same')
$allResults += $resultsA

# B. Different keys, same logical operation: duplicate active operation prevented.
$resultsB = Invoke-ConcurrentPair `
  (PrepareSql $tenantA $adminA (JobId 2) 'orch-conc-prepare-b1') `
  (PrepareSql $tenantA $adminA (JobId 2) 'orch-conc-prepare-b2')
$allResults += $resultsB

# C. Preparation versus consent withdrawal.
$resultsC = Invoke-ConcurrentPair `
  (PrepareSql $tenantA $adminA (JobId 3) 'orch-conc-prepare-c') `
  (ConsentWithdrawSql 'orch-conc-withdraw-c')
$allResults += $resultsC
Invoke-Sql ((AuthContext $adminA) + "SELECT public.set_patient_communication_consent('$tenantA','$patientA','sms','granted','patient_written','restore','orch-conc-restore-c'); COMMIT;") | Out-Null

# D. Preparation versus suppression.
$resultsD = Invoke-ConcurrentPair `
  (PrepareSql $tenantA $adminA (JobId 4) 'orch-conc-prepare-d') `
  (SuppressSql 'orch-conc-suppress-d')
$allResults += $resultsD
Invoke-Sql ((AuthContext $adminA) + "SELECT public.set_patient_communication_suppression('$tenantA','$patientA','sms',false,NULL,'orch-conc-unsuppress-d'); COMMIT;") | Out-Null

# E. Preparation versus contact archive.
$contactUpdated = Invoke-Scalar "SELECT updated_at FROM public.patient_communication_contacts WHERE id='$contactA'"
$archiveSql = (AuthContext $adminA) + "SELECT public.archive_patient_communication_contact('$tenantA','$patientA','$contactA','$contactUpdated','orch-conc-archive-e'); COMMIT;"
$resultsE = Invoke-ConcurrentPair `
  (PrepareSql $tenantA $adminA (JobId 5) 'orch-conc-prepare-e') `
  $archiveSql
$allResults += $resultsE
Invoke-Sql @"
UPDATE public.patient_communication_contacts
SET archived_at=NULL,is_primary=true,is_verified=true,verification_source='patient_confirmed'
WHERE id='$contactA';
"@ | Out-Null

# F. Preparation versus appointment reschedule/version change.
$appointmentF = AppointmentId 6
$updateAppointment = "BEGIN; UPDATE public.appointments SET start_time=start_time+interval '1 day',end_time=end_time+interval '1 day' WHERE id='$appointmentF'; COMMIT;"
$resultsF = Invoke-ConcurrentPair `
  (PrepareSql $tenantA $adminA (JobId 6) 'orch-conc-prepare-f') `
  $updateAppointment
$allResults += $resultsF

# G/H. Simulation same key and different keys.
Invoke-Sql (PrepareSql $tenantA $adminA (JobId 7) 'orch-conc-prepare-g') | Out-Null
$operationG = Invoke-Scalar "SELECT id FROM public.communication_operations WHERE tenant_id='$tenantA' AND reminder_job_id='$(JobId 7)'"
$resultsG = Invoke-ConcurrentPair `
  (SimulateSql $operationG 'success' 'orch-conc-sim-same') `
  (SimulateSql $operationG 'success' 'orch-conc-sim-same')
$allResults += $resultsG

Invoke-Sql (PrepareSql $tenantA $adminA (JobId 8) 'orch-conc-prepare-h') | Out-Null
$operationH = Invoke-Scalar "SELECT id FROM public.communication_operations WHERE tenant_id='$tenantA' AND reminder_job_id='$(JobId 8)'"
$resultsH = Invoke-ConcurrentPair `
  (SimulateSql $operationH 'success' 'orch-conc-sim-h1') `
  (SimulateSql $operationH 'rejected' 'orch-conc-sim-h2')
$allResults += $resultsH

# I. Timeout after possible acceptance stays uncertain and is not retried.
Invoke-Sql (PrepareSql $tenantA $adminA (JobId 9) 'orch-conc-prepare-i') | Out-Null
$operationI = Invoke-Scalar "SELECT id FROM public.communication_operations WHERE tenant_id='$tenantA' AND reminder_job_id='$(JobId 9)'"
Invoke-Sql (SimulateSql $operationI 'timeout_after_acceptance' 'orch-conc-sim-i') | Out-Null

# J. Same operation key in different tenants remains independent.
$resultsJ = Invoke-ConcurrentPair `
  (PrepareSql $tenantA $adminA (JobId 10) 'orch-conc-cross-tenant-key') `
  (PrepareSql $tenantB $adminB (JobId 1 $true) 'orch-conc-cross-tenant-key')
$allResults += $resultsJ

# K. Route update during preparation leaves one internally consistent route snapshot.
$resultsK = Invoke-ConcurrentPair `
  (PrepareSql $tenantA $adminA (JobId 11) 'orch-conc-prepare-k') `
  (RouteUpdateSql 'orch-conc-route-update-k')
$allResults += $resultsK

$operations = [int](Invoke-Scalar "SELECT count(*) FROM public.communication_operations WHERE tenant_id IN ('$tenantA','$tenantB')")
$replays = @($allResults | Where-Object { $_.Code -eq 0 -and $_.Text.Trim() -eq 'true' }).Count
$conflicts = @($allResults | Where-Object { $_.Code -ne 0 }).Count
$uncertain = [int](Invoke-Scalar "SELECT count(*) FROM public.communication_operations WHERE tenant_id='$tenantA' AND state='simulation_uncertain'")
$cancelled = [int](Invoke-Scalar "SELECT count(*) FROM public.communication_operations WHERE tenant_id='$tenantA' AND state='cancelled'")
$duplicates = [int](Invoke-Scalar @"
SELECT count(*) FROM (
  SELECT tenant_id,reminder_job_id,channel,appointment_updated_at,reminder_job_updated_at,contact_updated_at,payload_fingerprint
  FROM public.communication_operations
  WHERE state <> 'cancelled'
  GROUP BY tenant_id,reminder_job_id,channel,appointment_updated_at,reminder_job_updated_at,contact_updated_at,payload_fingerprint
  HAVING count(*) > 1
) d
"@)
$auditEvents = [int](Invoke-Scalar "SELECT count(*) FROM public.audit_events WHERE tenant_id IN ('$tenantA','$tenantB') AND action LIKE 'communication_%'")
$activityEvents = [int](Invoke-Scalar "SELECT count(*) FROM public.activity_events WHERE tenant_id IN ('$tenantA','$tenantB') AND type LIKE 'communication_%'")
$deadlocks = Count-Deadlocks $allResults
$unsafe = [int](Invoke-Scalar @"
SELECT count(*)
FROM public.communication_operations o
JOIN public.patient_communication_preferences p ON p.tenant_id=o.tenant_id AND p.patient_id=o.patient_id
WHERE o.state='prepared'
  AND (
    CASE o.channel WHEN 'sms' THEN p.sms_consent_state WHEN 'whatsapp' THEN p.whatsapp_consent_state ELSE p.email_consent_state END <> 'granted'
    OR p.global_suppression
    OR CASE o.channel WHEN 'sms' THEN p.sms_suppressed WHEN 'whatsapp' THEN p.whatsapp_suppressed ELSE p.email_suppressed END
  )
"@)
$routeSnapshotMismatch = [int](Invoke-Scalar @"
SELECT count(*) FROM public.communication_operations
WHERE tenant_id='$tenantA'
  AND route_version <> (route_snapshot->>'configurationVersion')::integer
"@)

if ($duplicates -ne 0) { throw "Duplicate active operations: $duplicates" }
if ($unsafe -ne 0) { throw "Unsafe prepared operations: $unsafe" }
if ($deadlocks -ne 0) { throw "Deadlocks detected: $deadlocks" }
if ($routeSnapshotMismatch -ne 0) { throw "Route snapshot mismatch: $routeSnapshotMismatch" }
if ($auditEvents -ne $activityEvents) { throw "Audit/activity parity mismatch: $auditEvents/$activityEvents" }
if ($uncertain -ne 1) { throw "Expected exactly one uncertain operation, got $uncertain" }

[pscustomobject]@{
  operations = $operations
  replays = $replays
  conflicts = $conflicts
  uncertainOperations = $uncertain
  cancelledOperations = $cancelled
  duplicateActiveOperations = $duplicates
  unsafePreparedOperations = $unsafe
  routeSnapshotMismatches = $routeSnapshotMismatch
  auditEvents = $auditEvents
  activityEvents = $activityEvents
  deadlocks = $deadlocks
} | Format-List

Invoke-Sql $cleanup | Out-Null
Write-Host 'COMMUNICATION-ORCHESTRATION-FOUNDATION-001 concurrency validation passed.'
