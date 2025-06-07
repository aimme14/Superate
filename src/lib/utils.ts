import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
/*---------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------handler file--------------------------------------------------*/
/**
 * This function is used to copy a string to the clipboard.
 * @param text Text to copy.
 */
export const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text) }

/**
 * This function is used to process a file, specifically a base64 string.
 * also works to convert a blob to base64
 * @param data - The file to process.
 * @returns {string} A promise that resolves to a base64 string.
 */
export const processFile = (data: File): Promise<string> => {
  return new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve((reader.result as string).split(',')[1])
    reader.readAsDataURL(data)
  })
}