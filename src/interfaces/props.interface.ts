import { type LucideIcon } from "lucide-react"

/*--------------------------------------------------Component Props--------------------------------------------------*/
//interface defautl props
export interface Props { children?: React.ReactNode }
export interface EndpointParams { id?: string; type: string; action: 'one' | 'many' | 'void' }
/*---------------------- ui components ----------------------*/
// options query
export interface QueryOptions {
  [key: string]: any
  enabled?: boolean
}
/*---------------------- Reusables ----------------------*/
// HeaderCustom
export interface HeaderSpanProps {
  iconSpan?: 'info' | 'warn' | 'alert' | 'none'
  span?: string
}

// SelectMultiOption
export interface SelectMultiOptionProps {
  icon?: LucideIcon
  value: string
  label: string
}

// SelectOption
export interface SelectOptionProps<T = string> {
  description?: string
  disabled?: boolean
  label: string
  value: T
}

// StatusCheck
export interface CheckProps {
  icon: LucideIcon | any
  label: string
  color: string
  name: string
}

// Carousel
/** @description permite crear un carousel de imagenes con un intervalo de tiempo */
export interface CarouselProps {
  children: React.ReactNode
  autoPlay?: boolean
  interval?: number
}
export interface CarouselContext {
  index: number
  setIndex: (index: number) => void
  next: () => void
  prev: () => void
}

//Sidebar
export interface NavItemProps {
  action?: () => void | Promise<void>
  subItems?: NavItemProps[]
  icon: LucideIcon | any
  label: string
  href?: string
}

// Dialog
export interface DialogField {
  component: React.ReactElement
  name: string
}
export interface ConfirmTriggerProps {
  onSubmit: (data: any) => Promise<void>
  resetData: Record<string, any>
  description: string
  fieldName: string
  title: string
}

// Step-form
export interface AddOn {
  subtitle: string
  checked: boolean
  title: string
  price: number
  id: number
}
export type FormItems = {
  plan: 'arcade' | 'advanced' | 'pro'
  yearly: boolean
  addOns: AddOn[]
  phone: string
  email: string
  name: string
}