$ErrorActionPreference = 'Stop'

# AMOCRM-INTEGRATION-HARDENING-001 local-only concurrency validation.
# No request is sent to a real amoCRM account. Provider exchanges are represented by
# deterministic encrypted byte payloads after the same database leases used by the backend.
$container = (docker ps --format '{{.Names}}' | Where-Object { $_ -like 'supabase_db_*' } | Select-Object -First 1)
if (-not $container) { throw 'Local Supabase DB container is not running.' }

$tenantA = 'c3410000-0000-4000-8000-000000000001'
$tenantB = 'c3410000-0000-4000-8000-000000000002'
$tenantC = 'c3410000-0000-4000-8000-000000000003'
$ownerA = 'c3420000-0000-4000-8000-000000000001'
$ownerB = 'c3420000-0000-4000-8000-000000000002'
$ownerC = 'c3420000-0000-4000-8000-000000000003'
$redirectHash = ('a' * 64)
$deadlocks = 0
$callbackExchanges = 0
$refreshCalls = 0
$refreshReplays = 0
$mismatches = 0

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

function Start-ConnectionSql(
  [string]$tenantId,
  [string]$actorId,
  [string]$stateHash,
  [string]$expectedAccount = '',
  [string]$expectedDomain = ''
) {
  $accountSql = if ($expectedAccount) { "'$expectedAccount'" } else { 'NULL' }
  $domainSql = if ($expectedDomain) { "'$expectedDomain'" } else { 'NULL' }
  return "SELECT public.amocrm_start_connection_server('$tenantId','$actorId','$stateHash','$redirectHash',now()+interval '10 minutes',$accountSql,$domainSql,true);"
}

function Claim-Sql([string]$stateHash, [string]$lease) {
  return "SELECT public.amocrm_claim_callback_state_server('$stateHash','$lease');"
}

function Complete-Sql(
  [string]$stateHash,
  [string]$lease,
  [string]$accountId,
  [string]$domain,
  [string]$accessHex,
  [string]$refreshHex
) {
  return "SELECT public.amocrm_complete_callback_server('$stateHash','$lease','$accountId','$domain','Concurrent Test',decode('$accessHex','hex'),decode('$refreshHex','hex'),1,now()+interval '1 day');"
}

$setup = @"
DELETE FROM public.tenants WHERE id IN ('$tenantA','$tenantB','$tenantC');
DELETE FROM auth.users WHERE id IN ('$ownerA','$ownerB','$ownerC');
INSERT INTO public.tenants(id,name,timezone) VALUES
('$tenantA','Concurrency A','Asia/Almaty'),
('$tenantB','Concurrency B','Asia/Almaty'),
('$tenantC','Concurrency C','Asia/Almaty');
INSERT INTO auth.users(
 id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
 raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) VALUES
