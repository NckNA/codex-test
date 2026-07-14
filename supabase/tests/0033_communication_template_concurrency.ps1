$ErrorActionPreference = 'Stop'

# COMMUNICATION-TEMPLATE-FOUNDATION-001 local-only concurrency validation.
# No external provider, amoCRM, SMS, WhatsApp or email request is made.
$container = (docker ps --format '{{.Names}}' | Where-Object { $_ -like 'supabase_db_*' } | Select-Object -First 1)
if (-not $container) { throw 'Local Supabase DB container is not running.' }

$tenantA = 'f3310000-0000-4000-8000-000000000001'
$tenantB = 'f3310000-0000-4000-8000-000000000002'
$adminA = 'f3320000-0000-4000-8000-000000000001'
$adminB = 'f3320000-0000-4000-8000-000000000002'
$patientA = 'f3330000-0000-4000-8000-000000000001'
$patientB = 'f3330000-0000-4000-8000-000000000002'
$doctorA = 'f3340000-0000-4000-8000-000000000001'
$doctorB = 'f3340000-0000-4000-8000-000000000002'
$appointmentA1 = 'f3350000-0000-4000-8000-000000000001'
$appointmentA2 = 'f3350000-0000-4000-8000-000000000002'
$appointmentA3 = 'f3350000-0000-4000-8000-000000000003'
$appointmentB1 = 'f3350000-0000-4000-8000-000000000101'
$contactA = 'f3360000-0000-4000-8000-000000000001'
$contactB = 'f3360000-0000-4000-8000-000000000002'
$jobA1 = 'f3370000-0000-4000-8000-000000000001'
$jobA2 = 'f3370000-0000-4000-8000-000000000002'
$jobA3 = 'f3370000-0000-4000-8000-000000000003'
$jobB1 = 'f3370000-0000-4000-8000-000000000101'

