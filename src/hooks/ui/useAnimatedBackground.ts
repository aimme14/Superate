import { ThemeContextProps } from '@/interfaces/context.interface'
import { useSpring } from '@react-spring/web'

export const useAnimatedBackground = ({ theme }: ThemeContextProps) => {
  const springProps = useSpring({
    from: { backgroundPosition: '0% 50%' },
    to: { backgroundPosition: '100% 50%' },
    config: { duration: 20000 },
    loop: true,
  });

  const gradientColors = theme === 'dark'
    ? ['from-zinc-950/50', 'via-purple-950/50', 'to-indigo-950/50']
    : ['from-white/50', 'via-purple-100/50', 'to-pink-100/50'];

  return { springProps, gradientColors };
}