$ErrorActionPreference = 'Stop'

# APPOINTMENT-CANCELLATION-NOSHOW-001 local-only concurrency validation.
$container = (docker ps --format '{{.Names}}' | Where-Object { $_ -like 'supabase_db_*' } | Select-Object -First 1)
if (-not $container) { throw 'Local Supabase DB container is not running.' }

$tenantA = 'c2610000-0000-4000-8000-000000000001'
$tenantB = 'c2610000-0000-4000-8000-000000000002'
$adminA = 'c2620000-0000-4000-8000-000000000001'
$adminB = 'c2620000-0000-4000-8000-000000000002'
$patientA1 = 'c2630000-0000-4000-8000-000000000001'
$patientA2 = 'c2630000-0000-4000-8000-000000000002'
$patientB1 = 'c2630000-0000-4000-8000-000000000003'
$doctorA1 = 'c2640000-0000-4000-8000-000000000001'
$doctorA2 = 'c2640000-0000-4000-8000-000000000002'
$doctorB1 = 'c2640000-0000-4000-8000-000000000003'

$ids = @{
  A = 'c2650000-0000-4000-8000-000000000001'
  B = 'c2650000-0000-4000-8000-000000000002'
  C = 'c2650000-0000-4000-8000-000000000003'
  D = 'c2650000-0000-4000-8000-000000000004'
  E = 'c2650000-0000-4000-8000-000000000005'
  F = 'c2650000-0000-4000-8000-000000000006'
  G = 'c2650000-0000-4000-8000-000000000007'
  H = 'c2650000-0000-4000-8000-000000000008'
  IA = 'c2650000-0000-4000-8000-000000000009'
  IB = 'c2650000-0000-4000-8000-000000000010'
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

function CancelSql([string]$userId, [string]$tenantId, [string]$appointmentId, [string]$source, [string]$reason, [string]$expected, [string]$key) {
  return (AuthContext $userId) + "SELECT (r->>'operationType') || '|' || (r->>'replayed') || '|' || (r#>>'{appointment,id}') FROM (SELECT public.cancel_appointment('$tenantId','$appointmentId','$source','$reason','$expected','$key') r) q; COMMIT;"
}

function NoShowSql([string]$userId, [string]$tenantId, [string]$appointmentId, [string]$reason, [string]$expected, [string]$key) {
  return (AuthContext $userId) + "SELECT (r->>'operationType') || '|' || (r->>'replayed') || '|' || (r#>>'{appointment,id}') FROM (SELECT public.mark_appointment_no_show('$tenantId','$appointmentId','$reason','$expected','$key') r) q; COMMIT;"
}

function CreateSql([string]$userId, [string]$tenantId, [string]$patientId, [string]$doctorId, [string]$start, [string]$end, [string]$key) {
  return (AuthContext $userId) + "SELECT (r->>'operationType') || '|' || (r->>'replayed') || '|' || (r#>>'{appointment,id}') FROM (SELECT public.create_appointment('$tenantId','$patientId','$doctorId','$start','$end','QA','Concurrent booking','new','unpaid','phone',1,null,'$key') r) q; COMMIT;"
}

function RescheduleSql([string]$appointmentId, [string]$patientId, [string]$doctorId, [string]$start, [string]$end, [string]$expected, [string]$key) {
  return (AuthContext $adminA) + "SELECT (r->>'operationType') || '|' || (r->>'replayed') || '|' || (r#>>'{appointment,id}') FROM (SELECT public.reschedule_appointment('$tenantA','$appointmentId','$patientId','$doctorId','$start','$end','QA','Concurrent move','new','unpaid','phone',1,null,'$expected','$key') r) q; COMMIT;"
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
  @($ids.A,$tenantA,$patientA1,$doctorA1,'2026-11-01 08:00+00','2026-11-01 09:00+00','new'),
  @($ids.B,$tenantA,$patientA1,$doctorA1,'2026-11-02 08:00+00','2026-11-02 09:00+00','new'),
  @($ids.C,$tenantA,$patientA1,$doctorA1,'2026-11-03 08:00+00','2026-11-03 09:00+00','new'),
  @($ids.D,$tenantA,$patientA1,$doctorA1,'2026-11-04 08:00+00','2026-11-04 09:00+00','confirmed'),
  @($ids.E,$tenantA,$patientA1,$doctorA1,'2026-11-05 08:00+00','2026-11-05 09:00+00','new'),
  @($ids.F,$tenantA,$patientA1,$doctorA1,'2026-11-06 08:00+00','2026-11-06 09:00+00','new'),
  @($ids.G,$tenantA,$patientA1,$doctorA1,'2026-11-07 08:00+00','2026-11-07 09:00+00','confirmed'),
  @($ids.H,$tenantA,$patientA1,$doctorA1,'2026-11-08 08:00+00','2026-11-08 09:00+00','new'),
  @($ids.IA,$tenantA,$patientA1,$doctorA2,'2026-11-09 08:00+00','2026-11-09 09:00+00','new'),
  @($ids.IB,$tenantB,$patientB1,$doctorB1,'2026-11-09 08:00+00','2026-11-09 09:00+00','new')
)
$appointmentValues = ($setupAppointments | ForEach-Object { "('$($_[0])','$($_[1])','$($_[2])','$($_[3])','QA','Lifecycle $($_[0])','$($_[6])','unpaid','phone',1,'$($_[4])','$($_[5])')" }) -join ",`n"

$setup = @"
BEGIN;
$cleanup
INSERT INTO public.tenants(id,name) VALUES ('$tenantA','ACN concurrency A'),('$tenantB','ACN concurrency B');
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
 ('$adminA','00000000-0000-0000-0000-000000000000','authenticated','authenticated','acn-concurrency-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
 ('$adminB','00000000-0000-0000-0000-000000000000','authenticated','authenticated','acn-concurrency-b@example.local','x',now(),'{"provider":"email"}','{}',now(),now());
INSERT INTO public.profiles(id) VALUES ('$adminA'),('$adminB');
INSERT INTO public.tenant_users(tenant_id,user_id,role) VALUES ('$tenantA','$adminA','clinic_admin'),('$tenantB','$adminB','clinic_admin');
INSERT INTO public.patients(id,tenant_id,full_name,phone,source,status) VALUES
 ('$patientA1','$tenantA','ACN Concurrent A1','+77002631001','phone','active'),
 ('$patientA2','$tenantA','ACN Concurrent A2','+77002631002','phone','active'),
 ('$patientB1','$tenantB','ACN Concurrent B1','+77002631003','phone','active');
INSERT INTO public.doctors(id,tenant_id,full_name,specialization,cabinet,color,active) VALUES
 ('$doctorA1','$tenantA','ACN Doctor A1','General','A1','#111111',true),
 ('$doctorA2','$tenantA','ACN Doctor A2','General','A2','#222222',true),
 ('$doctorB1','$tenantB','ACN Doctor B1','General','B1','#333333',true);
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

  # A. Same cancellation key and payload: both callers return one logical action.
  $aSql = CancelSql $adminA $tenantA $ids.A 'patient' 'Same cancellation' $updated.A 'acn-conc-a-same'
  $a = @(Invoke-ConcurrentPair $aSql $aSql); $allResults += $a
  if ((Count-Success $a) -ne 2 -or (Count-Replay $a) -ne 1) { throw "A replay failed: $($a.Text -join ' || ')" }
  $totalSuccess += 2; $totalReplay += 1
  Write-Output "A_SAME_CANCEL_KEY success=2 replay=$(Count-Replay $a)"

  # B. Same cancellation key, different reason.
  $b = @(Invoke-ConcurrentPair `
    (CancelSql $adminA $tenantA $ids.B 'clinic' 'Reason one' $updated.B 'acn-conc-b-conflict') `
    (CancelSql $adminA $tenantA $ids.B 'clinic' 'Reason two' $updated.B 'acn-conc-b-conflict'))
  $allResults += $b; Assert-OneWinner $b 'B changed cancellation payload'
  $totalSuccess += 1; $totalConflict += 1
  Write-Output "B_CHANGED_CANCEL_PAYLOAD success=1 conflict=1"

  # C. Different keys race to cancel the same row.
  $c = @(Invoke-ConcurrentPair `
    (CancelSql $adminA $tenantA $ids.C 'clinic' 'Different key one' $updated.C 'acn-conc-c-one') `
    (CancelSql $adminA $tenantA $ids.C 'clinic' 'Different key two' $updated.C 'acn-conc-c-two'))
  $allResults += $c; Assert-OneWinner $c 'C different cancel keys'
  $totalSuccess += 1; $totalConflict += 1
  Write-Output "C_DIFFERENT_CANCEL_KEYS success=1 conflict=1"

  # D. Cancellation versus no-show: exactly one terminal fact wins.
  $d = @(Invoke-ConcurrentPair `
    (CancelSql $adminA $tenantA $ids.D 'patient' 'Cancelled during race' $updated.D 'acn-conc-d-cancel') `
    (NoShowSql $adminA $tenantA $ids.D 'No-show during race' $updated.D 'acn-conc-d-noshow'))
  $allResults += $d; Assert-OneWinner $d 'D cancel versus no-show'
  $totalSuccess += 1; $totalConflict += 1
  Write-Output "D_CANCEL_VS_NOSHOW success=1 conflict=1 finalStatus=$(Invoke-Scalar "select status from public.appointments where id='$($ids.D)'")"

  # E. Cancellation versus reschedule: one consistent final state, no lost update.
  $e = @(Invoke-ConcurrentPair `
    (CancelSql $adminA $tenantA $ids.E 'doctor' 'Cancel while moving' $updated.E 'acn-conc-e-cancel') `
    (RescheduleSql $ids.E $patientA1 $doctorA2 '2026-11-05 10:00+00' '2026-11-05 11:00+00' $updated.E 'acn-conc-e-reschedule'))
  $allResults += $e; Assert-OneWinner $e 'E cancel versus reschedule'
  $totalSuccess += 1; $totalConflict += 1
  Write-Output "E_CANCEL_VS_RESCHEDULE success=1 conflict=1 finalStatus=$(Invoke-Scalar "select status from public.appointments where id='$($ids.E)'")"

  # F. Cancellation versus a new booking for the same slot.
  $f = @(Invoke-ConcurrentPair `
    (CancelSql $adminA $tenantA $ids.F 'clinic' 'Release slot' $updated.F 'acn-conc-f-cancel') `
    (CreateSql $adminA $tenantA $patientA2 $doctorA1 '2026-11-06 08:00+00' '2026-11-06 09:00+00' 'acn-conc-f-book'))
  $allResults += $f
  $fSuccess = Count-Success $f; $fConflict = Count-Conflict $f
  if ($fSuccess -lt 1 -or $fSuccess -gt 2 -or $fConflict -gt 1) { throw "F unexpected race result: $($f.Text -join ' || ')" }
  if ((Invoke-Scalar "select status from public.appointments where id='$($ids.F)'") -ne 'cancelled') { throw 'F cancellation did not commit' }
  $totalSuccess += $fSuccess; $totalConflict += $fConflict
  Write-Output "F_CANCEL_VS_BOOKING success=$fSuccess conflict=$fConflict activeSlotRows=$(Invoke-Scalar "select count(*) from public.appointments where tenant_id='$tenantA' and doctor_id='$doctorA1' and start_time='2026-11-06 08:00+00' and status<>'cancelled'")"

  # G. Same no-show key and payload.
  $gSql = NoShowSql $adminA $tenantA $ids.G 'Same no-show' $updated.G 'acn-conc-g-same'
  $g = @(Invoke-ConcurrentPair $gSql $gSql); $allResults += $g
  if ((Count-Success $g) -ne 2 -or (Count-Replay $g) -ne 1) { throw "G replay failed: $($g.Text -join ' || ')" }
  $totalSuccess += 2; $totalReplay += 1
  Write-Output "G_SAME_NOSHOW_KEY success=2 replay=$(Count-Replay $g)"

  # H. Different no-show payloads, same key.
  $h = @(Invoke-ConcurrentPair `
    (NoShowSql $adminA $tenantA $ids.H 'No-show reason one' $updated.H 'acn-conc-h-conflict') `
    (NoShowSql $adminA $tenantA $ids.H 'No-show reason two' $updated.H 'acn-conc-h-conflict'))
  $allResults += $h; Assert-OneWinner $h 'H changed no-show payload'
  $totalSuccess += 1; $totalConflict += 1
  Write-Output "H_CHANGED_NOSHOW_PAYLOAD success=1 conflict=1"

  # I. Same key in different tenants is independent.
  $i = @(Invoke-ConcurrentPair `
    (CancelSql $adminA $tenantA $ids.IA 'technical' 'Tenant A independent' $updated.IA 'acn-conc-i-same') `
    (CancelSql $adminB $tenantB $ids.IB 'technical' 'Tenant B independent' $updated.IB 'acn-conc-i-same'))
  $allResults += $i
  if ((Count-Success $i) -ne 2) { throw "I tenant isolation failed: $($i.Text -join ' || ')" }
  $totalSuccess += 2
  Write-Output "I_TENANT_ISOLATION success=2 operationRows=$(Invoke-Scalar "select count(*) from public.appointment_operations where operation_key='acn-conc-i-same'")"

  $deadlocks = Count-Deadlocks $allResults
  $cancelledRows = [int](Invoke-Scalar "select count(*) from public.appointments where tenant_id in ('$tenantA','$tenantB') and status='cancelled'")
  $noShowRows = [int](Invoke-Scalar "select count(*) from public.appointments where tenant_id in ('$tenantA','$tenantB') and status='no_show'")
  $lifecycleOps = [int](Invoke-Scalar "select count(*) from public.appointment_operations where tenant_id in ('$tenantA','$tenantB') and operation_type in ('cancel','no_show') and operation_key like 'acn-conc-%'")
  $auditCount = [int](Invoke-Scalar "select count(*) from public.audit_events where tenant_id in ('$tenantA','$tenantB') and request_id like 'acn-conc-%' and action in ('appointment_cancelled','appointment_no_show_marked')")
  $activityCount = [int](Invoke-Scalar "select count(*) from public.activity_events where tenant_id in ('$tenantA','$tenantB') and metadata->>'operationKey' like 'acn-conc-%' and type in ('appointment_cancelled','appointment_no_show_marked')")
  $activeOverlaps = [int](Invoke-Scalar "select count(*) from public.appointments a join public.appointments b on b.id>a.id and b.tenant_id=a.tenant_id and a.status<>'cancelled' and b.status<>'cancelled' and b.start_time<a.end_time and b.end_time>a.start_time and (b.doctor_id=a.doctor_id or (a.patient_id is not null and b.patient_id=a.patient_id)) where a.tenant_id in ('$tenantA','$tenantB')")

  if ($lifecycleOps -ne ($auditCount) -or $auditCount -ne $activityCount) {
    throw "Lifecycle event totals differ operations=$lifecycleOps audit=$auditCount activity=$activityCount"
  }
  if ($activeOverlaps -ne 0) { throw "Active overlap pairs remain: $activeOverlaps" }
  if ($deadlocks -ne 0) { throw "Deadlocks detected: $deadlocks" }

  Write-Output "FINAL successCount=$totalSuccess replayCount=$totalReplay conflictCount=$totalConflict cancelledRows=$cancelledRows noShowRows=$noShowRows auditCount=$auditCount activityCount=$activityCount activeOverlapPairs=$activeOverlaps deadlocks=$deadlocks"
  Write-Output 'APPOINTMENT-CANCELLATION-NOSHOW-001 CONCURRENCY VALIDATION PASSED'
}
finally {
  Invoke-Sql $cleanup | Out-Null
  $remaining = Invoke-Scalar "select (select count(*) from public.tenants where id in ('$tenantA','$tenantB')) + (select count(*) from auth.users where id in ('$adminA','$adminB'))"
  if ([int]$remaining -ne 0) { throw "Concurrency cleanup failed: remaining=$remaining" }
}
