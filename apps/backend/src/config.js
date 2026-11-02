import dotenv from 'dotenv';
dotenv.config();

export const config = Object.freeze({
  server: {
    port: parseInt(process.env.PORT || '4000', 10),
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'games-tracker-secret-key-change-in-production',
    adminUser: process.env.ADMIN_USER || 'admin',
    adminPass: process.env.ADMIN_PASS || '1234',
    apiKey: process.env.API_KEY || '',
  },
  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID,
    clientSecret: process.env.TWITCH_CLIENT_SECRET,
    hasCredentials: !!(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET),
  },
});

export const CURRENT_YEAR = new Date().getFullYear();
export const CURRENT_MONTH = new Date().getMonth() + 1;

const DEFAULT_ADMIN_PASS = '1234';
const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Valida que en producción las credenciales de auth no usen los valores por defecto.
 * Devuelve la lista de errores (vacía si la configuración es aceptable).
 */
export function validateAuthConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') return [];
  const errors = [];
  if (!env.JWT_SECRET || env.JWT_SECRET.length < MIN_JWT_SECRET_LENGTH) {
    errors.push(`JWT_SECRET debe estar definido y tener al menos ${MIN_JWT_SECRET_LENGTH} caracteres`);
  }
  if (!env.ADMIN_PASS || env.ADMIN_PASS === DEFAULT_ADMIN_PASS) {
    errors.push('ADMIN_PASS debe estar definido y no puede ser el valor por defecto');
  }
  return errors;
}
