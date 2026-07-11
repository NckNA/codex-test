$ErrorActionPreference = 'Stop'

# APPOINTMENT-CONFLICT-HARDENING-001 local-only concurrency validation.
$container = (docker ps --format '{{.Names}}' | Where-Object { $_ -like 'supabase_db_*' } | Select-Object -First 1)
if (-not $container) { throw 'Local Supabase DB container is not running.' }

$tenantA = 'c2510000-0000-4000-8000-000000000001'
$tenantB = 'c2510000-0000-4000-8000-000000000002'
$adminA = 'c2520000-0000-4000-8000-000000000001'
$adminB = 'c2520000-0000-4000-8000-000000000002'
$patientA1 = 'c2530000-0000-4000-8000-000000000001'
$patientA2 = 'c2530000-0000-4000-8000-000000000002'
$patientA3 = 'c2530000-0000-4000-8000-000000000003'
$patientA4 = 'c2530000-0000-4000-8000-000000000004'
$patientB1 = 'c2530000-0000-4000-8000-000000000005'
$doctorA1 = 'c2540000-0000-4000-8000-000000000001'
$doctorA2 = 'c2540000-0000-4000-8000-000000000002'
$doctorA3 = 'c2540000-0000-4000-8000-000000000003'
$doctorB1 = 'c2540000-0000-4000-8000-000000000004'
$moveH1 = 'c2550000-0000-4000-8000-000000000001'
$moveH2 = 'c2550000-0000-4000-8000-000000000002'
$moveI = 'c2550000-0000-4000-8000-000000000003'

