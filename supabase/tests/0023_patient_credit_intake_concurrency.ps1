$ErrorActionPreference = 'Stop'

$container = 'supabase_db_codex-test-supabase'
$tenant = '11111111-1111-1111-1111-111111111111'
$patient = 'd2330000-0000-4000-8000-000000000001'

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
    $output = $sql | & docker exec -i $containerName psql -U postgres -d postgres -At -v ON_ERROR_STOP=1 2>&1
    [pscustomobject]@{ Code = [int]$LASTEXITCODE; Text = ($output -join "`n").Trim() }
  } -ArgumentList $container, $sqlA
  $jobB = Start-Job -ScriptBlock {
    param($containerName, $sql)
    $output = $sql | & docker exec -i $containerName psql -U postgres -d postgres -At -v ON_ERROR_STOP=1 2>&1
    [pscustomobject]@{ Code = [int]$LASTEXITCODE; Text = ($output -join "`n").Trim() }
  } -ArgumentList $container, $sqlB

  Wait-Job $jobA, $jobB | Out-Null
  $results = @((Receive-Job $jobA), (Receive-Job $jobB))
  Remove-Job $jobA, $jobB
  return $results
}

$admin = Invoke-Scalar "select id from auth.users where email='qa.admin.a@example.local'"
$cashier = Invoke-Scalar "select id from auth.users where email='qa.cashier.a@example.local'"
if (-not $admin -or -not $cashier) { throw 'Local QA users are missing.' }

$cleanup = "DELETE FROM public.patients WHERE id='$patient'::uuid;"

