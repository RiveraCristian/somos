import { salir } from '@/app/ingresar/acciones';
import { BarraLateral } from '@/components/admin/BarraLateral';
import { requerirUsuario } from '@/lib/auth';
import { ROLES_ADMIN } from '@/lib/constantes';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const usuario = await requerirUsuario(ROLES_ADMIN, '/admin');

  const pendientes = await prisma.pago.count({
    where: { pagoEstado: 'pendiente', isDeleted: false },
  });

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <BarraLateral
        nombre={usuario.usuarioNombre}
        rol={usuario.usuarioRol}
        departamento={usuario.usuarioDepartamento}
        pendientes={pendientes}
        salir={salir}
      />

      <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
