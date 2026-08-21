import type { Etapa, EtapaVigente } from './etapas';

/**
 * Modo vitrina: la landing sin base de datos.
 *
 * Sirve para publicar la portada como sitio estatico (GitHub Pages) y que la
 * gente pueda verla sin levantar Postgres ni exponer datos reales. Cuando
 * MODO_VITRINA esta encendido, las funciones de datos devuelven este contenido
 * de muestra en vez de consultar la base.
 *
 * La portada es exactamente la misma: no hay una copia del diseño para la
 * demo. Lo unico que cambia es de donde salen los datos.
 */
export const MODO_VITRINA = process.env.MODO_VITRINA === '1';

/** Fecha de muestra: siempre unos meses adelante, para que la cuenta regresiva
 *  tenga sentido en cualquier momento en que se reconstruya el sitio. */
function fechaDeMuestra(): Date {
  const d = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  d.setHours(23, 0, 0, 0);
  return d;
}

const AHORA = new Date();
const auditoria = {
  createdBy: 1,
  createdAt: AHORA,
  modifiedBy: null,
  modifiedAt: AHORA,
};

export function eventoDeVitrina() {
  const eventoId = 1;

  return {
    eventoId,
    eventoSlug: 'somos',
    eventoNombre: 'SOMOS',
    eventoLema: 'Una noche, una pista, la gente de siempre.',
    eventoDescripcion:
      'Compras tu entrada acá mismo y la pagas por transferencia. Apenas se confirma el pago te llega tu QR al correo.',
    eventoFechaInicio: fechaDeMuestra(),
    eventoFechaTermino: null,
    eventoVenue: 'Por confirmar',
    eventoDireccion: null,
    eventoCiudad: 'Talca',
    eventoRegion: 'Maule',
    eventoMapaUrl: null,
    eventoCapacidad: 200,
    eventoEstado: 'publicado',
    eventoInstagram: 'somos.cl',
    eventoWhatsapp: null,
    eventoTenpoNombre: null,
    eventoTenpoRut: null,
    eventoTenpoCorreo: null,
    eventoTenpoBanco: null,
    eventoTenpoTipoCuenta: null,
    eventoTenpoCuenta: null,
    eventoTenpoQrUrl: null,
    ...auditoria,
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,

    tiposEntrada: [
      {
        tipoEntradaId: 1,
        tipoEntradaEventoId: eventoId,
        tipoEntradaNombre: 'General',
        tipoEntradaSlug: 'general',
        tipoEntradaDescripcion: 'Acceso al recinto durante toda la noche.',
        tipoEntradaPrecio: 20000,
        tipoEntradaCupo: 200,
        tipoEntradaOrden: 1,
        tipoEntradaActivo: true,
        tipoEntradaColor: 'cyan',
        ...auditoria,
      },
    ],

    artistas: [
      {
        artistaId: 1,
        artistaEventoId: eventoId,
        artistaNombre: 'Por anunciar',
        artistaGenero: 'Techno',
        artistaDescripcion: 'El line-up se revela más cerca de la fecha.',
        artistaHoraInicio: null,
        artistaHoraTermino: null,
        artistaInstagram: null,
        artistaImagenUrl: null,
        artistaOrden: 1,
        artistaDestacado: true,
        artistaActivo: true,
        ...auditoria,
      },
    ],

    preguntas: [
      {
        preguntaId: 1,
        preguntaEventoId: eventoId,
        preguntaTexto: '¿Cualquiera puede comprar?',
        preguntaRespuesta:
          'No. SOMOS es una fiesta privada: solo compra quien está en la lista de invitados. ' +
          'Verificamos con tu número de teléfono al momento de comprar.',
        preguntaOrden: 1,
        preguntaActiva: true,
        ...auditoria,
      },
      {
        preguntaId: 2,
        preguntaEventoId: eventoId,
        preguntaTexto: '¿Cuántas entradas puedo sacar?',
        preguntaRespuesta:
          'Hasta dos por número de teléfono: la tuya y la de alguien que traigas. ' +
          'Cada entrada va a nombre de una persona y con su propio correo.',
        preguntaOrden: 2,
        preguntaActiva: true,
        ...auditoria,
      },
      {
        preguntaId: 3,
        preguntaEventoId: eventoId,
        preguntaTexto: '¿Por qué sube el precio?',
        preguntaRespuesta:
          'Las primeras 100 entradas valen $20.000, después suben a $25.000, y el mismo día ' +
          'del evento cuestan $30.000 en la puerta. Mientras antes compres, menos pagas.',
        preguntaOrden: 3,
        preguntaActiva: true,
        ...auditoria,
      },
      {
        preguntaId: 4,
        preguntaEventoId: eventoId,
        preguntaTexto: '¿Puedo pasarle mi entrada a otra persona?',
        preguntaRespuesta:
          'No. El QR se quema al entrar y sirve una sola vez, así que no se puede compartir ni reutilizar.',
        preguntaOrden: 4,
        preguntaActiva: true,
        ...auditoria,
      },
    ],
  };
}

/** Cuantas entradas van tomadas, para que la demo no se vea en cero. */
export const CUPOS_VITRINA = new Map<number, number>([[1, 37]]);

export const ETAPAS_VITRINA: Etapa[] = [
  { etapaId: 1, nombre: 'Primera tanda', precio: 20000, cupo: 100, orden: 1, enPuerta: false },
  { etapaId: 2, nombre: 'Segunda tanda', precio: 25000, cupo: null, orden: 2, enPuerta: false },
  { etapaId: 3, nombre: 'En puerta', precio: 30000, cupo: null, orden: 3, enPuerta: true },
];

export const ETAPA_VIGENTE_VITRINA: EtapaVigente = {
  etapaId: 1,
  nombre: 'Primera tanda',
  precio: 20000,
  cupo: 100,
  restantes: 63,
  enPuerta: false,
  vendidas: 37,
};
