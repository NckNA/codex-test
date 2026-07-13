import type {
  CommunicationAdapterCode,
  CommunicationAdapterResultCode,
  CommunicationCommand,
  CommunicationSimulationScenario,
} from './CommunicationCommand';
import { assertSafeCommunicationCommand, fingerprintCommunicationValue } from './CommunicationCommand';

export interface NormalizedCommunicationAdapterResult {
  code: CommunicationAdapterResultCode;
  accepted: boolean;
  retryable: boolean;
  uncertain: boolean;
  externalOperationId?: string;
  safeErrorCode?: string;
  occurredAt: string;
}

export interface PreparedCommunicationAdapterOperation {
  adapterCode: CommunicationAdapterCode;
  commandFingerprint: string;
  command: CommunicationCommand;
}

export interface CommunicationAdapter {
  readonly code: CommunicationAdapterCode;
  validateCommand(command: CommunicationCommand): void;
  prepare(command: CommunicationCommand): Promise<PreparedCommunicationAdapterOperation>;
  simulate(
    prepared: PreparedCommunicationAdapterOperation,
    scenario: CommunicationSimulationScenario,
  ): Promise<NormalizedCommunicationAdapterResult>;
  recover(
    prepared: PreparedCommunicationAdapterOperation,
    externalOperationId?: string,
  ): Promise<NormalizedCommunicationAdapterResult>;
}

export function normalizeSimulationScenario(
  scenario: CommunicationSimulationScenario,
  externalOperationId?: string,
  occurredAt = new Date().toISOString(),
): NormalizedCommunicationAdapterResult {
  const code: CommunicationAdapterResultCode = scenario === 'success' ? 'accepted' : scenario;
  const uncertain = code === 'timeout_after_acceptance' || code === 'unknown';
  const retryable = code === 'temporary_failure' || code === 'timeout_before_acceptance';
  return {
    code,
    accepted: code === 'accepted',
    retryable,
    uncertain,
    externalOperationId,
    safeErrorCode: code === 'accepted' ? undefined : `simulation_${code}`,
    occurredAt,
  };
}

export async function prepareAdapterOperation(
  adapterCode: CommunicationAdapterCode,
  command: CommunicationCommand,
): Promise<PreparedCommunicationAdapterOperation> {
  assertSafeCommunicationCommand(command);
  return {
    adapterCode,
    command,
    commandFingerprint: await fingerprintCommunicationValue(command),
  };
}

export async function deterministicSimulationId(
  prepared: PreparedCommunicationAdapterOperation,
  scenario: CommunicationSimulationScenario,
): Promise<string> {
  const digest = await fingerprintCommunicationValue({
    adapterCode: prepared.adapterCode,
    commandFingerprint: prepared.commandFingerprint,
    scenario,
  });
  return `sim-${digest.slice(0, 24)}`;
}
