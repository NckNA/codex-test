$ErrorActionPreference = 'Stop'

$container = 'supabase_db_codex-test-supabase'
$tenant = '11111111-1111-1111-1111-111111111111'
$patient = 'c9000000-0000-4000-8000-000000000001'
$invoiceSame = 'c9100000-0000-4000-8000-000000000001'
$invoiceRace = 'c9100000-0000-4000-8000-000000000002'
$itemSame = 'c9200000-0000-4000-8000-000000000001'
$itemRace = 'c9200000-0000-4000-8000-000000000002'

function Invoke-Scalar([string]$sql) {
  return (& docker exec $container psql -U postgres -d postgres -Atc $sql).Trim()
}

function Invoke-Sql([string]$sql) {
  $sql | & docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Local SQL command failed.' }
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

$admin = Invoke-Scalar "select id from auth.users where email='qa.admin.a@example.local'"
$cashier = Invoke-Scalar "select id from auth.users where email='qa.cashier.a@example.local'"
if (-not $admin -or -not $cashier) { throw 'Local QA users are missing.' }

$cleanup = @"
DELETE FROM public.patients WHERE id='$patient'::uuid;
"@

try {
  Invoke-Sql $cleanup
  $setup = @"
BEGIN;
INSERT INTO public.patients(id,tenant_id,full_name,phone,source,balance)
VALUES ('$patient','$tenant','Cashier Concurrency Smoke','+77009000999','phone',123);
INSERT INTO public.invoices(id,tenant_id,patient_id,invoice_number,status,currency,issue_date,issued_at,subtotal_amount,total_amount,balance_amount,created_by,issued_by,metadata)
VALUES
  ('$invoiceSame','$tenant','$patient','CC-001','issued','KZT',now(),now(),1000,1000,1000,'$admin','$admin','{"marker":"cashier-concurrency"}'),
  ('$invoiceRace','$tenant','$patient','CC-002','issued','KZT',now(),now(),1000,1000,1000,'$admin','$admin','{"marker":"cashier-concurrency"}');
INSERT INTO public.invoice_items(id,tenant_id,invoice_id,patient_id,service_name,quantity,unit_price,total_amount,status,created_by,metadata)
VALUES
  ('$itemSame','$tenant','$invoiceSame','$patient','Concurrent identical retry',1,1000,1000,'active','$admin','{"marker":"cashier-concurrency"}'),
  ('$itemRace','$tenant','$invoiceRace','$patient','Concurrent competing payment',1,1000,1000,'active','$admin','{"marker":"cashier-concurrency"}');
COMMIT;
"@
  Invoke-Sql $setup

  $context = "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$cashier',true);"
  $identicalSql = $context + " SELECT public.record_and_allocate_payment('$tenant','$patient',1000,'cash','KZT',null,'CC-SAME',null,null,ARRAY['$invoiceSame'::uuid],'cashier-concurrent-same','{`"source`":`"concurrency`"}'::jsonb); COMMIT;"
  $identical = @(Invoke-ConcurrentPair $identicalSql $identicalSql)
  $identicalFailures = @($identical | Where-Object { $_.Code -ne 0 }).Count
  if ($identicalFailures -ne 0) { throw "Concurrent identical retries failed: $identicalFailures" }

  $samePayments = [int](Invoke-Scalar "select count(*) from public.payments where tenant_id='$tenant' and cashier_operation_key='cashier-concurrent-same'")
  $sameAllocations = [int](Invoke-Scalar "select count(*) from public.payment_allocations where invoice_id='$invoiceSame' and status='active'")
  $sameAllocated = [decimal](Invoke-Scalar "select coalesce(sum(amount),0) from public.payment_allocations where invoice_id='$invoiceSame' and status='active'")
  $samePaymentId = Invoke-Scalar "select id from public.payments where tenant_id='$tenant' and cashier_operation_key='cashier-concurrent-same'"
  $sameAudit = [int](Invoke-Scalar "select count(*) from public.audit_events where payment_id='$samePaymentId' and action in ('payment_recorded','payment_allocated')")
  $sameActivity = [int](Invoke-Scalar "select count(*) from public.activity_events where metadata->>'paymentId'='$samePaymentId' and type in ('payment_recorded','payment_allocated')")
  if ($samePayments -ne 1 -or $sameAllocations -ne 1 -or $sameAllocated -ne 1000 -or $sameAudit -ne 2 -or $sameActivity -ne 2) {
    throw "Identical retry invariant failed: payments=$samePayments allocations=$sameAllocations allocated=$sameAllocated audit=$sameAudit activity=$sameActivity"
  }

  $raceA = $context + " SELECT public.record_and_allocate_payment('$tenant','$patient',700,'cash','KZT',null,'CC-RACE-A',null,null,ARRAY['$invoiceRace'::uuid],'cashier-race-a','{}'::jsonb); COMMIT;"
  $raceB = $context + " SELECT public.record_and_allocate_payment('$tenant','$patient',700,'cash','KZT',null,'CC-RACE-B',null,null,ARRAY['$invoiceRace'::uuid],'cashier-race-b','{}'::jsonb); COMMIT;"
  $race = @(Invoke-ConcurrentPair $raceA $raceB)
  $raceSuccess = @($race | Where-Object { $_.Code -eq 0 }).Count
  $raceRejected = @($race | Where-Object { $_.Code -ne 0 }).Count
  $racePayments = [int](Invoke-Scalar "select count(*) from public.payments where tenant_id='$tenant' and cashier_operation_key in ('cashier-race-a','cashier-race-b')")
  $raceAllocations = [int](Invoke-Scalar "select count(*) from public.payment_allocations where invoice_id='$invoiceRace' and status='active'")
  $raceAllocated = [decimal](Invoke-Scalar "select coalesce(sum(amount),0) from public.payment_allocations where invoice_id='$invoiceRace' and status='active'")
  $raceBalance = [decimal](Invoke-Scalar "select balance_amount from public.invoices where id='$invoiceRace'")
  if ($raceSuccess -ne 1 -or $raceRejected -ne 1 -or $racePayments -ne 1 -or $raceAllocations -ne 1 -or $raceAllocated -ne 700 -or $raceBalance -ne 300) {
    throw "Competing operation invariant failed: success=$raceSuccess rejected=$raceRejected payments=$racePayments allocations=$raceAllocations allocated=$raceAllocated balance=$raceBalance"
  }

  $patientBalance = [decimal](Invoke-Scalar "select balance from public.patients where id='$patient'")
  if ($patientBalance -ne 123) { throw "patients.balance changed to $patientBalance" }

  Write-Output "IDENTICAL_RETRY success=2 payments=$samePayments allocations=$sameAllocations audit=$sameAudit activity=$sameActivity"
  Write-Output "COMPETING_OPERATIONS success=$raceSuccess rejected=$raceRejected payments=$racePayments allocated=$raceAllocated balance=$raceBalance"
  Write-Output 'CASHIER CONCURRENCY VALIDATION PASSED'
}
finally {
  Invoke-Sql $cleanup
  $remaining = [int](Invoke-Scalar "select count(*) from public.patients where id='$patient'")
  if ($remaining -ne 0) { throw "Concurrency cleanup failed: remaining=$remaining" }
}
