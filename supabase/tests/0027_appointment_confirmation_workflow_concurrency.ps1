$ErrorActionPreference = 'Stop'

# APPOINTMENT-CONFIRMATION-WORKFLOW-001 local-only concurrency validation.
$container = (docker ps --format '{{.Names}}' | Where-Object { $_ -like 'supabase_db_*' } | Select-Object -First 1)
if (-not $container) { throw 'Local Supabase DB container is not running.' }

$tenantA = 'c2710000-0000-4000-8000-000000000001'
$tenantB = 'c2710000-0000-4000-8000-000000000002'
$adminA = 'c2720000-0000-4000-8000-000000000001'
$adminB = 'c2720000-0000-4000-8000-000000000002'
$patientA1 = 'c2730000-0000-4000-8000-000000000001'
$patientA2 = 'c2730000-0000-4000-8000-000000000002'
$patientB1 = 'c2730000-0000-4000-8000-000000000003'
$doctorA1 = 'c2740000-0000-4000-8000-000000000001'
$doctorA2 = 'c2740000-0000-4000-8000-000000000002'
$doctorB1 = 'c2740000-0000-4000-8000-000000000003'

$ids = @{
  A = 'c2750000-0000-4000-8000-000000000001'
  B = 'c2750000-0000-4000-8000-000000000002'
  C = 'c2750000-0000-4000-8000-000000000003'
  D = 'c2750000-0000-4000-8000-000000000004'
  E = 'c2750000-0000-4000-8000-000000000005'
  F = 'c2750000-0000-4000-8000-000000000006'
  G = 'c2750000-0000-4000-8000-000000000007'
  HA = 'c2750000-0000-4000-8000-000000000008'
  HB = 'c2750000-0000-4000-8000-000000000009'
  I = 'c2750000-0000-4000-8000-000000000010'
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

function AttemptSql([string]$userId, [string]$tenantId, [string]$appointmentId, [string]$channel, [string]$outcome, [string]$note, [string]$expected, [string]$key) {
  return (AuthContext $userId) + "SELECT (r->>'operationType') || '|' || (r->>'replayed') || '|' || (r#>>'{confirmationAttempt,id}') FROM (SELECT public.record_appointment_confirmation_attempt('$tenantId','$appointmentId','$channel','$outcome','$note','$expected','$key') r) q; COMMIT;"
}

function ConfirmSql([string]$userId, [string]$tenantId, [string]$appointmentId, [string]$channel, [string]$note, [string]$expected, [string]$key) {
  return (AuthContext $userId) + "SELECT (r->>'operationType') || '|' || (r->>'replayed') || '|' || (r#>>'{confirmationAttempt,id}') FROM (SELECT public.confirm_appointment('$tenantId','$appointmentId','$channel','$note','$expected','$key') r) q; COMMIT;"
}

function CancelSql([string]$appointmentId, [string]$expected, [string]$key) {
  return (AuthContext $adminA) + "SELECT r->>'operationType' FROM (SELECT public.cancel_appointment('$tenantA','$appointmentId','patient','Concurrent cancellation','$expected','$key') r) q; COMMIT;"
}

function NoShowSql([string]$appointmentId, [string]$expected, [string]$key) {
  return (AuthContext $adminA) + "SELECT r->>'operationType' FROM (SELECT public.mark_appointment_no_show('$tenantA','$appointmentId','Concurrent no-show','$expected','$key') r) q; COMMIT;"
}

function RescheduleSql([string]$appointmentId, [string]$expected, [string]$key) {
  return (AuthContext $adminA) + "SELECT r->>'operationType' FROM (SELECT public.reschedule_appointment('$tenantA','$appointmentId','$patientA1','$doctorA2','2027-01-06 10:00+00','2027-01-06 11:00+00','QA','Concurrent move','new','unpaid','phone',1,null,'$expected','$key') r) q; COMMIT;"
}

function Count-Success([object[]]$results) { return @($results | Where-Object { $_.Code -eq 0 }).Count }
function Count-Conflict([object[]]$results) { return @($results | Where-Object { $_.Code -ne 0 }).Count }
function Count-Replay([object[]]$results) { return @($results | Where-Object { $_.Text -match '\|true\|' }).Count }
function Count-Deadlocks([object[]]$results) { return @($results | Where-Object { $_.Text -match 'deadlock detected' }).Count }

function Assert-OneWinner([object[]]$results, [string]$name) {
  $success = Count-Success $results
  $conflict = Count-Conflict $results
  if ($success -ne 1 -or $conflict -ne 1) {
    throw "$name expected one success and one controlled conflict; success=$success conflict=$conflict outputs=$($results.Text -join ' || ')"
  }
}

$cleanup = @"
DELETE FROM public.tenants WHERE id IN ('$tenantA'::uuid,'$tenantB'::uuid);
DELETE FROM auth.users WHERE id IN ('$adminA'::uuid,'$adminB'::uuid);
"@

$setupAppointments = @(
  @($ids.A,$tenantA,$patientA1,$doctorA1,'2027-01-01 08:00+00','2027-01-01 09:00+00'),
  @($ids.B,$tenantA,$patientA1,$doctorA1,'2027-01-02 08:00+00','2027-01-02 09:00+00'),
  @($ids.C,$tenantA,$patientA1,$doctorA1,'2027-01-03 08:00+00','2027-01-03 09:00+00'),
  @($ids.D,$tenantA,$patientA1,$doctorA1,'2027-01-04 08:00+00','2027-01-04 09:00+00'),
  @($ids.E,$tenantA,$patientA1,$doctorA1,'2027-01-05 08:00+00','2027-01-05 09:00+00'),
  @($ids.F,$tenantA,$patientA1,$doctorA1,'2027-01-06 08:00+00','2027-01-06 09:00+00'),
  @($ids.G,$tenantA,$patientA1,$doctorA1,'2027-01-07 08:00+00','2027-01-07 09:00+00'),
  @($ids.HA,$tenantA,$patientA1,$doctorA2,'2027-01-08 08:00+00','2027-01-08 09:00+00'),
  @($ids.HB,$tenantB,$patientB1,$doctorB1,'2027-01-08 08:00+00','2027-01-08 09:00+00'),
  @($ids.I,$tenantA,$patientA2,$doctorA2,'2027-01-09 08:00+00','2027-01-09 09:00+00')
)
$appointmentValues = ($setupAppointments | ForEach-Object { "('$($_[0])','$($_[1])','$($_[2])','$($_[3])','QA','Confirmation $($_[0])','new','unpaid','phone',1,'$($_[4])','$($_[5])')" }) -join ",`n"

$setup = @"
BEGIN;
$cleanup
INSERT INTO public.tenants(id,name) VALUES ('$tenantA','ACW concurrency A'),('$tenantB','ACW concurrency B');
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
 ('$adminA','00000000-0000-0000-0000-000000000000','authenticated','authenticated','acw-concurrency-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
 ('$adminB','00000000-0000-0000-0000-000000000000','authenticated','authenticated','acw-concurrency-b@example.local','x',now(),'{"provider":"email"}','{}',now(),now());
INSERT INTO public.profiles(id) VALUES ('$adminA'),('$adminB');
INSERT INTO public.tenant_users(tenant_id,user_id,role) VALUES ('$tenantA','$adminA','clinic_admin'),('$tenantB','$adminB','clinic_admin');
INSERT INTO public.patients(id,tenant_id,full_name,phone,source,status) VALUES
 ('$patientA1','$tenantA','ACW Concurrent A1','+77002711001','phone','active'),
 ('$patientA2','$tenantA','ACW Concurrent A2','+77002711002','phone','active'),
 ('$patientB1','$tenantB','ACW Concurrent B1','+77002711003','phone','active');
INSERT INTO public.doctors(id,tenant_id,full_name,specialization,cabinet,color,active) VALUES
 ('$doctorA1','$tenantA','ACW Doctor A1','General','A1','#111111',true),
 ('$doctorA2','$tenantA','ACW Doctor A2','General','A2','#222222',true),
 ('$doctorB1','$tenantB','ACW Doctor B1','General','B1','#333333',true);
INSERT INTO public.appointments(id,tenant_id,patient_id,doctor_id,cabinet,service,status,payment_type,source,price,start_time,end_time) VALUES
$appointmentValues;
COMMIT;
"@

$allResults = @()
$totalSuccess = 0
$totalReplay = 0
$totalConflict = 0

try {
  Invoke-Sql $setup | Out-Null
  $updated = @{}
  foreach ($name in $ids.Keys) { $updated[$name] = Invoke-Scalar "select updated_at from public.appointments where id='$($ids[$name])'" }

  # A. Same attempt key and payload: one logical attempt, both callers receive it.
  $aSql = AttemptSql $adminA $tenantA $ids.A 'phone' 'no_answer' 'Same attempt' $updated.A 'acw-conc-a-same'
  $a = @(Invoke-ConcurrentPair $aSql $aSql); $allResults += $a
  if ((Count-Success $a) -ne 2 -or (Count-Replay $a) -ne 1) { throw "A replay failed: $($a.Text -join ' || ')" }
  $totalSuccess += 2; $totalReplay += 1
  Write-Output "A_SAME_ATTEMPT_KEY success=2 replay=$(Count-Replay $a)"

  # B. Same key with different outcomes: one success, one idempotency conflict.
  $b = @(Invoke-ConcurrentPair `
    (AttemptSql $adminA $tenantA $ids.B 'phone' 'no_answer' 'Outcome one' $updated.B 'acw-conc-b-conflict') `
    (AttemptSql $adminA $tenantA $ids.B 'phone' 'callback_requested' 'Outcome two' $updated.B 'acw-conc-b-conflict'))
  $allResults += $b; Assert-OneWinner $b 'B changed attempt outcome'
  $totalSuccess += 1; $totalConflict += 1
  Write-Output 'B_CHANGED_OUTCOME success=1 conflict=1'

  # C. Different keys with one expected version: optimistic locking intentionally allows one.
  $c = @(Invoke-ConcurrentPair `
    (AttemptSql $adminA $tenantA $ids.C 'phone' 'no_answer' 'First operator' $updated.C 'acw-conc-c-one') `
    (AttemptSql $adminA $tenantA $ids.C 'whatsapp' 'message_sent' 'Second operator' $updated.C 'acw-conc-c-two'))
  $allResults += $c; Assert-OneWinner $c 'C different attempt keys'
  $totalSuccess += 1; $totalConflict += 1
  Write-Output 'C_DIFFERENT_ATTEMPTS success=1 conflict=1'

  # D. Confirmation versus cancellation: exactly one lifecycle action wins.
  $d = @(Invoke-ConcurrentPair `
    (ConfirmSql $adminA $tenantA $ids.D 'phone' 'Confirm race' $updated.D 'acw-conc-d-confirm') `
    (CancelSql $ids.D $updated.D 'acw-conc-d-cancel'))
  $allResults += $d; Assert-OneWinner $d 'D confirm versus cancel'
  $totalSuccess += 1; $totalConflict += 1
  Write-Output "D_CONFIRM_VS_CANCEL success=1 conflict=1 final=$(Invoke-Scalar "select status||'|'||confirmation_state from public.appointments where id='$($ids.D)'")"

  # E. Confirmation versus no-show: exactly one wins.
  $e = @(Invoke-ConcurrentPair `
    (ConfirmSql $adminA $tenantA $ids.E 'whatsapp' 'Confirm race' $updated.E 'acw-conc-e-confirm') `
    (NoShowSql $ids.E $updated.E 'acw-conc-e-noshow'))
  $allResults += $e; Assert-OneWinner $e 'E confirm versus no-show'
  $totalSuccess += 1; $totalConflict += 1
  Write-Output "E_CONFIRM_VS_NOSHOW success=1 conflict=1 final=$(Invoke-Scalar "select status||'|'||confirmation_state from public.appointments where id='$($ids.E)'")"

  # F. Confirmation versus reschedule: no lost update.
  $f = @(Invoke-ConcurrentPair `
    (ConfirmSql $adminA $tenantA $ids.F 'phone' 'Confirm while moving' $updated.F 'acw-conc-f-confirm') `
    (RescheduleSql $ids.F $updated.F 'acw-conc-f-reschedule'))
  $allResults += $f; Assert-OneWinner $f 'F confirm versus reschedule'
  $totalSuccess += 1; $totalConflict += 1
  Write-Output "F_CONFIRM_VS_RESCHEDULE success=1 conflict=1 final=$(Invoke-Scalar "select start_time||'|'||confirmation_state from public.appointments where id='$($ids.F)'")"

  # G. Duplicate direct confirm with same key: one logical confirmation.
  $gSql = ConfirmSql $adminA $tenantA $ids.G 'whatsapp' 'Same confirmation' $updated.G 'acw-conc-g-same'
  $g = @(Invoke-ConcurrentPair $gSql $gSql); $allResults += $g
  if ((Count-Success $g) -ne 2 -or (Count-Replay $g) -ne 1) { throw "G replay failed: $($g.Text -join ' || ')" }
  $totalSuccess += 2; $totalReplay += 1
  Write-Output "G_DUPLICATE_CONFIRM success=2 replay=$(Count-Replay $g)"

  # H. Same key in different tenants is independent.
  $h = @(Invoke-ConcurrentPair `
    (ConfirmSql $adminA $tenantA $ids.HA 'phone' 'Tenant A' $updated.HA 'acw-conc-h-same') `
    (ConfirmSql $adminB $tenantB $ids.HB 'phone' 'Tenant B' $updated.HB 'acw-conc-h-same'))
  $allResults += $h
  if ((Count-Success $h) -ne 2) { throw "H tenant isolation failed: $($h.Text -join ' || ')" }
  $totalSuccess += 2
  Write-Output "H_TENANT_ISOLATION success=2 operationRows=$(Invoke-Scalar "select count(*) from public.appointment_operations where operation_key='acw-conc-h-same'")"

  # I. A stale expected version is rejected after one successful attempt.
  $iFirst = AttemptSql $adminA $tenantA $ids.I 'phone' 'no_answer' 'Fresh version' $updated.I 'acw-conc-i-first'
  $iResult = @(Invoke-ConcurrentPair $iFirst ((AuthContext $adminA) + 'SELECT 1; COMMIT;'))
  $allResults += $iResult
  if ((Count-Success $iResult) -ne 2) { throw 'I setup attempt failed' }
  $staleSql = ConfirmSql $adminA $tenantA $ids.I 'phone' 'Stale version' $updated.I 'acw-conc-i-stale'
  $stale = @(Invoke-ConcurrentPair $staleSql $staleSql); $allResults += $stale
  if ((Count-Success $stale) -ne 0 -or (Count-Conflict $stale) -ne 2) { throw "I stale version should fail twice: $($stale.Text -join ' || ')" }
  $totalSuccess += 1; $totalConflict += 2
  Write-Output 'I_STALE_VERSION success=0 conflict=2'

  $deadlocks = Count-Deadlocks $allResults
  $attemptRows = [int](Invoke-Scalar "select count(*) from public.appointment_confirmation_attempts where tenant_id in ('$tenantA','$tenantB') and operation_key like 'acw-conc-%'")
  $confirmationRows = [int](Invoke-Scalar "select count(*) from public.appointment_confirmation_attempts where tenant_id in ('$tenantA','$tenantB') and operation_key like 'acw-conc-%' and outcome='confirmed'")
  $operationRows = [int](Invoke-Scalar "select count(*) from public.appointment_operations where tenant_id in ('$tenantA','$tenantB') and operation_type in ('confirmation_attempt','confirm') and operation_key like 'acw-conc-%'")
  $auditCount = [int](Invoke-Scalar "select count(*) from public.audit_events where tenant_id in ('$tenantA','$tenantB') and request_id like 'acw-conc-%' and action in ('appointment_confirmation_attempted','appointment_confirmed')")
  $activityCount = [int](Invoke-Scalar "select count(*) from public.activity_events where tenant_id in ('$tenantA','$tenantB') and metadata->>'operationKey' like 'acw-conc-%' and type in ('appointment_confirmation_attempted','appointment_confirmed')")
  $duplicateKeys = [int](Invoke-Scalar "select count(*) from (select tenant_id,operation_key,count(*) c from public.appointment_operations where operation_key like 'acw-conc-%' group by tenant_id,operation_key having count(*)>1) q")

  if ($attemptRows -ne $operationRows -or $operationRows -ne $auditCount -or $auditCount -ne $activityCount) {
    throw "Confirmation totals differ attempts=$attemptRows operations=$operationRows audit=$auditCount activity=$activityCount"
  }
  if ($duplicateKeys -ne 0) { throw "Duplicate tenant operation keys remain: $duplicateKeys" }
  if ($deadlocks -ne 0) { throw "Deadlocks detected: $deadlocks" }

  Write-Output "FINAL successCount=$totalSuccess replayCount=$totalReplay conflictCount=$totalConflict attempts=$attemptRows confirmations=$confirmationRows operations=$operationRows audit=$auditCount activity=$activityCount duplicateKeys=$duplicateKeys deadlocks=$deadlocks"
  Write-Output 'APPOINTMENT-CONFIRMATION-WORKFLOW-001 CONCURRENCY VALIDATION PASSED'
}
finally {
  Invoke-Sql $cleanup | Out-Null
  $remaining = Invoke-Scalar "select (select count(*) from public.tenants where id in ('$tenantA','$tenantB')) + (select count(*) from auth.users where id in ('$adminA','$adminB'))"
  if ([int]$remaining -ne 0) { throw "Concurrency cleanup failed: remaining=$remaining" }
}
