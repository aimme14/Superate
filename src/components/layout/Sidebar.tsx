import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "#/ui/collapsible"
import { NavItemProps } from "@/interfaces/props.interface"
import { Link, useLocation } from 'react-router-dom'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { ChevronDown } from 'lucide-react'
import { links } from '@/utils/constants'
import { cn } from '@/lib/utils'
import { useThemeContext } from '@/context/ThemeContext'
import { useRegistrationConfig } from '@/hooks/query/useRegistrationConfig'
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
  const { isEnabled: registrationEnabled } = useRegistrationConfig()
  const items = links(registrationEnabled)
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
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} onClick={() => isMobile && !item.subItems && toggle()}>
      <CollapsibleTrigger asChild>
        <div className="transition-transform duration-200 hover:scale-[1.02] hover:translate-x-1 active:scale-[0.98]">
          <SidebarMenuButton 
            asChild 
            isActive={isActive}
            className={cn(
              "relative overflow-hidden group transition-all duration-300",
              "rounded-lg mx-2 my-1",
              isActive
                ? theme === 'dark'
                  ? '!bg-purple-600 !text-white hover:bg-gradient-to-r hover:from-purple-600 hover:via-purple-700 hover:to-indigo-600 hover:shadow-lg hover:shadow-purple-500/50'
                  : '!bg-purple-700 !text-white !border-2 !border-purple-800 hover:bg-gradient-to-r hover:from-purple-700 hover:via-purple-800 hover:to-indigo-700 hover:shadow-lg hover:shadow-purple-500/30'
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
                  'w-5 h-5 transition-transform duration-300 group-hover:scale-110',
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
          <div className="transition-transform duration-200 hover:scale-[1.02] hover:translate-x-1 active:scale-[0.98]">
            <SidebarMenuSubButton 
              asChild 
              isActive={isActive}
              className={cn(
                "relative overflow-hidden group transition-all duration-300",
                "rounded-lg mx-2 my-1",
                isActive
                  ? theme === 'dark'
                    ? '!bg-purple-600 !text-white hover:bg-gradient-to-r hover:from-purple-600 hover:via-purple-700 hover:to-indigo-600 hover:shadow-lg hover:shadow-purple-500/50'
                    : '!bg-purple-700 !text-white !border-2 !border-purple-800 hover:bg-gradient-to-r hover:from-purple-700 hover:via-purple-800 hover:to-indigo-700 hover:shadow-lg hover:shadow-purple-500/30'
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
                    'w-4 h-4 transition-transform duration-300 group-hover:scale-110',
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