function Invoke-Sql([string]$sql) {
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = $sql | & docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q 2>&1
  $code = [int]$LASTEXITCODE
  $ErrorActionPreference = $old
  if ($code -ne 0) { throw "SQL failed:`n$($output -join "`n")" }
  return $output
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
  return $results
}

function AuthContext([string]$userId) {
  return "BEGIN; SET LOCAL ROLE authenticated; SET LOCAL `"request.jwt.claim.sub`"='$userId'; "
}

function CreateTemplateSql(
  [string]$tenantId,[string]$userId,[string]$purpose,[string]$channel,[string]$language,
  [string]$displayName,[string]$subject,[string]$body,[string]$key
) {
  if ($key.Length -lt 8 -or $key.Length -gt 200 -or $key -notmatch '^[A-Za-z0-9][A-Za-z0-9._:-]*$') {
    throw "Invalid template operation key before SQL: [$key]"
  }
  $subjectSql = if ([string]::IsNullOrWhiteSpace($subject)) { 'NULL' } else { "'$subject'" }
  return (AuthContext $userId) + @"
SELECT r->>'replayed' FROM (
  SELECT public.create_communication_template(
    '$tenantId','$purpose','$channel','$language','$displayName',$subjectSql,'$body','$key'
  ) r
) q;
COMMIT;
"@
}
function CreateDraftSql([string]$tenantId,[string]$userId,[string]$templateId,[string]$key) {
  return (AuthContext $userId) + "SELECT r->>'replayed' FROM (SELECT public.create_communication_template_draft('$tenantId','$templateId','$key') r) q; COMMIT;"
}

function UpdateDraftSql(
  [string]$tenantId,[string]$userId,[string]$versionId,[string]$body,[string]$expected,[string]$key
) {
  return (AuthContext $userId) + "SELECT r->>'replayed' FROM (SELECT public.update_communication_template_draft('$tenantId','$versionId',NULL,'$body','$expected','$key') r) q; COMMIT;"
}

function PublishSql(
  [string]$tenantId,[string]$userId,[string]$templateId,[string]$versionId,[string]$expected,[string]$key
) {
  return (AuthContext $userId) + "SELECT r->>'replayed' FROM (SELECT public.publish_communication_template_version('$tenantId','$templateId','$versionId','$expected','$key') r) q; COMMIT;"
}

function ArchiveSql([string]$tenantId,[string]$userId,[string]$templateId,[string]$expected,[string]$key) {
  return (AuthContext $userId) + "SELECT r->>'replayed' FROM (SELECT public.archive_communication_template('$tenantId','$templateId','$expected','$key') r) q; COMMIT;"
}

function PrepareSql([string]$tenantId,[string]$userId,[string]$jobId,[string]$key) {
  return (AuthContext $userId) + @"
SELECT r->>'replayed' FROM (
  SELECT public.prepare_communication_operation(
    '$tenantId','$jobId','sms','$key',
    (SELECT updated_at FROM public.appointment_reminder_jobs WHERE tenant_id='$tenantId' AND id='$jobId'),
    (SELECT a.updated_at FROM public.appointments a JOIN public.appointment_reminder_jobs j
      ON j.tenant_id=a.tenant_id AND j.appointment_id=a.id
      WHERE j.tenant_id='$tenantId' AND j.id='$jobId')
  ) r
) q;
COMMIT;
"@
}

function Count-Success([object[]]$results) { return @($results | Where-Object { $_.Code -eq 0 }).Count }
function Count-Replay([object[]]$results) { return @($results | Where-Object { $_.Code -eq 0 -and $_.Text.Trim() -eq 'true' }).Count }
function Count-Conflict([object[]]$results) { return @($results | Where-Object { $_.Code -ne 0 }).Count }
function Count-Deadlocks([object[]]$results) { return @($results | Where-Object { $_.Text -match 'deadlock detected' }).Count }

$cleanup = @"
DELETE FROM public.tenants WHERE id IN ('$tenantA'::uuid,'$tenantB'::uuid);
DELETE FROM auth.users WHERE id IN ('$adminA'::uuid,'$adminB'::uuid);
"@

$setup = @"
BEGIN;
$cleanup
INSERT INTO public.tenants(id,name,timezone) VALUES
 ('$tenantA','Template concurrency A','Asia/Almaty'),
 ('$tenantB','Template concurrency B','Asia/Almaty');
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
 ('$adminA','00000000-0000-0000-0000-000000000000','authenticated','authenticated','template-conc-a@example.local','x',now(),'{"provider":"email"}','{}',now(),now()),
 ('$adminB','00000000-0000-0000-0000-000000000000','authenticated','authenticated','template-conc-b@example.local','x',now(),'{"provider":"email"}','{}',now(),now());
INSERT INTO public.profiles(id) VALUES ('$adminA'),('$adminB');
INSERT INTO public.tenant_users(tenant_id,user_id,role) VALUES
 ('$tenantA','$adminA','clinic_admin'),('$tenantB','$adminB','clinic_admin');
INSERT INTO public.patients(id,tenant_id,full_name,source,status) VALUES
 ('$patientA','$tenantA','Template Concurrent A','phone','active'),
 ('$patientB','$tenantB','Template Concurrent B','phone','active');
INSERT INTO public.doctors(id,tenant_id,full_name,specialization,cabinet,color,active) VALUES
 ('$doctorA','$tenantA','Doctor A','General','A1','#111111',true),
 ('$doctorB','$tenantB','Doctor B','General','B1','#222222',true);
INSERT INTO public.appointments(id,tenant_id,patient_id,doctor_id,cabinet,service,status,start_time,end_time) VALUES
 ('$appointmentA1','$tenantA','$patientA','$doctorA','A1','Template concurrency','new','2099-10-01 10:00+00','2099-10-01 11:00+00'),
 ('$appointmentA2','$tenantA','$patientA','$doctorA','A1','Template concurrency','new','2099-10-02 10:00+00','2099-10-02 11:00+00'),
 ('$appointmentA3','$tenantA','$patientA','$doctorA','A1','Template concurrency','new','2099-10-03 10:00+00','2099-10-03 11:00+00'),
 ('$appointmentB1','$tenantB','$patientB','$doctorB','B1','Template concurrency B','new','2099-10-04 10:00+00','2099-10-04 11:00+00');
INSERT INTO public.patient_communication_contacts(
 id,tenant_id,patient_id,contact_type,contact_value_raw,contact_value_normalized,is_primary,is_verified,verification_source,owner_type,language
) VALUES
 ('$contactA','$tenantA','$patientA','phone','+77007778899','+77007778899',true,true,'patient_confirmed','patient','ru'),
 ('$contactB','$tenantB','$patientB','phone','+77008889900','+77008889900',true,true,'patient_confirmed','patient','ru');
UPDATE public.patient_communication_preferences
 SET preferred_language='ru',preferred_channel='sms',sms_consent_state='granted',sms_suppressed=false,global_suppression=false
 WHERE tenant_id='$tenantA' AND patient_id='$patientA';
UPDATE public.patient_communication_preferences
 SET preferred_language='ru',preferred_channel='sms',sms_consent_state='granted',sms_suppressed=false,global_suppression=false
 WHERE tenant_id='$tenantB' AND patient_id='$patientB';
INSERT INTO public.patient_communication_consent_events(
 tenant_id,patient_id,channel,previous_state,new_state,source,actor_user_id,reason,operation_key,fingerprint
) VALUES
 ('$tenantA','$patientA','sms','unknown','granted','patient_written','$adminA','concurrency','template-conc-consent-a',repeat('a',64)),
 ('$tenantB','$patientB','sms','unknown','granted','patient_written','$adminB','concurrency','template-conc-consent-b',repeat('b',64));
INSERT INTO public.appointment_reminder_jobs(
 id,tenant_id,appointment_id,patient_id,reminder_type,execution_mode,due_at,state,appointment_updated_at,
 policy_version,plan_key,payload_fingerprint,priority,original_due_at,metadata
) VALUES
 ('$jobA1','$tenantA','$appointmentA1','$patientA','confirmation_request','manual','2099-09-30 08:00+00','scheduled',(SELECT updated_at FROM public.appointments WHERE id='$appointmentA1'),1,repeat('1',64),repeat('2',64),100,'2099-09-30 08:00+00','{}'),
 ('$jobA2','$tenantA','$appointmentA2','$patientA','confirmation_request','manual','2099-10-01 08:00+00','scheduled',(SELECT updated_at FROM public.appointments WHERE id='$appointmentA2'),1,repeat('3',64),repeat('4',64),100,'2099-10-01 08:00+00','{}'),
 ('$jobA3','$tenantA','$appointmentA3','$patientA','confirmation_request','manual','2099-10-02 08:00+00','scheduled',(SELECT updated_at FROM public.appointments WHERE id='$appointmentA3'),1,repeat('5',64),repeat('6',64),100,'2099-10-02 08:00+00','{}'),
 ('$jobB1','$tenantB','$appointmentB1','$patientB','confirmation_request','manual','2099-10-03 08:00+00','scheduled',(SELECT updated_at FROM public.appointments WHERE id='$appointmentB1'),1,repeat('7',64),repeat('8',64),100,'2099-10-03 08:00+00','{}');
COMMIT;
"@
Invoke-Sql $setup | Out-Null
Invoke-Sql ((AuthContext $adminA) + "SELECT public.create_or_update_communication_route('$tenantA',NULL,'sms','mock',true,100,NULL,'template-conc-route-a'); COMMIT;") | Out-Null
Invoke-Sql ((AuthContext $adminB) + "SELECT public.create_or_update_communication_route('$tenantB',NULL,'sms','mock',true,100,NULL,'template-conc-route-b'); COMMIT;") | Out-Null

$allResults = @()

# A. Same template creation key: one create and one replay.
$resultsA = Invoke-ConcurrentPair `
  (CreateTemplateSql $tenantA $adminA 'appointment_day_before_reminder' 'email' 'en' 'Day-before EN' 'Reminder' 'Hello, {{patient_first_name}}.' 'template-conc-create-same') `
  (CreateTemplateSql $tenantA $adminA 'appointment_day_before_reminder' 'email' 'en' 'Day-before EN' 'Reminder' 'Hello, {{patient_first_name}}.' 'template-conc-create-same')
$allResults += $resultsA
$templateMain = Invoke-Scalar "SELECT id FROM public.communication_templates WHERE tenant_id='$tenantA' AND purpose_code='appointment_day_before_reminder' AND channel='email' AND language='en'"
$version1 = Invoke-Scalar "SELECT id FROM public.communication_template_versions WHERE template_id='$templateMain' AND version_number=1"
$version1Updated = Invoke-Scalar "SELECT updated_at FROM public.communication_template_versions WHERE id='$version1'"
Invoke-Sql (PublishSql $tenantA $adminA $templateMain $version1 $version1Updated 'template-conc-initial-publish') | Out-Null
Write-Host "A_SAME_CREATE success=$(Count-Success $resultsA) replay=$(Count-Replay $resultsA) templates=$(Invoke-Scalar "SELECT count(*) FROM public.communication_templates WHERE id='$templateMain'")"

# B. Competing draft creation: one version 2 draft, one conflict.
$resultsB = Invoke-ConcurrentPair `
  (CreateDraftSql $tenantA $adminA $templateMain 'template-conc-draft-b1') `
  (CreateDraftSql $tenantA $adminA $templateMain 'template-conc-draft-b2')
$allResults += $resultsB
$version2 = Invoke-Scalar "SELECT id FROM public.communication_template_versions WHERE template_id='$templateMain' AND version_number=2"
$version2Updated = Invoke-Scalar "SELECT updated_at FROM public.communication_template_versions WHERE id='$version2'"
Write-Host "B_COMPETING_DRAFT success=$(Count-Success $resultsB) conflict=$(Count-Conflict $resultsB) drafts=$(Invoke-Scalar "SELECT count(*) FROM public.communication_template_versions WHERE template_id='$templateMain' AND status='draft'")"

# C. Two publish operations: one winner, prior active superseded, no double active.
$resultsC = Invoke-ConcurrentPair `
  (PublishSql $tenantA $adminA $templateMain $version2 $version2Updated 'template-conc-publish-c1') `
  (PublishSql $tenantA $adminA $templateMain $version2 $version2Updated 'template-conc-publish-c2')
$allResults += $resultsC
Write-Host "C_TWO_PUBLISH success=$(Count-Success $resultsC) conflict=$(Count-Conflict $resultsC) active=$(Invoke-Scalar "SELECT count(*) FROM public.communication_template_versions WHERE template_id='$templateMain' AND status='published'") superseded=$(Invoke-Scalar "SELECT count(*) FROM public.communication_template_versions WHERE template_id='$templateMain' AND status='superseded'")"

# D. Same publish key: replay safe.
Invoke-Sql (CreateDraftSql $tenantA $adminA $templateMain 'template-conc-draft-d') | Out-Null
$version3 = Invoke-Scalar "SELECT id FROM public.communication_template_versions WHERE template_id='$templateMain' AND status='draft'"
$version3Updated = Invoke-Scalar "SELECT updated_at FROM public.communication_template_versions WHERE id='$version3'"
$resultsD = Invoke-ConcurrentPair `
  (PublishSql $tenantA $adminA $templateMain $version3 $version3Updated 'template-conc-publish-same') `
  (PublishSql $tenantA $adminA $templateMain $version3 $version3Updated 'template-conc-publish-same')
$allResults += $resultsD
Write-Host "D_SAME_PUBLISH success=$(Count-Success $resultsD) replay=$(Count-Replay $resultsD)"

# E. Same operation key with changed payload: one winner and one idempotency conflict.
$resultsE = Invoke-ConcurrentPair `
  (CreateTemplateSql $tenantA $adminA 'appointment_same_day_reminder' 'whatsapp' 'en' 'Same-day A' '' 'Hello {{patient_first_name}}.' 'template-conc-changed-key') `
  (CreateTemplateSql $tenantA $adminA 'appointment_control_call_task' 'whatsapp' 'en' 'Control B' '' 'Call {{patient_first_name}}.' 'template-conc-changed-key')
$allResults += $resultsE
Write-Host "E_CHANGED_PAYLOAD success=$(Count-Success $resultsE) conflict=$(Count-Conflict $resultsE)"

# F. Draft update versus publish: one ordered success, the other stale or immutable.
Invoke-Sql (CreateDraftSql $tenantA $adminA $templateMain 'template-conc-draft-f') | Out-Null
$versionF = Invoke-Scalar "SELECT id FROM public.communication_template_versions WHERE template_id='$templateMain' AND status='draft'"
$versionFUpdated = Invoke-Scalar "SELECT updated_at FROM public.communication_template_versions WHERE id='$versionF'"
$resultsF = Invoke-ConcurrentPair `
  (UpdateDraftSql $tenantA $adminA $versionF 'Updated concurrently for {{patient_first_name}}.' $versionFUpdated 'template-conc-update-f') `
  (PublishSql $tenantA $adminA $templateMain $versionF $versionFUpdated 'template-conc-publish-f')
$allResults += $resultsF
$versionFStatus = Invoke-Scalar "SELECT status FROM public.communication_template_versions WHERE id='$versionF'"
if ($versionFStatus -eq 'draft') {
  $versionFUpdatedNow = Invoke-Scalar "SELECT updated_at FROM public.communication_template_versions WHERE id='$versionF'"
  Invoke-Sql (PublishSql $tenantA $adminA $templateMain $versionF $versionFUpdatedNow 'template-conc-publish-f-reconcile') | Out-Null
}
Write-Host "F_UPDATE_VS_PUBLISH success=$(Count-Success $resultsF) conflict=$(Count-Conflict $resultsF) final=$(Invoke-Scalar "SELECT status FROM public.communication_template_versions WHERE id='$versionF'")"

# G. Publish versus archive: final template is deterministically archived.
Invoke-Sql (CreateDraftSql $tenantA $adminA $templateMain 'template-conc-draft-g') | Out-Null
$versionG = Invoke-Scalar "SELECT id FROM public.communication_template_versions WHERE template_id='$templateMain' AND status='draft'"
$versionGUpdated = Invoke-Scalar "SELECT updated_at FROM public.communication_template_versions WHERE id='$versionG'"
$templateGUpdated = Invoke-Scalar "SELECT updated_at FROM public.communication_templates WHERE id='$templateMain'"
$resultsG = Invoke-ConcurrentPair `
  (PublishSql $tenantA $adminA $templateMain $versionG $versionGUpdated 'template-conc-publish-g') `
  (ArchiveSql $tenantA $adminA $templateMain $templateGUpdated 'template-conc-archive-g')
$allResults += $resultsG
$templateGFinal = Invoke-Scalar "SELECT status FROM public.communication_templates WHERE id='$templateMain'"
if ($templateGFinal -ne 'archived') {
  $templateGUpdatedNow = Invoke-Scalar "SELECT updated_at FROM public.communication_templates WHERE id='$templateMain'"
  Invoke-Sql (ArchiveSql $tenantA $adminA $templateMain $templateGUpdatedNow 'template-conc-archive-g-reconcile') | Out-Null
  $templateGFinal = Invoke-Scalar "SELECT status FROM public.communication_templates WHERE id='$templateMain'"
}
Write-Host "G_PUBLISH_VS_ARCHIVE success=$(Count-Success $resultsG) conflict=$(Count-Conflict $resultsG) final=$templateGFinal"

# H. Preparation versus template publish: operation snapshots exactly one coherent version.
$orchestrationCreateSql = CreateTemplateSql `
  -tenantId $tenantA -userId $adminA -purpose 'appointment_confirmation_request' `
  -channel 'sms' -language 'ru' -displayName 'Confirmation RU' -subject '' `
  -body 'Version one: {{patient_first_name}} {{appointment_date}} {{appointment_time}} {{clinic_name}}.' `
  -key 'template-conc-orch-create'
Invoke-Sql $orchestrationCreateSql | Out-Null
$templateOrch = Invoke-Scalar "SELECT id FROM public.communication_templates WHERE tenant_id='$tenantA' AND purpose_code='appointment_confirmation_request' AND channel='sms' AND language='ru'"
$orchV1 = Invoke-Scalar "SELECT id FROM public.communication_template_versions WHERE template_id='$templateOrch' AND version_number=1"
$orchV1Updated = Invoke-Scalar "SELECT updated_at FROM public.communication_template_versions WHERE id='$orchV1'"
Invoke-Sql (PublishSql $tenantA $adminA $templateOrch $orchV1 $orchV1Updated 'template-conc-orch-publish-v1') | Out-Null
Invoke-Sql (CreateDraftSql $tenantA $adminA $templateOrch 'template-conc-orch-draft-v2') | Out-Null
$orchV2 = Invoke-Scalar "SELECT id FROM public.communication_template_versions WHERE template_id='$templateOrch' AND status='draft'"
$orchV2Updated = Invoke-Scalar "SELECT updated_at FROM public.communication_template_versions WHERE id='$orchV2'"
Invoke-Sql (UpdateDraftSql $tenantA $adminA $orchV2 'Version two: {{patient_first_name}} {{appointment_date}} {{appointment_time}} {{clinic_name}}.' $orchV2Updated 'template-conc-orch-update-v2') | Out-Null
$orchV2Updated = Invoke-Scalar "SELECT updated_at FROM public.communication_template_versions WHERE id='$orchV2'"
$resultsH = Invoke-ConcurrentPair `
  (PrepareSql $tenantA $adminA $jobA1 'template-conc-prepare-h') `
  (PublishSql $tenantA $adminA $templateOrch $orchV2 $orchV2Updated 'template-conc-orch-publish-v2')
$allResults += $resultsH
$operationHVersion = Invoke-Scalar "SELECT template_version_id FROM public.communication_operations WHERE tenant_id='$tenantA' AND reminder_job_id='$jobA1'"
$operationHCoherent = [int](Invoke-Scalar "SELECT count(*) FROM public.communication_operations o JOIN public.communication_template_versions v ON v.tenant_id=o.tenant_id AND v.template_id=o.template_id AND v.id=o.template_version_id WHERE o.tenant_id='$tenantA' AND o.reminder_job_id='$jobA1' AND o.template_content_fingerprint=v.content_fingerprint AND o.rendered_content_fingerprint=(o.template_snapshot->>'renderedContentFingerprint')")
Write-Host "H_PREPARE_VS_PUBLISH success=$(Count-Success $resultsH) conflict=$(Count-Conflict $resultsH) snapshotVersion=$operationHVersion coherent=$operationHCoherent"

# I. Concurrent preparations after publish use one active version.
$activeOrchVersion = Invoke-Scalar "SELECT active_version_id FROM public.communication_templates WHERE id='$templateOrch'"
$resultsI = Invoke-ConcurrentPair `
  (PrepareSql $tenantA $adminA $jobA2 'template-conc-prepare-i2') `
  (PrepareSql $tenantA $adminA $jobA3 'template-conc-prepare-i3')
$allResults += $resultsI
$operationsIWrong = [int](Invoke-Scalar "SELECT count(*) FROM public.communication_operations WHERE reminder_job_id IN ('$jobA2','$jobA3') AND template_version_id<>'$activeOrchVersion'")
Write-Host "I_PREPARE_AFTER_PUBLISH success=$(Count-Success $resultsI) wrongVersion=$operationsIWrong active=$activeOrchVersion"

# J. Same operation key in different tenants remains independent.
$crossTenantSqlA = CreateTemplateSql `
  -tenantId $tenantA -userId $adminA -purpose 'appointment_control_call_task' `
  -channel 'email' -language 'ru' -displayName 'Cross A' -subject 'Subject A' `
  -body 'Body A' -key 'template-conc-cross-tenant-key'
$crossTenantSqlB = CreateTemplateSql `
  -tenantId $tenantB -userId $adminB -purpose 'appointment_control_call_task' `
  -channel 'email' -language 'ru' -displayName 'Cross B' -subject 'Subject B' `
  -body 'Body B' -key 'template-conc-cross-tenant-key'
$resultsJ = Invoke-ConcurrentPair $crossTenantSqlA $crossTenantSqlB
$allResults += $resultsJ
Write-Host "J_CROSS_TENANT success=$(Count-Success $resultsJ) operationRows=$(Invoke-Scalar "SELECT count(*) FROM public.communication_template_operations WHERE operation_key='template-conc-cross-tenant-key'")"

$templates = [int](Invoke-Scalar "SELECT count(*) FROM public.communication_templates WHERE tenant_id IN ('$tenantA','$tenantB')")
$versions = [int](Invoke-Scalar "SELECT count(*) FROM public.communication_template_versions WHERE tenant_id IN ('$tenantA','$tenantB')")
$drafts = [int](Invoke-Scalar "SELECT count(*) FROM public.communication_template_versions WHERE tenant_id IN ('$tenantA','$tenantB') AND status='draft'")
$published = [int](Invoke-Scalar "SELECT count(*) FROM public.communication_template_versions WHERE tenant_id IN ('$tenantA','$tenantB') AND status='published'")
$superseded = [int](Invoke-Scalar "SELECT count(*) FROM public.communication_template_versions WHERE tenant_id IN ('$tenantA','$tenantB') AND status='superseded'")
$activeVersions = [int](Invoke-Scalar "SELECT count(*) FROM public.communication_templates WHERE tenant_id IN ('$tenantA','$tenantB') AND active_version_id IS NOT NULL")
$replays = @($allResults | Where-Object { $_.Code -eq 0 -and $_.Text.Trim() -eq 'true' }).Count
$conflicts = @($allResults | Where-Object { $_.Code -ne 0 }).Count
$operationsByVersion = Invoke-Scalar "SELECT coalesce(string_agg(template_version_id::text||'='||count_value,',' ORDER BY template_version_id::text),'') FROM (SELECT template_version_id,count(*)::text count_value FROM public.communication_operations WHERE tenant_id IN ('$tenantA','$tenantB') GROUP BY template_version_id) s"
$auditEvents = [int](Invoke-Scalar "SELECT count(*) FROM public.audit_events WHERE tenant_id IN ('$tenantA','$tenantB') AND action LIKE 'communication_template_%'")
$activityEvents = [int](Invoke-Scalar "SELECT count(*) FROM public.activity_events WHERE tenant_id IN ('$tenantA','$tenantB') AND type LIKE 'communication_template_%'")
$deadlocks = Count-Deadlocks $allResults
$multipleActive = [int](Invoke-Scalar "SELECT count(*) FROM (SELECT template_id FROM public.communication_template_versions WHERE tenant_id IN ('$tenantA','$tenantB') AND status='published' GROUP BY template_id HAVING count(*)>1) d")
$duplicateVersionNumbers = [int](Invoke-Scalar "SELECT count(*) FROM (SELECT template_id,version_number FROM public.communication_template_versions WHERE tenant_id IN ('$tenantA','$tenantB') GROUP BY template_id,version_number HAVING count(*)>1) d")
$operationsWithoutSnapshot = [int](Invoke-Scalar "SELECT count(*) FROM public.communication_operations WHERE tenant_id IN ('$tenantA','$tenantB') AND (template_id IS NULL OR template_version_id IS NULL OR template_content_fingerprint IS NULL OR rendered_content_fingerprint IS NULL OR template_snapshot IS NULL)")
$auditMismatch = [math]::Abs($auditEvents - $activityEvents)

if ((Count-Success $resultsA) -ne 2 -or (Count-Replay $resultsA) -ne 1) { throw 'Scenario A replay invariant failed.' }
if ((Count-Success $resultsB) -ne 1 -or (Count-Conflict $resultsB) -ne 1) { throw 'Scenario B competing draft invariant failed.' }
if ((Count-Success $resultsC) -ne 1 -or (Count-Conflict $resultsC) -ne 1) { throw 'Scenario C competing publish invariant failed.' }
if ((Count-Success $resultsD) -ne 2 -or (Count-Replay $resultsD) -ne 1) { throw 'Scenario D publish replay invariant failed.' }
if ((Count-Success $resultsE) -ne 1 -or (Count-Conflict $resultsE) -ne 1) { throw 'Scenario E changed payload invariant failed.' }
if ((Count-Success $resultsF) -ne 1 -or (Count-Conflict $resultsF) -ne 1) { throw 'Scenario F update/publish ordering invariant failed.' }
if ((Invoke-Scalar "SELECT status FROM public.communication_templates WHERE id='$templateMain'") -ne 'archived') { throw 'Scenario G final template must be archived.' }
if ($operationHCoherent -ne 1) { throw 'Scenario H operation snapshot is not coherent.' }
if ((Count-Success $resultsI) -ne 2 -or $operationsIWrong -ne 0) { throw 'Scenario I active-version invariant failed.' }
if ((Count-Success $resultsJ) -ne 2) { throw 'Scenario J cross-tenant independence failed.' }
if ($multipleActive -ne 0) { throw "Multiple active versions: $multipleActive" }
if ($duplicateVersionNumbers -ne 0) { throw "Duplicate version numbers: $duplicateVersionNumbers" }
if ($operationsWithoutSnapshot -ne 0) { throw "Operations without template snapshot: $operationsWithoutSnapshot" }
if ($auditMismatch -ne 0) { throw "Audit/activity mismatch: $auditEvents/$activityEvents" }
if ($deadlocks -ne 0) { throw "Deadlocks detected: $deadlocks" }

[pscustomobject]@{
  templates = $templates
  versions = $versions
  drafts = $drafts
  published = $published
  superseded = $superseded
  activeVersions = $activeVersions
  replays = $replays
  conflicts = $conflicts
  operationsByTemplateVersion = $operationsByVersion
  multipleActiveVersions = $multipleActive
  duplicateVersionNumbers = $duplicateVersionNumbers
  operationsWithoutTemplateSnapshot = $operationsWithoutSnapshot
  auditEvents = $auditEvents
  activityEvents = $activityEvents
  auditActivityMismatch = $auditMismatch
  deadlocks = $deadlocks
} | Format-List

Invoke-Sql $cleanup | Out-Null
Write-Host 'COMMUNICATION-TEMPLATE-FOUNDATION-001 concurrency validation passed.'
