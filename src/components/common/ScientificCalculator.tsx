import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Calculator, Delete, Radical, Pi } from 'lucide-react'

interface ScientificCalculatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInsert: (value: string) => void
}

export function ScientificCalculator({ open, onOpenChange, onInsert }: ScientificCalculatorProps) {
  const [display, setDisplay] = useState('0')
  const [previousValue, setPreviousValue] = useState<number | null>(null)
  const [operation, setOperation] = useState<string | null>(null)
  const [waitingForOperand, setWaitingForOperand] = useState(false)

  useEffect(() => {
    if (!open) {
      // Reset cuando se cierra
      setDisplay('0')
      setPreviousValue(null)
      setOperation(null)
      setWaitingForOperand(false)
    }
  }, [open])

  const inputNumber = (num: string) => {
    if (waitingForOperand) {
      setDisplay(String(num))
      setWaitingForOperand(false)
    } else {
      setDisplay(display === '0' ? String(num) : display + num)
    }
  }

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay('0.')
      setWaitingForOperand(false)
    } else if (display.indexOf('.') === -1) {
      setDisplay(display + '.')
    }
  }

  const clear = () => {
    setDisplay('0')
    setPreviousValue(null)
    setOperation(null)
    setWaitingForOperand(false)
  }

  const performOperation = (nextOperation: string) => {
    const inputValue = parseFloat(display)

    if (previousValue === null) {
      setPreviousValue(inputValue)
    } else if (operation) {
      const currentValue = previousValue || 0
      const newValue = calculate(currentValue, inputValue, operation)

      setDisplay(String(newValue))
      setPreviousValue(newValue)
    }

    setWaitingForOperand(true)
    setOperation(nextOperation)
  }

  const calculate = (firstValue: number, secondValue: number, operation: string): number => {
    switch (operation) {
      case '+':
        return firstValue + secondValue
      case '-':
        return firstValue - secondValue
      case '×':
        return firstValue * secondValue
      case '÷':
        return secondValue !== 0 ? firstValue / secondValue : 0
      case '=':
        return secondValue
      default:
        return secondValue
    }
  }

  const handleScientificFunction = (func: string) => {
    const value = parseFloat(display)
    let result: number

    switch (func) {
      case 'sin':
        result = Math.sin(value * (Math.PI / 180))
        break
      case 'cos':
        result = Math.cos(value * (Math.PI / 180))
        break
      case 'tan':
        result = Math.tan(value * (Math.PI / 180))
        break
      case 'asin':
        result = Math.asin(value) * (180 / Math.PI)
        break
      case 'acos':
        result = Math.acos(value) * (180 / Math.PI)
        break
      case 'atan':
        result = Math.atan(value) * (180 / Math.PI)
        break
      case 'log':
        result = Math.log10(value)
        break
      case 'ln':
        result = Math.log(value)
        break
      case 'sqrt':
        result = Math.sqrt(value)
        break
      case 'square':
        result = value * value
        break
      case 'pow':
        // Para potencia, usamos el valor anterior como exponente
        if (previousValue !== null) {
          result = Math.pow(previousValue, value)
          setPreviousValue(null)
        } else {
          result = value
        }
        break
      case 'exp':
        result = Math.exp(value)
        break
      case 'pi':
        result = Math.PI
        break
      case 'e':
        result = Math.E
        break
      default:
        result = value
    }

    setDisplay(String(result))
    setWaitingForOperand(true)
  }

  const handleEquals = () => {
    const inputValue = parseFloat(display)

    if (previousValue !== null && operation) {
      const newValue = calculate(previousValue, inputValue, operation)
      setDisplay(String(newValue))
      setPreviousValue(null)
      setOperation(null)
      setWaitingForOperand(true)
    }
  }

  // Convertir el valor del display a formato LaTeX apropiado
  const convertToLatex = (value: string): string => {
    // Si es un número simple, devolverlo como está (LaTeX puede renderizar números directamente)
    const numValue = parseFloat(value)
    if (!isNaN(numValue)) {
      // Si tiene decimales, mantener el formato
      if (value.includes('.')) {
        return value
      }
      // Si es un entero, devolverlo como está
      return value
    }
    // Si no es un número, devolver como está (por si acaso hay operaciones más complejas)
    return value
  }

  const handleInsert = () => {
    // Convertir el valor a LaTeX antes de insertar
    const latexValue = convertToLatex(display)
    onInsert(latexValue)
    clear()
    onOpenChange(false)
  }

  const ButtonRow = ({ children }: { children: React.ReactNode }) => (
    <div className="grid grid-cols-5 gap-2">{children}</div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calculadora Científica
          </DialogTitle>
          <DialogDescription>
            Realiza cálculos científicos y matemáticos avanzados
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Display */}
          <div className="w-full p-4 bg-gray-900 dark:bg-gray-950 text-white text-right text-3xl font-mono rounded-lg min-h-[80px] flex items-center justify-end overflow-x-auto">
            {display}
          </div>

          {/* Scientific Functions */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Funciones Científicas</div>
            <div className="grid grid-cols-5 gap-2">
              <Button variant="outline" size="sm" onClick={() => handleScientificFunction('sin')}>
                sin
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleScientificFunction('cos')}>
                cos
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleScientificFunction('tan')}>
                tan
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleScientificFunction('asin')}>
                sin⁻¹
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleScientificFunction('acos')}>
                cos⁻¹
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleScientificFunction('atan')}>
                tan⁻¹
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleScientificFunction('log')}>
                log
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleScientificFunction('ln')}>
                ln
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleScientificFunction('exp')}>
                eˣ
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleScientificFunction('pow')}>
                xʸ
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleScientificFunction('sqrt')}>
                <Radical className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleScientificFunction('square')}>
                x²
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleScientificFunction('pi')}>
                <Pi className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleScientificFunction('e')}>
                e
              </Button>
            </div>
          </div>

          {/* Number Pad */}
          <div className="space-y-2">
            <ButtonRow>
              <Button variant="outline" onClick={clear}>
                <Delete className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setDisplay(String(parseFloat(display) * -1))}>
                ±
              </Button>
              <Button variant="outline" onClick={() => setDisplay(String(parseFloat(display) / 100))}>
                %
              </Button>
              <Button variant="outline" onClick={() => performOperation('÷')}>
                ÷
              </Button>
            </ButtonRow>

            <ButtonRow>
              <Button variant="outline" onClick={() => inputNumber('7')}>7</Button>
              <Button variant="outline" onClick={() => inputNumber('8')}>8</Button>
              <Button variant="outline" onClick={() => inputNumber('9')}>9</Button>
              <Button variant="outline" onClick={() => performOperation('×')}>×</Button>
            </ButtonRow>

            <ButtonRow>
              <Button variant="outline" onClick={() => inputNumber('4')}>4</Button>
              <Button variant="outline" onClick={() => inputNumber('5')}>5</Button>
              <Button variant="outline" onClick={() => inputNumber('6')}>6</Button>
              <Button variant="outline" onClick={() => performOperation('-')}>-</Button>
            </ButtonRow>

            <ButtonRow>
              <Button variant="outline" onClick={() => inputNumber('1')}>1</Button>
              <Button variant="outline" onClick={() => inputNumber('2')}>2</Button>
              <Button variant="outline" onClick={() => inputNumber('3')}>3</Button>
              <Button variant="outline" onClick={() => performOperation('+')}>+</Button>
            </ButtonRow>

            <ButtonRow>
              <Button variant="outline" className="col-span-2" onClick={() => inputNumber('0')}>
                0
              </Button>
              <Button variant="outline" onClick={inputDecimal}>.</Button>
              <Button variant="default" className="col-span-2" onClick={handleEquals}>
                =
              </Button>
            </ButtonRow>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button type="button" onClick={handleInsert}>
            Insertar Resultado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}