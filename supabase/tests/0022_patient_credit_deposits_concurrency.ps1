$ErrorActionPreference = 'Stop'

# Local-only concurrency validation. No cloud credentials are read or used.
$container = 'supabase_db_codex-test-supabase'
$tenant = 'f2210000-0000-4000-8000-000000000001'
$patient = 'f2220000-0000-4000-8000-000000000001'
$admin = 'f2230000-0000-4000-8000-000000000001'
$invoice = 'f2250000-0000-4000-8000-000000000001'
$item = 'f2260000-0000-4000-8000-000000000001'
$paymentReservationRace = 'f2240000-0000-4000-8000-000000000001'
$paymentRefundRace = 'f2240000-0000-4000-8000-000000000002'
$paymentAllocationRace = 'f2240000-0000-4000-8000-000000000003'
$paymentReleaseRace = 'f2240000-0000-4000-8000-000000000004'
$paymentConsumeRace = 'f2240000-0000-4000-8000-000000000005'
$paymentIdempotentRace = 'f2240000-0000-4000-8000-000000000006'
$paymentIdempotentConflict = 'f2240000-0000-4000-8000-000000000007'
$paymentDifferentA = 'f2240000-0000-4000-8000-000000000008'
$paymentDifferentB = 'f2240000-0000-4000-8000-000000000009'
$paymentApproveRace = 'f2240000-0000-4000-8000-000000000010'
$paymentCompleteRace = 'f2240000-0000-4000-8000-000000000011'
$paymentRejectRace = 'f2240000-0000-4000-8000-000000000012'
$paymentVoidRace = 'f2240000-0000-4000-8000-000000000013'