function Invoke-Sql([string]$sql) {
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = $sql | & docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q 2>&1
  $code = $LASTEXITCODE
  $ErrorActionPreference = $previousPreference
  if ($code -ne 0) { throw "SQL failed:`n$($output -join "`n")" }
  return $output
}

function Invoke-Scalar([string]$sql) {
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = & docker exec $container psql -U postgres -d postgres -Atq -v ON_ERROR_STOP=1 -c $sql 2>&1
  $code = $LASTEXITCODE
  $ErrorActionPreference = $previousPreference
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

function CreateSql(
  [string]$userId,
  [string]$tenantId,
  [string]$patientId,
  [string]$doctorId,
  [string]$startTime,
  [string]$endTime,
  [string]$service,
  [string]$operationKey
) {
  $context = AuthContext $userId
  return $context + "SELECT (r#>>'{appointment,id}') || '|' || (r->>'replayed') FROM (SELECT public.create_appointment('$tenantId','$patientId','$doctorId','$startTime','$endTime','QA','$service','new','unpaid','phone',100,null,'$operationKey') r) q; COMMIT;"
}

function InvalidCreateSql([string]$startTime, [string]$endTime, [string]$key) {
  return (AuthContext $adminA) + "SELECT public.create_appointment('$tenantA','$patientA1','$doctorA1','$startTime','$endTime','QA','Invalid','new','unpaid','phone',1,null,'$key'); COMMIT;"
}

function Assert-OneWinner([object[]]$results, [string]$name) {
  $success = @($results | Where-Object { $_.Code -eq 0 }).Count
  $conflict = @($results | Where-Object { $_.Code -ne 0 }).Count
  if ($success -ne 1 -or $conflict -ne 1) {
    throw "$name expected one success and one conflict; success=$success conflict=$conflict outputs=$($results.Text -join ' || ')"
  }
  return [pscustomobject]@{ Success = $success; Conflict = $conflict }
}

function Count-Deadlocks([object[]]$results) {
  return @($results | Where-Object { $_.Text -match 'deadlock detected' }).Count
}

$cleanup = @"
DELETE FROM public.tenants WHERE id IN ('$tenantA'::uuid,'$tenantB'::uuid);
DELETE FROM auth.users WHERE id IN ('$adminA'::uuid,'$adminB'::uuid);
"@

$setup = @"
BEGIN;
$cleanup
INSERT INTO public.tenants(id,name) VALUES
 ('$tenantA','ACH concurrency A'),
 ('$tenantB','ACH concurrency B');
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
 ('$adminA','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ach-concurrency-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
 ('$adminB','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ach-concurrency-b@example.local','x',now(),'{"provider":"email"}','{}',now(),now());
INSERT INTO public.profiles(id) VALUES ('$adminA'),('$adminB');
INSERT INTO public.tenant_users(tenant_id,user_id,role) VALUES
 ('$tenantA','$adminA','clinic_admin'),
 ('$tenantB','$adminB','clinic_admin');
INSERT INTO public.patients(id,tenant_id,full_name,phone,source,status) VALUES
 ('$patientA1','$tenantA','Concurrent A1','+77002531001','phone','active'),
 ('$patientA2','$tenantA','Concurrent A2','+77002531002','phone','active'),
 ('$patientA3','$tenantA','Concurrent A3','+77002531003','phone','active'),
 ('$patientA4','$tenantA','Concurrent A4','+77002531004','phone','active'),
 ('$patientB1','$tenantB','Concurrent B1','+77002531005','phone','active');
INSERT INTO public.doctors(id,tenant_id,full_name,specialization,cabinet,color,active) VALUES
 ('$doctorA1','$tenantA','Concurrent Doctor A1','General','A1','#111111',true),
 ('$doctorA2','$tenantA','Concurrent Doctor A2','General','A2','#222222',true),
 ('$doctorA3','$tenantA','Concurrent Doctor A3','General','A3','#333333',true),
 ('$doctorB1','$tenantB','Concurrent Doctor B1','General','B1','#444444',true);
INSERT INTO public.appointments(id,tenant_id,patient_id,doctor_id,cabinet,service,status,payment_type,source,price,start_time,end_time) VALUES
 ('$moveH1','$tenantA','$patientA1','$doctorA1','A1','Move H1','new','unpaid','phone',1,'2026-09-08 08:00+00','2026-09-08 09:00+00'),
 ('$moveH2','$tenantA','$patientA2','$doctorA2','A2','Move H2','new','unpaid','phone',1,'2026-09-08 09:00+00','2026-09-08 10:00+00'),
 ('$moveI','$tenantA','$patientA3','$doctorA3','A3','Move I','new','unpaid','phone',1,'2026-09-09 08:00+00','2026-09-09 09:00+00');
COMMIT;
"@

$allResults = @()

try {
  Invoke-Sql $setup | Out-Null
  $moveH1Updated = Invoke-Scalar "select updated_at from public.appointments where id='$moveH1'"
  $moveH2Updated = Invoke-Scalar "select updated_at from public.appointments where id='$moveH2'"
  $moveIUpdated = Invoke-Scalar "select updated_at from public.appointments where id='$moveI'"

  # A. Same doctor, exact interval.
  $a = @(Invoke-ConcurrentPair `
    (CreateSql $adminA $tenantA $patientA1 $doctorA1 '2026-09-01 10:00+00' '2026-09-01 11:00+00' 'A-exact-1' 'ach-conc-a1') `
    (CreateSql $adminA $tenantA $patientA2 $doctorA1 '2026-09-01 10:00+00' '2026-09-01 11:00+00' 'A-exact-2' 'ach-conc-a2'))
  $allResults += $a
  $ar = Assert-OneWinner $a 'A exact doctor'
  Write-Output "A_EXACT_DOCTOR success=$($ar.Success) conflict=$($ar.Conflict) rows=$(Invoke-Scalar "select count(*) from public.appointments where tenant_id='$tenantA' and start_time='2026-09-01 10:00+00'")"

  # B. Same doctor, partial overlap.
  $b = @(Invoke-ConcurrentPair `
    (CreateSql $adminA $tenantA $patientA1 $doctorA1 '2026-09-02 10:00+00' '2026-09-02 11:00+00' 'B-partial-1' 'ach-conc-b1') `
    (CreateSql $adminA $tenantA $patientA2 $doctorA1 '2026-09-02 10:30+00' '2026-09-02 11:30+00' 'B-partial-2' 'ach-conc-b2'))
  $allResults += $b
  $br = Assert-OneWinner $b 'B partial doctor'
  Write-Output "B_PARTIAL_DOCTOR success=$($br.Success) conflict=$($br.Conflict)"

  # C. Same patient, different doctors.
  $c = @(Invoke-ConcurrentPair `
    (CreateSql $adminA $tenantA $patientA3 $doctorA1 '2026-09-03 10:00+00' '2026-09-03 11:00+00' 'C-patient-1' 'ach-conc-c1') `
    (CreateSql $adminA $tenantA $patientA3 $doctorA2 '2026-09-03 10:00+00' '2026-09-03 11:00+00' 'C-patient-2' 'ach-conc-c2'))
  $allResults += $c
  $cr = Assert-OneWinner $c 'C patient conflict'
  Write-Output "C_PATIENT_CONFLICT success=$($cr.Success) conflict=$($cr.Conflict)"

  # D. Different doctor and patient resources.
  $d = @(Invoke-ConcurrentPair `
    (CreateSql $adminA $tenantA $patientA1 $doctorA1 '2026-09-04 10:00+00' '2026-09-04 11:00+00' 'D-free-1' 'ach-conc-d1') `
    (CreateSql $adminA $tenantA $patientA2 $doctorA2 '2026-09-04 10:00+00' '2026-09-04 11:00+00' 'D-free-2' 'ach-conc-d2'))
  $allResults += $d
  $dSuccess = @($d | Where-Object { $_.Code -eq 0 }).Count
  if ($dSuccess -ne 2) { throw "D different resources expected two successes: $($d.Text -join ' || ')" }
  Write-Output "D_DIFFERENT_RESOURCES success=$dSuccess conflict=0"

  # E. Back-to-back on the same doctor.
  $e = @(Invoke-ConcurrentPair `
    (CreateSql $adminA $tenantA $patientA1 $doctorA1 '2026-09-05 10:00+00' '2026-09-05 11:00+00' 'E-adjacent-1' 'ach-conc-e1') `
    (CreateSql $adminA $tenantA $patientA2 $doctorA1 '2026-09-05 11:00+00' '2026-09-05 12:00+00' 'E-adjacent-2' 'ach-conc-e2'))
  $allResults += $e
  $eSuccess = @($e | Where-Object { $_.Code -eq 0 }).Count
  if ($eSuccess -ne 2) { throw "E back-to-back expected two successes: $($e.Text -join ' || ')" }
  Write-Output "E_BACK_TO_BACK success=$eSuccess conflict=0"

  # F. Same operation key and same payload.
  $fSql = CreateSql $adminA $tenantA $patientA4 $doctorA3 '2026-09-06 10:00+00' '2026-09-06 11:00+00' 'F-replay' 'ach-conc-f-same'
  $f = @(Invoke-ConcurrentPair $fSql $fSql)
  $allResults += $f
  if (@($f | Where-Object { $_.Code -ne 0 }).Count -ne 0) { throw "F same-key replay failed: $($f.Text -join ' || ')" }
  $fIds = @($f | ForEach-Object { ($_.Text -split '\|')[0].Trim() } | Select-Object -Unique)
  $fReplay = @($f | Where-Object { $_.Text -match '\|true' }).Count
  if ($fIds.Count -ne 1 -or $fReplay -ne 1) { throw "F replay invariant failed ids=$($fIds.Count) replay=$fReplay outputs=$($f.Text -join ' || ')" }
  Write-Output "F_SAME_KEY success=2 replay=$fReplay uniqueAppointmentIds=$($fIds.Count)"

  # G. Same key with changed payload.
  $g = @(Invoke-ConcurrentPair `
    (CreateSql $adminA $tenantA $patientA1 $doctorA2 '2026-09-07 10:00+00' '2026-09-07 11:00+00' 'G-first' 'ach-conc-g-conflict') `
    (CreateSql $adminA $tenantA $patientA1 $doctorA2 '2026-09-07 11:00+00' '2026-09-07 12:00+00' 'G-second' 'ach-conc-g-conflict'))
  $allResults += $g
  $gr = Assert-OneWinner $g 'G changed payload'
  Write-Output "G_CHANGED_PAYLOAD success=$($gr.Success) conflict=$($gr.Conflict) operationRows=$(Invoke-Scalar "select count(*) from public.appointment_operations where tenant_id='$tenantA' and operation_key='ach-conc-g-conflict'")"

  # H. Two different appointments rescheduled into one doctor slot.
  $hContext = AuthContext $adminA
  $h1 = $hContext + "SELECT (r#>>'{appointment,id}') || '|' || (r->>'replayed') FROM (SELECT public.reschedule_appointment('$tenantA','$moveH1','$patientA1','$doctorA3','2026-09-08 12:00+00','2026-09-08 13:00+00','A3','Move H1','new','unpaid','phone',1,null,'$moveH1Updated','ach-conc-h1') r) q; COMMIT;"
  $h2 = $hContext + "SELECT (r#>>'{appointment,id}') || '|' || (r->>'replayed') FROM (SELECT public.reschedule_appointment('$tenantA','$moveH2','$patientA2','$doctorA3','2026-09-08 12:00+00','2026-09-08 13:00+00','A3','Move H2','new','unpaid','phone',1,null,'$moveH2Updated','ach-conc-h2') r) q; COMMIT;"
  $h = @(Invoke-ConcurrentPair $h1 $h2)
  $allResults += $h
  $hr = Assert-OneWinner $h 'H concurrent reschedule'
  Write-Output "H_RESCHEDULE success=$($hr.Success) conflict=$($hr.Conflict) slotRows=$(Invoke-Scalar "select count(*) from public.appointments where tenant_id='$tenantA' and doctor_id='$doctorA3' and start_time='2026-09-08 12:00+00' and status<>'cancelled'")"

  # I. Create versus reschedule race.
  $iCreate = CreateSql $adminA $tenantA $patientA4 $doctorA2 '2026-09-09 12:00+00' '2026-09-09 13:00+00' 'I-create' 'ach-conc-i-create'
  $iRes = (AuthContext $adminA) + "SELECT (r#>>'{appointment,id}') || '|' || (r->>'replayed') FROM (SELECT public.reschedule_appointment('$tenantA','$moveI','$patientA3','$doctorA2','2026-09-09 12:00+00','2026-09-09 13:00+00','A2','Move I','new','unpaid','phone',1,null,'$moveIUpdated','ach-conc-i-reschedule') r) q; COMMIT;"
  $i = @(Invoke-ConcurrentPair $iCreate $iRes)
  $allResults += $i
  $ir = Assert-OneWinner $i 'I create versus reschedule'
  Write-Output "I_CREATE_VS_RESCHEDULE success=$($ir.Success) conflict=$($ir.Conflict) slotRows=$(Invoke-Scalar "select count(*) from public.appointments where tenant_id='$tenantA' and doctor_id='$doctorA2' and start_time='2026-09-09 12:00+00' and status<>'cancelled'")"

  # J. Tenant-scoped keys/resources remain independent.
  $j = @(Invoke-ConcurrentPair `
    (CreateSql $adminA $tenantA $patientA1 $doctorA1 '2026-09-10 10:00+00' '2026-09-10 11:00+00' 'J-tenant-A' 'ach-conc-j-same-key') `
    (CreateSql $adminB $tenantB $patientB1 $doctorB1 '2026-09-10 10:00+00' '2026-09-10 11:00+00' 'J-tenant-B' 'ach-conc-j-same-key'))
  $allResults += $j
  $jSuccess = @($j | Where-Object { $_.Code -eq 0 }).Count
  if ($jSuccess -ne 2) { throw "J tenant isolation expected two successes: $($j.Text -join ' || ')" }
  Write-Output "J_TENANT_ISOLATION success=$jSuccess operationRows=$(Invoke-Scalar "select count(*) from public.appointment_operations where operation_key='ach-conc-j-same-key'")"

  # K. Invalid interval race never creates a row.
  $k = @(Invoke-ConcurrentPair `
    (InvalidCreateSql '2026-09-11 10:00+00' '2026-09-11 10:00+00' 'ach-conc-k-zero') `
    (InvalidCreateSql '2026-09-11 11:00+00' '2026-09-11 10:00+00' 'ach-conc-k-negative'))
  $allResults += $k
  $kRejected = @($k | Where-Object { $_.Code -ne 0 }).Count
  if ($kRejected -ne 2) { throw "K invalid intervals expected two rejections: $($k.Text -join ' || ')" }
  Write-Output "K_INVALID_INTERVAL success=0 conflict=$kRejected invalidRows=$(Invoke-Scalar "select count(*) from public.appointments where end_time<=start_time")"

  $doctorOverlaps = [int](Invoke-Scalar "select count(*) from public.appointments a join public.appointments b on b.id>a.id and b.tenant_id=a.tenant_id and b.doctor_id=a.doctor_id and a.status<>'cancelled' and b.status<>'cancelled' and b.start_time<a.end_time and b.end_time>a.start_time where a.tenant_id in ('$tenantA','$tenantB')")
  $patientOverlaps = [int](Invoke-Scalar "select count(*) from public.appointments a join public.appointments b on b.id>a.id and b.tenant_id=a.tenant_id and b.patient_id=a.patient_id and a.patient_id is not null and a.status<>'cancelled' and b.status<>'cancelled' and b.start_time<a.end_time and b.end_time>a.start_time where a.tenant_id in ('$tenantA','$tenantB')")
  $invalidIntervals = [int](Invoke-Scalar "select count(*) from public.appointments where tenant_id in ('$tenantA','$tenantB') and end_time<=start_time")
  $operationRows = [int](Invoke-Scalar "select count(*) from public.appointment_operations where tenant_id in ('$tenantA','$tenantB') and operation_key like 'ach-conc-%'")
  $appointmentRows = [int](Invoke-Scalar "select count(*) from public.appointments where tenant_id in ('$tenantA','$tenantB')")
  $uniqueAppointmentIds = [int](Invoke-Scalar "select count(distinct appointment_id) from public.appointment_operations where tenant_id in ('$tenantA','$tenantB') and operation_key like 'ach-conc-%'")
  $auditCount = [int](Invoke-Scalar "select count(*) from public.audit_events where tenant_id in ('$tenantA','$tenantB') and request_id like 'ach-conc-%' and action in ('appointment_created','appointment_rescheduled')")
  $activityCount = [int](Invoke-Scalar "select count(*) from public.activity_events where tenant_id in ('$tenantA','$tenantB') and metadata->>'operationKey' like 'ach-conc-%' and type in ('appointment_created','appointment_rescheduled')")
  $deadlocks = Count-Deadlocks $allResults

  if ($doctorOverlaps -ne 0 -or $patientOverlaps -ne 0 -or $invalidIntervals -ne 0) {
    throw "Final invariants failed doctorOverlaps=$doctorOverlaps patientOverlaps=$patientOverlaps invalidIntervals=$invalidIntervals"
  }
  if ($operationRows -ne 13 -or $auditCount -ne 13 -or $activityCount -ne 13) {
    throw "Event/idempotency totals failed operations=$operationRows audit=$auditCount activity=$activityCount"
  }
  if ($deadlocks -ne 0) { throw "Deadlocks detected: $deadlocks" }

  Write-Output "FINAL successOperations=$operationRows appointmentRows=$appointmentRows uniqueAppointmentIds=$uniqueAppointmentIds doctorOverlapPairs=$doctorOverlaps patientOverlapPairs=$patientOverlaps invalidIntervals=$invalidIntervals audit=$auditCount activity=$activityCount deadlocks=$deadlocks"
  Write-Output 'APPOINTMENT-CONFLICT-HARDENING-001 CONCURRENCY VALIDATION PASSED'
}
finally {
  Invoke-Sql $cleanup | Out-Null
  $remaining = Invoke-Scalar "select (select count(*) from public.tenants where id in ('$tenantA','$tenantB')) + (select count(*) from auth.users where id in ('$adminA','$adminB'))"
  if ([int]$remaining -ne 0) { throw "Concurrency cleanup failed: remaining=$remaining" }
}
