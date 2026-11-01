import { describe, it, expect } from 'vitest';
import {
  canTransitionRunState,
  validateRunStateTransition,
  isTerminalRunState
} from '../src/index.js';

describe('Runtime Package Tests', () => {
  it('allows valid state machine progressions', () => {
    expect(canTransitionRunState('queued', 'initializing')).toBe(true);
    expect(canTransitionRunState('initializing', 'running')).toBe(true);
    expect(canTransitionRunState('running', 'waiting_for_approval')).toBe(true);
    expect(canTransitionRunState('waiting_for_approval', 'running')).toBe(true);
    expect(canTransitionRunState('running', 'succeeded')).toBe(true);
  });

  it('rejects invalid state machine progressions', () => {
    expect(canTransitionRunState('queued', 'succeeded')).toBe(false);
    expect(canTransitionRunState('succeeded', 'running')).toBe(false);
    expect(() => validateRunStateTransition('succeeded', 'running')).toThrow(
      /Invalid run state transition from 'succeeded' to 'running'/
    );
  });

  it('identifies terminal run states', () => {
    expect(isTerminalRunState('succeeded')).toBe(true);
    expect(isTerminalRunState('failed')).toBe(true);
    expect(isTerminalRunState('cancelled')).toBe(true);
    expect(isTerminalRunState('running')).toBe(false);
    expect(isTerminalRunState('waiting_for_approval')).toBe(false);
  });
});