('$ownerA','00000000-0000-0000-0000-000000000000','authenticated','authenticated','amo-concurrency-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
('$ownerB','00000000-0000-0000-0000-000000000000','authenticated','authenticated','amo-concurrency-b@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
('$ownerC','00000000-0000-0000-0000-000000000000','authenticated','authenticated','amo-concurrency-c@example.local','x',now(),'{"provider":"email"}','{}',now(),now());
INSERT INTO public.profiles(id) VALUES ('$ownerA'),('$ownerB'),('$ownerC');
INSERT INTO public.tenant_users(tenant_id,user_id,role) VALUES
('$tenantA','$ownerA','clinic_owner'),('$tenantB','$ownerB','clinic_owner'),('$tenantC','$ownerC','clinic_owner');
"@
Invoke-Sql $setup | Out-Null

try {
  # A. Two starts: one stable account, two state rows, one live state.
  $stateA1 = ('1' * 64)
  $stateA2 = ('2' * 64)
  $startPair = Invoke-ConcurrentPair (Start-ConnectionSql $tenantA $ownerA $stateA1) (Start-ConnectionSql $tenantA $ownerA $stateA2)
  Assert-True (($startPair | Where-Object Code -eq 0).Count -eq 2) 'A both starts should complete'
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.integration_accounts WHERE tenant_id='$tenantA'") -eq '1') 'A one stable integration account'
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.integration_oauth_states WHERE tenant_id='$tenantA'") -eq '2') 'A independent states recorded'
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.integration_oauth_states WHERE tenant_id='$tenantA' AND consumed_at IS NULL AND cancelled_at IS NULL") -eq '1') 'A one live state'

  # B. Same callback state twice: one claimant/exchange winner.
  $liveState = Invoke-Scalar "SELECT state_hash FROM public.integration_oauth_states WHERE tenant_id='$tenantA' AND consumed_at IS NULL AND cancelled_at IS NULL"
  $claimLeaseA = 'c3430000-0000-4000-8000-000000000001'
  $claimLeaseB = 'c3430000-0000-4000-8000-000000000002'
  $claimPair = Invoke-ConcurrentPair (Claim-Sql $liveState $claimLeaseA) (Claim-Sql $liveState $claimLeaseB)
  $claimWinners = @($claimPair | Where-Object Code -eq 0)
  Assert-True ($claimWinners.Count -eq 1) 'B one callback claim winner'
  $callbackExchanges += $claimWinners.Count
  $winnerClaimLease = if ($claimPair[0].Code -eq 0) { $claimLeaseA } else { $claimLeaseB }
  Invoke-Sql (Complete-Sql $liveState $winnerClaimLease '123456' 'clinic-a.amocrm.ru' '01020304' '05060708') | Out-Null
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.integration_oauth_states WHERE state_hash='$liveState' AND consumed_at IS NOT NULL") -eq '1') 'B state consumed once'
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.audit_events WHERE tenant_id='$tenantA' AND action='amocrm_connection_completed'") -eq '1') 'B one completion audit'

  # C. Different states for the same tenant: deterministic single live state and mismatch cannot overwrite.
  $stateC1 = ('3' * 64)
  $stateC2 = ('4' * 64)
  $startPairC = Invoke-ConcurrentPair `
    (Start-ConnectionSql $tenantA $ownerA $stateC1 '123456' 'clinic-a.amocrm.ru') `
    (Start-ConnectionSql $tenantA $ownerA $stateC2 '123456' 'clinic-a.amocrm.ru')
  Assert-True (($startPairC | Where-Object Code -eq 0).Count -eq 2) 'C both reconnect starts complete'
  $liveStateC = Invoke-Scalar "SELECT state_hash FROM public.integration_oauth_states WHERE tenant_id='$tenantA' AND consumed_at IS NULL AND cancelled_at IS NULL"
  $leaseC = 'c3430000-0000-4000-8000-000000000003'
  Invoke-Sql (Claim-Sql $liveStateC $leaseC) | Out-Null
  $mismatchResult = Invoke-Sql (Complete-Sql $liveStateC $leaseC '999999' 'wrong-account.amocrm.ru' '11121314' '15161718')
  Assert-True ($mismatchResult -match 'account_mismatch') 'C mismatch safely represented'
  $mismatches += 1
  Assert-True ((Invoke-Scalar "SELECT encode(encrypted_access_credential,'hex') FROM public.integration_credentials c JOIN public.integration_accounts a ON a.id=c.integration_account_id WHERE a.tenant_id='$tenantA'") -eq '01020304') 'C mismatch did not overwrite credentials'

  # Restore A through a verified reconnect.
  $restoreState = ('5' * 64)
  $restoreLease = 'c3430000-0000-4000-8000-000000000004'
  Invoke-Sql (Start-ConnectionSql $tenantA $ownerA $restoreState '123456' 'clinic-a.amocrm.ru') | Out-Null
  Invoke-Sql (Claim-Sql $restoreState $restoreLease) | Out-Null
  Invoke-Sql (Complete-Sql $restoreState $restoreLease '123456' 'clinic-a.amocrm.ru' '21222324' '25262728') | Out-Null
  $callbackExchanges += 2

  # D. Two tenants complete the same external account concurrently: advisory account lock yields one binding.
  $stateB = ('b' * 64)
  $stateC = ('c' * 64)
  $leaseB = 'c3430000-0000-4000-8000-000000000005'
  $leaseTenantC = 'c3430000-0000-4000-8000-000000000006'
  Invoke-Sql (Start-ConnectionSql $tenantB $ownerB $stateB) | Out-Null
  Invoke-Sql (Start-ConnectionSql $tenantC $ownerC $stateC) | Out-Null
  Invoke-Sql (Claim-Sql $stateB $leaseB) | Out-Null
  Invoke-Sql (Claim-Sql $stateC $leaseTenantC) | Out-Null
  $sameAccountPair = Invoke-ConcurrentPair `
    (Complete-Sql $stateB $leaseB 'shared-777' 'shared.amocrm.ru' '31323334' '35363738') `
    (Complete-Sql $stateC $leaseTenantC 'shared-777' 'shared.amocrm.ru' '41424344' '45464748')
  Assert-True (($sameAccountPair | Where-Object Code -eq 0).Count -eq 2) 'D both callbacks return controlled results'
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.integration_accounts WHERE external_account_id='shared-777' AND status IN ('connected','refresh_required','degraded','account_mismatch','revoked','disabled')") -eq '1') 'D one active binding winner'
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.integration_accounts WHERE last_error_code='account_already_bound'") -eq '1') 'D loser safely rejected'
  $callbackExchanges += 2

  # E. Two refresh calls on the same version: one lease/external refresh, one replay.
  Invoke-Sql "UPDATE public.integration_credentials SET access_expires_at=now()-interval '1 minute' WHERE tenant_id='$tenantA'; UPDATE public.integration_accounts SET token_expires_at=now()-interval '1 minute' WHERE tenant_id='$tenantA';" | Out-Null
  $refreshLeaseA = 'c3440000-0000-4000-8000-000000000001'
  $refreshLeaseB = 'c3440000-0000-4000-8000-000000000002'
  $refreshPair = Invoke-ConcurrentPair `
    "SELECT public.amocrm_acquire_refresh_server('$tenantA','$ownerA','$refreshLeaseA',300);" `
    "SELECT public.amocrm_acquire_refresh_server('$tenantA','$ownerA','$refreshLeaseB',300);"
  $heldLease = Invoke-Scalar "SELECT refresh_lease_token FROM public.integration_accounts WHERE tenant_id='$tenantA'"
  Assert-True ($heldLease -in @($refreshLeaseA,$refreshLeaseB)) 'E one refresh lease held'
  Assert-True ((@($refreshPair | Where-Object { $_.Text -match 'acquired' })).Count -eq 1) 'E one refresh winner'
  Assert-True ((@($refreshPair | Where-Object { $_.Text -match 'in_progress' })).Count -eq 1) 'E one refresh replay'
  $refreshCalls += 1
  $refreshReplays += 1
  $versionBefore = [int](Invoke-Scalar "SELECT credential_version FROM public.integration_accounts WHERE tenant_id='$tenantA'")
  $integrationA = Invoke-Scalar "SELECT id FROM public.integration_accounts WHERE tenant_id='$tenantA'"
  Invoke-Sql "SELECT public.amocrm_commit_refresh_server('$integrationA','$ownerA','$heldLease',$versionBefore,decode('51525354','hex'),decode('55565758','hex'),1,now()+interval '1 day','123456','clinic-a.amocrm.ru','Clinic A');" | Out-Null
  Assert-True ([int](Invoke-Scalar "SELECT credential_version FROM public.integration_accounts WHERE tenant_id='$tenantA'") -eq ($versionBefore + 1)) 'E version increments once'

  # F. Refresh versus disconnect: final state is disconnected with no usable credentials.
  Invoke-Sql "UPDATE public.integration_credentials SET access_expires_at=now()-interval '1 minute' WHERE tenant_id='$tenantA'; UPDATE public.integration_accounts SET token_expires_at=now()-interval '1 minute' WHERE tenant_id='$tenantA';" | Out-Null
  $refreshLeaseF = 'c3440000-0000-4000-8000-000000000003'
  $acquireF = Invoke-Sql "SELECT public.amocrm_acquire_refresh_server('$tenantA','$ownerA','$refreshLeaseF',300);"
  Assert-True ($acquireF -match 'acquired') 'F refresh acquired before race'
  $refreshCalls += 1
  $versionF = [int](Invoke-Scalar "SELECT credential_version FROM public.integration_accounts WHERE tenant_id='$tenantA'")
  $refreshDisconnectPair = Invoke-ConcurrentPair `
    "SELECT public.amocrm_commit_refresh_server('$integrationA','$ownerA','$refreshLeaseF',$versionF,decode('61626364','hex'),decode('65666768','hex'),1,now()+interval '1 day','123456','clinic-a.amocrm.ru','Clinic A');" `
    "SELECT public.amocrm_disconnect_server('$tenantA','$ownerA');"
  Assert-True ((Invoke-Scalar "SELECT status FROM public.integration_accounts WHERE tenant_id='$tenantA'") -eq 'disconnected') 'F final state disconnected'
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.integration_credentials WHERE tenant_id='$tenantA'") -eq '0') 'F no active credentials after disconnect'

  # Reconnect A for refresh-versus-callback and reference scenarios.
  $stateG = ('6' * 64)
  $leaseG = 'c3430000-0000-4000-8000-000000000007'
  Invoke-Sql (Start-ConnectionSql $tenantA $ownerA $stateG '123456' 'clinic-a.amocrm.ru') | Out-Null
  Invoke-Sql (Claim-Sql $stateG $leaseG) | Out-Null
  Invoke-Sql (Complete-Sql $stateG $leaseG '123456' 'clinic-a.amocrm.ru' '71727374' '75767778') | Out-Null
  $callbackExchanges += 1

  # G. Refresh versus reconnect callback: verified reconnect wins final credential bytes.
  Invoke-Sql "UPDATE public.integration_credentials SET access_expires_at=now()-interval '1 minute' WHERE tenant_id='$tenantA'; UPDATE public.integration_accounts SET token_expires_at=now()-interval '1 minute' WHERE tenant_id='$tenantA';" | Out-Null
  $refreshLeaseG = 'c3440000-0000-4000-8000-000000000004'
  $acquireG = Invoke-Sql "SELECT public.amocrm_acquire_refresh_server('$tenantA','$ownerA','$refreshLeaseG',300);"
  Assert-True ($acquireG -match 'acquired') 'G refresh lease acquired'
  $refreshCalls += 1
  $versionG = [int](Invoke-Scalar "SELECT credential_version FROM public.integration_accounts WHERE tenant_id='$tenantA'")
  $callbackStateG = ('7' * 64)
  $callbackLeaseG = 'c3430000-0000-4000-8000-000000000008'
  Invoke-Sql (Start-ConnectionSql $tenantA $ownerA $callbackStateG '123456' 'clinic-a.amocrm.ru') | Out-Null
  Invoke-Sql (Claim-Sql $callbackStateG $callbackLeaseG) | Out-Null
  $refreshReconnectPair = Invoke-ConcurrentPair `
    "SELECT public.amocrm_commit_refresh_server('$integrationA','$ownerA','$refreshLeaseG',$versionG,decode('81828384','hex'),decode('85868788','hex'),1,now()+interval '1 day','123456','clinic-a.amocrm.ru','Clinic A');" `
    (Complete-Sql $callbackStateG $callbackLeaseG '123456' 'clinic-a.amocrm.ru' '91929394' '95969798')
  Assert-True (($refreshReconnectPair | Where-Object Code -eq 0).Count -eq 2) 'G race completes without deadlock'
  Assert-True ((Invoke-Scalar "SELECT encode(encrypted_access_credential,'hex') FROM public.integration_credentials WHERE tenant_id='$tenantA'") -eq '91929394') 'G reconnect credential cannot be overwritten by stale refresh'
  Assert-True ((Invoke-Scalar "SELECT status FROM public.integration_accounts WHERE tenant_id='$tenantA'") -eq 'connected') 'G final connection healthy'
  $callbackExchanges += 1

  # H. Concurrent disconnect replay: one audit transition, safe replays.
  $disconnectAuditBefore = [int](Invoke-Scalar "SELECT count(*) FROM public.audit_events WHERE tenant_id='$tenantA' AND action='amocrm_disconnected'")
  $disconnectPair = Invoke-ConcurrentPair `
    "SELECT public.amocrm_disconnect_server('$tenantA','$ownerA');" `
    "SELECT public.amocrm_disconnect_server('$tenantA','$ownerA');"
  Assert-True (($disconnectPair | Where-Object Code -eq 0).Count -eq 2) 'H both disconnect calls return safely'
  Assert-True ((@($disconnectPair | Where-Object { $_.Text -match '"replayed"\s*:\s*true' })).Count -eq 1) 'H one disconnect is replay'
  Assert-True ([int](Invoke-Scalar "SELECT count(*) FROM public.audit_events WHERE tenant_id='$tenantA' AND action='amocrm_disconnected'") -eq ($disconnectAuditBefore + 1)) 'H one disconnect audit event'

  # I. Duplicate external reference: one mapping winner.
  $internalRef = 'c3450000-0000-4000-8000-000000000001'
  $referencePair = Invoke-ConcurrentPair `
    "SELECT public.amocrm_create_external_reference_server('$tenantA','$ownerA','contact','$internalRef','contact-1',NULL);" `
    "SELECT public.amocrm_create_external_reference_server('$tenantA','$ownerA','contact','$internalRef','contact-1',NULL);"
  $referenceWinnerCount = @($referencePair | Where-Object Code -eq 0).Count
  Assert-True ($referenceWinnerCount -eq 1) ("I one external reference winner. A=$($referencePair[0].Code):$($referencePair[0].Text) B=$($referencePair[1].Code):$($referencePair[1].Text)")
  Assert-True ((Invoke-Scalar "SELECT count(*) FROM public.integration_external_references WHERE tenant_id='$tenantA' AND internal_entity_id='$internalRef'") -eq '1') 'I exactly one mapping'

  # J. Expiry versus callback: expired state cannot be claimed.
  $expiredState = ('e' * 64)
  Invoke-Sql @"
INSERT INTO public.integration_oauth_states(
 state_hash,tenant_id,integration_account_id,initiated_by,provider_code,
 redirect_uri_fingerprint,expires_at
) SELECT '$expiredState',tenant_id,id,'$ownerA','amocrm','$redirectHash',now()-interval '1 second'
FROM public.integration_accounts WHERE tenant_id='$tenantA';
"@ | Out-Null
  $expiredLease = 'c3430000-0000-4000-8000-000000000009'
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $expiredOutput = "SELECT public.amocrm_claim_callback_state_server('$expiredState','$expiredLease');" | docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q 2>&1
  $expiredCode = [int]$LASTEXITCODE
  $ErrorActionPreference = $old
  Assert-True ($expiredCode -ne 0 -and (($expiredOutput -join "`n") -match 'AMOCRM_STATE_EXPIRED')) 'J expired state rejected'

  # K and final counters/invariants.
  $integrationAccounts = [int](Invoke-Scalar "SELECT count(*) FROM public.integration_accounts WHERE tenant_id IN ('$tenantA','$tenantB','$tenantC')")
  $oauthStates = [int](Invoke-Scalar "SELECT count(*) FROM public.integration_oauth_states WHERE tenant_id IN ('$tenantA','$tenantB','$tenantC')")
  $consumedStates = [int](Invoke-Scalar "SELECT count(*) FROM public.integration_oauth_states WHERE tenant_id IN ('$tenantA','$tenantB','$tenantC') AND consumed_at IS NOT NULL")
  $credentialVersions = [int](Invoke-Scalar "SELECT coalesce(max(credential_version),0) FROM public.integration_accounts WHERE tenant_id IN ('$tenantA','$tenantB','$tenantC')")
  $disconnectedAccounts = [int](Invoke-Scalar "SELECT count(*) FROM public.integration_accounts WHERE tenant_id IN ('$tenantA','$tenantB','$tenantC') AND status='disconnected'")
  $externalReferences = [int](Invoke-Scalar "SELECT count(*) FROM public.integration_external_references WHERE tenant_id IN ('$tenantA','$tenantB','$tenantC')")
  $auditEvents = [int](Invoke-Scalar "SELECT count(*) FROM public.audit_events WHERE tenant_id IN ('$tenantA','$tenantB','$tenantC') AND action LIKE 'amocrm_%'")
  $activityEvents = [int](Invoke-Scalar "SELECT count(*) FROM public.activity_events WHERE tenant_id IN ('$tenantA','$tenantB','$tenantC') AND type LIKE 'amocrm_%'")
  $crossTenantCredentialOverwrite = [int](Invoke-Scalar "SELECT count(*) FROM public.integration_credentials c JOIN public.integration_accounts a ON a.id=c.integration_account_id WHERE c.tenant_id<>a.tenant_id")
  $duplicateActiveBindings = [int](Invoke-Scalar "SELECT count(*) FROM (SELECT external_account_id FROM public.integration_accounts WHERE external_account_id IS NOT NULL AND status IN ('connected','refresh_required','degraded','account_mismatch','revoked','disabled') GROUP BY external_account_id HAVING count(*)>1) x")
  $credentialVersionRollback = [int](Invoke-Scalar "SELECT count(*) FROM public.integration_credentials c JOIN public.integration_accounts a ON a.id=c.integration_account_id WHERE c.credential_version<>a.credential_version")
  $rawCredentialsInAudit = [int](Invoke-Scalar "SELECT count(*) FROM public.audit_events WHERE tenant_id IN ('$tenantA','$tenantB','$tenantC') AND metadata::text ~* '(access[_ ]?token|refresh[_ ]?token|client[_ ]?secret|authorization[_ ]?code|state[_ ]?hash|01020304|91929394)'")
  $oauthStateReuse = [int](Invoke-Scalar "SELECT count(*) FROM (SELECT state_hash,count(*) FROM public.integration_oauth_states GROUP BY state_hash HAVING count(*)>1) x")
  $auditActivityMismatch = [math]::Abs($auditEvents - $activityEvents)

  Assert-True ($crossTenantCredentialOverwrite -eq 0) 'cross-tenant credential overwrite = 0'
  Assert-True ($duplicateActiveBindings -eq 0) 'duplicate active account bindings = 0'
  Assert-True ($credentialVersionRollback -eq 0) 'credential version rollback = 0'
  Assert-True ($rawCredentialsInAudit -eq 0) 'raw credentials in audit = 0'
  Assert-True ($oauthStateReuse -eq 0) 'OAuth state reuse = 0'
  Assert-True ($deadlocks -eq 0) 'deadlocks = 0'
  Assert-True ($auditActivityMismatch -eq 0) 'audit/activity mismatch = 0'

  [ordered]@{
    integrationAccounts = $integrationAccounts
    oauthStates = $oauthStates
    consumedStates = $consumedStates
    callbackExchanges = $callbackExchanges
    credentialVersions = $credentialVersions
    refreshCalls = $refreshCalls
    refreshReplays = $refreshReplays
    mismatches = $mismatches
    disconnectedAccounts = $disconnectedAccounts
    externalReferences = $externalReferences
    auditEvents = $auditEvents
    activityEvents = $activityEvents
    deadlocks = $deadlocks
    invariants = [ordered]@{
      crossTenantCredentialOverwrite = $crossTenantCredentialOverwrite
      duplicateActiveAccountBindings = $duplicateActiveBindings
      credentialVersionRollback = $credentialVersionRollback
      rawCredentialsInAudit = $rawCredentialsInAudit
      oauthStateReuse = $oauthStateReuse
      auditActivityMismatch = $auditActivityMismatch
    }
  } | ConvertTo-Json -Depth 4
}
finally {
  Invoke-Sql "DELETE FROM public.tenants WHERE id IN ('$tenantA','$tenantB','$tenantC'); DELETE FROM auth.users WHERE id IN ('$ownerA','$ownerB','$ownerC');" | Out-Null
}
