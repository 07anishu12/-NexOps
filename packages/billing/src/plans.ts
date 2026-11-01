export type SubscriptionPlanTier = 'free' | 'pro' | 'team' | 'enterprise';

export interface PlanLimits {
  tier: SubscriptionPlanTier;
  monthlyCredits: number;
  maxAgents: number;
  maxDeploymentsPerAgent: number;
  rateLimitPerMinute: number;
  canUseCustomDomains: boolean;
  canUsePaidIntegrations: boolean;
}

export const PLAN_CONFIGS: Record<SubscriptionPlanTier, PlanLimits> = {
  free: {
    tier: 'free',
    monthlyCredits: 100,
    maxAgents: 2,
    maxDeploymentsPerAgent: 1,
    rateLimitPerMinute: 60,
    canUseCustomDomains: false,
    canUsePaidIntegrations: false
  },
  pro: {
    tier: 'pro',
    monthlyCredits: 5000,
    maxAgents: 10,
    maxDeploymentsPerAgent: 5,
    rateLimitPerMinute: 300,
    canUseCustomDomains: true,
    canUsePaidIntegrations: true
  },
  team: {
    tier: 'team',
    monthlyCredits: 25000,
    maxAgents: 50,
    maxDeploymentsPerAgent: 20,
    rateLimitPerMinute: 1200,
    canUseCustomDomains: true,
    canUsePaidIntegrations: true
  },
  enterprise: {
    tier: 'enterprise',
    monthlyCredits: 100000,
    maxAgents: 1000,
    maxDeploymentsPerAgent: 100,
    rateLimitPerMinute: 6000,
    canUseCustomDomains: true,
    canUsePaidIntegrations: true
  }
};

export function getPlanLimits(tier: SubscriptionPlanTier): PlanLimits {
  return PLAN_CONFIGS[tier];
}