function Invoke-Sql([string]$sql) {
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = $sql | & docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 2>&1
  $code = $LASTEXITCODE
  $ErrorActionPreference = $previousPreference
  if ($code -ne 0) { throw "SQL failed:`n$sql`n$($output -join "`n")" }
  return $output
}

function Invoke-Scalar([string]$sql) {
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = & docker exec $container psql -U postgres -d postgres -At -v ON_ERROR_STOP=1 -c $sql 2>&1
  $code = $LASTEXITCODE
  $ErrorActionPreference = $previousPreference
  if ($code -ne 0) { throw "Scalar SQL failed: $sql`n$($output -join "`n")" }
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

  $completed = Wait-Job $jobA, $jobB -Timeout 60
  if (@($completed).Count -ne 2) {
    Stop-Job $jobA, $jobB -ErrorAction SilentlyContinue
    Remove-Job $jobA, $jobB -Force -ErrorAction SilentlyContinue
    throw 'Concurrency pair timed out; possible deadlock.'
  }
  $results = @((Receive-Job $jobA), (Receive-Job $jobB))
  Remove-Job $jobA, $jobB
  return $results
}

function Assert-Equal($actual, $expected, [string]$message) {
  if ($actual -ne $expected) { throw "$message expected=$expected actual=$actual" }
}

$cleanup = @"
DELETE FROM public.tenants WHERE id='$tenant'::uuid;
DELETE FROM auth.users WHERE id='$admin'::uuid;
"@

$setup = @"
BEGIN;
INSERT INTO public.tenants(id,name) VALUES ('$tenant'::uuid,'Deposit concurrency tenant');
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES ('$admin'::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','deposit-concurrency@example.local','x',now(),'{"provider":"email"}','{}',now(),now());
INSERT INTO public.profiles(id) VALUES ('$admin'::uuid);
INSERT INTO public.tenant_users(tenant_id,user_id,role) VALUES ('$tenant'::uuid,'$admin'::uuid,'clinic_admin');
INSERT INTO public.patients(id,tenant_id,full_name,phone,source,balance)
VALUES ('$patient'::uuid,'$tenant'::uuid,'Deposit concurrency patient','+77009991111','phone',55);
INSERT INTO public.invoices(id,tenant_id,patient_id,invoice_number,status,currency,issued_at,created_by,metadata)
VALUES ('$invoice'::uuid,'$tenant'::uuid,'$patient'::uuid,'DEP-CONC-1','issued','KZT',now(),'$admin'::uuid,'{}');
INSERT INTO public.invoice_items(id,tenant_id,invoice_id,patient_id,service_name,quantity,unit_price,total_amount,status,created_by,metadata)
VALUES ('$item'::uuid,'$tenant'::uuid,'$invoice'::uuid,'$patient'::uuid,'Concurrency capacity',1,10000,10000,'active','$admin'::uuid,'{}');
SELECT public.recalculate_invoice_financials_internal('$invoice'::uuid);
INSERT INTO public.payments(id,tenant_id,patient_id,status,payment_method,amount,currency,received_by,metadata) VALUES
 ('$paymentReservationRace'::uuid,'$tenant'::uuid,'$patient'::uuid,'received','cash',1000,'KZT','$admin'::uuid,'{}'),
 ('$paymentRefundRace'::uuid,'$tenant'::uuid,'$patient'::uuid,'received','cash',1000,'KZT','$admin'::uuid,'{}'),
 ('$paymentAllocationRace'::uuid,'$tenant'::uuid,'$patient'::uuid,'received','cash',1000,'KZT','$admin'::uuid,'{}'),
 ('$paymentReleaseRace'::uuid,'$tenant'::uuid,'$patient'::uuid,'received','cash',1000,'KZT','$admin'::uuid,'{}'),
 ('$paymentConsumeRace'::uuid,'$tenant'::uuid,'$patient'::uuid,'received','cash',1000,'KZT','$admin'::uuid,'{}'),
 ('$paymentIdempotentRace'::uuid,'$tenant'::uuid,'$patient'::uuid,'received','cash',1000,'KZT','$admin'::uuid,'{}'),
 ('$paymentIdempotentConflict'::uuid,'$tenant'::uuid,'$patient'::uuid,'received','cash',1000,'KZT','$admin'::uuid,'{}'),
 ('$paymentDifferentA'::uuid,'$tenant'::uuid,'$patient'::uuid,'received','cash',1000,'KZT','$admin'::uuid,'{}'),
 ('$paymentDifferentB'::uuid,'$tenant'::uuid,'$patient'::uuid,'received','cash',1000,'KZT','$admin'::uuid,'{}'),
 ('$paymentApproveRace'::uuid,'$tenant'::uuid,'$patient'::uuid,'received','cash',1000,'KZT','$admin'::uuid,'{}'),
 ('$paymentCompleteRace'::uuid,'$tenant'::uuid,'$patient'::uuid,'received','cash',1000,'KZT','$admin'::uuid,'{}'),
 ('$paymentRejectRace'::uuid,'$tenant'::uuid,'$patient'::uuid,'received','cash',1000,'KZT','$admin'::uuid,'{}'),
 ('$paymentVoidRace'::uuid,'$tenant'::uuid,'$patient'::uuid,'received','cash',1000,'KZT','$admin'::uuid,'{}');
COMMIT;
"@

$authContext = "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$admin',true);"

try {
  Invoke-Sql $cleanup | Out-Null
  Invoke-Sql $setup | Out-Null

  # 1. Reservation vs reservation: only one 700 reservation can fit.
  $reservationRace = @(Invoke-ConcurrentPair `
    ($authContext + " SELECT public.create_patient_fund_reservation('$tenant','$patient','$paymentReservationRace',700,'general',NULL,NULL,NULL,NULL,NULL,'{}','rr-a'); COMMIT;") `
    ($authContext + " SELECT public.create_patient_fund_reservation('$tenant','$patient','$paymentReservationRace',700,'general',NULL,NULL,NULL,NULL,NULL,'{}','rr-b'); COMMIT;"))
  Assert-Equal @($reservationRace | Where-Object { $_.Code -eq 0 }).Count 1 'reservation-vs-reservation success count'
  Assert-Equal @($reservationRace | Where-Object { $_.Code -ne 0 }).Count 1 'reservation-vs-reservation rejection count'
  Assert-Equal ([decimal](Invoke-Scalar "select coalesce(sum(remaining_amount),0) from public.patient_fund_reservations where payment_id='$paymentReservationRace'::uuid and status in ('active','partially_used')")) 700 'reservation-vs-reservation reserved total'
  Assert-Equal ([decimal](Invoke-Scalar "select available_credit_amount from public.get_payment_fund_capacity_internal('$tenant','$paymentReservationRace')")) 300 'reservation-vs-reservation available credit'
  Assert-Equal ([int](Invoke-Scalar "select count(*) from public.audit_events where action='patient_fund_reservation_created' and payment_id='$paymentReservationRace'")) 1 'reservation-vs-reservation audit count'
  Assert-Equal ([int](Invoke-Scalar "select count(*) from public.activity_events where type='patient_fund_reservation_created' and patient_id='$patient'::uuid and metadata->>'paymentId'='$paymentReservationRace'")) 1 'reservation-vs-reservation activity count'

  # 2. Reservation vs refund: one claimant wins 700; total locked capacity stays 700.
  $refundRace = @(Invoke-ConcurrentPair `
    ($authContext + " SELECT public.create_patient_fund_reservation('$tenant','$patient','$paymentRefundRace',700,'general',NULL,NULL,NULL,NULL,NULL,'{}','refund-race-reservation'); COMMIT;") `
    ($authContext + " SELECT public.request_refund('$tenant','$paymentRefundRace',700,'cash','refund race','refund-race-refund','{}'); COMMIT;"))
  Assert-Equal @($refundRace | Where-Object { $_.Code -eq 0 }).Count 1 'reservation-vs-refund success count'
  Assert-Equal @($refundRace | Where-Object { $_.Code -ne 0 }).Count 1 'reservation-vs-refund rejection count'
  $refundLocked = [decimal](Invoke-Scalar "select coalesce((select sum(remaining_amount) from public.patient_fund_reservations where payment_id='$paymentRefundRace'::uuid and status in ('active','partially_used')),0)+coalesce((select sum(amount) from public.refunds where payment_id='$paymentRefundRace'::uuid and status in ('pending','approved')),0)")
  Assert-Equal $refundLocked 700 'reservation-vs-refund locked total'
  Assert-Equal ([decimal](Invoke-Scalar "select available_credit_amount from public.get_payment_fund_capacity_internal('$tenant','$paymentRefundRace')")) 300 'reservation-vs-refund available credit'
  Assert-Equal ([int](Invoke-Scalar "select count(*) from public.audit_events where payment_id='$paymentRefundRace' and action in ('patient_fund_reservation_created','refund_requested')")) 1 'reservation-vs-refund success audit count'

  # 3. Reservation vs generic allocation: one claimant wins 700.
  $allocationRace = @(Invoke-ConcurrentPair `
    ($authContext + " SELECT public.create_patient_fund_reservation('$tenant','$patient','$paymentAllocationRace',700,'general',NULL,NULL,NULL,NULL,NULL,'{}','allocation-race-reservation'); COMMIT;") `
    ($authContext + " SELECT public.allocate_payment('$tenant','$paymentAllocationRace',700,'$invoice',NULL,'{}'); COMMIT;"))
  Assert-Equal @($allocationRace | Where-Object { $_.Code -eq 0 }).Count 1 'reservation-vs-allocation success count'
  Assert-Equal @($allocationRace | Where-Object { $_.Code -ne 0 }).Count 1 'reservation-vs-allocation rejection count'
  $allocationLocked = [decimal](Invoke-Scalar "select coalesce((select sum(remaining_amount) from public.patient_fund_reservations where payment_id='$paymentAllocationRace'::uuid and status in ('active','partially_used')),0)+coalesce((select sum(amount) from public.payment_allocations where payment_id='$paymentAllocationRace'::uuid and status='active'),0)")
  Assert-Equal $allocationLocked 700 'reservation-vs-allocation used total'
  Assert-Equal ([decimal](Invoke-Scalar "select available_credit_amount from public.get_payment_fund_capacity_internal('$tenant','$paymentAllocationRace')")) 300 'reservation-vs-allocation available credit'

  # 4. Release vs generic allocation: release always succeeds; allocation may follow it or reject before it.
  Invoke-Sql ($authContext + " SELECT public.create_patient_fund_reservation('$tenant','$patient','$paymentReleaseRace',600,'general',NULL,NULL,NULL,NULL,NULL,'{}','release-race-create'); COMMIT;") | Out-Null
  $releaseReservation = Invoke-Scalar "select id from public.patient_fund_reservations where tenant_id='$tenant'::uuid and idempotency_key='release-race-create'"
  $releaseRace = @(Invoke-ConcurrentPair `
    ($authContext + " SELECT public.release_patient_fund_reservation('$tenant','$releaseReservation',NULL,'release race','release-race-key'); COMMIT;") `
    ($authContext + " SELECT public.allocate_payment('$tenant','$paymentReleaseRace',600,'$invoice',NULL,'{}'); COMMIT;"))
  Assert-Equal ([int](Invoke-Scalar "select count(*) from public.patient_fund_reservations where id='$releaseReservation'::uuid and status='released' and remaining_amount=0")) 1 'release-vs-allocation release state'
  $releaseAllocation = [decimal](Invoke-Scalar "select coalesce(sum(amount),0) from public.payment_allocations where payment_id='$paymentReleaseRace'::uuid and status='active'")
  if ($releaseAllocation -ne 0 -and $releaseAllocation -ne 600) { throw "release-vs-allocation unexpected allocation=$releaseAllocation" }
  $releaseAvailable = [decimal](Invoke-Scalar "select available_credit_amount from public.get_payment_fund_capacity_internal('$tenant','$paymentReleaseRace')")
  if ($releaseAvailable -lt 0 -or ($releaseAvailable + $releaseAllocation) -ne 1000) { throw "release-vs-allocation capacity invalid available=$releaseAvailable allocation=$releaseAllocation" }
  Assert-Equal ([int](Invoke-Scalar "select count(*) from public.audit_events where action='patient_fund_reservation_released' and target_id='$releaseReservation'")) 1 'release-vs-allocation release audit count'

  # 5. Two consumes against the same reservation: one 400 consume wins, one loses against remainder 200.
  Invoke-Sql ($authContext + " SELECT public.create_patient_fund_reservation('$tenant','$patient','$paymentConsumeRace',600,'service','consume race',NULL,NULL,NULL,NULL,'{}','consume-race-create'); COMMIT;") | Out-Null
  $consumeReservation = Invoke-Scalar "select id from public.patient_fund_reservations where tenant_id='$tenant'::uuid and idempotency_key='consume-race-create'"
  $consumeRace = @(Invoke-ConcurrentPair `
    ($authContext + " SELECT public.allocate_reserved_credit('$tenant','$patient','$consumeReservation','$invoice',400,'consume-race-a'); COMMIT;") `
    ($authContext + " SELECT public.allocate_reserved_credit('$tenant','$patient','$consumeReservation','$invoice',400,'consume-race-b'); COMMIT;"))
  Assert-Equal @($consumeRace | Where-Object { $_.Code -eq 0 }).Count 1 'consume-vs-consume success count'
  Assert-Equal @($consumeRace | Where-Object { $_.Code -ne 0 }).Count 1 'consume-vs-consume rejection count'
  Assert-Equal ([decimal](Invoke-Scalar "select consumed_amount from public.patient_fund_reservations where id='$consumeReservation'::uuid")) 400 'consume-vs-consume consumed amount'
  Assert-Equal ([decimal](Invoke-Scalar "select remaining_amount from public.patient_fund_reservations where id='$consumeReservation'::uuid")) 200 'consume-vs-consume remainder'
  Assert-Equal ([int](Invoke-Scalar "select count(*) from public.payment_allocations where patient_fund_reservation_id='$consumeReservation'::uuid")) 1 'consume-vs-consume allocation rows'
  Assert-Equal ([int](Invoke-Scalar "select count(*) from public.audit_events where action='reserved_credit_allocated' and metadata->>'reservationId'='$consumeReservation'")) 1 'consume-vs-consume allocation audit count'
  Assert-Equal ([int](Invoke-Scalar "select count(*) from public.activity_events where type='reserved_credit_allocated' and metadata->>'reservationId'='$consumeReservation'")) 1 'consume-vs-consume allocation activity count'

  # 6. Same idempotency key and same payload: both callers succeed, one row and one event.
  $sameKeyRace = @(Invoke-ConcurrentPair `
    ($authContext + " SELECT public.create_patient_fund_reservation('$tenant','$patient','$paymentIdempotentRace',300,'general',NULL,NULL,NULL,NULL,NULL,'{}','same-key'); COMMIT;") `
    ($authContext + " SELECT public.create_patient_fund_reservation('$tenant','$patient','$paymentIdempotentRace',300,'general',NULL,NULL,NULL,NULL,NULL,'{}','same-key'); COMMIT;"))
  Assert-Equal @($sameKeyRace | Where-Object { $_.Code -eq 0 }).Count 2 'same-key identical retries success count'
  Assert-Equal ([int](Invoke-Scalar "select count(*) from public.patient_fund_reservations where tenant_id='$tenant'::uuid and idempotency_key='same-key'")) 1 'same-key reservation row count'
  Assert-Equal ([int](Invoke-Scalar "select count(*) from public.audit_events where action='patient_fund_reservation_created' and payment_id='$paymentIdempotentRace'")) 1 'same-key audit count'

  # 7. Same key with different payload: one succeeds, one conflicts.
  $differentPayloadRace = @(Invoke-ConcurrentPair `
    ($authContext + " SELECT public.create_patient_fund_reservation('$tenant','$patient','$paymentIdempotentConflict',200,'general',NULL,NULL,NULL,NULL,NULL,'{}','conflict-key'); COMMIT;") `
    ($authContext + " SELECT public.create_patient_fund_reservation('$tenant','$patient','$paymentIdempotentConflict',300,'general',NULL,NULL,NULL,NULL,NULL,'{}','conflict-key'); COMMIT;"))
  Assert-Equal @($differentPayloadRace | Where-Object { $_.Code -eq 0 }).Count 1 'different-payload key success count'
  Assert-Equal @($differentPayloadRace | Where-Object { $_.Code -ne 0 }).Count 1 'different-payload key rejection count'
  Assert-Equal ([int](Invoke-Scalar "select count(*) from public.patient_fund_reservations where tenant_id='$tenant'::uuid and idempotency_key='conflict-key'")) 1 'different-payload key row count'

  # 8. Refund transitions use payment -> refund lock order and do not deadlock with reservation creation.
  Invoke-Sql ($authContext + " SELECT public.request_refund('$tenant','$paymentApproveRace',700,'cash','approve race','approve-race-refund','{}'); COMMIT;") | Out-Null
  $approveRefund = Invoke-Scalar "select id from public.refunds where tenant_id='$tenant'::uuid and idempotency_key='approve-race-refund'"
  $approveRace = @(Invoke-ConcurrentPair `
    ($authContext + " SELECT public.create_patient_fund_reservation('$tenant','$patient','$paymentApproveRace',400,'general',NULL,NULL,NULL,NULL,NULL,'{}','approve-race-reservation'); COMMIT;") `
    ($authContext + " SELECT public.approve_refund('$tenant','$approveRefund'); COMMIT;"))
  Assert-Equal @($approveRace | Where-Object { $_.Code -eq 0 }).Count 1 'reservation-vs-approve success count'
  Assert-Equal @($approveRace | Where-Object { $_.Code -ne 0 }).Count 1 'reservation-vs-approve rejection count'
  Assert-Equal (Invoke-Scalar "select status from public.refunds where id='$approveRefund'::uuid") 'approved' 'approve transition status'
  Assert-Equal ([int](Invoke-Scalar "select count(*) from public.audit_events where action='refund_approved' and target_id='$approveRefund'")) 1 'approve transition audit count'

  Invoke-Sql ($authContext + " SELECT public.request_refund('$tenant','$paymentCompleteRace',700,'cash','complete race','complete-race-refund','{}'); COMMIT;") | Out-Null
  $completeRefund = Invoke-Scalar "select id from public.refunds where tenant_id='$tenant'::uuid and idempotency_key='complete-race-refund'"
  Invoke-Sql ($authContext + " SELECT public.approve_refund('$tenant','$completeRefund'); COMMIT;") | Out-Null
  $completeRace = @(Invoke-ConcurrentPair `
    ($authContext + " SELECT public.create_patient_fund_reservation('$tenant','$patient','$paymentCompleteRace',400,'general',NULL,NULL,NULL,NULL,NULL,'{}','complete-race-reservation'); COMMIT;") `
    ($authContext + " SELECT public.complete_refund('$tenant','$completeRefund','complete-race','{}'); COMMIT;"))
  Assert-Equal @($completeRace | Where-Object { $_.Code -eq 0 }).Count 1 'reservation-vs-complete success count'
  Assert-Equal @($completeRace | Where-Object { $_.Code -ne 0 }).Count 1 'reservation-vs-complete rejection count'
  Assert-Equal (Invoke-Scalar "select status from public.refunds where id='$completeRefund'::uuid") 'completed' 'complete transition status'
  Assert-Equal ([int](Invoke-Scalar "select count(*) from public.audit_events where action='refund_completed' and target_id='$completeRefund'")) 1 'complete transition audit count'

  Invoke-Sql ($authContext + " SELECT public.request_refund('$tenant','$paymentRejectRace',700,'cash','reject race','reject-race-refund','{}'); COMMIT;") | Out-Null
  $rejectRefund = Invoke-Scalar "select id from public.refunds where tenant_id='$tenant'::uuid and idempotency_key='reject-race-refund'"
  $rejectRace = @(Invoke-ConcurrentPair `
    ($authContext + " SELECT public.create_patient_fund_reservation('$tenant','$patient','$paymentRejectRace',700,'general',NULL,NULL,NULL,NULL,NULL,'{}','reject-race-reservation'); COMMIT;") `
    ($authContext + " SELECT public.reject_refund('$tenant','$rejectRefund','reject race'); COMMIT;"))
  if (@($rejectRace | Where-Object { $_.Code -eq 0 }).Count -lt 1) { throw 'reservation-vs-reject must complete the reject transition' }
  Assert-Equal (Invoke-Scalar "select status from public.refunds where id='$rejectRefund'::uuid") 'rejected' 'reject transition status'
  $rejectAvailable = [decimal](Invoke-Scalar "select available_credit_amount from public.get_payment_fund_capacity_internal('$tenant','$paymentRejectRace')")
  if ($rejectAvailable -ne 300 -and $rejectAvailable -ne 1000) { throw "reservation-vs-reject unexpected available credit=$rejectAvailable" }
  Assert-Equal ([int](Invoke-Scalar "select count(*) from public.audit_events where action='refund_rejected' and target_id='$rejectRefund'")) 1 'reject transition audit count'

  Invoke-Sql ($authContext + " SELECT public.request_refund('$tenant','$paymentVoidRace',700,'cash','void race','void-race-refund','{}'); COMMIT;") | Out-Null
  $voidRefund = Invoke-Scalar "select id from public.refunds where tenant_id='$tenant'::uuid and idempotency_key='void-race-refund'"
  $voidRace = @(Invoke-ConcurrentPair `
    ($authContext + " SELECT public.create_patient_fund_reservation('$tenant','$patient','$paymentVoidRace',700,'general',NULL,NULL,NULL,NULL,NULL,'{}','void-race-reservation'); COMMIT;") `
    ($authContext + " SELECT public.void_refund('$tenant','$voidRefund','void race'); COMMIT;"))
  if (@($voidRace | Where-Object { $_.Code -eq 0 }).Count -lt 1) { throw 'reservation-vs-void must complete the void transition' }
  Assert-Equal (Invoke-Scalar "select status from public.refunds where id='$voidRefund'::uuid") 'voided' 'void transition status'
  $voidAvailable = [decimal](Invoke-Scalar "select available_credit_amount from public.get_payment_fund_capacity_internal('$tenant','$paymentVoidRace')")
  if ($voidAvailable -ne 300 -and $voidAvailable -ne 1000) { throw "reservation-vs-void unexpected available credit=$voidAvailable" }
  Assert-Equal ([int](Invoke-Scalar "select count(*) from public.audit_events where action='refund_voided' and target_id='$voidRefund'")) 1 'void transition audit count'

  # 9. Different payments do not serialize each other and both proceed.
  $differentPayments = @(Invoke-ConcurrentPair `
    ($authContext + " SELECT public.create_patient_fund_reservation('$tenant','$patient','$paymentDifferentA',600,'general',NULL,NULL,NULL,NULL,NULL,'{}','different-a'); COMMIT;") `
    ($authContext + " SELECT public.create_patient_fund_reservation('$tenant','$patient','$paymentDifferentB',600,'general',NULL,NULL,NULL,NULL,NULL,'{}','different-b'); COMMIT;"))
  Assert-Equal @($differentPayments | Where-Object { $_.Code -eq 0 }).Count 2 'different payments success count'
  Assert-Equal ([int](Invoke-Scalar "select count(*) from public.patient_fund_reservations where payment_id in ('$paymentDifferentA'::uuid,'$paymentDifferentB'::uuid)")) 2 'different payments row count'

  $negativeCapacity = [int](Invoke-Scalar "select count(*) from (select p.id, p.amount-c.active_allocated_amount-c.completed_refund_amount-c.refund_reserved_amount-c.reserved_deposit_amount as free from public.payments p cross join lateral public.get_payment_fund_capacity_internal(p.tenant_id,p.id) c where p.tenant_id='$tenant'::uuid) q where free < 0")
  Assert-Equal $negativeCapacity 0 'negative capacity rows'

  Write-Output "RESERVATION_RACE success=1 rejected=1 reserved=700 available=300"
  Write-Output "REFUND_RACE success=1 rejected=1 locked=$refundLocked available=300"
  Write-Output "ALLOCATION_RACE success=1 rejected=1 used=$allocationLocked available=300"
  Write-Output "RELEASE_RACE allocation=$releaseAllocation available=$releaseAvailable"
  Write-Output "CONSUME_RACE success=1 rejected=1 consumed=400 remaining=200"
  Write-Output "IDEMPOTENCY_RACE identical_success=2 rows=1 conflict_success=1 conflict_rejected=1"
  Write-Output "REFUND_TRANSITION_RACES approve=approved complete=completed reject=rejected/$rejectAvailable void=voided/$voidAvailable deadlocks=0"
  Write-Output 'PATIENT-CREDIT-DEPOSITS-FOUNDATION-001 CONCURRENCY VALIDATION PASSED'
}
finally {
  Invoke-Sql $cleanup | Out-Null
  $remainingTenant = [int](Invoke-Scalar "select count(*) from public.tenants where id='$tenant'::uuid")
  $remainingUser = [int](Invoke-Scalar "select count(*) from auth.users where id='$admin'::uuid")
  if ($remainingTenant -ne 0 -or $remainingUser -ne 0) {
    throw "Concurrency cleanup failed: tenants=$remainingTenant users=$remainingUser"
  }
}
