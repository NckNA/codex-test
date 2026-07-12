$ErrorActionPreference = 'Stop'

# APPOINTMENT-REMINDER-QUEUE-FOUNDATION-001 local-only concurrency validation.
$container = (docker ps --format '{{.Names}}' | Where-Object { $_ -like 'supabase_db_*' } | Select-Object -First 1)
if (-not $container) { throw 'Local Supabase DB container is not running.' }

$tenantA = 'd2910000-0000-4000-8000-000000000001'
$tenantB = 'e2910000-0000-4000-8000-000000000001'
$adminA = 'd2920000-0000-4000-8000-000000000001'
$adminB = 'e2920000-0000-4000-8000-000000000001'
$patientA = 'd2930000-0000-4000-8000-000000000001'
$patientB = 'e2930000-0000-4000-8000-000000000001'
$doctorA = 'd2940000-0000-4000-8000-000000000001'
$doctorB = 'e2940000-0000-4000-8000-000000000001'

$ids = @{
  A = 'd2950000-0000-4000-8000-000000000001'
  B = 'd2950000-0000-4000-8000-000000000002'
  C = 'd2950000-0000-4000-8000-000000000003'
  D = 'd2950000-0000-4000-8000-000000000004'
  E = 'd2950000-0000-4000-8000-000000000005'
  F = 'd2950000-0000-4000-8000-000000000006'
  G = 'd2950000-0000-4000-8000-000000000007'
  HA = 'd2950000-0000-4000-8000-000000000008'
  HB = 'e2950000-0000-4000-8000-000000000001'
}

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

function PlanSql([string]$userId, [string]$tenantId, [string]$appointmentId) {
  return (AuthContext $userId) + "SELECT jsonb_array_length(r->'created')||'|'||jsonb_array_length(r->'reused')||'|'||jsonb_array_length(r->'superseded')||'|'||jsonb_array_length(r->'cancelled') FROM (SELECT public.plan_appointment_reminder_jobs('$tenantId','$appointmentId','2026-12-01 00:00+00') r) q; COMMIT;"
}

function ReconcileSql([string]$userId, [string]$tenantId, [string]$from, [string]$to) {
  return (AuthContext $userId) + "SELECT (r->>'created')||'|'||(r->>'reused') FROM (SELECT public.reconcile_tenant_appointment_reminders('$tenantId','$from','$to',100,'2026-12-01 00:00+00') r) q; COMMIT;"
}

function RescheduleSql([string]$appointmentId, [string]$expected, [string]$key) {
  return (AuthContext $adminA) + "SELECT r->>'operationType' FROM (SELECT public.reschedule_appointment('$tenantA','$appointmentId','$patientA','$doctorA','2027-02-20 10:00+00','2027-02-20 11:00+00','A1','Moved','new','unpaid','phone',1,null,'$expected','$key') r) q; COMMIT;"
}

function CancelSql([string]$appointmentId, [string]$expected, [string]$key) {
  return (AuthContext $adminA) + "SELECT r->>'operationType' FROM (SELECT public.cancel_appointment('$tenantA','$appointmentId','clinic','Concurrent reminder cancellation','$expected','$key') r) q; COMMIT;"
}

function NoShowSql([string]$appointmentId, [string]$expected, [string]$key) {
  return (AuthContext $adminA) + "SELECT r->>'operationType' FROM (SELECT public.mark_appointment_no_show('$tenantA','$appointmentId','Concurrent reminder no-show','$expected','$key') r) q; COMMIT;"
}

function ConfirmSql([string]$appointmentId, [string]$expected, [string]$key) {
  return (AuthContext $adminA) + "SELECT r->>'operationType' FROM (SELECT public.confirm_appointment('$tenantA','$appointmentId','phone','Concurrent reminder confirmation','$expected','$key') r) q; COMMIT;"
}

