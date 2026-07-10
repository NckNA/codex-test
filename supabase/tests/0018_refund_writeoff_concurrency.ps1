$ErrorActionPreference = 'Stop'

$container = 'supabase_db_codex-test-supabase'
$tenant = '11111111-1111-1111-1111-111111111111'
$patient = 'c1000000-0000-4000-8000-000000000001'
$paymentRace = 'c2000000-0000-4000-8000-000000000001'
$paymentIdempotency = 'c2000000-0000-4000-8000-000000000002'
$invoiceRace = 'c3000000-0000-4000-8000-000000000001'
$invoiceIdempotency = 'c3000000-0000-4000-8000-000000000002'
$itemRace = 'c4000000-0000-4000-8000-000000000001'
$itemIdempotency = 'c4000000-0000-4000-8000-000000000002'

function Invoke-Scalar([string]$sql) {
  return (& docker exec $container psql -U postgres -d postgres -Atc $sql).Trim()
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
if (-not $admin -or -not $cashier) {
  throw 'Local QA users are missing. Run the guarded QA user seed first.'
}

$setup = @"
BEGIN;
DELETE FROM public.patients WHERE id='$patient'::uuid;
INSERT INTO public.patients(id,tenant_id,full_name,phone,source,balance)
VALUES ('$patient','$tenant','Concurrency Smoke','+77000000999','phone',0);
INSERT INTO public.payments(id,tenant_id,patient_id,status,payment_method,amount,currency,received_by)
VALUES
  ('$paymentRace','$tenant','$patient','received','cash',1000,'KZT','$cashier'),
  ('$paymentIdempotency','$tenant','$patient','received','cash',1000,'KZT','$cashier');
INSERT INTO public.invoices(id,tenant_id,patient_id,status,currency,issue_date,issued_at,subtotal_amount,total_amount,balance_amount,created_by,issued_by)
VALUES
  ('$invoiceRace','$tenant','$patient','issued','KZT',now(),now(),1000,1000,1000,'$admin','$admin'),
  ('$invoiceIdempotency','$tenant','$patient','issued','KZT',now(),now(),1000,1000,1000,'$admin','$admin');
INSERT INTO public.invoice_items(id,tenant_id,invoice_id,patient_id,service_name,quantity,unit_price,total_amount,status,created_by)
VALUES
  ('$itemRace','$tenant','$invoiceRace','$patient','Race write-off',1,1000,1000,'active','$admin'),
  ('$itemIdempotency','$tenant','$invoiceIdempotency','$patient','Idempotent write-off',1,1000,1000,'active','$admin');
COMMIT;
"@
$setup | & docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 | Out-Null

$refundContext = "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$cashier',true);"
$refundRace = @(Invoke-ConcurrentPair `
  ($refundContext + " SELECT (public.request_refund('$tenant','$paymentRace',600,'cash','race A','refund-race-a','{}')).id; COMMIT;") `
  ($refundContext + " SELECT (public.request_refund('$tenant','$paymentRace',600,'cash','race B','refund-race-b','{}')).id; COMMIT;"))
$refundSuccess = @($refundRace | Where-Object { $_.Code -eq 0 }).Count
$refundRejected = @($refundRace | Where-Object { $_.Code -ne 0 }).Count
$refundReserved = [decimal](Invoke-Scalar "select coalesce(sum(amount),0) from public.refunds where payment_id='$paymentRace' and status in ('pending','approved')")
if ($refundSuccess -ne 1 -or $refundRejected -ne 1 -or $refundReserved -ne 600) {
  throw "Refund race failed: success=$refundSuccess rejected=$refundRejected reserved=$refundReserved"
}

$refundIdempotencyRace = @(Invoke-ConcurrentPair `
  ($refundContext + " SELECT (public.request_refund('$tenant','$paymentIdempotency',400,'cash','same retry','refund-race-same','{}')).id; COMMIT;") `
  ($refundContext + " SELECT (public.request_refund('$tenant','$paymentIdempotency',400,'cash','same retry','refund-race-same','{}')).id; COMMIT;"))
if (@($refundIdempotencyRace | Where-Object { $_.Code -ne 0 }).Count -ne 0) {
  throw 'Concurrent refund idempotency call failed.'
}
$refundIdempotencyRows = [int](Invoke-Scalar "select count(*) from public.refunds where payment_id='$paymentIdempotency' and idempotency_key='refund-race-same'")
if ($refundIdempotencyRows -ne 1) {
  throw "Concurrent refund idempotency created $refundIdempotencyRows rows."
}

$writeOffContext = "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$admin',true);"
$writeOffRace = @(Invoke-ConcurrentPair `
  ($writeOffContext + " SELECT (public.request_invoice_write_off('$tenant','$invoiceRace',600,'race A','writeoff-race-a','{}')).id; COMMIT;") `
  ($writeOffContext + " SELECT (public.request_invoice_write_off('$tenant','$invoiceRace',600,'race B','writeoff-race-b','{}')).id; COMMIT;"))
$writeOffSuccess = @($writeOffRace | Where-Object { $_.Code -eq 0 }).Count
$writeOffRejected = @($writeOffRace | Where-Object { $_.Code -ne 0 }).Count
$writeOffReserved = [decimal](Invoke-Scalar "select coalesce(sum(amount),0) from public.financial_adjustments where invoice_id='$invoiceRace' and adjustment_type='write_off' and status='active'")
if ($writeOffSuccess -ne 1 -or $writeOffRejected -ne 1 -or $writeOffReserved -ne 600) {
  throw "Write-off race failed: success=$writeOffSuccess rejected=$writeOffRejected reserved=$writeOffReserved"
}

$writeOffIdempotencyRace = @(Invoke-ConcurrentPair `
  ($writeOffContext + " SELECT (public.request_invoice_write_off('$tenant','$invoiceIdempotency',400,'same retry','writeoff-race-same','{}')).id; COMMIT;") `
  ($writeOffContext + " SELECT (public.request_invoice_write_off('$tenant','$invoiceIdempotency',400,'same retry','writeoff-race-same','{}')).id; COMMIT;"))
if (@($writeOffIdempotencyRace | Where-Object { $_.Code -ne 0 }).Count -ne 0) {
  throw 'Concurrent write-off idempotency call failed.'
}
$writeOffIdempotencyRows = [int](Invoke-Scalar "select count(*) from public.financial_adjustments where invoice_id='$invoiceIdempotency' and idempotency_key='writeoff-race-same'")
if ($writeOffIdempotencyRows -ne 1) {
  throw "Concurrent write-off idempotency created $writeOffIdempotencyRows rows."
}

Write-Output "REFUND_RACE success=$refundSuccess rejected=$refundRejected reserved=$refundReserved"
Write-Output "REFUND_IDEMPOTENCY rows=$refundIdempotencyRows"
Write-Output "WRITEOFF_RACE success=$writeOffSuccess rejected=$writeOffRejected reserved=$writeOffReserved"
Write-Output "WRITEOFF_IDEMPOTENCY rows=$writeOffIdempotencyRows"
Write-Output 'CONCURRENCY VALIDATION PASSED'
