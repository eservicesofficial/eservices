'use client'

import { useState, useCallback } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

interface ThemeToggleProps {
  className?: string
  variant?: 'default' | 'ghost' | 'outline'
  size?: 'default' | 'sm' | 'icon' | 'lg'
  iconClassName?: string
}

export function ThemeToggle({ className, variant = 'ghost', size = 'icon', iconClassName }: ThemeToggleProps) {
  const { setTheme, resolvedTheme } = useTheme()
  const [isSpinning, setIsSpinning] = useState(false)

  const isDark = resolvedTheme === 'dark'

  const toggleTheme = useCallback(() => {
    setIsSpinning(true)
    setTheme(isDark ? 'light' : 'dark')
    setTimeout(() => setIsSpinning(false), 500)
  }, [isDark, setTheme])

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleTheme}
      className={`transition-transform duration-200 hover:scale-110 active:scale-95 ${className || ''}`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <Sun className={`h-[1.2rem] w-[1.2rem] text-orange-500 transition-all ${isSpinning ? 'theme-toggle-spin' : ''} ${iconClassName || ''}`} />
      ) : (
        <Moon className={`h-[1.2rem] w-[1.2rem] text-slate-500 transition-all ${isSpinning ? 'theme-toggle-spin' : ''} ${iconClassName || ''}`} />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
