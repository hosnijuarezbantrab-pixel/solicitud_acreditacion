-- ============================================================
--  DDL — Bantrab Accionistas Backend
--  Tablas propias del backend (no son las tablas core de Oracle Forms)
--  Las tablas del core (ACCASAMBLEA, ACCACCIONISTA, etc.) ya existen
--  en el schema AC y no se modifican.
-- ============================================================

-- ── Tabla de control de correlativos ─────────────────────────
-- Ya existe como AC.ACC_EXPEDIENTES_ASAMBLEA en el schema Oracle.
-- Se incluye como referencia; NO ejecutar si ya existe.
/*
CREATE TABLE AC.ACC_EXPEDIENTES_ASAMBLEA (
  TIPO_ASAMBLEA   VARCHAR2(1)   NOT NULL,
  ASAMBLEA        VARCHAR2(10)  NOT NULL,
  CORRELATIVO     NUMBER(38),
  TIPO_DOCEMITIDO NUMBER(5)     NOT NULL,
  CONSTRAINT PK_EXPEDIENTES PRIMARY KEY (TIPO_ASAMBLEA, ASAMBLEA, TIPO_DOCEMITIDO, CORRELATIVO)
);
*/

-- ── Tabla de tokens OTP de firma (si no usa el microservicio externo) ────────
-- Solo crear si este backend gestiona los tokens directamente.
-- Si se usa el microservicio firma-accionistas-backend, esta tabla ya existe allí.
/*
CREATE TABLE TOKENS_FIRMA (
  ID_TOKEN          NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  TOKEN             VARCHAR2(6)    NOT NULL,
  SOLICITUD_ID      VARCHAR2(50)   NOT NULL,
  ACCIONISTA_ID     VARCHAR2(50)   NOT NULL,
  ESTADO            VARCHAR2(20)   DEFAULT 'ACTIVO' NOT NULL,
  FECHA_CREACION    TIMESTAMP      DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FECHA_EXPIRACION  TIMESTAMP      NOT NULL,
  FECHA_USO         TIMESTAMP,
  IP_GENERACION     VARCHAR2(50),
  CONSTRAINT CHK_TOKEN_ESTADO CHECK (ESTADO IN ('ACTIVO', 'USADO', 'EXPIRADO'))
);

CREATE INDEX IDX_TOKEN_BUSQUEDA   ON TOKENS_FIRMA(TOKEN, ACCIONISTA_ID, ESTADO);
CREATE INDEX IDX_TOKEN_EXPIRACION ON TOKENS_FIRMA(ESTADO, FECHA_EXPIRACION);
CREATE INDEX IDX_TOKEN_ACCIONISTA ON TOKENS_FIRMA(ACCIONISTA_ID, ESTADO);
*/

-- ── Índices adicionales recomendados en tablas existentes ────────────────────
-- Mejoran el rendimiento de búsquedas frecuentes del backend.
-- Validar con DBA antes de aplicar en producción.

-- Para búsqueda por DPI en ACCFRM0803
-- CREATE INDEX IDX_ACC_DPI ON AC.ACCACCIONISTA(NUMERO_DPI);

-- Para búsqueda de expedientes por accionista (listarExpedientesDeAccionista)
-- CREATE INDEX IDX_ACCASM_ACCIONISTA ON AC.ACCASAMBLEA(ACCIONISTA);

-- Para búsqueda de tokens activos (CronJob de expiración, ya existe en microservicio)
-- CREATE INDEX IDX_ACCASM_ESTADO ON AC.ACCASAMBLEA(ESTADO_EXPEDIENTE, TIPO_ASAMBLEA, ASAMBLEA);

-- ── Parámetros del backend en ACC_PARAMETROS_GENERALES ───────────────────────
-- Configuración que el backend puede leer con AC_FNC_OBT_PARAMETRO

-- INSERT INTO AC.ACC_PARAMETROS_GENERALES (ACC_PARAMETRO, ACC_VALOR, ACC_DETALLE, ACC_MODULO)
-- VALUES ('MESES_ACT_ACC', '18', 'Meses máx. sin actualizar datos del accionista', 'ACC');
-- COMMIT;
