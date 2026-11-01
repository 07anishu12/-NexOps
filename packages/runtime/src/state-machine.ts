import { RunState } from '@agentflow/contracts';

const VALID_TRANSITIONS: Record<RunState, RunState[]> = {
  queued: ['initializing', 'cancelled', 'expired'],
  initializing: ['running', 'failed', 'cancelled'],
  running: ['waiting_for_approval', 'succeeded', 'failed', 'cancelled'],
  waiting_for_approval: ['running', 'cancelled', 'expired', 'failed'],
  succeeded: [],
  failed: ['reconciliation_required'],
  cancelled: [],
  expired: [],
  blocked: ['running', 'failed', 'cancelled'],
  reconciliation_required: ['dead_lettered', 'succeeded', 'failed'],
  dead_lettered: []
};

export function canTransitionRunState(from: RunState, to: RunState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateRunStateTransition(from: RunState, to: RunState): void {
  if (!canTransitionRunState(from, to)) {
    throw new Error(`Invalid run state transition from '${from}' to '${to}'`);
  }
}

export function isTerminalRunState(state: RunState): boolean {
  return ['succeeded', 'failed', 'cancelled', 'expired', 'dead_lettered'].includes(state);
}
