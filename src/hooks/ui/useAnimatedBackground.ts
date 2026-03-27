import { ThemeContextProps } from '@/interfaces/context.interface'
import { useSpring } from '@react-spring/web'

type UseAnimatedBackgroundParams = ThemeContextProps & {
  shouldAnimate: boolean
}

export const useAnimatedBackground = ({ theme, shouldAnimate }: UseAnimatedBackgroundParams) => {
  const springProps = useSpring({
    from: { backgroundPosition: '0% 50%' },
    to: { backgroundPosition: '100% 50%' },
    config: { duration: 30000 },
    loop: true,
    pause: !shouldAnimate,
  })

  // Gradientes más sofisticados y profesionales
  const gradientColors = theme === 'dark'
    ? ['from-slate-950', 'via-purple-950/80', 'via-indigo-950/80', 'to-slate-950']
    : ['from-slate-50', 'via-purple-50/90', 'via-indigo-50/90', 'to-pink-50'];

  return { springProps, gradientColors };
}