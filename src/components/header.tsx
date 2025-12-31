'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import { useEffect, useRef, useState, useCallback } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CircleCheckIcon, CircleHelpIcon, CircleIcon } from 'lucide-react'

import { useIsMobile } from '@/hooks/use-mobile'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu'
import { SodaIcon } from './sodaIcon'

export function Header() {
  const isMobile = useIsMobile()
  const pathname = usePathname()
  const { setTheme, theme } = useTheme()
  const handleThemeChange = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  const lastScrollY = useRef(0)
  const [showBorder, setShowBorder] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const current = window.scrollY
      setShowBorder(current > lastScrollY.current && current > 10)
      lastScrollY.current = current
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`z-50 sticky top-0 transition-all duration-300 p-3 flex items-center justify-between bg-background border-b-c-border border-b`}
    >
      <div>
        <Link href="/" className="flex items-center space-x-1">
          <SodaIcon className="h-10 w-10" />
          <span className="font-bold text-2xl gradient-text">SODA DEX</span>
        </Link>
      </div>
      <NavigationMenu viewport={isMobile}>
        <NavigationMenuList className="flex-wrap">
          <NavigationMenuItem>
            <NavigationMenuLink
              data-active={pathname === '/swap'}
              asChild
              className={navigationMenuTriggerStyle()}
            >
              <Link className="text-xl" href="/swap">
                Swap
              </Link>
            </NavigationMenuLink>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink
              asChild
              data-active={pathname === '/pools'}
              className={`${navigationMenuTriggerStyle()}`}
            >
              <Link className="text-xl" href="/pools">
                Pools
              </Link>
            </NavigationMenuLink>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink
              asChild
              data-active={pathname === '/positions'}
              className={navigationMenuTriggerStyle()}
            >
              <Link className="text-xl" href="/positions">
                Positions
              </Link>
            </NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
      <div className="flex items-center">
        <Button
          className="cursor-pointer h-10 w-10 mr-3 shadow-(--rk-shadows-connectButton)"
          variant="outline"
          size="icon"
          onClick={handleThemeChange}
        >
          <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span className="sr-only">Toggle theme</span>
        </Button>
        <ConnectButton chainStatus="icon" />
      </div>
    </header>
  )
}
