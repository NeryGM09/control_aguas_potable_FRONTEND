# Frontend Agua (Capacitor + Vite)

Aplicacion frontend para control de agua potable con salida web y APK Android.

## Que incluye este repositorio
- Codigo fuente del frontend en `src/`
- Proyecto Android de Capacitor en `android/`
- Configuracion Docker para publicar el frontend y proxyear `/api`
- Script para generar APK en `scripts/build-apk.ps1`
- Carpeta `Instalador_apk/` para conservar el APK oficial que entrega la empresa

## Requisitos
- Node.js 20+ y npm
- Android Studio con Android SDK y Java 17
- Docker Desktop (opcional, para levantar la version web en contenedores)
- Repositorio backend `API_CATV` disponible si se usara `docker-compose.yml`

## Variables de entorno
Este repo incluye `.env.example`. Crea tu `.env` a partir de ese archivo y ajusta solo lo necesario.

Variables principales:
- `VITE_API_BASE_URL`: base URL para la web. El valor `"/"` funciona con el proxy de Vite y con Nginx.
- `VITE_API_BASE_URL_NATIVE`: base URL para Android / Capacitor.
- `VITE_API_TIMEOUT`: timeout de llamadas API en milisegundos.
- `VITE_LOGO_TRESVALLES_URL`, `VITE_LOGO_CHUMBAGUA_URL`, `VITE_LOGO_DEFAULT_URL`: logos remotos opcionales.

Ejemplos utiles:
- Web local con Vite proxy: `VITE_API_BASE_URL=/`
- Android emulador: `VITE_API_BASE_URL_NATIVE=http://10.0.2.2:8000`
- Android dispositivo fisico: `VITE_API_BASE_URL_NATIVE=http://<IP_DEL_SERVIDOR>:8000`
- API remota: `VITE_API_BASE_URL=https://api-catv.tresvalles.hn`

## Desarrollo web local
1. Instala dependencias con `npm install`.
2. Crea `.env` a partir de `.env.example`.
3. Ejecuta `npm run dev`.
4. Abre la URL que muestra Vite.

Notas:
- En desarrollo, `vite.config.js` ya proxyea `/api` hacia `http://localhost:8000`.
- `npm run build` genera la salida de produccion en `dist/`.

## Scripts disponibles
- `npm run dev`: servidor de desarrollo Vite.
- `npm run build`: build web de produccion.
- `npm run preview`: vista previa local del build.
- `npm run docker:validate`: valida la configuracion minima para Docker.
- `npm run android:sync`: sincroniza Capacitor con Android.
- `npm run android:build`: genera `dist/` y sincroniza Android.
- `npm run android:open`: abre el proyecto Android Studio.
- `npm run android:apk`: genera el APK release y lo copia a `dist_apk/`.

## Docker
`docker-compose.yml` esta pensado para levantar frontend + backend juntos.

Antes de ejecutar Docker:
1. Ten clonado el backend `API_CATV`.
2. Si el backend no esta en `../API_CATV`, define estas variables en tu consola o en un archivo `.env` de Compose:
   - `API_CATV_ROOT`: ruta al repositorio backend.
   - `API_CATV_ENV_FILE`: ruta al `.env` del backend.
3. Ejecuta `npm run docker:validate`.
4. Levanta el stack con `docker compose up --build`.

Comportamiento esperado:
- El frontend queda en `http://localhost:8080`.
- Las llamadas web a `/api/...` salen por Nginx hacia el servicio `api-catv`.
- Si necesitas que el frontend apunte a una API remota, sobreescribe `VITE_API_BASE_URL` al construir el contenedor.

## Android y APK
Flujo recomendado:
1. `npm install`
2. `npm run android:build`
3. `npm run android:open`
4. En Android Studio, espera la sincronizacion de Gradle y genera el APK.

Atajos:
- `npm run android:apk` genera el APK y copia la salida a `dist_apk/control_aguas_release.apk`.

Archivos importantes:
- `Instalador_apk/` debe conservar el APK empresarial que se comparte internamente.
- `android/app/src/main/assets/public/` se regenera con `npm run android:build`.

## Firma de release
Para generar una release firmada:
1. Copia `android/keystore.properties.example` a `android/keystore.properties`.
2. Completa los datos reales del keystore.
3. Asegurate de tener el archivo `.jks` o `.keystore` fuera del repositorio o en una ruta controlada.
4. Genera la build desde Android Studio o con el flujo release del proyecto.

## Que no se sube al repo
No se versionan:
- `.env`
- `node_modules/`
- `dist/`
- `android/build/` y `android/app/build/`
- `.idea/`
- `android/local.properties`
- certificados y keystores

Si alguien descarga este repositorio, deberia poder:
- instalar dependencias
- configurar su `.env`
- levantar la web
- sincronizar Android
- generar una APK
- encontrar el APK corporativo dentro de `Instalador_apk/`
