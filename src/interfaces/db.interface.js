export const success = (data) => ({ success: true, data })
export const failure = (error) => ({ success: false, error })