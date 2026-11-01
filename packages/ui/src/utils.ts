import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export function getButtonClassName(variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): string {
  const base = 'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-800 text-gray-100 hover:bg-gray-700 focus:ring-gray-600',
    outline: 'border border-gray-700 text-gray-200 hover:bg-gray-800 focus:ring-gray-600',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    ghost: 'text-gray-400 hover:text-white hover:bg-gray-800 focus:ring-gray-600'
  };

  const sizes: Record<ButtonSize, string> = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  return cn(base, variants[variant], sizes[size]);
}

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'outline';

export function getBadgeClassName(variant: BadgeVariant = 'default'): string {
  const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold';
  const variants: Record<BadgeVariant, string> = {
    default: 'bg-gray-800 text-gray-300',
    success: 'bg-emerald-950 text-emerald-400 border border-emerald-800',
    warning: 'bg-amber-950 text-amber-400 border border-amber-800',
    error: 'bg-rose-950 text-rose-400 border border-rose-800',
    outline: 'border border-gray-700 text-gray-400'
  };
  return cn(base, variants[variant]);
}
