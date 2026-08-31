/**
 * Read a required environment variable, failing loudly at first use rather than
 * handing back undefined and producing a confusing error three calls later.
 */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const isProduction = process.env.NODE_ENV === 'production'