try {
  Invoke-Sql $cleanup
  Invoke-Sql @"
INSERT INTO public.patients(id,tenant_id,full_name,phone,source,balance)
VALUES ('$patient','$tenant','Patient Credit Concurrency Smoke','+77002339999','phone',4321);
"@

  $context = "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$cashier',true);"
  $sameCall = "SELECT (public.record_patient_credit_payment('$tenant','$patient',100000,'cash','KZT',NULL,'PCI-SAME','Concurrent payer','Same retry','patient-credit-concurrent-same','{`"source`":`"concurrency`"}'::jsonb)#>>'{payment,id}'); COMMIT;"
  $sameSql = "$context $sameCall"
  $identical = @(Invoke-ConcurrentPair $sameSql $sameSql)
  $sameFailures = @($identical | Where-Object { $_.Code -ne 0 }).Count
  if ($sameFailures -ne 0) {
    throw "Concurrent identical retries failed: $sameFailures`n$($identical.Text -join "`n---`n")"
  }

  $sameIds = @($identical | ForEach-Object { $_.Text.Split("`n") | Where-Object { $_ -match '^[0-9a-f-]{36}$' } | Select-Object -Last 1 })
  $sameUniqueIds = @($sameIds | Sort-Object -Unique)
  $samePayments = [int](Invoke-Scalar "select count(*) from public.payments where tenant_id='$tenant' and credit_intake_operation_key='patient-credit-concurrent-same'")
  $samePaymentId = Invoke-Scalar "select id from public.payments where tenant_id='$tenant' and credit_intake_operation_key='patient-credit-concurrent-same'"
  $sameAudit = [int](Invoke-Scalar "select count(*) from public.audit_events where payment_id='$samePaymentId' and action='payment_recorded'")
  $sameActivity = [int](Invoke-Scalar "select count(*) from public.activity_events where metadata->>'paymentId'='$samePaymentId' and type='payment_recorded'")
  $sameCapacity = [decimal](Invoke-Scalar "select available_credit_amount from public.get_payment_fund_capacity_internal('$tenant','$samePaymentId')")
  if ($samePayments -ne 1 -or $sameUniqueIds.Count -ne 1 -or $sameAudit -ne 1 -or $sameActivity -ne 1 -or $sameCapacity -ne 100000) {
    throw "Identical retry invariant failed: payments=$samePayments uniqueIds=$($sameUniqueIds.Count) audit=$sameAudit activity=$sameActivity capacity=$sameCapacity"
  }

  $conflictA = "$context SELECT public.record_patient_credit_payment('$tenant','$patient',70000,'kaspi','KZT',NULL,'PCI-CONFLICT-A',NULL,NULL,'patient-credit-concurrent-conflict','{}'::jsonb); COMMIT;"
  $conflictB = "$context SELECT public.record_patient_credit_payment('$tenant','$patient',80000,'kaspi','KZT',NULL,'PCI-CONFLICT-B',NULL,NULL,'patient-credit-concurrent-conflict','{}'::jsonb); COMMIT;"
  $conflict = @(Invoke-ConcurrentPair $conflictA $conflictB)
  $conflictSuccess = @($conflict | Where-Object { $_.Code -eq 0 }).Count
  $conflictRejected = @($conflict | Where-Object { $_.Code -ne 0 -and $_.Text -match 'PATIENT_CREDIT_IDEMPOTENCY_CONFLICT' }).Count
  $conflictPayments = [int](Invoke-Scalar "select count(*) from public.payments where tenant_id='$tenant' and credit_intake_operation_key='patient-credit-concurrent-conflict'")
  $conflictAudit = [int](Invoke-Scalar "select count(*) from public.audit_events where payment_id=(select id::text from public.payments where tenant_id='$tenant' and credit_intake_operation_key='patient-credit-concurrent-conflict') and action='payment_recorded'")
  if ($conflictSuccess -ne 1 -or $conflictRejected -ne 1 -or $conflictPayments -ne 1 -or $conflictAudit -ne 1) {
    throw "Conflicting retry invariant failed: success=$conflictSuccess rejected=$conflictRejected payments=$conflictPayments audit=$conflictAudit`n$($conflict.Text -join "`n---`n")"
  }

  $differentA = "$context SELECT public.record_patient_credit_payment('$tenant','$patient',11111,'card','KZT',NULL,'PCI-DIFF-A',NULL,NULL,'patient-credit-concurrent-different-a','{}'::jsonb); COMMIT;"
  $differentB = "$context SELECT public.record_patient_credit_payment('$tenant','$patient',22222,'card','KZT',NULL,'PCI-DIFF-B',NULL,NULL,'patient-credit-concurrent-different-b','{}'::jsonb); COMMIT;"
  $different = @(Invoke-ConcurrentPair $differentA $differentB)
  $differentSuccess = @($different | Where-Object { $_.Code -eq 0 }).Count
  $differentPayments = [int](Invoke-Scalar "select count(*) from public.payments where tenant_id='$tenant' and credit_intake_operation_key in ('patient-credit-concurrent-different-a','patient-credit-concurrent-different-b')")
  $differentTotal = [decimal](Invoke-Scalar "select coalesce(sum(amount),0) from public.payments where tenant_id='$tenant' and credit_intake_operation_key in ('patient-credit-concurrent-different-a','patient-credit-concurrent-different-b')")
  if ($differentSuccess -ne 2 -or $differentPayments -ne 2 -or $differentTotal -ne 33333) {
    throw "Different-key invariant failed: success=$differentSuccess payments=$differentPayments total=$differentTotal"
  }

  $patientBalance = [decimal](Invoke-Scalar "select balance from public.patients where id='$patient'")
  $allocations = [int](Invoke-Scalar "select count(*) from public.payment_allocations where patient_id='$patient'")
  $reservations = [int](Invoke-Scalar "select count(*) from public.patient_fund_reservations where patient_id='$patient'")
  $invoices = [int](Invoke-Scalar "select count(*) from public.invoices where patient_id='$patient'")
  if ($patientBalance -ne 4321 -or $allocations -ne 0 -or $reservations -ne 0 -or $invoices -ne 0) {
    throw "Forbidden side effect invariant failed: balance=$patientBalance allocations=$allocations reservations=$reservations invoices=$invoices"
  }

  Write-Output "IDENTICAL_RETRY success=2 payments=$samePayments uniquePaymentIds=$($sameUniqueIds.Count) audit=$sameAudit activity=$sameActivity credit=$sameCapacity"
  Write-Output "CONFLICTING_RETRY success=$conflictSuccess rejected=$conflictRejected payments=$conflictPayments audit=$conflictAudit"
  Write-Output "DIFFERENT_KEYS success=$differentSuccess payments=$differentPayments amount=$differentTotal"
  Write-Output 'PATIENT CREDIT INTAKE CONCURRENCY VALIDATION PASSED'
}
finally {
  Invoke-Sql $cleanup
  $remaining = [int](Invoke-Scalar "select count(*) from public.patients where id='$patient'")
  if ($remaining -ne 0) { throw "Concurrency cleanup failed: remaining=$remaining" }
}
