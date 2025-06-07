import { useState } from 'react'

/** @description permite crear un formulario de pasos */
interface ArrayElements {
	indexArray?: number[]
	subfield: string
}
interface UseStepFormProps {
	validationFields: { [key: number]: Array<string | ArrayElements> }
	steps: number
	methods: any
}

export const useStepForm = ({ steps, methods, validationFields }: UseStepFormProps) => {
	const [showMessage, setShowMessage] = useState(false)
	const [index, setIndex] = useState(0)

	const validateField = async (field: string | { subfield: string; indexArray?: number[] }) => {
		if (typeof field === 'string') return methods.trigger(field)

		const arrayValue = field.subfield.split('.')
			.reduce((obj, key) => obj?.[key], methods.getValues())

		if (Array.isArray(arrayValue)) {
			const promises = arrayValue.map((_, i) => methods.trigger(`${field.subfield}.${i}`))
			const results = await Promise.all(promises)
			return results.every(result => result === true)
		}
		return true
	}

	const next = async () => {
		const currentFields = validationFields[index]
		if (currentFields) {
			const validation = currentFields.map(f => validateField(f))
			const results = await Promise.all(validation)
			const isValid = results.every(result => result === true)
			if (!isValid) return
		}

		if (index < steps - 1) setIndex((i) => i + 1)
		else if (index === steps - 1) setShowMessage(true)
	}

	const previous = () => {
		if (index > 0) setIndex((i) => i - 1)
	}

	const goTo = (step: number) => {
		if (step >= 0 && step < steps) setIndex(step)
	}

	const isLastStep = index === steps - 1
	const isFirstStep = index === 0

	return { goTo, next, previous, index, showMessage, isLastStep, isFirstStep }
}