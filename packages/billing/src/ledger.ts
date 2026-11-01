export interface CreditBalanceState {
  availableCredits: number;
  reservedCredits: number;
}

export function holdCredits(
  state: CreditBalanceState,
  amountToHold: number
): CreditBalanceState {
  if (amountToHold <= 0) {
    throw new Error('Hold amount must be positive');
  }
  if (state.availableCredits < amountToHold) {
    throw new Error(
      `Insufficient credits: available (${state.availableCredits}) < required (${amountToHold})`
    );
  }

  return {
    availableCredits: state.availableCredits - amountToHold,
    reservedCredits: state.reservedCredits + amountToHold
  };
}

export function settleCredits(
  state: CreditBalanceState,
  heldAmount: number,
  actualConsumed: number
): CreditBalanceState {
  if (state.reservedCredits < heldAmount) {
    throw new Error(
      `Cannot settle: held amount (${heldAmount}) exceeds reserved credits (${state.reservedCredits})`
    );
  }

  const unusedHold = Math.max(0, heldAmount - actualConsumed);

  return {
    availableCredits: state.availableCredits + unusedHold,
    reservedCredits: state.reservedCredits - heldAmount
  };
}

export function releaseCredits(
  state: CreditBalanceState,
  heldAmount: number
): CreditBalanceState {
  return settleCredits(state, heldAmount, 0);
}
