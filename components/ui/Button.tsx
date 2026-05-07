'use client';

import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'base' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  title?: string;
}

const variants = {
  primary: 'bg-[--electric]/15 border-[--electric]/25 text-[--electric] hover:bg-[--electric]/25 hover:shadow-glow-electric',
  secondary: 'bg-white/[0.04] border-[--border] text-[--text-1] hover:bg-white/[0.08]',
  danger: 'bg-[--neon-red]/15 border-[--neon-red]/25 text-[--neon-red] hover:bg-[--neon-red]/25 hover:shadow-glow-red',
  ghost: 'bg-transparent border-transparent text-[--text-2] hover:bg-white/[0.04] hover:text-[--text-1]',
  success: 'bg-[--synth-dim] border-[--synth]/20 text-[--synth] hover:bg-[--synth]/20 hover:shadow-glow-synth',
};

const sizes = {
  sm: 'px-2.5 py-1 text-xs h-7',
  base: 'px-3 py-1.5 text-xs h-8',
  lg: 'px-4 py-2 text-sm h-10',
};

export function Button({ variant = 'primary', size = 'sm', loading, icon, iconPosition = 'left', fullWidth, disabled, className = '', children, onClick, type = 'button', title }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`
        inline-flex items-center justify-center gap-1.5
        font-semibold rounded-md
        transition-all duration-150
        disabled:opacity-30 disabled:cursor-not-allowed
        active:scale-[0.97]
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {loading && <Loader2 className="w-3 h-3 animate-spin" />}
      {!loading && icon && iconPosition === 'left' && icon}
      {children}
      {!loading && icon && iconPosition === 'right' && icon}
    </button>
  );
}