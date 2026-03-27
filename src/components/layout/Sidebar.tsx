import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "#/ui/collapsible"
import { NavItemProps } from "@/interfaces/props.interface"
import { Link, useLocation } from 'react-router-dom'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { ChevronDown } from 'lucide-react'
import { getGuestLinksForViewport, links } from '@/utils/constants'
import { prefetchChunkForSidebarHref } from '@/utils/prefetchChunks'
import { cn } from '@/lib/utils'
import { useThemeContext } from '@/context/ThemeContext'
import { useAuthContext } from '@/context/AuthContext'
import { useQueryClient } from '@tanstack/react-query'
import { useRegistrationConfig } from '@/hooks/query/useRegistrationConfig'
import { getStudentsByTeacher, getStudentsByPrincipal } from '@/controllers/student.controller'
import React from 'react'
import {
  Sidebar as SidebarShadcn,
  SidebarMenuSubButton,
  SidebarGroupContent,
  SidebarMenuSubItem,
  SidebarGroupLabel,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  useSidebar
} from "#/ui/sidebar"

export const Sidebar = () => {
  const { toggleSidebar } = useSidebar()
  const isMobile = useIsMobile()
  const { isAuth } = useAuthContext()
  const { isEnabled: registrationEnabled } = useRegistrationConfig()
  const allItems = links(registrationEnabled)
  const items =
    !isAuth
      ? getGuestLinksForViewport(allItems, {
          isMobile,
      })
      : allItems
  return (
    <SidebarShadcn>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className='py-5 text-lg font-bold font-roboto-slab'>Menú Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarItem item={item} isMobile={isMobile} toggle={toggleSidebar} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </SidebarShadcn>
  )
}

interface SidebarItemProps { item: NavItemProps, isMobile: boolean, toggle: () => void }
const SidebarItem = ({ item, isMobile, toggle }: SidebarItemProps) => {
  const isActive = useLocation().pathname === item.href
  const { theme } = useThemeContext()
  const { user } = useAuthContext()
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = React.useState(false)

  const isDashboard = item.href === '/dashboard'
  const prefetchDashboardData = React.useCallback(() => {
    if (!user?.uid) return
    if (user.role === 'teacher') {
      void queryClient.prefetchQuery({
        queryKey: ['students', 'by-teacher', user.uid],
        queryFn: () => getStudentsByTeacher(user.uid!),
        staleTime: 5 * 60 * 1000,
      })
    } else if (user.role === 'principal') {
      void queryClient.prefetchQuery({
        queryKey: ['students', 'by-principal', user.uid],
        queryFn: () => getStudentsByPrincipal(user.uid!),
        staleTime: 5 * 60 * 1000,
      })
    }
  }, [user?.uid, user?.role, queryClient])

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} onClick={() => isMobile && !item.subItems && toggle()}>
      <CollapsibleTrigger asChild>
        <div
          className="transition-colors duration-150"
          onMouseEnter={() => {
            prefetchChunkForSidebarHref(item.href as string)
            if (isDashboard) prefetchDashboardData()
          }}
        >
          <SidebarMenuButton 
            asChild 
            isActive={isActive}
            className={cn(
              "relative overflow-hidden group transition-colors duration-150",
              "rounded-lg mx-2 my-1",
              isActive
                ? theme === 'dark'
                  ? '!bg-purple-600 !text-white hover:bg-purple-700'
                  : '!bg-purple-700 !text-white !border-2 !border-purple-800 hover:bg-purple-800'
                : theme === 'dark'
                  ? 'hover:bg-zinc-800/80 text-zinc-200 hover:text-purple-300'
                  : 'hover:bg-purple-50 text-gray-700 hover:text-purple-700'
            )}
          >
            <Link
              to={item.href as string}
              onClick={() => item.action?.()}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-3 relative z-10',
                isActive && theme === 'light' && '!text-white'
              )}
            >
              <div>
                <item.icon className={cn(
                    'w-5 h-5',
                  isActive && theme === 'light' ? '!text-white' : isActive ? 'text-white' : ''
                )} />
              </div>
              <span className={cn(
                'text-sm font-medium pointer-events-none',
                isActive && theme === 'light' ? '!text-white' : isActive ? 'text-white' : ''
              )}>{item.label}</span>
              {item.subItems && (<IconChevron isOpen={isOpen} />)}
            </Link>
          </SidebarMenuButton>
        </div>
      </CollapsibleTrigger>

      {item.subItems && (
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.subItems.map((subItem) => (
              <SidebarSubItem key={subItem.label} item={subItem} toggle={toggle} isMobile={isMobile} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}

interface SidebarSubItemProps { item: NavItemProps, isMobile: boolean, toggle: () => void }
const SidebarSubItem = ({ item, isMobile, toggle }: SidebarSubItemProps) => {
  const isActive = useLocation().pathname === item.href
  const { theme } = useThemeContext()
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <SidebarMenuSubItem>
      <Collapsible open={isOpen} onOpenChange={setIsOpen} onClick={() => isMobile && !item.subItems && toggle()}>
        <CollapsibleTrigger asChild>
          <div
            className="transition-colors duration-150"
            onMouseEnter={() => prefetchChunkForSidebarHref(item.href as string)}
          >
            <SidebarMenuSubButton 
              asChild 
              isActive={isActive}
              className={cn(
                "relative overflow-hidden group transition-colors duration-150",
                "rounded-lg mx-2 my-1",
                isActive
                  ? theme === 'dark'
                    ? '!bg-purple-600 !text-white hover:bg-purple-700'
                    : '!bg-purple-700 !text-white !border-2 !border-purple-800 hover:bg-purple-800'
                  : theme === 'dark'
                    ? 'hover:bg-zinc-800/80 text-zinc-200 hover:text-purple-300'
                    : 'hover:bg-purple-50 text-gray-700 hover:text-purple-700'
              )}
            >
              <Link
                to={item.href as string}
                onClick={() => item.action?.()}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-2 relative z-10',
                  isActive && theme === 'light' && '!text-white'
                )}
              >
                <div>
                  <item.icon className={cn(
                    'w-4 h-4',
                    isActive && theme === 'light' ? '!text-white' : isActive ? 'text-white' : ''
                  )} />
                </div>
                <span className={cn(
                  'text-sm font-medium pointer-events-none',
                  isActive && theme === 'light' ? '!text-white' : isActive ? 'text-white' : ''
                )}>{item.label}</span>
                {item.subItems && (<IconChevron isOpen={isOpen} />)}
              </Link>
            </SidebarMenuSubButton>
          </div>
        </CollapsibleTrigger>

        {item.subItems && (
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.subItems.map((subSubItem) => (
                <SidebarSubItem key={subSubItem.label} item={subSubItem} toggle={toggle} isMobile={isMobile} />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        )}
      </Collapsible>
    </SidebarMenuSubItem>
  )
}
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------tools--------------------------------------------------*/
const IconChevron = ({ isOpen }: { isOpen: boolean }) => <ChevronDown className={`w-4 h-4 ms-auto transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />