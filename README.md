# Frontend Agua (Capacitor + Vite)

## Requisitos
- Node.js 18+ y npm
- Android Studio instalado con el SDK y Java 17

## Configuracion de API (web vs APK)
Variables en `.env`:
- `VITE_API_BASE_URL`: URL para la version web.
- `VITE_API_BASE_URL_NATIVE`: URL para APK (si no se define, usa `VITE_API_BASE_URL`).

Ejemplos:
- Emulador Android: `http://10.0.2.2:8000`
- Dispositivo en red local: `http://<IP_DEL_SERVIDOR>:8000`

## Flujo para generar APK con Android Studio
1. Instalar dependencias:
   `npm install`
2. Generar build web y sincronizar con Android:
   `npm run android:build`
3. Abrir el proyecto Android en Android Studio:
   `npm run android:open`
4. En Android Studio:
   - Espera a que sincronice Gradle.
   - Instala el SDK que te solicite (si aplica).
   - Build > Build Bundle(s) / APK(s) > Build APK(s).

## APK (un solo archivo)
Comando directo para generar un solo APK (release) y copiarlo a `dist_apk/`:
- `npm run android:apk`

## APK Release (firmado)
Para generar un APK release necesitas un keystore:
1. Crea tu keystore con Android Studio o keytool.
2. Copia `android/keystore.properties.example` a `android/keystore.properties`
3. Edita `android/keystore.properties` con los valores reales.
4. Vuelve a sincronizar y genera el APK release desde Android Studio.

Notas:
- `android/keystore.properties` no se sube al repo.
- `android/app/src/main/assets/public` se genera con `npm run android:build`.
