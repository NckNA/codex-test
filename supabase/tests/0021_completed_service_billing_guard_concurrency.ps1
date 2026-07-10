$ErrorActionPreference = 'Stop'

# Local-only validation. The UUID namespace is reserved for this script and the
# finally block removes the tenant (cascading its task-scoped clinical/finance data).
$container = 'supabase_db_codex-test-supabase'
$tenant = 'd3100000-0000-4000-8000-000000000001'
$patient = 'd3110000-0000-4000-8000-000000000001'
$admin = 'd3120000-0000-4000-8000-000000000001'
$invoiceA = 'd3130000-0000-4000-8000-000000000001'
$invoiceB = 'd3130000-0000-4000-8000-000000000002'
$invoiceC = 'd3130000-0000-4000-8000-000000000003'
$invoiceD = 'd3130000-0000-4000-8000-000000000004'
$serviceRace = 'd3140000-0000-4000-8000-000000000001'
$serviceC = 'd3140000-0000-4000-8000-000000000002'
$serviceD = 'd3140000-0000-4000-8000-000000000003'

function Invoke-Sql([string]$sql) {
  $output = $sql | & docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 2>&1
  if ($LASTEXITCODE -ne 0) { throw ($output -join "`n") }
  return $output
}

function Invoke-Scalar([string]$sql) {
  $output = & docker exec $container psql -U postgres -d postgres -At -v ON_ERROR_STOP=1 -c $sql 2>&1
  if ($LASTEXITCODE -ne 0) { throw ($output -join "`n") }
  return ($output | Select-Object -Last 1).ToString().Trim()
}

function Invoke-ConcurrentPair([string]$sqlA, [string]$sqlB) {
  $jobA = Start-Job -ScriptBlock {
    param($containerName, $sql)
    $output = $sql | & docker exec -i $containerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 2>&1
    [pscustomobject]@{ Code = [int]$LASTEXITCODE; Text = ($output -join "`n") }
  } -ArgumentList $container, $sqlA
  $jobB = Start-Job -ScriptBlock {
    param($containerName, $sql)
    $output = $sql | & docker exec -i $containerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 2>&1
    [pscustomobject]@{ Code = [int]$LASTEXITCODE; Text = ($output -join "`n") }
  } -ArgumentList $container, $sqlB
  Wait-Job $jobA, $jobB | Out-Null
  $results = @((Receive-Job $jobA), (Receive-Job $jobB))
  Remove-Job $jobA, $jobB
  return $results
}

$cleanup = @"
DELETE FROM public.tenants WHERE id='$tenant'::uuid;
DELETE FROM auth.users WHERE id='$admin'::uuid;
"@

