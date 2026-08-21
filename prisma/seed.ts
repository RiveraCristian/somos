/**
 * Seed inicial de SOMOS.
 *
 * Es idempotente: se puede correr las veces que sea sin duplicar datos.
 *
 *   npm run db:seed
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** Usuario tecnico que figura como autor de todo lo que entra por el sitio publico. */
const USUARIO_SISTEMA_ID = 1;

async function main() {
  console.log('› Sembrando base de datos SOMOS…');

  // -------------------------------------------------------------------------
  // 1. Usuarios
  // -------------------------------------------------------------------------
  await prisma.usuario.upsert({
    where: { usuarioId: USUARIO_SISTEMA_ID },
    update: {},
    create: {
      usuarioId: USUARIO_SISTEMA_ID,
      usuarioCorreo: 'sistema@somos.local',
      usuarioNombre: 'Sistema (auto-registro publico)',
      usuarioRol: 'Viewer',
      // Sin password y desactivado: no puede iniciar sesion, solo existe para
      // que created_by nunca quede nulo cuando el registro nace en el sitio.
      usuarioPassword: null,
      usuarioActivo: false,
      usuarioFechaDesactivacion: new Date(),
    },
  });

  // Insertar el usuario 1 con id explicito no avanza la secuencia del SERIAL,
  // asi que el siguiente insert automatico intentaria usar el id 1 de nuevo.
  // Hay que reposicionarla ANTES de crear cualquier otro usuario.
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('usuarios', 'usuario_id'), GREATEST((SELECT MAX(usuario_id) FROM usuarios), 1))`,
  );

  const correoAdmin = (process.env.ADMIN_SEED_CORREO ?? 'admin@somos.cl').toLowerCase();
  const nombreAdmin = process.env.ADMIN_SEED_NOMBRE ?? 'Administrador SOMOS';
  const passwordAdmin = process.env.ADMIN_SEED_PASSWORD ?? 'CAMBIAME123';

  const admin = await prisma.usuario.upsert({
    where: { usuarioCorreo: correoAdmin },
    update: { usuarioNombre: nombreAdmin, usuarioActivo: true },
    create: {
      usuarioCorreo: correoAdmin,
      usuarioNombre: nombreAdmin,
      usuarioPassword: bcrypt.hashSync(passwordAdmin, 12),
      usuarioRol: 'Admin',
      usuarioDepartamento: 'Producción',
    },
  });

  // Usuario de puerta: solo valida entradas, no toca el resto del panel.
  const puerta = await prisma.usuario.upsert({
    where: { usuarioCorreo: 'puerta@somos.cl' },
    update: {},
    create: {
      usuarioCorreo: 'puerta@somos.cl',
      usuarioNombre: 'Staff de puerta',
      usuarioPassword: bcrypt.hashSync(passwordAdmin, 12),
      usuarioRol: 'Steward',
      usuarioDepartamento: 'Puerta',
    },
  });

  console.log(`  · usuarios: sistema, ${admin.usuarioCorreo}, ${puerta.usuarioCorreo}`);

  // -------------------------------------------------------------------------
  // 2. Evento
  // -------------------------------------------------------------------------
  const evento = await prisma.evento.upsert({
    where: { eventoSlug: 'somos' },
    update: {},
    create: {
      eventoSlug: 'somos',
      eventoNombre: 'SOMOS',
      eventoLema: 'Una noche, un lugar, una sola entrada por persona.',
      eventoDescripcion:
        'Compras tu entrada acá mismo y la pagas por transferencia. Apenas se confirma ' +
        'el pago te llega tu entrada con un QR único a tu correo. En la puerta lo ' +
        'escaneamos y listo.',
      eventoFechaInicio: null, // por definir
      eventoFechaTermino: null,
      eventoVenue: null, // por definir
      eventoDireccion: null,
      eventoCiudad: 'Talca',
      eventoRegion: 'Maule',
      eventoCapacidad: 200,
      eventoEstado: 'publicado',
      eventoInstagram: 'somos.cl',
      eventoWhatsapp: null,

      // Datos de cobro: reemplazalos por los tuyos desde /admin/evento.
      // Cuenta de respaldo, para quien transfiere por su cuenta en vez de usar
      // el widget. El cobro normal va por Fintoc y deposita donde diga su panel.
      eventoCuentaNombre: 'Nombre del organizador',
      eventoCuentaRut: '12.345.678-9',
      eventoCuentaCorreo: 'organizador@correo.cl',
      eventoCuentaBanco: 'Banco de Chile',
      eventoCuentaTipo: 'Cuenta Corriente',
      eventoCuentaNumero: '000000000000',
      eventoCuentaQrUrl: null,

      createdBy: USUARIO_SISTEMA_ID,
    },
  });

  console.log(`  · evento: ${evento.eventoNombre} (${evento.eventoCiudad})`);

  // -------------------------------------------------------------------------
  // 3. Tipos de entrada
  // -------------------------------------------------------------------------
  // Una sola entrada. Si mas adelante hacen falta tramos (preventa, VIP), se
  // agregan desde /admin/evento sin tocar codigo.
  const tipos = [
    {
      slug: 'general',
      nombre: 'General',
      descripcion: 'Acceso al recinto durante toda la noche.',
      precio: 20000,
      cupo: 200,
      orden: 1,
      color: 'cyan',
    },
  ];

  for (const t of tipos) {
    await prisma.tipoEntrada.upsert({
      where: {
        tipoEntradaEventoId_tipoEntradaSlug: {
          tipoEntradaEventoId: evento.eventoId,
          tipoEntradaSlug: t.slug,
        },
      },
      update: {},
      create: {
        tipoEntradaEventoId: evento.eventoId,
        tipoEntradaSlug: t.slug,
        tipoEntradaNombre: t.nombre,
        tipoEntradaDescripcion: t.descripcion,
        tipoEntradaPrecio: t.precio,
        tipoEntradaCupo: t.cupo,
        tipoEntradaOrden: t.orden,
        tipoEntradaColor: t.color,
        createdBy: USUARIO_SISTEMA_ID,
      },
    });
  }

  console.log(`  · tipos de entrada: ${tipos.map((t) => t.nombre).join(', ')}`);

  // -------------------------------------------------------------------------
  // 3b. Etapas de venta
  // -------------------------------------------------------------------------
  // El precio no lo pone el tipo de entrada sino la etapa vigente: las primeras
  // 100 mas baratas, despues sube, y el dia del evento sube otra vez.
  const etapas = [
    { nombre: 'Primera tanda', precio: 20000, cupo: 100, orden: 1, enPuerta: false },
    { nombre: 'Segunda tanda', precio: 25000, cupo: null, orden: 2, enPuerta: false },
    { nombre: 'En puerta', precio: 30000, cupo: null, orden: 3, enPuerta: true },
  ];

  for (const e of etapas) {
    await prisma.etapaVenta.upsert({
      where: {
        etapaEventoId_etapaOrden: { etapaEventoId: evento.eventoId, etapaOrden: e.orden },
      },
      update: {},
      create: {
        etapaEventoId: evento.eventoId,
        etapaNombre: e.nombre,
        etapaPrecio: e.precio,
        etapaCupo: e.cupo,
        etapaOrden: e.orden,
        etapaEnPuerta: e.enPuerta,
        createdBy: USUARIO_SISTEMA_ID,
      },
    });
  }

  console.log(`  · etapas: ${etapas.map((e) => `${e.nombre} ${e.precio}`).join(' → ')}`);

  // -------------------------------------------------------------------------
  // 3c. Lista de invitados
  // -------------------------------------------------------------------------
  // SOMOS es privada: sin numeros en esta tabla no puede comprar nadie. Va un
  // numero de prueba mientras llega la lista real.
  await prisma.invitado.upsert({
    where: {
      invitadoEventoId_invitadoTelefono: {
        invitadoEventoId: evento.eventoId,
        invitadoTelefono: '+56999999999',
      },
    },
    update: {},
    create: {
      invitadoEventoId: evento.eventoId,
      invitadoTelefono: '+56999999999',
      invitadoNombre: 'Numero de prueba',
      invitadoCupo: 2,
      invitadoNota: 'Provisorio: reemplazar por la lista real de invitados.',
      createdBy: USUARIO_SISTEMA_ID,
    },
  });

  console.log('  · lista de invitados: +56999999999 (prueba)');

  // -------------------------------------------------------------------------
  // 4. Line-up de ejemplo (editable desde el panel)
  // -------------------------------------------------------------------------
  const yaHayArtistas = await prisma.artista.count({
    where: { artistaEventoId: evento.eventoId },
  });

  if (yaHayArtistas === 0) {
    await prisma.artista.createMany({
      data: [
        {
          artistaEventoId: evento.eventoId,
          artistaNombre: 'Por confirmar',
          artistaGenero: 'Warm up / house',
          artistaDescripcion: 'Apertura de la noche. Reemplaza este artista desde el panel.',
          artistaOrden: 1,
          artistaDestacado: false,
          createdBy: USUARIO_SISTEMA_ID,
        },
        {
          artistaEventoId: evento.eventoId,
          artistaNombre: 'Por confirmar',
          artistaGenero: 'Techno',
          artistaDescripcion: 'Bloque central. Reemplaza este artista desde el panel.',
          artistaOrden: 2,
          artistaDestacado: true,
          createdBy: USUARIO_SISTEMA_ID,
        },
        {
          artistaEventoId: evento.eventoId,
          artistaNombre: 'Por confirmar',
          artistaGenero: 'Hard groove',
          artistaDescripcion: 'Cierre. Reemplaza este artista desde el panel.',
          artistaOrden: 3,
          artistaDestacado: false,
          createdBy: USUARIO_SISTEMA_ID,
        },
      ],
    });
    console.log('  · line-up: 3 slots por confirmar');
  }

  // -------------------------------------------------------------------------
  // 5. Preguntas frecuentes
  // -------------------------------------------------------------------------
  const yaHayPreguntas = await prisma.preguntaFrecuente.count({
    where: { preguntaEventoId: evento.eventoId },
  });

  if (yaHayPreguntas === 0) {
    await prisma.preguntaFrecuente.createMany({
      data: [
        {
          preguntaEventoId: evento.eventoId,
          preguntaTexto: '¿Cómo compro mi entrada?',
          preguntaRespuesta:
            'Eliges tu entrada y dejas tus datos. Después la pagas con Fintoc: eliges tu banco ' +
            'y apruebas la transferencia sin salir de la página. Si tu banco no aparece o algo ' +
            'falla, puedes transferir por tu cuenta y subir la captura. En ambos casos te llega ' +
            'tu entrada con QR al correo.',
          preguntaOrden: 1,
          createdBy: USUARIO_SISTEMA_ID,
        },
        {
          preguntaEventoId: evento.eventoId,
          preguntaTexto: '¿Es seguro pagar acá?',
          preguntaRespuesta:
            'Sí. Fintoc te conecta directamente con tu banco: nosotros nunca vemos tus claves ' +
            'ni los datos de tu cuenta, y la transferencia la autorizas tú en el sitio de tu ' +
            'banco. Si prefieres transferir por tu cuenta, te pedimos la captura porque el ' +
            'banco no le avisa a un sitio web cuando llega el dinero.',
          preguntaOrden: 2,
          createdBy: USUARIO_SISTEMA_ID,
        },
        {
          preguntaEventoId: evento.eventoId,
          preguntaTexto: '¿Cuánto se demora la confirmación?',
          preguntaRespuesta:
            'Revisamos los comprobantes a mano, así que puede tomar unas horas. Te llega un ' +
            'correo apenas quede lista tu entrada.',
          preguntaOrden: 3,
          createdBy: USUARIO_SISTEMA_ID,
        },
        {
          preguntaEventoId: evento.eventoId,
          preguntaTexto: '¿Puedo pasarle mi QR a otra persona?',
          preguntaRespuesta:
            'El QR es de un solo uso y se quema al escanearlo en la puerta. Si se lo pasas a ' +
            'alguien, esa persona entra y tú te quedas afuera. Una entrada, una persona.',
          preguntaOrden: 4,
          createdBy: USUARIO_SISTEMA_ID,
        },
        {
          preguntaEventoId: evento.eventoId,
          preguntaTexto: '¿Se devuelve la plata?',
          preguntaRespuesta:
            'Las entradas no tienen devolución ni cambio de fecha. Si la fiesta se cancela por ' +
            'fuerza mayor, avisamos por correo y devolvemos lo pagado.',
          preguntaOrden: 5,
          createdBy: USUARIO_SISTEMA_ID,
        },
      ],
    });
    console.log('  · preguntas frecuentes: 5');
  }

  console.log('✓ Seed listo.');
  console.log(`  Panel:  /admin  →  ${correoAdmin}`);
  console.log(`  Puerta: /puerta →  puerta@somos.cl`);
}

main()
  .catch((e) => {
    console.error('✗ Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
