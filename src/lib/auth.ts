import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

import { prisma } from './prisma';
import { generarToken, hashearToken } from './codigos';
import type { Rol } from './constantes';

const COOKIE_SESION = 'somos_sesion';
const DIAS_SESION = 7;
const COSTO_BCRYPT = 12;

function secreto(): Uint8Array {
  const valor = process.env.JWT_SECRET;
  if (!valor || valor.length < 24) {
    throw new Error(
      'JWT_SECRET no esta configurado (o es demasiado corto). Revisa tu archivo .env.',
    );
  }
  return new TextEncoder().encode(valor);
}

export type UsuarioSesion = {
  usuarioId: number;
  usuarioNombre: string;
  usuarioCorreo: string;
  usuarioRol: Rol;
  usuarioDepartamento: string | null;
  sesionId: number;
};

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------
export async function hashearPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COSTO_BCRYPT);
}

export async function verificarPassword(password: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

// ---------------------------------------------------------------------------
// Sesiones
// ---------------------------------------------------------------------------

/**
 * Crea la sesion en base de datos y deja la cookie firmada en el navegador.
 * Solo se puede llamar desde un Server Action o un Route Handler.
 */
export async function crearSesion(usuarioId: number, rol: Rol): Promise<void> {
  const cabeceras = await headers();
  const expiraEn = new Date(Date.now() + DIAS_SESION * 24 * 60 * 60 * 1000);

  // El identificador viaja en el JWT; en la base queda solo su hash, para poder
  // revocar la sesion sin almacenar nunca el token en claro.
  const identificador = generarToken(32);

  const sesion = await prisma.sesion.create({
    data: {
      sesionUsuarioId: usuarioId,
      sesionTokenHash: hashearToken(identificador),
      sesionExpiraEn: expiraEn,
      sesionIp: (cabeceras.get('x-forwarded-for') ?? '').split(',')[0].trim() || null,
      sesionUserAgent: cabeceras.get('user-agent')?.slice(0, 300) ?? null,
    },
  });

  const token = await new SignJWT({ rol, sid: sesion.sesionId, jti: identificador })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(usuarioId))
    .setIssuedAt()
    .setExpirationTime(expiraEn)
    .sign(secreto());

  const tarro = await cookies();
  tarro.set(COOKIE_SESION, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiraEn,
  });
}

/** Revoca la sesion actual y borra la cookie. */
export async function cerrarSesion(): Promise<void> {
  const actual = await obtenerUsuarioActual();
  if (actual) {
    await prisma.sesion.update({
      where: { sesionId: actual.sesionId },
      data: { sesionRevocada: true },
    });
  }
  const tarro = await cookies();
  tarro.delete(COOKIE_SESION);
}

/**
 * Usuario autenticado de la request actual, o null.
 * `cache` de React lo memoriza: aunque varios componentes lo pidan, la
 * consulta a la base se hace una sola vez por request.
 */
export const obtenerUsuarioActual = cache(async (): Promise<UsuarioSesion | null> => {
  const tarro = await cookies();
  const token = tarro.get(COOKIE_SESION)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secreto());
    const sesionId = Number(payload.sid);
    const identificador = String(payload.jti ?? '');
    if (!sesionId || !identificador) return null;

    const sesion = await prisma.sesion.findUnique({
      where: { sesionId },
      include: { usuario: true },
    });

    if (!sesion) return null;
    if (sesion.sesionRevocada) return null;
    if (sesion.sesionExpiraEn.getTime() < Date.now()) return null;
    if (sesion.sesionTokenHash !== hashearToken(identificador)) return null;
    if (!sesion.usuario.usuarioActivo) return null;

    return {
      usuarioId: sesion.usuario.usuarioId,
      usuarioNombre: sesion.usuario.usuarioNombre,
      usuarioCorreo: sesion.usuario.usuarioCorreo,
      usuarioRol: sesion.usuario.usuarioRol as Rol,
      usuarioDepartamento: sesion.usuario.usuarioDepartamento,
      sesionId: sesion.sesionId,
    };
  } catch {
    // Firma invalida, token vencido o secreto rotado.
    return null;
  }
});

/**
 * Exige sesion activa con alguno de los roles indicados.
 * Si no la hay, redirige al login guardando el destino original.
 */
export async function requerirUsuario(
  rolesPermitidos: Rol[],
  destino = '/admin',
): Promise<UsuarioSesion> {
  const usuario = await obtenerUsuarioActual();

  if (!usuario) {
    redirect(`/ingresar?siguiente=${encodeURIComponent(destino)}`);
  }

  if (!rolesPermitidos.includes(usuario.usuarioRol)) {
    redirect('/sin-permiso');
  }

  return usuario;
}