$setup = @"
BEGIN;
INSERT INTO public.tenants(id,name) VALUES ('$tenant'::uuid,'CSBG concurrency tenant');
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES ('$admin'::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','csbg-concurrency@example.local','x',now(),'{"provider":"email"}','{}',now(),now());
INSERT INTO public.profiles(id) VALUES ('$admin'::uuid);
INSERT INTO public.tenant_users(tenant_id,user_id,role) VALUES ('$tenant'::uuid,'$admin'::uuid,'clinic_admin');
INSERT INTO public.patients(id,tenant_id,full_name,phone,source,balance) VALUES ('$patient'::uuid,'$tenant'::uuid,'CSBG concurrency patient','+77003110001','phone',91);
INSERT INTO public.invoices(id,tenant_id,patient_id,invoice_number,status,currency,subtotal_amount,total_amount,balance_amount) VALUES
 ('$invoiceA'::uuid,'$tenant'::uuid,'$patient'::uuid,'CSBG-RACE-A','draft','KZT',0,0,0),
 ('$invoiceB'::uuid,'$tenant'::uuid,'$patient'::uuid,'CSBG-RACE-B','draft','KZT',0,0,0),
 ('$invoiceC'::uuid,'$tenant'::uuid,'$patient'::uuid,'CSBG-DIFF-C','draft','KZT',0,0,0),
 ('$invoiceD'::uuid,'$tenant'::uuid,'$patient'::uuid,'CSBG-DIFF-D','draft','KZT',0,0,0);
INSERT INTO public.completed_services(id,tenant_id,patient_id,service_name,quantity,unit_price,total_amount,currency,status,created_by) VALUES
 ('$serviceRace'::uuid,'$tenant'::uuid,'$patient'::uuid,'race service',1,100,100,'KZT','completed','$admin'::uuid),
 ('$serviceC'::uuid,'$tenant'::uuid,'$patient'::uuid,'different service C',1,200,200,'KZT','completed','$admin'::uuid),
 ('$serviceD'::uuid,'$tenant'::uuid,'$patient'::uuid,'different service D',1,300,300,'KZT','completed','$admin'::uuid);
COMMIT;
"@

$authContext = "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$admin',true);"

try {
  Invoke-Sql $cleanup | Out-Null
  Invoke-Sql $setup | Out-Null

  $race = @(Invoke-ConcurrentPair `
    ($authContext + " SELECT public.add_invoice_item('$tenant','$invoiceA','race A',1,100,0,0,'$serviceRace'); COMMIT;") `
    ($authContext + " SELECT public.add_invoice_item('$tenant','$invoiceB','race B',1,100,0,0,'$serviceRace'); COMMIT;"))
  $raceSuccess = @($race | Where-Object { $_.Code -eq 0 }).Count
  $raceRejected = @($race | Where-Object { $_.Code -ne 0 }).Count
  $linkedItems = [int](Invoke-Scalar "select count(*) from public.invoice_items where completed_service_id='$serviceRace'::uuid")
  $successAudit = [int](Invoke-Scalar "select count(*) from public.audit_events where action='invoice_item_added' and metadata->>'completedServiceId'='$serviceRace'")
  $successActivity = [int](Invoke-Scalar "select count(*) from public.activity_events where type='invoice_item_added' and metadata->>'completedServiceId'='$serviceRace'")
  $totalA = [decimal](Invoke-Scalar "select total_amount from public.invoices where id='$invoiceA'::uuid")
  $totalB = [decimal](Invoke-Scalar "select total_amount from public.invoices where id='$invoiceB'::uuid")
  if ($raceSuccess -ne 1 -or $raceRejected -ne 1 -or $linkedItems -ne 1 -or $successAudit -ne 1 -or $successActivity -ne 1 -or (($totalA -eq 100 -and $totalB -eq 0) -or ($totalA -eq 0 -and $totalB -eq 100)) -ne $true) {
    throw "Same-service race invariant failed: success=$raceSuccess rejected=$raceRejected items=$linkedItems audit=$successAudit activity=$successActivity totals=$totalA/$totalB"
  }

  $retry = $authContext + " SELECT public.add_invoice_item('$tenant','$invoiceA','retry',1,100,0,0,'$serviceRace'); COMMIT;"
  $retryExit = 0
  try {
    $retryOutput = $retry | & docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 2>&1
    $retryExit = $LASTEXITCODE
  } catch {
    # An expected rejected retry is a nonzero native command under Stop mode.
    $retryOutput = $_
    $retryExit = $LASTEXITCODE
  }
  if ($retryExit -eq 0) { throw 'Retry unexpectedly succeeded.' }
  if ([int](Invoke-Scalar "select count(*) from public.invoice_items where completed_service_id='$serviceRace'::uuid") -ne 1) { throw 'Retry created a duplicate item.' }

  $different = @(Invoke-ConcurrentPair `
    ($authContext + " SELECT public.add_invoice_item('$tenant','$invoiceC','different C',1,200,0,0,'$serviceC'); COMMIT;") `
    ($authContext + " SELECT public.add_invoice_item('$tenant','$invoiceD','different D',1,300,0,0,'$serviceD'); COMMIT;"))
  if (@($different | Where-Object { $_.Code -eq 0 }).Count -ne 2) { throw 'Different completed services should both bill concurrently.' }
  $differentItems = [int](Invoke-Scalar "select count(*) from public.invoice_items where completed_service_id in ('$serviceC'::uuid,'$serviceD'::uuid)")
  $differentAudit = [int](Invoke-Scalar "select count(*) from public.audit_events where action='invoice_item_added' and metadata->>'completedServiceId' in ('$serviceC','$serviceD')")
  $differentActivity = [int](Invoke-Scalar "select count(*) from public.activity_events where type='invoice_item_added' and metadata->>'completedServiceId' in ('$serviceC','$serviceD')")
  $totalC = [decimal](Invoke-Scalar "select total_amount from public.invoices where id='$invoiceC'::uuid")
  $totalD = [decimal](Invoke-Scalar "select total_amount from public.invoices where id='$invoiceD'::uuid")
  if ($differentItems -ne 2 -or $differentAudit -ne 2 -or $differentActivity -ne 2 -or $totalC -ne 200 -or $totalD -ne 300) {
    throw "Different-service concurrency invariant failed: items=$differentItems audit=$differentAudit activity=$differentActivity totals=$totalC/$totalD"
  }

  Write-Output "SAME_SERVICE_RACE success=$raceSuccess rejected=$raceRejected items=$linkedItems audit=$successAudit activity=$successActivity totals=$totalA/$totalB"
  Write-Output "DIFFERENT_SERVICE_RACE success=2 items=$differentItems audit=$differentAudit activity=$differentActivity totals=$totalC/$totalD"
  Write-Output 'COMPLETED-SERVICE-BILLING-GUARD-001 CONCURRENCY VALIDATION PASSED'
}
finally {
  Invoke-Sql $cleanup | Out-Null
  $remaining = [int](Invoke-Scalar "select count(*) from public.tenants where id='$tenant'::uuid")
  if ($remaining -ne 0) { throw "Concurrency cleanup failed: remaining tenants=$remaining" }
}
