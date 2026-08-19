$ErrorActionPreference = 'Stop'

# LAB-WORK-MUTATION-FOUNDATION-001N local-only concurrency validation.
# Two independent PostgreSQL sessions race on the same tenant-scoped laboratory order.
$container = (docker ps --format '{{.Names}}' | Where-Object { $_ -like 'supabase_db_*' } | Select-Object -First 1)
if (-not $container) { throw 'Local Supabase DB container is not running.' }

$tenant = 'c3600000-0000-4000-8000-000000000001'
$admin = 'c3610000-0000-4000-8000-000000000001'
$patient = 'c3620000-0000-4000-8000-000000000001'
$doctor = 'c3630000-0000-4000-8000-000000000001'
$lab = 'c3640000-0000-4000-8000-000000000001'
$type1 = 'c3650000-0000-4000-8000-000000000001'
$type2 = 'c3650000-0000-4000-8000-000000000002'
$order = 'c3660000-0000-4000-8000-000000000001'
$deadlocks = 0

function Invoke-Sql([string]$sql) {
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = $sql | & docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q 2>&1
  $code = [int]$LASTEXITCODE
  $ErrorActionPreference = $old
  if ($code -ne 0) { throw "SQL failed:`n$($output -join "`n")" }
  return ($output -join "`n")
}

function Invoke-Scalar([string]$sql) {
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = & docker exec $container psql -U postgres -d postgres -Atq -v ON_ERROR_STOP=1 -c $sql 2>&1
  $code = [int]$LASTEXITCODE
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
  foreach ($result in $results) {
    if ($result.Text -match 'deadlock detected') { $script:deadlocks += 1 }
  }
  return $results
}

function Assert-True([bool]$condition, [string]$message) {
  if (-not $condition) { throw "ASSERTION FAILED: $message" }
}

function As-Authenticated([string]$actorId, [string]$statement) {
  return "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$actorId',true); $statement; COMMIT;"
}

$setup = @"
DELETE FROM public.tenants WHERE id='$tenant';
DELETE FROM auth.users WHERE id='$admin';
INSERT INTO public.tenants(id,name) VALUES ('$tenant','Lab Mutation Concurrency');
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES ('$admin','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lab36-concurrency@example.local','x',now(),'{"provider":"email"}','{}',now(),now());
INSERT INTO public.profiles(id,first_name,last_name) VALUES ('$admin','Concurrency','Admin');
INSERT INTO public.tenant_users(tenant_id,user_id,role) VALUES ('$tenant','$admin','clinic_admin');
INSERT INTO public.patients(id,tenant_id,full_name,phone,source,status,balance)
VALUES ('$patient','$tenant','Concurrency Patient','+77003660001','phone','active',0);
INSERT INTO public.doctors(id,tenant_id,full_name,active) VALUES ('$doctor','$tenant','Concurrency Doctor',true);
INSERT INTO public.laboratories(id,tenant_id,name,active) VALUES ('$lab','$tenant','Concurrency Lab',true);
INSERT INTO public.laboratory_work_types(id,tenant_id,name,active,sort_order) VALUES
('$type1','$tenant','Concurrency Type One',true,10),
('$type2','$tenant','Concurrency Type Two',true,20);
"@
Invoke-Sql $setup | Out-Null

try {
  Invoke-Sql (As-Authenticated $admin "SELECT public.create_laboratory_work_order_atomic(p_tenant_id=>'$tenant',p_order_id=>'$order',p_patient_id=>'$patient',p_title=>'Concurrency Base',p_work_type_ids=>ARRAY['$type1'::uuid],p_responsible_doctor_id=>'$doctor',p_laboratory_id=>'$lab',p_request_id=>'race-create')") | Out-Null
  Assert-True ((Invoke-Scalar "SELECT mutation_version FROM public.laboratory_work_orders WHERE id='$order'") -eq '1') 'create starts at mutation_version 1'

  # A. Two edits from the same snapshot. Exactly one full payload/set wins.
  $versionA = Invoke-Scalar "SELECT mutation_version FROM public.laboratory_work_orders WHERE id='$order'"
  $sqlEditA = As-Authenticated $admin "SELECT public.update_laboratory_work_order_atomic(p_tenant_id=>'$tenant',p_order_id=>'$order',p_expected_version=>$versionA,p_title=>'RACE_A',p_work_type_ids=>ARRAY['$type1'::uuid],p_responsible_doctor_id=>'$doctor',p_laboratory_id=>'$lab',p_request_id=>'race-edit-a')"
  $sqlEditB = As-Authenticated $admin "SELECT public.update_laboratory_work_order_atomic(p_tenant_id=>'$tenant',p_order_id=>'$order',p_expected_version=>$versionA,p_title=>'RACE_B',p_work_type_ids=>ARRAY['$type2'::uuid],p_responsible_doctor_id=>'$doctor',p_laboratory_id=>'$lab',p_request_id=>'race-edit-b')"
  $pairA = Invoke-ConcurrentPair $sqlEditA $sqlEditB
  Assert-True ((@($pairA | Where-Object Code -eq 0)).Count -eq 1) 'A exactly one edit wins'
  Assert-True ((@($pairA | Where-Object { $_.Code -ne 0 -and $_.Text -match 'LAB_ORDER_STALE_WRITE' })).Count -eq 1) 'A loser is stale-write conflict'
  Assert-True ($deadlocks -eq 0) 'A no deadlock'
  Assert-True ((Invoke-Scalar "SELECT mutation_version FROM public.laboratory_work_orders WHERE id='$order'") -eq '2') 'A version increments exactly once'

  $winnerTitle = Invoke-Scalar "SELECT title FROM public.laboratory_work_orders WHERE id='$order'"
  $winnerType = Invoke-Scalar "SELECT laboratory_work_type_id FROM public.laboratory_work_order_types WHERE laboratory_work_order_id='$order'"
  $coherentA = (($winnerTitle -eq 'RACE_A') -and ($winnerType -eq $type1)) -or (($winnerTitle -eq 'RACE_B') -and ($winnerType -eq $type2))
  Assert-True $coherentA 'A order row and desired work-type set belong to the same winner'
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.laboratory_work_order_types WHERE laboratory_work_order_id='$order'") -eq '1') 'A no mixed/partial relation set'
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.audit_events WHERE target_id='$order' AND action='laboratory_order.updated'") -eq '1') 'A one update audit for one winner'

  # B. Complete races an edit from the same version. Row lock + version/status gate permits one command only.
  $versionB = Invoke-Scalar "SELECT mutation_version FROM public.laboratory_work_orders WHERE id='$order'"
  $currentType = Invoke-Scalar "SELECT laboratory_work_type_id FROM public.laboratory_work_order_types WHERE laboratory_work_order_id='$order'"
  $sqlComplete = As-Authenticated $admin "SELECT public.complete_laboratory_work_order_atomic('$tenant','$order',$versionB,'race-complete')"
  $sqlEditC = As-Authenticated $admin "SELECT public.update_laboratory_work_order_atomic(p_tenant_id=>'$tenant',p_order_id=>'$order',p_expected_version=>$versionB,p_title=>'RACE_EDIT_AFTER',p_work_type_ids=>ARRAY['$currentType'::uuid],p_responsible_doctor_id=>'$doctor',p_laboratory_id=>'$lab',p_request_id=>'race-edit-c')"
  $pairB = Invoke-ConcurrentPair $sqlComplete $sqlEditC
  Assert-True ((@($pairB | Where-Object Code -eq 0)).Count -eq 1) 'B exactly one lifecycle/edit command wins'
  $controlledLosers = @($pairB | Where-Object { $_.Code -ne 0 -and ($_.Text -match 'LAB_ORDER_STALE_WRITE' -or $_.Text -match 'LAB_ORDER_EDIT_REQUIRES_IN_PROGRESS' -or $_.Text -match 'LAB_ORDER_COMPLETE_REQUIRES_IN_PROGRESS') })
  Assert-True ($controlledLosers.Count -eq 1) 'B loser is controlled stale/status conflict'
  Assert-True ($deadlocks -eq 0) 'B no deadlock'
  Assert-True ((Invoke-Scalar "SELECT mutation_version FROM public.laboratory_work_orders WHERE id='$order'") -eq '3') 'B version increments exactly once'
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.laboratory_work_order_types WHERE laboratory_work_order_id='$order'") -eq '1') 'B relation set remains whole'

  $statusB = Invoke-Scalar "SELECT status FROM public.laboratory_work_orders WHERE id='$order'"
  $titleB = Invoke-Scalar "SELECT title FROM public.laboratory_work_orders WHERE id='$order'"
  if ($statusB -eq 'completed') {
    Assert-True ($titleB -eq $winnerTitle) 'B complete winner preserves pre-race order fields'
  } else {
    Assert-True ($statusB -eq 'in_progress' -and $titleB -eq 'RACE_EDIT_AFTER') 'B edit winner is canonical in-progress result'
  }

  $auditMutations = [int](Invoke-Scalar "SELECT count(*) FROM public.audit_events WHERE target_id='$order' AND action IN ('laboratory_order.updated','laboratory_order.completed')")
  Assert-True ($auditMutations -eq 2) 'two races produced exactly two successful mutation audits total'

  [ordered]@{
    editRaceWinner = $winnerTitle
    editRaceWorkType = $winnerType
    secondRaceFinalStatus = $statusB
    secondRaceFinalTitle = $titleB
    finalMutationVersion = [int](Invoke-Scalar "SELECT mutation_version FROM public.laboratory_work_orders WHERE id='$order'")
    updateOrCompleteAudits = $auditMutations
    deadlocks = $deadlocks
    invariants = [ordered]@{
      mixedWorkTypeSet = 0
      staleWinnerCount = 1
      secondRaceWinnerCount = 1
    }
  } | ConvertTo-Json -Depth 4
}
finally {
  Invoke-Sql "DELETE FROM public.tenants WHERE id='$tenant'; DELETE FROM auth.users WHERE id='$admin';" | Out-Null
}
