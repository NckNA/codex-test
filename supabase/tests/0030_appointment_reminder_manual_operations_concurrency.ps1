$ErrorActionPreference = 'Stop'

# APPOINTMENT-REMINDER-MANUAL-OPERATIONS-001 local-only concurrency validation.
$container = (docker ps --format '{{.Names}}' | Where-Object { $_ -like 'supabase_db_*' } | Select-Object -First 1)
if (-not $container) { throw 'Local Supabase DB container is not running.' }

$tenantA = 'e3010000-0000-4000-8000-000000000001'
$tenantB = 'e3010000-0000-4000-8000-000000000002'
$adminA = 'e3020000-0000-4000-8000-000000000001'
$adminB = 'e3020000-0000-4000-8000-000000000002'
$patientA = 'e3030000-0000-4000-8000-000000000001'
$patientB = 'e3030000-0000-4000-8000-000000000002'
$doctorA = 'e3040000-0000-4000-8000-000000000001'
$doctorB = 'e3040000-0000-4000-8000-000000000002'

$appointments = @{
  A = 'e3050000-0000-4000-8000-000000000001'
  B = 'e3050000-0000-4000-8000-000000000002'
  C = 'e3050000-0000-4000-8000-000000000003'
  D = 'e3050000-0000-4000-8000-000000000004'
  E = 'e3050000-0000-4000-8000-000000000005'
  F = 'e3050000-0000-4000-8000-000000000006'
  G = 'e3050000-0000-4000-8000-000000000007'
  H = 'e3050000-0000-4000-8000-000000000008'
  IA = 'e3050000-0000-4000-8000-000000000009'
  IB = 'e3050000-0000-4000-8000-000000000010'
}
$jobs = @{
  A = 'e3060000-0000-4000-8000-000000000001'
  B = 'e3060000-0000-4000-8000-000000000002'
  C = 'e3060000-0000-4000-8000-000000000003'
  D = 'e3060000-0000-4000-8000-000000000004'
  E = 'e3060000-0000-4000-8000-000000000005'
  F = 'e3060000-0000-4000-8000-000000000006'
  IA = 'e3060000-0000-4000-8000-000000000009'
  IB = 'e3060000-0000-4000-8000-000000000010'
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

function CompleteSql([string]$tenantId, [string]$userId, [string]$jobId, [string]$jobExpected, [string]$appointmentExpected, [string]$key, [string]$outcome = 'no_answer') {
  return (AuthContext $userId) + "SELECT coalesce('ERROR:'||(r->>'errorCode'),r->>'replayed') FROM (SELECT public.complete_appointment_reminder_job('$tenantId','$jobId','phone','$outcome','Concurrent manual completion','$jobExpected','$appointmentExpected','$key') r) q; COMMIT;"
}

function SkipSql([string]$tenantId, [string]$userId, [string]$jobId, [string]$jobExpected, [string]$appointmentExpected, [string]$key) {
  return (AuthContext $userId) + "SELECT coalesce('ERROR:'||(r->>'errorCode'),r->>'replayed') FROM (SELECT public.skip_appointment_reminder_job('$tenantId','$jobId','Concurrent manual skip','$jobExpected','$appointmentExpected','$key') r) q; COMMIT;"
}

function DeferSql([string]$tenantId, [string]$userId, [string]$jobId, [string]$newDueAt, [string]$jobExpected, [string]$appointmentExpected, [string]$key) {
  return (AuthContext $userId) + "SELECT coalesce('ERROR:'||(r->>'errorCode'),r->>'replayed') FROM (SELECT public.defer_appointment_reminder_job('$tenantId','$jobId','$newDueAt','Concurrent manual defer','$jobExpected','$appointmentExpected','$key') r) q; COMMIT;"
}

function PlanSql([string]$tenantId, [string]$userId, [string]$appointmentId) {
  return (AuthContext $userId) + "SELECT jsonb_array_length(r->'created')||'|'||jsonb_array_length(r->'reused') FROM (SELECT public.plan_appointment_reminder_jobs('$tenantId','$appointmentId',transaction_timestamp()) r) q; COMMIT;"
}

function CancelSql([string]$appointmentId, [string]$expected, [string]$key) {
  return (AuthContext $adminA) + "SELECT r->>'operationType' FROM (SELECT public.cancel_appointment('$tenantA','$appointmentId','clinic','Concurrent manual reminder cancellation','$expected','$key') r) q; COMMIT;"
}

function RescheduleSql([string]$appointmentId, [string]$expected, [string]$key) {
  return (AuthContext $adminA) + "SELECT r->>'operationType' FROM (SELECT public.reschedule_appointment('$tenantA','$appointmentId','$patientA','$doctorA','2027-04-20 10:00+00','2027-04-20 11:00+00','A1','Concurrent moved','new','unpaid','phone',1,null,'$expected','$key') r) q; COMMIT;"
}

function Count-Success([object[]]$results) { return @($results | Where-Object { $_.Code -eq 0 -and $_.Text.Trim() -notmatch '^ERROR:' }).Count }
function Count-Failure([object[]]$results) { return @($results | Where-Object { $_.Code -ne 0 -or $_.Text.Trim() -match '^ERROR:' }).Count }
function Count-Replay([object[]]$results) { return @($results | Where-Object { $_.Code -eq 0 -and $_.Text.Trim() -eq 'true' }).Count }
function Count-Deadlocks([object[]]$results) { return @($results | Where-Object { $_.Text -match 'deadlock detected' }).Count }

$cleanup = @"
DELETE FROM public.tenants WHERE id IN ('$tenantA'::uuid,'$tenantB'::uuid);
DELETE FROM auth.users WHERE id IN ('$adminA'::uuid,'$adminB'::uuid);
"@

$appointmentRows = @(
  @($appointments.A,$tenantA,$patientA,$doctorA,'2027-03-01 08:00+00','2027-03-01 09:00+00'),
  @($appointments.B,$tenantA,$patientA,$doctorA,'2027-03-02 08:00+00','2027-03-02 09:00+00'),
  @($appointments.C,$tenantA,$patientA,$doctorA,'2027-03-03 08:00+00','2027-03-03 09:00+00'),
  @($appointments.D,$tenantA,$patientA,$doctorA,'2027-03-04 08:00+00','2027-03-04 09:00+00'),
  @($appointments.E,$tenantA,$patientA,$doctorA,'2027-03-05 08:00+00','2027-03-05 09:00+00'),
  @($appointments.F,$tenantA,$patientA,$doctorA,'2027-03-06 08:00+00','2027-03-06 09:00+00'),
  @($appointments.G,$tenantA,$patientA,$doctorA,'2027-03-07 08:00+00','2027-03-07 09:00+00'),
  @($appointments.H,$tenantA,$patientA,$doctorA,'2027-03-08 08:00+00','2027-03-08 09:00+00'),
  @($appointments.IA,$tenantA,$patientA,$doctorA,'2027-03-09 08:00+00','2027-03-09 09:00+00'),
  @($appointments.IB,$tenantB,$patientB,$doctorB,'2027-03-09 08:00+00','2027-03-09 09:00+00')
)
$appointmentValues = ($appointmentRows | ForEach-Object { "('$($_[0])','$($_[1])','$($_[2])','$($_[3])','A1','Manual concurrency','new','unpaid','phone',1,'$($_[4])','$($_[5])')" }) -join ",`n"

$directJobRows = @(
  @($jobs.A,$tenantA,$appointments.A,$patientA,'A'),
  @($jobs.B,$tenantA,$appointments.B,$patientA,'B'),
  @($jobs.C,$tenantA,$appointments.C,$patientA,'C'),
  @($jobs.D,$tenantA,$appointments.D,$patientA,'D'),
  @($jobs.E,$tenantA,$appointments.E,$patientA,'E'),
  @($jobs.F,$tenantA,$appointments.F,$patientA,'F'),
  @($jobs.IA,$tenantA,$appointments.IA,$patientA,'IA'),
  @($jobs.IB,$tenantB,$appointments.IB,$patientB,'IB')
)
$directJobValues = ($directJobRows | ForEach-Object {
  "('$($_[0])','$($_[1])','$($_[2])','$($_[3])','confirmation_request','manual',transaction_timestamp()-interval '1 hour','scheduled',(select updated_at from public.appointments where id='$($_[2])'),(select policy_version from public.tenant_reminder_policies where tenant_id='$($_[1])'),encode(extensions.digest('manual-conc-plan-$($_[4])','sha256'),'hex'),encode(extensions.digest('manual-conc-payload-$($_[4])','sha256'),'hex'),50,jsonb_build_object('fixture','$($_[4])'))"
}) -join ",`n"

$setup = @"
BEGIN;
$cleanup
INSERT INTO public.tenants(id,name,timezone) VALUES ('$tenantA','Manual concurrency A','Asia/Almaty'),('$tenantB','Manual concurrency B','Asia/Almaty');
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
 ('$adminA','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manual-conc-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
 ('$adminB','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manual-conc-b@example.local','x',now(),'{"provider":"email"}','{}',now(),now());
INSERT INTO public.profiles(id) VALUES ('$adminA'),('$adminB');
INSERT INTO public.tenant_users(tenant_id,user_id,role) VALUES ('$tenantA','$adminA','clinic_admin'),('$tenantB','$adminB','clinic_admin');
INSERT INTO public.patients(id,tenant_id,full_name,phone,source,status) VALUES
 ('$patientA','$tenantA','Manual Concurrent A','+77003020001','phone','active'),
 ('$patientB','$tenantB','Manual Concurrent B','+77003020002','phone','active');
INSERT INTO public.doctors(id,tenant_id,full_name,specialization,cabinet,color,active) VALUES
 ('$doctorA','$tenantA','Manual Doctor A','General','A1','#111111',true),
 ('$doctorB','$tenantB','Manual Doctor B','General','B1','#222222',true);
INSERT INTO public.appointments(id,tenant_id,patient_id,doctor_id,cabinet,service,status,payment_type,source,price,start_time,end_time) VALUES
$appointmentValues;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub"='$adminA';
SELECT public.set_tenant_reminder_policy('$tenantA',true,true,false,true,'12:00',true,true,true,180);
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub"='$adminB';
SELECT public.set_tenant_reminder_policy('$tenantB',true,true,false,true,'12:00',true,true,true,180);
RESET ROLE;
INSERT INTO public.appointment_reminder_jobs(
  id,tenant_id,appointment_id,patient_id,reminder_type,execution_mode,due_at,state,
  appointment_updated_at,policy_version,plan_key,payload_fingerprint,priority,metadata
) VALUES
$directJobValues;
COMMIT;
"@

$allResults = @()
$conflicts = 0
$replays = 0
try {
  Invoke-Sql $setup | Out-Null

  # A. Same completion key: one logical completion and one safe replay.
  $jobExpectedA = Invoke-Scalar "select updated_at from public.appointment_reminder_jobs where id='$($jobs.A)'"
  $appointmentExpectedA = Invoke-Scalar "select updated_at from public.appointments where id='$($appointments.A)'"
  $aSql1 = CompleteSql $tenantA $adminA $jobs.A $jobExpectedA $appointmentExpectedA 'manual-conc-same-key-001'
  $aSql2 = CompleteSql $tenantA $adminA $jobs.A $jobExpectedA $appointmentExpectedA 'manual-conc-same-key-001'
  $a = @(Invoke-ConcurrentPair $aSql1 $aSql2)
  $allResults += $a
  if ((Count-Success $a) -ne 2) { throw "A same-key completion failed: $($a.Text -join ' || ')" }
  $attemptCountA = [int](Invoke-Scalar "select count(*) from public.appointment_confirmation_attempts where appointment_id='$($appointments.A)'")
  if ($attemptCountA -ne 1) { throw "A expected one confirmation attempt, found $attemptCountA; outputs=$($a.Text -join ' || ')" }
  $operationCountA = [int](Invoke-Scalar "select count(*) from public.appointment_operations where tenant_id='$tenantA' and operation_key='manual-conc-same-key-001'")
  if ($operationCountA -ne 1) { throw "A expected one operation row, found $operationCountA; outputs=$($a.Text -join ' || ')" }
  $aReplay = Count-Replay $a; if ($aReplay -ne 1) { throw "A expected one replay, found $aReplay" }; $replays += $aReplay
  Write-Output 'A_SAME_COMPLETION_KEY success=2 replay=1 attempts=1 completed=1'

  # B. Different completion keys: one winner, one terminal/stale conflict.
  $jobExpectedB = Invoke-Scalar "select updated_at from public.appointment_reminder_jobs where id='$($jobs.B)'"
  $appointmentExpectedB = Invoke-Scalar "select updated_at from public.appointments where id='$($appointments.B)'"
  $bSql1 = CompleteSql $tenantA $adminA $jobs.B $jobExpectedB $appointmentExpectedB 'manual-conc-different-b1'
  $bSql2 = CompleteSql $tenantA $adminA $jobs.B $jobExpectedB $appointmentExpectedB 'manual-conc-different-b2'
  $b = @(Invoke-ConcurrentPair $bSql1 $bSql2)
  $allResults += $b
  if ((Count-Success $b) -ne 1 -or (Count-Failure $b) -ne 1) { throw "B expected one winner: $($b.Text -join ' || ')" }
  if ([int](Invoke-Scalar "select count(*) from public.appointment_confirmation_attempts where appointment_id='$($appointments.B)'") -ne 1) { throw 'B duplicate confirmation attempt' }
  $conflicts += Count-Failure $b
  Write-Output 'B_DIFFERENT_COMPLETION_KEYS success=1 conflicts=1 attempts=1'

  # C. Complete versus skip: exactly one terminal action wins.
  $jobExpectedC = Invoke-Scalar "select updated_at from public.appointment_reminder_jobs where id='$($jobs.C)'"
  $appointmentExpectedC = Invoke-Scalar "select updated_at from public.appointments where id='$($appointments.C)'"
  $cSql1 = CompleteSql $tenantA $adminA $jobs.C $jobExpectedC $appointmentExpectedC 'manual-conc-c-complete'
  $cSql2 = SkipSql $tenantA $adminA $jobs.C $jobExpectedC $appointmentExpectedC 'manual-conc-c-skip'
  $c = @(Invoke-ConcurrentPair $cSql1 $cSql2)
  $allResults += $c
  if ((Count-Success $c) -ne 1) { throw "C complete/skip expected one winner: $($c.Text -join ' || ')" }
  $stateC = Invoke-Scalar "select state from public.appointment_reminder_jobs where id='$($jobs.C)'"
  if ($stateC -notin @('completed','skipped')) { throw "C invalid final state $stateC" }
  $conflicts += Count-Failure $c
  Write-Output "C_COMPLETE_VS_SKIP success=1 conflicts=1 finalState=$stateC"

  # D. Complete versus defer: exactly one mutation wins.
  $jobExpectedD = Invoke-Scalar "select updated_at from public.appointment_reminder_jobs where id='$($jobs.D)'"
  $appointmentExpectedD = Invoke-Scalar "select updated_at from public.appointments where id='$($appointments.D)'"
  $dSql1 = CompleteSql $tenantA $adminA $jobs.D $jobExpectedD $appointmentExpectedD 'manual-conc-d-complete'
  $dSql2 = DeferSql $tenantA $adminA $jobs.D '2027-01-15 10:00+00' $jobExpectedD $appointmentExpectedD 'manual-conc-d-defer'
  $d = @(Invoke-ConcurrentPair $dSql1 $dSql2)
  $allResults += $d
  if ((Count-Success $d) -ne 1) { throw "D complete/defer expected one winner: $($d.Text -join ' || ')" }
  $stateD = Invoke-Scalar "select state||'|'||(deferred_at is not null)::text from public.appointment_reminder_jobs where id='$($jobs.D)'"
  $conflicts += Count-Failure $d
  Write-Output "D_COMPLETE_VS_DEFER success=1 conflicts=1 final=$stateD"

  # E. Complete versus cancellation: cancellation wins or follows an already committed completion.
  $jobExpectedE = Invoke-Scalar "select updated_at from public.appointment_reminder_jobs where id='$($jobs.E)'"
  $appointmentExpectedE = Invoke-Scalar "select updated_at from public.appointments where id='$($appointments.E)'"
  $eSql1 = CompleteSql $tenantA $adminA $jobs.E $jobExpectedE $appointmentExpectedE 'manual-conc-e-complete'
  $eSql2 = CancelSql $appointments.E $appointmentExpectedE 'manual-conc-e-cancel'
  $e = @(Invoke-ConcurrentPair $eSql1 $eSql2)
  $allResults += $e
  $eSuccess = Count-Success $e
  if ($eSuccess -ne 1) { throw "E expected exactly one winner: $($e.Text -join ' || ')" }
  $appointmentStateE = Invoke-Scalar "select status from public.appointments where id='$($appointments.E)'"
  $jobStateE = Invoke-Scalar "select state from public.appointment_reminder_jobs where id='$($jobs.E)'"
  $attemptsE = [int](Invoke-Scalar "select count(*) from public.appointment_confirmation_attempts where appointment_id='$($appointments.E)'")
  $completionWon = $appointmentStateE -eq 'new' -and $jobStateE -eq 'completed' -and $attemptsE -eq 1
  $cancellationWon = $appointmentStateE -eq 'cancelled' -and $jobStateE -eq 'cancelled' -and $attemptsE -eq 0
  if (-not ($completionWon -or $cancellationWon)) { throw "E inconsistent final state appointment=$appointmentStateE job=$jobStateE attempts=$attemptsE" }
  $conflicts += Count-Failure $e
  Write-Output "E_COMPLETE_VS_CANCELLATION success=1 finalAppointment=$appointmentStateE finalJob=$jobStateE attempts=$attemptsE"

  # F. Complete versus reschedule: one transaction wins and old work cannot survive as active stale work.
  $jobExpectedF = Invoke-Scalar "select updated_at from public.appointment_reminder_jobs where id='$($jobs.F)'"
  $appointmentExpectedF = Invoke-Scalar "select updated_at from public.appointments where id='$($appointments.F)'"
  $fSql1 = CompleteSql $tenantA $adminA $jobs.F $jobExpectedF $appointmentExpectedF 'manual-conc-f-complete'
  $fSql2 = RescheduleSql $appointments.F $appointmentExpectedF 'manual-conc-f-reschedule'
  $f = @(Invoke-ConcurrentPair $fSql1 $fSql2)
  $allResults += $f
  if ((Count-Success $f) -ne 1) { throw "F complete/reschedule expected one winner: $($f.Text -join ' || ')" }
  if ([int](Invoke-Scalar "select count(*) from public.appointment_reminder_jobs j join public.appointments a on a.id=j.appointment_id and a.tenant_id=j.tenant_id where j.appointment_id='$($appointments.F)' and j.state in ('scheduled','ready') and j.appointment_updated_at<>a.updated_at") -ne 0) { throw 'F stale active job remains' }
  $conflicts += Count-Failure $f
  Write-Output 'F_COMPLETE_VS_RESCHEDULE success=1 conflicts=1 activeStale=0'

  # G. Skip versus planner: skipped identity is never recreated unchanged.
  Invoke-Sql (PlanSql $tenantA $adminA $appointments.G) | Out-Null
  $jobG = Invoke-Scalar "select id from public.appointment_reminder_jobs where appointment_id='$($appointments.G)' order by priority,created_at,id limit 1"
  $jobExpectedG = Invoke-Scalar "select updated_at from public.appointment_reminder_jobs where id='$jobG'"
  $appointmentExpectedG = Invoke-Scalar "select updated_at from public.appointments where id='$($appointments.G)'"
  $planKeyG = Invoke-Scalar "select plan_key from public.appointment_reminder_jobs where id='$jobG'"
  $gSql1 = SkipSql $tenantA $adminA $jobG $jobExpectedG $appointmentExpectedG 'manual-conc-g-skip'
  $gSql2 = PlanSql $tenantA $adminA $appointments.G
  $g = @(Invoke-ConcurrentPair $gSql1 $gSql2)
  $allResults += $g
  if ((Count-Success $g) -ne 2) { throw "G skip/planner failed: $($g.Text -join ' || ')" }
  if ([int](Invoke-Scalar "select count(*) from public.appointment_reminder_jobs where tenant_id='$tenantA' and plan_key='$planKeyG'") -ne 1) { throw 'G planner recreated skipped identity' }
  if ((Invoke-Scalar "select state from public.appointment_reminder_jobs where id='$jobG'") -ne 'skipped') { throw 'G job not skipped' }
  Write-Output 'G_SKIP_VS_PLANNER success=2 skippedIdentityRows=1'

  # H. Defer versus planner: manual due override survives and no duplicate active identity exists.
  Invoke-Sql (PlanSql $tenantA $adminA $appointments.H) | Out-Null
  $jobH = Invoke-Scalar "select id from public.appointment_reminder_jobs where appointment_id='$($appointments.H)' order by priority,created_at,id limit 1"
  $jobExpectedH = Invoke-Scalar "select updated_at from public.appointment_reminder_jobs where id='$jobH'"
  $appointmentExpectedH = Invoke-Scalar "select updated_at from public.appointments where id='$($appointments.H)'"
  $planKeyH = Invoke-Scalar "select plan_key from public.appointment_reminder_jobs where id='$jobH'"
  $hSql1 = DeferSql $tenantA $adminA $jobH '2027-02-01 10:00+00' $jobExpectedH $appointmentExpectedH 'manual-conc-h-defer'
  $hSql2 = PlanSql $tenantA $adminA $appointments.H
  $h = @(Invoke-ConcurrentPair $hSql1 $hSql2)
  $allResults += $h
  if ((Count-Success $h) -ne 2) { throw "H defer/planner failed: $($h.Text -join ' || ')" }
  if ([int](Invoke-Scalar "select count(*) from public.appointment_reminder_jobs where tenant_id='$tenantA' and plan_key='$planKeyH'") -ne 1) { throw 'H duplicate deferred identity' }
  if ((Invoke-Scalar "select due_at='2027-02-01 10:00+00'::timestamptz and deferred_at is not null from public.appointment_reminder_jobs where id='$jobH'") -ne 't') { throw 'H defer override was lost' }
  Write-Output 'H_DEFER_VS_PLANNER success=2 activeIdentityRows=1 overridePreserved=true'

  # I. Same operation key in different tenants is independent.
  $jobExpectedIA = Invoke-Scalar "select updated_at from public.appointment_reminder_jobs where id='$($jobs.IA)'"
  $appointmentExpectedIA = Invoke-Scalar "select updated_at from public.appointments where id='$($appointments.IA)'"
  $jobExpectedIB = Invoke-Scalar "select updated_at from public.appointment_reminder_jobs where id='$($jobs.IB)'"
  $appointmentExpectedIB = Invoke-Scalar "select updated_at from public.appointments where id='$($appointments.IB)'"
  $iSql1 = CompleteSql $tenantA $adminA $jobs.IA $jobExpectedIA $appointmentExpectedIA 'manual-conc-cross-tenant-001'
  $iSql2 = CompleteSql $tenantB $adminB $jobs.IB $jobExpectedIB $appointmentExpectedIB 'manual-conc-cross-tenant-001'
  $i = @(Invoke-ConcurrentPair $iSql1 $iSql2)
  $allResults += $i
  if ((Count-Success $i) -ne 2) { throw "I cross-tenant same key failed: $($i.Text -join ' || ')" }
  if ([int](Invoke-Scalar "select count(*) from public.appointment_operations where operation_key='manual-conc-cross-tenant-001' and tenant_id in ('$tenantA','$tenantB')") -ne 2) { throw 'I operation key was not tenant scoped' }
  Write-Output 'I_CROSS_TENANT_SAME_KEY success=2 operations=2 tenants=2'

  # J. Aggregate invariants and deadlock count.
  $completed = [int](Invoke-Scalar "select count(*) from public.appointment_reminder_jobs where tenant_id in ('$tenantA','$tenantB') and state='completed'")
  $skipped = [int](Invoke-Scalar "select count(*) from public.appointment_reminder_jobs where tenant_id in ('$tenantA','$tenantB') and state='skipped'")
  $deferred = [int](Invoke-Scalar "select count(*) from public.appointment_reminder_jobs where tenant_id in ('$tenantA','$tenantB') and deferred_at is not null")
  $attempts = [int](Invoke-Scalar "select count(*) from public.appointment_confirmation_attempts where tenant_id in ('$tenantA','$tenantB')")
  $audit = [int](Invoke-Scalar "select count(*) from public.audit_events where tenant_id in ('$tenantA','$tenantB') and action in ('appointment_reminder_completed','appointment_reminder_deferred','appointment_reminder_skipped')")
  $activity = [int](Invoke-Scalar "select count(*) from public.activity_events where tenant_id in ('$tenantA','$tenantB') and type in ('appointment_reminder_completed','appointment_reminder_deferred','appointment_reminder_skipped')")
  $duplicateActive = [int](Invoke-Scalar "select count(*) from (select tenant_id,plan_key,count(*) from public.appointment_reminder_jobs where tenant_id in ('$tenantA','$tenantB') and state in ('scheduled','ready') group by 1,2 having count(*)>1) q")
  $activeStale = [int](Invoke-Scalar "select count(*) from public.appointment_reminder_jobs j join public.appointments a on a.id=j.appointment_id and a.tenant_id=j.tenant_id join public.tenant_reminder_policies p on p.tenant_id=j.tenant_id where j.tenant_id in ('$tenantA','$tenantB') and j.state in ('scheduled','ready') and (j.appointment_updated_at<>a.updated_at or j.policy_version<>p.policy_version)")
  $deadlocks = Count-Deadlocks $allResults

  if ($audit -ne $activity) { throw "Audit/activity mismatch audit=$audit activity=$activity" }
  if ($duplicateActive -ne 0 -or $activeStale -ne 0) { throw "Queue invariant failed duplicateActive=$duplicateActive activeStale=$activeStale" }
  if ($deadlocks -ne 0) { throw "Deadlocks detected: $deadlocks" }

  Write-Output "J_AGGREGATE completed=$completed skipped=$skipped deferred=$deferred attempts=$attempts replays=$replays conflicts=$conflicts audit=$audit activity=$activity duplicateActive=$duplicateActive activeStale=$activeStale deadlocks=$deadlocks"
  Write-Output 'APPOINTMENT-REMINDER-MANUAL-OPERATIONS-001 CONCURRENCY VALIDATION PASSED'
}
finally {
  Invoke-Sql $cleanup | Out-Null
  $remaining = Invoke-Scalar "select (select count(*) from public.tenants where id in ('$tenantA','$tenantB')) + (select count(*) from auth.users where id in ('$adminA','$adminB'))"
  if ([int]$remaining -ne 0) { throw "Concurrency cleanup failed: remaining=$remaining" }
}

