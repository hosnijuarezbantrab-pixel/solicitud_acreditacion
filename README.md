# Bantrab Accionistas — Backend NestJS

Backend del Sistema de Accionistas de Banco de los Trabajadores (BANTRAB).

Migración de lógica de negocio desde Oracle Forms (ACCFRM0803 / ACCFRM0081 / ACCFRM0080) a NestJS + Oracle 19c.

---

## Arquitectura

```
bantrab-accionistas-backend/
└── src/
    ├── common/                    # Utilidades transversales
    │   ├── filters/               # HttpExceptionFilter — errores estandarizados
    │   ├── guards/                # ApiKeyGuard — autenticación X-Api-Key
    │   ├── interceptors/          # ResponseInterceptor — envelope { ok, data }
    │   └── decorators/            # @UsuarioActual(), @IpCliente()
    │
    ├── database/
    │   └── redis.module.ts        # Cliente Redis global (keyPrefix: bantrab:acc:)
    │
    └── modules/
        ├── accionistas/           # ACCFRM0803 — Consulta y actualización de accionistas
        │   ├── entities/          # AC.ACCACCIONISTA
        │   ├── dto/               # BuscarPorDpiDto, ActualizarDatosEditablesDto
        │   ├── accionistas.service.ts   # buscarPorDpi, vigencia, actualizarDatos
        │   └── accionistas.controller.ts
        │
        ├── asambleas/             # Consulta de AC.ACCASAMBLEA_ACTUAL
        │   ├── entities/          # AsambleaActual
        │   ├── asambleas.service.ts     # getActivas, validarPeriodo, enRango*
        │   └── asambleas.controller.ts  # GET /activas
        │
        ├── acreditacion/          # ACCFRM0081 — Acreditación múltiple
        │   ├── entities/          # Accasamblea, AccasambleaHis, ExpedienteSecuencia, AccDetinversion
        │   ├── dto/               # RegistrarAcreditacionDto, ActualizarExpedienteDto, ...
        │   ├── services/
        │   │   └── correlativo.service.ts  # SELECT FOR UPDATE — sin huecos garantizado
        │   ├── acreditacion.service.ts     # P_REGISTRO_ASAMBLEA_NUEVO completo
        │   └── acreditacion.controller.ts
        │
        ├── expedientes/           # ACCFRM0080 — Gestión de expediente individual
        │   ├── expedientes.service.ts     # R8, R9, R10, R11
        │   └── expedientes.controller.ts
        │
        └── firma-integration/     # Integración con microservicio firma-accionistas-backend
            ├── dto/               # GenerarTokenFirmaDto, ConsultarTokenDto
            ├── firma-integration.service.ts    # Cliente HTTP (axios) hacia el microservicio
            └── firma-integration.controller.ts # POST /token, GET /token/:t/estado, GET /imagen/:id
```

---

## Módulos y equivalencias Oracle Forms

| Módulo NestJS | Forma Oracle | Procedimiento principal |
|---|---|---|
| `AccionistasModule` | ACCFRM0803 | `F_VERIFICA_ESTADO_ACC`, `ac_fnc_meses_vencimiento_act` |
| `AsambleasModule` | ACCFRM0081 | `P_LLENA_ASAMBLEAS`, cursor C1 de `PRC_INSERTA_ASAMBLEA_C` |
| `AcreditacionModule` | ACCFRM0081 | `P_REGISTRO_ASAMBLEA_NUEVO` → `PRC_INSERTA_ASAMBLEA_C` |
| `CorrelativoService` | Oracle Forms | `ACC_EXPEDIENTE_NUEVO` (reemplazado con SELECT FOR UPDATE) |
| `ExpedientesModule` | ACCFRM0080 | R8 BTT_ASOCIAR, R9 BTT_EXPEDIENTE, R10 BTN_CREDENCIAL, R11 ITEM538 |
| `FirmaIntegrationModule` | — | Cliente HTTP hacia `firma-accionistas-backend` |

---

## Generación de correlativos sin huecos

La lógica de `ACC_EXPEDIENTE_NUEVO` (Oracle) fue reemplazada por `CorrelativoService`:

```
TX_INICIO
  ├─ SELECT FOR UPDATE → bloquea fila ACC_EXPEDIENTES_ASAMBLEA
  │    (transacciones concurrentes ESPERAN aquí)
  ├─ UPDATE correlativo = correlativo + 1
  └─ INSERT AC.ACCASAMBLEA (expediente = correlativo)
TX_COMMIT → libera lock + confirma ambas operaciones
```

Si cualquier paso falla → ROLLBACK automático → el número nunca existió → sin huecos.

---

## Integración con módulo de firma

```
Frontend                 Backend (este)              Microservicio Firma
─────────────────────────────────────────────────────────────────────────
POST /firma/token   →   FirmaIntegrationService  →  GET /generar-token
                         (X-Core-Key)
                    ←   { token, expiresAt }     ←  token generado

[accionista ingresa código en tablet]
POST verificar-token ────────────────────────────►  POST /verificar-token
(X-Tablet-Key, directo)                         ←  { verificado, datos }

[accionista firma]
POST guardar-firma ──────────────────────────────►  POST /guardar-firma
(X-Tablet-Key, directo)                         ←  { idFirma }

GET /firma/imagen/:id ──► FirmaIntegrationService → GET /firma/:id
```

