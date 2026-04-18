'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SwitchProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, defaultChecked, checked, onChange, ...props }, ref) => {
    const [isChecked, setIsChecked] = React.useState(
      checked !== undefined ? checked : defaultChecked ?? false
    )

    React.useEffect(() => {
      if (checked !== undefined) setIsChecked(checked)
    }, [checked])

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      if (checked === undefined) setIsChecked(e.target.checked)
      onChange?.(e)
    }

    return (
      <label
        className={cn(
          'relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full transition-colors',
          isChecked ? 'bg-primary' : 'bg-muted',
          className
        )}
      >
        <input
          type="checkbox"
          ref={ref}
          checked={isChecked}
          onChange={handleChange}
          className="sr-only"
          {...props}
        />
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform',
            isChecked ? 'translate-x-4' : 'translate-x-0.5'
          )}
        />
      </label>
    )
  }
)
Switch.displayName = 'Switch'

export { Switch }
