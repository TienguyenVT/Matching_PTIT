import { clsx } from 'clsx';
import * as React from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={clsx(
          'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none',
          'placeholder:text-gray-400 focus:ring-2 focus:ring-primary',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';