function PolicySql() {
  return (AuthContext $adminA) + "SELECT policy_version FROM public.set_tenant_reminder_policy('$tenantA',true,true,false,true,'11:30',true,true,true,120); COMMIT;"
}

function Count-Success([object[]]$results) { return @($results | Where-Object { $_.Code -eq 0 }).Count }
function Count-Deadlocks([object[]]$results) { return @($results | Where-Object { $_.Text -match 'deadlock detected' }).Count }

$cleanup = @"
DELETE FROM public.tenants WHERE id IN ('$tenantA'::uuid,'$tenantB'::uuid);
DELETE FROM auth.users WHERE id IN ('$adminA'::uuid,'$adminB'::uuid);
"@

$appointmentValues = @(
  @($ids.A,$tenantA,$patientA,$doctorA,'2027-02-01 08:00+00','2027-02-01 09:00+00'),
  @($ids.B,$tenantA,$patientA,$doctorA,'2027-02-02 08:00+00','2027-02-02 09:00+00'),
  @($ids.C,$tenantA,$patientA,$doctorA,'2027-02-03 08:00+00','2027-02-03 09:00+00'),
  @($ids.D,$tenantA,$patientA,$doctorA,'2027-02-04 08:00+00','2027-02-04 09:00+00'),
  @($ids.E,$tenantA,$patientA,$doctorA,'2027-02-05 08:00+00','2027-02-05 09:00+00'),
  @($ids.F,$tenantA,$patientA,$doctorA,'2027-02-06 08:00+00','2027-02-06 09:00+00'),
  @($ids.G,$tenantA,$patientA,$doctorA,'2027-02-07 08:00+00','2027-02-07 09:00+00'),
  @($ids.HA,$tenantA,$patientA,$doctorA,'2027-02-08 08:00+00','2027-02-08 09:00+00'),
  @($ids.HB,$tenantB,$patientB,$doctorB,'2027-02-08 08:00+00','2027-02-08 09:00+00')
)
$values = ($appointmentValues | ForEach-Object { "('$($_[0])','$($_[1])','$($_[2])','$($_[3])','A1','Reminder concurrency','new','unpaid','phone',1,'$($_[4])','$($_[5])')" }) -join ",`n"

