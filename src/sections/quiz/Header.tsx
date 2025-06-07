const Header = () => {
  return (
    <header className="bg-white border-b sticky top-0 z-10">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo de Supérate a la izquierda */}
        <div className="flex items-center gap-2">
          <div className="relative h-10 w-10">
            <img src="/assets/agustina.png" alt="Supérate Logo" className="fill-current object-contain" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
            Agustina Ferro
          </span>
        </div>

        {/* Logo de la institución a la derecha */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm text-gray-500">Evaluación oficial</p>
            <p className="text-base font-semibold"></p>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
