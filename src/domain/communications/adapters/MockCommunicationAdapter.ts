import type {
  CommunicationCommand,
  CommunicationSimulationScenario,
} from '../CommunicationCommand';
import type {
  CommunicationAdapter,
  NormalizedCommunicationAdapterResult,
  PreparedCommunicationAdapterOperation,
} from '../CommunicationAdapter';
import {
  deterministicSimulationId,
  normalizeSimulationScenario,
  prepareAdapterOperation,
} from '../CommunicationAdapter';
import { assertSafeCommunicationCommand } from '../CommunicationCommand';

export class MockCommunicationAdapter implements CommunicationAdapter {
  readonly code = 'mock' as const;
  private readonly recovered = new Map<string, NormalizedCommunicationAdapterResult>();

  validateCommand(command: CommunicationCommand): void {
    assertSafeCommunicationCommand(command);
  }

  async prepare(command: CommunicationCommand): Promise<PreparedCommunicationAdapterOperation> {
    this.validateCommand(command);
    return prepareAdapterOperation(this.code, command);
  }

  async simulate(
    prepared: PreparedCommunicationAdapterOperation,
    scenario: CommunicationSimulationScenario,
  ): Promise<NormalizedCommunicationAdapterResult> {
    const externalOperationId = await deterministicSimulationId(prepared, scenario);
    const result = normalizeSimulationScenario(scenario, externalOperationId);
    this.recovered.set(externalOperationId, result);
    return result;
  }

  async recover(
    _prepared: PreparedCommunicationAdapterOperation,
    externalOperationId?: string,
  ): Promise<NormalizedCommunicationAdapterResult> {
    if (externalOperationId && this.recovered.has(externalOperationId)) {
      return this.recovered.get(externalOperationId)!;
    }
    return normalizeSimulationScenario('unknown', externalOperationId);
  }
}