$setup = @"
BEGIN;
$cleanup
INSERT INTO public.tenants(id,name,timezone) VALUES ('$tenantA','Reminder concurrency A','Asia/Almaty'),('$tenantB','Reminder concurrency B','Asia/Almaty');
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
 ('$adminA','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rem-conc-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
 ('$adminB','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rem-conc-b@example.local','x',now(),'{"provider":"email"}','{}',now(),now());
INSERT INTO public.profiles(id) VALUES ('$adminA'),('$adminB');
INSERT INTO public.tenant_users(tenant_id,user_id,role) VALUES ('$tenantA','$adminA','clinic_admin'),('$tenantB','$adminB','clinic_admin');
INSERT INTO public.patients(id,tenant_id,full_name,phone,source,status) VALUES
 ('$patientA','$tenantA','Reminder Concurrent A','+77002920001','phone','active'),
 ('$patientB','$tenantB','Reminder Concurrent B','+77002920002','phone','active');
INSERT INTO public.doctors(id,tenant_id,full_name,specialization,cabinet,color,active) VALUES
 ('$doctorA','$tenantA','Reminder Doctor A','General','A1','#111111',true),
 ('$doctorB','$tenantB','Reminder Doctor B','General','B1','#222222',true);
INSERT INTO public.appointments(id,tenant_id,patient_id,doctor_id,cabinet,service,status,payment_type,source,price,start_time,end_time) VALUES
$values;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub"='$adminA';
SELECT public.set_tenant_reminder_policy('$tenantA',true,true,false,true,'12:00',true,true,true,180);
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub"='$adminB';
SELECT public.set_tenant_reminder_policy('$tenantB',true,true,false,true,'12:00',true,true,true,180);
COMMIT;
"@

$allResults = @()
try {
  Invoke-Sql $setup | Out-Null

  # A. Two appointment planners produce one logical job set.
  $a = @(Invoke-ConcurrentPair (PlanSql $adminA $tenantA $ids.A) (PlanSql $adminA $tenantA $ids.A)); $allResults += $a
  if ((Count-Success $a) -ne 2) { throw "A planners failed: $($a.Text -join ' || ')" }
  if ([int](Invoke-Scalar "select count(*) from public.appointment_reminder_jobs where appointment_id='$($ids.A)'") -ne 3) { throw 'A duplicate job set detected' }
  Write-Output 'A_SAME_APPOINTMENT_PLANNERS success=2 logicalJobs=3'

  # B. Overlapping tenant reconciliations remain idempotent.
  $bSqlA = ReconcileSql $adminA $tenantA '2027-02-02 00:00+00' '2027-02-03 00:00+00'
  $bSqlB = ReconcileSql $adminA $tenantA '2027-02-02 00:00+00' '2027-02-03 00:00+00'
  $b = @(Invoke-ConcurrentPair $bSqlA $bSqlB); $allResults += $b
  if ((Count-Success $b) -ne 2) { throw "B reconciliation failed: $($b.Text -join ' || ')" }
  $bJobCount = [int](Invoke-Scalar "select count(*) from public.appointment_reminder_jobs where appointment_id='$($ids.B)'")
  if ($bJobCount -ne 3) { throw "B reconciliation expected 3 logical jobs, found $bJobCount; outputs=$($b.Text -join ' || ')" }
  Write-Output "B_TENANT_RECONCILIATION_OVERLAP success=2 logicalJobs=$bJobCount"

  # C. Existing plan versus reschedule: old version is historical, new version is active.
  Invoke-Sql (PlanSql $adminA $tenantA $ids.C) | Out-Null
  $updatedC = Invoke-Scalar "select updated_at from public.appointments where id='$($ids.C)'"
  $c = @(Invoke-ConcurrentPair (PlanSql $adminA $tenantA $ids.C) (RescheduleSql $ids.C $updatedC 'rem-conc-c-reschedule')); $allResults += $c
  if ((Count-Success $c) -ne 2) { throw "C planner/reschedule failed: $($c.Text -join ' || ')" }
  if ([int](Invoke-Scalar "select count(*) from public.appointment_reminder_jobs where appointment_id='$($ids.C)' and state='superseded'") -ne 3) { throw 'C stale jobs were not superseded' }
  if ([int](Invoke-Scalar "select count(*) from public.appointment_reminder_jobs where appointment_id='$($ids.C)' and state in ('scheduled','ready')") -ne 3) { throw 'C new plan missing' }
  Write-Output 'C_PLANNER_VS_RESCHEDULE success=2 superseded=3 active=3'

  # D. Planner versus cancellation leaves no sendable job.
  Invoke-Sql (PlanSql $adminA $tenantA $ids.D) | Out-Null
  $updatedD = Invoke-Scalar "select updated_at from public.appointments where id='$($ids.D)'"
  $d = @(Invoke-ConcurrentPair (PlanSql $adminA $tenantA $ids.D) (CancelSql $ids.D $updatedD 'rem-conc-d-cancel')); $allResults += $d
  if ((Count-Success $d) -ne 2) { throw "D planner/cancel failed: $($d.Text -join ' || ')" }
  if ([int](Invoke-Scalar "select count(*) from public.appointment_reminder_jobs where appointment_id='$($ids.D)' and state in ('scheduled','ready')") -ne 0) { throw 'D active job remains after cancellation' }
  Write-Output 'D_PLANNER_VS_CANCELLATION success=2 active=0'

  # E. Planner versus no-show leaves no sendable job.
  Invoke-Sql (PlanSql $adminA $tenantA $ids.E) | Out-Null
  $updatedE = Invoke-Scalar "select updated_at from public.appointments where id='$($ids.E)'"
  $e = @(Invoke-ConcurrentPair (PlanSql $adminA $tenantA $ids.E) (NoShowSql $ids.E $updatedE 'rem-conc-e-noshow')); $allResults += $e
  if ((Count-Success $e) -ne 2) { throw "E planner/no-show failed: $($e.Text -join ' || ')" }
  if ([int](Invoke-Scalar "select count(*) from public.appointment_reminder_jobs where appointment_id='$($ids.E)' and state in ('scheduled','ready')") -ne 0) { throw 'E active job remains after no-show' }
  Write-Output 'E_PLANNER_VS_NOSHOW success=2 active=0'

  # F. Planner versus confirmation converges to the confirmed eligibility set.
  Invoke-Sql (PlanSql $adminA $tenantA $ids.F) | Out-Null
  $updatedF = Invoke-Scalar "select updated_at from public.appointments where id='$($ids.F)'"
  $f = @(Invoke-ConcurrentPair (PlanSql $adminA $tenantA $ids.F) (ConfirmSql $ids.F $updatedF 'rem-conc-f-confirm')); $allResults += $f
  if ((Count-Success $f) -ne 2) { throw "F planner/confirmation failed: $($f.Text -join ' || ')" }
  if ([int](Invoke-Scalar "select count(*) from public.appointment_reminder_jobs where appointment_id='$($ids.F)' and state in ('scheduled','ready') and reminder_type='confirmation_request'") -ne 0) { throw 'F confirmation request remains active' }
  if ([int](Invoke-Scalar "select count(*) from public.appointment_reminder_jobs where appointment_id='$($ids.F)' and state in ('scheduled','ready') and reminder_type='day_before_reminder'") -ne 1) { throw 'F ordinary confirmed reminder missing' }
  Write-Output 'F_PLANNER_VS_CONFIRMATION success=2 confirmationRequests=0 ordinaryReminders=1'

  # G. Policy change versus planner, followed by explicit reconciliation, leaves only current policy jobs active.
  Invoke-Sql (PlanSql $adminA $tenantA $ids.G) | Out-Null
  $g = @(Invoke-ConcurrentPair (PlanSql $adminA $tenantA $ids.G) (PolicySql)); $allResults += $g
  if ((Count-Success $g) -ne 2) { throw "G planner/policy failed: $($g.Text -join ' || ')" }
  Invoke-Sql (PlanSql $adminA $tenantA $ids.G) | Out-Null
  $currentPolicy = Invoke-Scalar "select policy_version from public.tenant_reminder_policies where tenant_id='$tenantA'"
  if ([int](Invoke-Scalar "select count(*) from public.appointment_reminder_jobs where appointment_id='$($ids.G)' and state in ('scheduled','ready') and policy_version<>$currentPolicy") -ne 0) { throw 'G stale policy jobs remain active' }
  if ([int](Invoke-Scalar "select count(*) from public.appointment_reminder_jobs where appointment_id='$($ids.G)' and state='superseded'") -lt 3) { throw 'G old policy jobs were not superseded' }
  Write-Output "G_POLICY_VS_PLANNER success=2 currentPolicy=$currentPolicy activeStale=0"

  # H. Identical plan material in different tenants remains independent.
  $h = @(Invoke-ConcurrentPair (PlanSql $adminA $tenantA $ids.HA) (PlanSql $adminB $tenantB $ids.HB)); $allResults += $h
  if ((Count-Success $h) -ne 2) { throw "H tenant isolation failed: $($h.Text -join ' || ')" }
  if ([int](Invoke-Scalar "select count(distinct tenant_id) from public.appointment_reminder_jobs where appointment_id in ('$($ids.HA)','$($ids.HB)')") -ne 2) { throw 'H cross-tenant plan isolation failed' }
  Write-Output 'H_CROSS_TENANT_INDEPENDENCE success=2 tenants=2'

  # I/J. Aggregate duplicate, audit and deadlock checks.
  $duplicatePlanKeys = [int](Invoke-Scalar "select count(*) from (select tenant_id,plan_key,count(*) from public.appointment_reminder_jobs where tenant_id in ('$tenantA','$tenantB') group by 1,2 having count(*)>1) q")
  $duplicateLogical = [int](Invoke-Scalar "select count(*) from (select tenant_id,appointment_id,reminder_type,due_at,appointment_updated_at,policy_version,count(*) from public.appointment_reminder_jobs where tenant_id in ('$tenantA','$tenantB') group by 1,2,3,4,5,6 having count(*)>1) q")
  $activeStale = [int](Invoke-Scalar "select count(*) from public.appointment_reminder_jobs j join public.appointments a on a.tenant_id=j.tenant_id and a.id=j.appointment_id join public.tenant_reminder_policies p on p.tenant_id=j.tenant_id where j.tenant_id in ('$tenantA','$tenantB') and j.state in ('scheduled','ready') and (j.appointment_updated_at<>a.updated_at or j.policy_version<>p.policy_version)")
  $audit = [int](Invoke-Scalar "select count(*) from public.audit_events where tenant_id in ('$tenantA','$tenantB') and action in ('appointment_reminder_planned','appointment_reminder_superseded','appointment_reminder_cancelled','appointment_reminder_skipped')")
  $activity = [int](Invoke-Scalar "select count(*) from public.activity_events where tenant_id in ('$tenantA','$tenantB') and type in ('appointment_reminder_planned','appointment_reminder_superseded','appointment_reminder_cancelled','appointment_reminder_skipped')")
  $jobs = [int](Invoke-Scalar "select count(*) from public.appointment_reminder_jobs where tenant_id in ('$tenantA','$tenantB')")
  $created = [int](Invoke-Scalar "select count(*) from public.appointment_reminder_jobs where tenant_id in ('$tenantA','$tenantB')")
  $superseded = [int](Invoke-Scalar "select count(*) from public.appointment_reminder_jobs where tenant_id in ('$tenantA','$tenantB') and state='superseded'")
  $cancelled = [int](Invoke-Scalar "select count(*) from public.appointment_reminder_jobs where tenant_id in ('$tenantA','$tenantB') and state='cancelled'")
  $deadlocks = Count-Deadlocks $allResults

  if ($duplicatePlanKeys -ne 0 -or $duplicateLogical -ne 0 -or $activeStale -ne 0) {
    throw "Queue invariants failed duplicatePlanKeys=$duplicatePlanKeys duplicateLogical=$duplicateLogical activeStale=$activeStale"
  }
  if ($audit -ne $activity) { throw "Audit/activity mismatch audit=$audit activity=$activity" }
  if ($deadlocks -ne 0) { throw "Deadlocks detected: $deadlocks" }

  Write-Output "I_DUPLICATE_AUDIT_PREVENTION audit=$audit activity=$activity duplicatePlanKeys=$duplicatePlanKeys duplicateLogical=$duplicateLogical"
  Write-Output "FINAL createdJobs=$created totalJobs=$jobs supersededJobs=$superseded cancelledJobs=$cancelled activeStaleJobs=$activeStale auditEvents=$audit activityEvents=$activity deadlocks=$deadlocks"
  Write-Output 'APPOINTMENT-REMINDER-QUEUE-FOUNDATION-001 CONCURRENCY VALIDATION PASSED'
}
finally {
  Invoke-Sql $cleanup | Out-Null
  $remaining = Invoke-Scalar "select (select count(*) from public.tenants where id in ('$tenantA','$tenantB')) + (select count(*) from auth.users where id in ('$adminA','$adminB'))"
  if ([int]$remaining -ne 0) { throw "Concurrency cleanup failed: remaining=$remaining" }
}
