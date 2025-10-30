import React from 'react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import 'katex/dist/katex.min.css'

export type RichTextEditorProps = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}

// Configuración de la toolbar con opciones estilo Word, incluyendo fórmulas (KaTeX)
const toolbarModules = {
  toolbar: [
    [{ font: [] }, { size: [] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ script: 'sub' }, { script: 'super' }],
    [{ color: [] }, { background: [] }],
    [{ header: 1 }, { header: 2 }],
    [{ align: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    ['formula'],
    ['clean']
  ],
  clipboard: { matchVisual: false }
}

const formats = [
  'font',
  'size',
  'bold',
  'italic',
  'underline',
  'strike',
  'script',
  'color',
  'background',
  'header',
  'align',
  'list',
  'blockquote',
  'code-block',
  'formula'
]

export default function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  return (
    <div className={className}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        modules={toolbarModules}
        formats={formats}
      />
    </div>
  )
}


