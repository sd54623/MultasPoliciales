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

## Uso diario

- La gente se registra con **Crear cuenta** (queda *sin acceso*).
- Tú entras → pestaña **Usuarios** → botones **+24 h / +2 días / +3 días / +7 días / +30 días**, o una cantidad personalizada, o **Quitar acceso**.
- Al vencer el tiempo ven: *"Tu suscripción ha finalizado. Adquiere una nueva para seguir disfrutando de ella."*
- Solo el admin ve el editor (agregar / reemplazar / borrar). Los demás solo buscan.
- Cambia el texto de contacto en `CONTACTO` dentro de `firebase-config.js`.