---

## Variables de entorno

Ver `.env.example`. Las principales:

| Variable | Descripción | Default |
|---|---|---|
| `DB_HOST` | Host Oracle | `localhost` |
| `DB_SID` | SID Oracle | `ORCL` |
| `MESES_VIGENCIA_ACCIONISTA` | Meses máx. sin actualizar datos | `18` |
| `DB_LOCK_TIMEOUT_MS` | Timeout SELECT FOR UPDATE | `10000` |
| `FIRMA_SERVICE_URL` | URL del microservicio de firma | `http://localhost:3002` |
| `FIRMA_CORE_API_KEY` | X-Core-Key para el microservicio | — |
| `API_KEY_FRONTEND` | X-Api-Key para este backend | — |

---

## Instalación y ejecución

```bash
npm install
cp .env.example .env
# Editar .env con valores reales

npm run start:dev     # Desarrollo con hot-reload
npm run build         # Compilar para producción
npm run start         # Producción
```

---

## Endpoints

### Accionistas
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/accionistas/buscar?dpi=` | Búsqueda por DPI (ACCFRM0803) |
| GET | `/api/v1/accionistas/:id` | Búsqueda por código |
| PATCH | `/api/v1/accionistas/:id/datos-editables` | Actualizar contacto y dirección |

### Asambleas
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/asambleas/activas` | Lista asambleas con Estado='S' e indicadores de período |

### Acreditación (ACCFRM0081)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/v1/acreditacion` | Registra acreditación en todas las asambleas activas |
| GET | `/api/v1/acreditacion/:accionista` | Lista expedientes del accionista |
| GET | `/api/v1/acreditacion/:ta/:asamblea/:acc/:tipoDoc` | Expediente individual (ACCFRM0080 POST-QUERY) |
| PATCH | `/api/v1/acreditacion/:ta/:asamblea/:exp/:tipoDoc` | Actualiza expediente (ACCFRM0080 PRE-UPDATE) |
| GET | `/api/v1/acreditacion/validar/:ta/:asamblea/:acc` | Verifica duplicado (ACC_VALIDA_ACCIONISTA) |

### Expedientes (ACCFRM0080)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/v1/expedientes/:ta/:asamblea/:exp/:td/imprimir-formulario` | R9 BTT_EXPEDIENTE |
| POST | `/api/v1/expedientes/:ta/:asamblea/:exp/:td/imprimir-credencial` | R10 BTN_CREDENCIAL |
| POST | `/api/v1/expedientes/:ta/:asamblea/:exp/:td/motivo-rechazo` | R11 ITEM538 |
| GET | `/api/v1/expedientes/:ta/:asamblea/:exp/:td/validar-asociacion/:tipo` | R8 BTT_ASOCIAR |

### Firma
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/v1/firma/token` | Genera OTP de 6 dígitos vía microservicio de firma |
| GET | `/api/v1/firma/token/:token/estado` | Consulta estado del token |
| GET | `/api/v1/firma/imagen/:id` | Recupera imagen de rúbrica |
| GET | `/api/v1/firma/health` | Health check del microservicio |

---

## Reglas de negocio implementadas

### ACCFRM0080 — Expediente individual
| Regla | Trigger Oracle | Implementación NestJS |
|---|---|---|
| R2 | `ESTADO_EXPEDIENTE.KEY-NEXT-ITEM` | `ActualizarExpedienteDto.autorizaUltimoEstado` + histórico |
| R4 | `CHECK_CREDENCIAL.WHEN-CHECKBOX-CHANGED` | `checkCredencial → fechaCredencial` |
| R5 | `CHECK_FEC_RECIBIDO.WHEN-CHECKBOX-CHANGED` | Validación estado = 2 (error 221) |
| R6 | `CHECK_FEC_ENTREGADO.WHEN-CHECKBOX-CHANGED` | `checkFecEntregado → fechaEntrega` |
| R8 | `BTT_ASOCIAR1/2.WHEN-BUTTON-PRESSED` | `validarAsociarVotos()` errores 160 y 114 |
| R9 | `BTT_EXPEDIENTE.WHEN-BUTTON-PRESSED` | `imprimirFormularioConstancia()` vigencia + 1→2 |
| R10 | `BTN_CREDENCIAL.WHEN-BUTTON-PRESSED` | `imprimirCredencial()` 3 escenarios (701/702/703) |
| R11 | `ITEM538.WHEN-BUTTON-PRESSED` | `registrarMotivoRechazo()` errores 704/705/708/709 |
| R13 | `PRE-UPDATE` | histórico si estado cambia a 2 |
| R14 | `POST-QUERY` | `totalVotos`, checks sincronizados |
# solicitud_acreditacion
