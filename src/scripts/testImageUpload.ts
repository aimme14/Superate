/**
 * Script para probar la funcionalidad de subida de imágenes
 * Este script crea una pregunta de prueba con imágenes
 */

import { questionService } from '@/services/firebase/question.service'

async function testImageUpload() {
  console.log('🧪 Iniciando prueba de subida de imágenes...')

  try {
    // Crear un archivo de imagen de prueba (blob)
    const canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 200
    const ctx = canvas.getContext('2d')
    
    if (ctx) {
      // Dibujar un rectángulo de prueba
      ctx.fillStyle = '#4F46E5'
      ctx.fillRect(0, 0, 200, 200)
      ctx.fillStyle = '#FFFFFF'
      ctx.font = '20px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('Imagen de Prueba', 100, 100)
      
      // Convertir a blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob)
        }, 'image/png')
      })
      
      const testFile = new File([blob], 'test-image.png', { type: 'image/png' })
      
      // Probar subida de imagen
      console.log('📤 Probando subida de imagen...')
      const result = await questionService.uploadImage(
        testFile,
        `test/images/${Date.now()}_test.png`
      )
      
      if (result.success) {
        console.log('✅ Imagen subida exitosamente:', result.data)
        
        // Crear pregunta de prueba con imagen
        const testQuestionData = {
          subject: 'Matemáticas',
          subjectCode: 'MA',
          topic: 'Álgebra',
          topicCode: 'AL',
          grade: '6' as const,
          level: 'Fácil' as const,
          levelCode: 'F' as const,
          questionText: '¿Cuál es el resultado de 2 + 2? (Pregunta con imagen de prueba)',
          questionImages: [result.data], // Usar la imagen subida
          answerType: 'MCQ' as const,
          options: [
            { id: 'A' as const, text: '3', imageUrl: null, isCorrect: false },
            { id: 'B' as const, text: '4', imageUrl: null, isCorrect: true },
            { id: 'C' as const, text: '5', imageUrl: null, isCorrect: false },
            { id: 'D' as const, text: '6', imageUrl: null, isCorrect: false },
          ]
        }
        
        console.log('📝 Creando pregunta de prueba...')
        const questionResult = await questionService.createQuestion(testQuestionData, 'test-user-uid')
        
        if (questionResult.success) {
          console.log('✅ Pregunta creada exitosamente:', questionResult.data.code)
          console.log('🎉 Prueba de imágenes completada exitosamente!')
        } else {
          console.error('❌ Error creando pregunta:', questionResult.error)
        }
      } else {
        console.error('❌ Error subiendo imagen:', result.error)
      }
    }
  } catch (error) {
    console.error('❌ Error en la prueba:', error)
  }
}

// Función para ejecutar desde la consola del navegador
if (typeof window !== 'undefined') {
  (window as any).testImageUpload = testImageUpload
}

export default testImageUpload
