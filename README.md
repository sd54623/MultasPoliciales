# Buscador de multas (con cuentas y suscripciones)

La página es estática (sirve para GitHub Pages). Las cuentas, las multas y los vencimientos viven en **Firebase** (gratis, plan Spark). Las reglas de `firestore.rules` hacen que **el servidor** niegue las multas a quien no tenga suscripción activa o ya venció, aunque abra la consola del navegador.

## Configuración (una sola vez)

1. Entra a <https://console.firebase.google.com> → **Crear proyecto**.
2. **Authentication** → *Comenzar* → *Sign-in method* → activa **Correo electrónico/contraseña**.
3. **Firestore Database** → *Crear base de datos* (modo producción) → pestaña **Reglas** → pega todo `firestore.rules` → **Publicar**.
4. **Configuración del proyecto (⚙️)** → *Tus apps* → icono web `</>` → registra la app y copia los datos en `firebase-config.js`.
5. **Authentication → Configuración → Dominios autorizados** → agrega `TUUSUARIO.github.io` (o tu dominio).
6. Sube la carpeta a GitHub y activa **Settings → Pages**.
7. **Hazte admin:** abre tu página → *Crear cuenta* con tu correo. Luego en Firebase: *Authentication → Users*, copia tu **UID**. En *Firestore* crea la colección `admins` con un documento cuyo **ID sea tu UID** y un campo cualquiera (ej. `activo` = `true`). Recarga la página: verás la etiqueta **Admin**.
8. Entra como admin → pega el contenido de `datos-iniciales.txt` en el cuadro y pulsa **Reemplazar todo**.

> `datos-iniciales.txt` está en `.gitignore` para que las multas **no queden públicas** en GitHub. Las multas solo existen en Firebase.

## Acceso con código de servicio (cuenta + código de un solo uso)

Para ver las multas hace falta **las dos cosas**: iniciar sesión con tu cuenta **y** poner el código que te manda el bot de Discord.

1. En Discord pulsas **Programar** y pones los minutos (1 a 60). El bot te manda un código por privado (`XXXX-XXXX-XXXX`).
2. En la página inicias sesión y escribes el código. Se marca como usado: **nadie más puede usarlo**.
3. El código vale **solo los minutos que programaste**. La página muestra la cuenta regresiva.
4. La sesión se cierra sola (y se vuelven a pedir cuenta y código) cuando:
   - se acaba el tiempo,
   - pulsas **Salir** en Discord,
   - el bot te expulsa por estar en invisible.
5. Si recargas la página con el código aún vigente, entras sin gastar otro código.
6. El admin entra solo con su cuenta (sin código).

### Poner a funcionar el bot

El bot completo está en la carpeta `bot/` (panel, rol de servicio, códigos, auto-cierre, invisible). Sigue **`bot/README.md`**: token, ID del bot, ID del servidor, ID del rol de servicio y la clave de Firebase. Después publica de nuevo `firestore.rules` (pestaña Reglas de Firestore).

### Cómo está protegido

- Las reglas de `firestore.rules` comprueban **en el servidor** que el código sea tuyo, esté activo y no haya vencido en cada lectura de las multas.
- El código real no se guarda: Firestore solo guarda su hash (SHA-256).
- Si dos personas intentan canjear el mismo código a la vez, solo una lo logra.
- Límite: lo que ya está cargado en la pantalla de alguien no se puede borrar de su navegador a distancia; lo que sí se corta es el acceso a nuevas lecturas y la página se cierra.

## Uso diario

- La gente se registra con **Crear cuenta**; el acceso a las multas lo da el código del bot.
- Solo el admin ve el editor (agregar / reemplazar / borrar). Los demás solo buscan.
