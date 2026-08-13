'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { cerrarSesion, crearSesion, verificarPassword } from '@/lib/auth';
import { ROLES_ADMIN, ROLES_PUERTA, type Rol } from '@/lib/constantes';
import { prisma } from '@/lib/prisma';
import { esquemaIngreso, primerError } from '@/lib/validaciones';

export type EstadoIngreso = { error?: string };

/**
 * Freno simple de fuerza bruta, en memoria del proceso.
 * Alcanza para un despliegue de una sola instancia como este; si algún día
 * corre replicado hay que moverlo a la base o a un Redis.
 */
const intentos = new Map<string, { cantidad: number; hasta: number }>();
const MAX_INTENTOS = 6;
const BLOQUEO_MS = 10 * 60 * 1000;

function registrarFallo(clave: string) {
  const actual = intentos.get(clave);
  const cantidad = (actual?.cantidad ?? 0) + 1;
  intentos.set(clave, {
    cantidad,
    hasta: cantidad >= MAX_INTENTOS ? Date.now() + BLOQUEO_MS : 0,
  });
}

function bloqueado(clave: string): boolean {
  const actual = intentos.get(clave);
  if (!actual) return false;
  if (actual.hasta && actual.hasta > Date.now()) return true;
  if (actual.hasta && actual.hasta <= Date.now()) intentos.delete(clave);
  return false;
}

export async function iniciarSesion(
  _previo: EstadoIngreso,
  formulario: FormData,
): Promise<EstadoIngreso> {
  const analisis = esquemaIngreso.safeParse({
    correo: formulario.get('correo'),
    password: formulario.get('password'),
  });

  if (!analisis.success) {
    return { error: primerError(analisis.error) };
  }

  const { correo, password } = analisis.data;
  const cabeceras = await headers();
  const ip = (cabeceras.get('x-forwarded-for') ?? 'local').split(',')[0].trim();
  const clave = `${ip}:${correo}`;

  if (bloqueado(clave)) {
    return { error: 'Demasiados intentos fallidos. Espera unos minutos y vuelve a probar.' };
  }

  const usuario = await prisma.usuario.findUnique({ where: { usuarioCorreo: correo } });

  // Mismo mensaje para usuario inexistente y para clave mala: no se le dice a
  // nadie qué correos existen.
  const credencialesMalas = { error: 'Correo o contraseña incorrectos.' };

  if (!usuario || !usuario.usuarioActivo) {
    registrarFallo(clave);
    return credencialesMalas;
  }

  const correcta = await verificarPassword(password, usuario.usuarioPassword);
  if (!correcta) {
    registrarFallo(clave);
    return credencialesMalas;
  }

  intentos.delete(clave);
  await crearSesion(usuario.usuarioId, usuario.usuarioRol as Rol);

  const solicitado = String(formulario.get('siguiente') ?? '');
  const rol = usuario.usuarioRol as Rol;

  // Solo se aceptan rutas internas: evita redirecciones abiertas.
  const destinoPedido = solicitado.startsWith('/') && !solicitado.startsWith('//') ? solicitado : '';

  const destino =
    destinoPedido ||
    (ROLES_ADMIN.includes(rol) ? '/admin' : ROLES_PUERTA.includes(rol) ? '/puerta' : '/');

  redirect(destino);
}

export async function salir(): Promise<void> {
  await cerrarSesion();
  redirect('/ingresar');
}
