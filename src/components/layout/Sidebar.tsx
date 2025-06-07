import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "#/ui/collapsible"
import { NavItemProps } from "@/interfaces/props.interface"
import { Link, useLocation } from 'react-router-dom'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { ChevronDown } from 'lucide-react'
import { links } from '@/utils/constants'
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
  const items = links()
  return (
    <SidebarShadcn>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className='py-5 text-lg font-bold font-roboto-slab'>Menu</SidebarGroupLabel>
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
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} onClick={() => isMobile && !item.subItems && toggle()}>
      <CollapsibleTrigger asChild>
        <SidebarMenuButton asChild isActive={isActive}>
          <Link
            to={item.href as string}
            onClick={() => item.action?.()}
            className='flex w-full items-center gap-2'
          >
            <item.icon className='w-4 h-4 md:w-5 md:h-5' />
            <span className='text-sm pointer-events-none'>{item.label}</span>
            {item.subItems && (<IconChevron isOpen={isOpen} />)}
          </Link>
        </SidebarMenuButton>
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
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <SidebarMenuSubItem>
      <Collapsible open={isOpen} onOpenChange={setIsOpen} onClick={() => isMobile && !item.subItems && toggle()}>
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton asChild isActive={isActive}>
            <Link
              to={item.href as string}
              onClick={() => item.action?.()}
              className='flex w-full items-center gap-2'
            >
              <item.icon className='w-4 h-4 md:w-5 md:h-5' />
              <span className='text-sm pointer-events-none'>{item.label}</span>
              {item.subItems && (<IconChevron isOpen={isOpen} />)}
            </Link>
          </SidebarMenuSubButton>
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