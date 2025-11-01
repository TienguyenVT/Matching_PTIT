import { clsx } from 'clsx';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'ghost';
};

export function Button({ className, variant = 'primary', ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none h-10 px-4 py-2';
  const styles = {
    primary: 'bg-primary text-white hover:shadow-level1',
    outline: 'border border-gray-300 hover:bg-gray-50',
    ghost: 'hover:bg-gray-100'
  } as const;
  return <button className={clsx(base, styles[variant], className)} {...props} />;
}


