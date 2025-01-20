/** Error base personalizado para la aplicación */
export default class ErrorAPI extends Error {
  code
  details
  statusCode

  constructor({ message, statusCode = 500, code, details }) {
    super(message);
    this.code = code
    this.details = details
    this.statusCode = statusCode
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** Error específico para operaciones no autorizadas */
export class Unauthorized extends ErrorAPI {
  constructor({ message }) {
    super({ message, statusCode: 401, code: 'UNAUTHORIZED' })
  }
}

/** Error específico para recursos no encontrados */
export class NotFound extends ErrorAPI {
  constructor({ message }) {
    super({ message: `${message} no encontrado`, statusCode: 404, code: 'NOT_FOUND' })
  }
}

/** Error específico para validación de datos */
export class Validation extends ErrorAPI {
  constructor({ message, details }) {
    super({ message, statusCode: 400, code: 'VALIDATION_ERROR', details })
  }
}

/** Error específico para conflictos en operaciones */
export class Conflict extends ErrorAPI {
  constructor({ message }) {
    super({ message, statusCode: 409, code: 'CONFLICT' })
  }
}


/**
 * Regresa un registro de error por defecto.
 * La idea de definir "details" como un objeto de codigo es debido a que se desconoce la procedencia del error.
 * Entonces en vez de mostrar directamente en "code", pasamos el codigo a traves de "details" para mayor flexibilidad.
 * @param {string} context: contexto del error (Error interno del servidor)
 * @param {string} message: corresponde al mensaje del error de firebase
*/
export function defaultRecord(context, message) {
  return { message: `${context}: ${message}`, errorType: ErrorAPI }
}