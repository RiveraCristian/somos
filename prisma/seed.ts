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

/**
 * Jueves 19 de noviembre de 2026, de 20:00 a 04:00, hora de Chile.
 *
 * El desfase va escrito (-03:00) en vez de calcularse: en noviembre Chile esta
 * en horario de verano, y para una fecha fija y conocida es mas claro que
 * arrastrar el conversor de zonas hasta aca. El seed se compila aparte para la
 * imagen de produccion y no puede importar de `src/`.
 */
const INICIO_EVENTO = new Date('2026-11-19T20:00:00-03:00');
const TERMINO_EVENTO = new Date('2026-11-20T04:00:00-03:00');

/** Una hora del dia del evento, en hora de Chile. Acepta >=24 para la madrugada. */
function horaEvento(hora: number): Date {
  const dia = hora >= 24 ? 20 : 19;
  const hh = String(hora % 24).padStart(2, '0');
  return new Date(`2026-11-${dia}T${hh}:00:00-03:00`);
}

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
      eventoFechaInicio: INICIO_EVENTO,
      eventoFechaTermino: TERMINO_EVENTO,
      // El lugar es secreto: la direccion se carga desde /admin/evento y solo
      // la ve quien ya tiene su entrada.
      eventoVenue: null,
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
    // Bloques por estilo, no artistas: los nombres se confirman despues y
    // mientras tanto lo concreto es como se mueve la noche.
    const bloques = [
      { genero: 'Deep house', desc: 'Apertura. La pista se llena de a poco.', desde: 20, hasta: 22, cierre: false },
      { genero: 'House', desc: null, desde: 22, hasta: 24, cierre: false },
      { genero: 'Tech house', desc: 'El punto mas alto de la noche.', desde: 24, hasta: 26, cierre: false },
      { genero: 'Reggaetón', desc: 'Cierre.', desde: 26, hasta: 28, cierre: true },
    ];

    await prisma.artista.createMany({
      data: bloques.map((b, i) => ({
        artistaEventoId: evento.eventoId,
        artistaNombre: 'Por confirmar',
        artistaGenero: b.genero,
        artistaDescripcion: b.desc,
        artistaHoraInicio: horaEvento(b.desde),
        artistaHoraTermino: horaEvento(b.hasta),
        artistaOrden: i + 1,
        artistaDestacado: b.cierre,
        createdBy: USUARIO_SISTEMA_ID,
      })),
    });
    console.log(`  · line-up: ${bloques.map((b) => b.genero).join(' → ')}`);
  }

  // -------------------------------------------------------------------------
  // 5. Preguntas frecuentes
  // -------------------------------------------------------------------------
  const yaHayPreguntas = await prisma.preguntaFrecuente.count({
    where: { preguntaEventoId: evento.eventoId },
  });

  if (yaHayPreguntas === 0) {
    // El contenido sale de faq-somos.md y de la exencion de responsabilidad.
    // Editable desde el panel: esto es solo el punto de partida.
    const preguntas: [string, string][] = [
      [
        '¿Cualquiera puede comprar una entrada?',
        'No. SOMOS es estrictamente privada: solo compra quien está en la lista de invitados. Al comprar verificamos tu número de teléfono, y cada número habilitado puede sacar hasta dos entradas — la tuya y la de alguien que traigas.',
      ],
      [
        '¿Cuánto cuesta y por qué sube el precio?',
        'El aforo es de 200 cupos y el precio sube por etapas: las primeras 100 entradas valen $20.000, desde la 101 valen $25.000, y el mismo día del evento cuestan $30.000 en la puerta. Mientras antes compres, menos pagas.',
      ],
      [
        '¿Cómo pago?',
        'Eliges tu entrada, dejas tu nombre y correo, y te la reservamos al tiro. Después pagas con Fintoc: eliges tu banco y apruebas la transferencia sin salir de la página. Si tu banco no aparece o algo falla, puedes transferir por tu cuenta y subir la captura del comprobante. Apenas se confirma el pago, tu entrada con QR aparece en pantalla y te llega al correo.',
      ],
      [
        '¿Cuándo y a qué hora es?',
        'Jueves 19 de noviembre de 2026. Las puertas abren a las 20:00 y la fiesta va hasta las 04:00.',
      ],
      [
        '¿Dónde es?',
        'En un recinto privado en Talca, Región del Maule. La dirección exacta no se publica: te llega junto con tu entrada, en tu correo de confirmación y en tu página de entrada, con el enlace a Google Maps. Es parte de lo que mantiene la fiesta privada, así que te pedimos no compartirla.',
      ],
      [
        '¿Qué música suena?',
        'La noche parte en deep house, sigue en house, sube a tech house y cierra en reggaetón. Los nombres del line-up se van confirmando a medida que se acerca la fecha.',
      ],
      [
        '¿Cómo entro el día del evento?',
        'Con el código QR que recibiste por correo, en el teléfono o impreso. En la puerta lo escaneamos y listo. Cada entrada es personal, nominal y el QR sirve una sola vez: si se lo pasas a alguien, esa persona entra y tú te quedas afuera.',
      ],
      [
        '¿Puedo comprar en la puerta?',
        'Sí, pero solo si quedan cupos de los 200 y si estás en la lista de invitados. En la puerta la entrada cuesta $30.000. Como el aforo es reducido, conviene asegurar el cupo antes.',
      ],
      [
        '¿Hay edad mínima y derecho de admisión?',
        'La fiesta es solo para mayores de 18 años y se verifica con cédula en la puerta. La organización se reserva el derecho de admisión y permanencia: no se permite el ingreso ni la permanencia, sin derecho a reembolso, a quien tenga conductas agresivas, moleste a otros asistentes o esté en un estado que ponga en riesgo la seguridad común.',
      ],
      [
        '¿Quién responde por accidentes o cosas perdidas?',
        'SOMOS es una reunión privada, autogestionada y sin fines de lucro: lo que se recauda cubre producción y técnica. Cada asistente asume su propia seguridad, su consumo y sus pertenencias. La organización no se hace responsable por lesiones o accidentes derivados de la imprudencia propia o de terceros, ni por la pérdida, robo o daño de objetos personales, vehículos o vestuario. Al comprar tu entrada aceptas estas condiciones; están completas en /terminos.',
      ],
    ];

    await prisma.preguntaFrecuente.createMany({
      data: preguntas.map(([texto, respuesta], i) => ({
        preguntaEventoId: evento.eventoId,
        preguntaTexto: texto,
        preguntaRespuesta: respuesta,
        preguntaOrden: i + 1,
        createdBy: USUARIO_SISTEMA_ID,
      })),
    });
    console.log(`  · preguntas frecuentes: ${preguntas.length}`);
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
