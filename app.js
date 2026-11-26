import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const $ = id => document.getElementById(id);
const VISTAS = ["vistaCarga", "vistaConfig", "vistaLogin", "vistaCodigo", "vistaApp"];
const ver = id => VISTAS.forEach(v => { $(v).hidden = v !== id; });

const texto = $("texto"), estado = $("estado"), campo = $("busqueda");
const contador = $("contador"), resultados = $("resultados");

/* ───────────── Búsqueda (misma lógica de siempre) ───────────── */

// Cada línea con contenido cuenta; las líneas de ━━━ y ═══ solo decoran
const separar = t => t.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

let lineas = [];

// Quita tildes y mayúsculas: "semaforo" encuentra "semáforo"
const limpiar = t => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const escapar = t => String(t).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function resaltar(t, palabras) {
  const base = limpiar(t), rangos = [];
  palabras.forEach(p => {
    let i = base.indexOf(p);
    while (i !== -1) { rangos.push([i, i + p.length]); i = base.indexOf(p, i + p.length); }
  });
  rangos.sort((a, b) => a[0] - b[0]);
  let out = "", pos = 0;
  rangos.forEach(([a, b]) => {
    if (a < pos) return;
    out += escapar(t.slice(pos, a)) + "<mark>" + escapar(t.slice(a, b)) + "</mark>";
    pos = b;
  });
  return out + escapar(t.slice(pos));
}

// Convierte las líneas en secciones: [{tema, titulo, multas:[...]}]
function armarSecciones(ls) {
  const secs = [];
  let tema = "", actual = null, esperandoTema = false;
  const nueva = titulo => { actual = { tema, titulo, multas: [] }; secs.push(actual); };
  ls.forEach(l => {
    if (/^═+$/.test(l)) { esperandoTema = !esperandoTema ? true : false; return; }
    if (esperandoTema) { tema = l; esperandoTema = true; return; }
    if (/^━+$/.test(l)) return;
    const m = l.match(/^━+\s*(.+?)\s*━+$/);
    if (m) { nueva(m[1]); return; }
    if (l.includes("→") || l.includes("RD$")) {
      if (!actual) nueva("Sin sección");
      actual.multas.push(l);
    } else nueva(l);
  });
  return secs.filter(s => s.multas.length);
}

function multaHTML(l, palabras, clase) {
  const i = l.indexOf("→");
  const cuerpo = i === -1
    ? resaltar(l, palabras)
    : `<span class="desc">${resaltar(l.slice(0, i).trim(), palabras)}</span><strong class="precio">${resaltar(l.slice(i + 1).trim(), palabras)}</strong>`;
  return `<article class="multa ${clase}">${cuerpo}</article>`;
}

function mostrar() {
  const palabras = limpiar(campo.value).split(/\s+/).filter(Boolean);

  if (lineas.length === 0) {
    contador.textContent = "";
    resultados.innerHTML = esAdmin
      ? '<div class="vacio">Todavía no hay texto. Pega tus multas arriba y pulsa "Agregar al buscador".</div>'
      : '<div class="vacio">Todavía no hay multas cargadas.</div>';
    return;
  }

  const secciones = armarSecciones(lineas);
  const coincide = t => { const b = limpiar(t); return palabras.every(p => b.includes(p)); };

  // Sin búsqueda: todo, agrupado por sección
  if (palabras.length === 0) {
    const total = secciones.reduce((n, s) => n + s.multas.length, 0);
    contador.textContent = `Mostrando todas (${total} multas en ${secciones.length} secciones)`;
    resultados.innerHTML = secciones.map(s => grupoHTML(s, palabras, false, s.multas, [])).join("");
    return;
  }

  // Con búsqueda: primero las secciones cuyo título coincide, luego las que solo tienen la multa
  const grupos = secciones.map(s => {
    const porTitulo = coincide(s.titulo);
    const exactas = s.multas.filter(coincide);
    return { s, porTitulo, exactas };
  }).filter(g => g.porTitulo || g.exactas.length);

  grupos.sort((a, b) => Number(b.porTitulo) - Number(a.porTitulo));

  const nSec = grupos.length;
  contador.textContent = nSec === 0 ? "" : `${nSec} ${nSec === 1 ? "sección" : "secciones"} con "${campo.value.trim()}"`;

  resultados.innerHTML = nSec === 0
    ? '<div class="vacio">Ninguna sección ni multa coincide con esa palabra. Prueba con otra.</div>'
    : grupos.map(g => {
        if (g.porTitulo) return grupoHTML(g.s, palabras, true, g.s.multas, []);
        const resto = g.s.multas.filter(m => !g.exactas.includes(m));
        return grupoHTML(g.s, palabras, false, g.exactas, resto);
      }).join("");
}

function grupoHTML(s, palabras, porTitulo, primeras, resto) {
  const tema = s.tema ? `<span class="tema">${escapar(s.tema)}</span>` : "";
  const buscando = palabras.length > 0;
  const claseP = buscando && !porTitulo ? "hit" : "";
  let html = `<section class="grupo"><header class="seccion">${tema}<h3>${resaltar(s.titulo, palabras)}</h3></header>`;
  html += primeras.map(m => multaHTML(m, palabras, claseP)).join("");
  if (resto.length) {
    html += `<p class="resto-titulo">Otras multas de esta sección</p>`;
    html += resto.map(m => multaHTML(m, [], "resto")).join("");
  }
  return html + "</section>";
}

campo.addEventListener("input", mostrar);
$("formulario").addEventListener("submit", e => { e.preventDefault(); mostrar(); });

/* ───────────── Firebase ───────────── */

if (String(firebaseConfig.apiKey).startsWith("PEGA")) {
  ver("vistaConfig");
  throw new Error("Falta configurar firebase-config.js");
}

const fb = initializeApp(firebaseConfig);
const auth = getAuth(fb);
const db = getFirestore(fb);

let usuario = null, esAdmin = false;
let sesion = null;                       // { expiraEn: Date } mientras el código esté vigente
let desCodigo = null, desDatos = null, reloj = null;
let avisoLogin = "";                     // mensaje que se muestra al volver al login

const AVISOS = {
  tiempo: "Tu servicio terminó: se cumplió el tiempo de tu código.",
  salida: "Saliste de servicio, así que tu código dejó de funcionar.",
  invisible: "Tu servicio fue removido porque estabas en invisible.",
  error: "Tu acceso ya no es válido. Pide un código nuevo en Discord."
};

// Mismo cálculo que hace el bot: SHA-256 del código en MAYÚSCULAS y sin guiones
const normalizarCodigo = t => t.toUpperCase().replace(/[^A-Z0-9]/g, "");
async function sha256(t) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}

const cuenta = ms => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function errorTexto(e) {
  const c = e && e.code || "";
  if (/invalid-email/.test(c)) return "El correo no es válido.";
  if (/(invalid-credential|wrong-password|user-not-found|invalid-login)/.test(c)) return "Correo o contraseña incorrectos.";
  if (/email-already-in-use/.test(c)) return "Ya existe una cuenta con ese correo.";
  if (/weak-password/.test(c)) return "La contraseña debe tener al menos 6 caracteres.";
  if (/too-many-requests/.test(c)) return "Demasiados intentos. Espera un momento.";
  if (/network/.test(c)) return "Sin conexión. Revisa tu internet.";
  if (/permission-denied/.test(c)) return "No tienes permiso para hacer eso.";
  return "Ocurrió un error. Intenta de nuevo.";
}

function limpiarSesion() {
  if (desCodigo) desCodigo();
  if (desDatos) desDatos();
  desCodigo = desDatos = null;
  clearInterval(reloj); reloj = null;
  lineas = []; esAdmin = false; sesion = null;
  resultados.innerHTML = ""; contador.textContent = ""; campo.value = "";
}

onAuthStateChanged(auth, async user => {
  limpiarSesion();
  usuario = user;
  if (!user) {
    $("barra").hidden = true;
    ver("vistaLogin");
    $("estadoAuth").textContent = avisoLogin; avisoLogin = "";
    return;
  }

  ver("vistaCarga");
  $("barra").hidden = false;
  $("quien").textContent = user.email;
  $("chip").textContent = "";
  $("chip").className = "chip";

  let admin = false;
  try { admin = (await getDoc(doc(db, "admins", user.uid))).exists(); } catch { admin = false; }
  if (usuario !== user) return; // cambió la sesión mientras esperábamos
  esAdmin = admin;

  if (esAdmin) { mostrarApp(); abrirDatos(); return; }
  retomarSesion(user);
});

/* ───────────── Código de servicio ───────────── */

const codigoVigente = (d, uid) =>
  !!d && d.usadoPor === uid && d.estado === "activo" && d.expiraEn && d.expiraEn.toDate() > new Date();

// Si recargas la página y tu código sigue vigente, entras directo (sin gastar otro código)
async function retomarSesion(user) {
  try {
    const s = await getDoc(doc(db, "sesiones", user.uid));
    if (s.exists()) {
      const c = await getDoc(doc(db, "codigos", s.data().codigo));
      if (usuario !== user) return;
      if (c.exists() && codigoVigente(c.data(), user.uid)) { entrarConCodigo(s.data().codigo); return; }
    }
  } catch { /* sin sesión previa */ }
  if (usuario !== user) return;
  ver("vistaCodigo");
  $("codigo").focus();
}

// Vigila el código en tiempo real: si el bot lo revoca (saliste, invisible, se acabó el tiempo)
// la página se cierra al instante.
function entrarConCodigo(hash) {
  desCodigo = onSnapshot(doc(db, "codigos", hash), snap => {
    if (!usuario) return;
    const d = snap.data();
    if (!codigoVigente(d, usuario.uid)) {
      cerrarServicio(!d ? "error" : d.estado === "revocado" ? (d.motivo || "salida") : "tiempo");
      return;
    }
    sesion = { expiraEn: d.expiraEn.toDate() };
    if (!desDatos) abrirDatos();
    mostrarApp();
    if (!reloj) reloj = setInterval(vigilar, 1000);
  }, () => cerrarServicio("error"));
}

function vigilar() {
  if (!sesion) return;
  const ms = sesion.expiraEn - Date.now();
  if (ms <= 0) { cerrarServicio("tiempo"); return; }
  actualizarChip(ms);
}

function actualizarChip(ms) {
  const chip = $("chip");
  chip.textContent = `En servicio · quedan ${cuenta(ms)}`;
  chip.className = "chip ok";
}

// Borra lo que haya en pantalla y cierra la sesión de la cuenta
function cerrarServicio(motivo) {
  avisoLogin = AVISOS[motivo] || AVISOS.error;
  limpiarSesion();
  ver("vistaCarga");
  signOut(auth);
}

$("formCodigo").addEventListener("submit", async e => {
  e.preventDefault();
  const est = $("estadoCodigo"), btn = $("btnCodigo");
  const limpio = normalizarCodigo($("codigo").value);
  if (limpio.length < 12) { est.textContent = "Escribe el código completo."; return; }
  btn.disabled = true; est.textContent = "Verificando…";
  try {
    const hash = await sha256(limpio);
    const ref = doc(db, "codigos", hash);
    let snap;
    try { snap = await getDoc(ref); }
    catch (err) {
      est.textContent = (err && err.code === "permission-denied")
        ? "Firebase negó la lectura: faltan publicar las reglas nuevas (firestore.rules) en Firestore → Reglas."
        : errorTexto(err);
      return;
    }
    const d = snap.data();
    if (!d) { est.textContent = "Ese código no existe (revisa que lo escribiste bien)."; return; }
    if (d.estado !== "activo") { est.textContent = "Ese código ya no está activo."; return; }
    const faltaMs = d.expiraEn.toDate() - Date.now();
    if (faltaMs <= 0) {
      est.textContent = `Ese código ya venció según la hora de este equipo (hace ${cuenta(-faltaMs)} min:seg). Si recién lo generaste, revisa que la hora de tu PC esté sincronizada.`;
      return;
    }
    if (d.usadoPor && d.usadoPor !== usuario.uid) { est.textContent = "Ese código ya fue usado por otra cuenta."; return; }
    if (!d.usadoPor) await updateDoc(ref, { usadoPor: usuario.uid, usadoEn: serverTimestamp() });
    await setDoc(doc(db, "sesiones", usuario.uid), { codigo: hash });
    $("codigo").value = ""; est.textContent = "";
    entrarConCodigo(hash);
  } catch (err) {
    est.textContent = (err && err.code === "permission-denied")
      ? "Ese código ya fue usado o venció."
      : errorTexto(err);
  } finally {
    btn.disabled = false;
  }
});

function mostrarApp() {
  ver("vistaApp");
  $("panelEditor").hidden = !esAdmin;
  $("tituloBuscar").textContent = esAdmin ? "2. Buscar" : "Buscar";
  const chip = $("chip");
  if (esAdmin) { chip.textContent = "Admin"; chip.className = "chip admin"; }
  else if (sesion) actualizarChip(sesion.expiraEn - Date.now());
  mostrar();
}

function abrirDatos() {
  desDatos = onSnapshot(doc(db, "datos", "multas"), snap => {
    lineas = snap.exists() ? (snap.data().lineas || []) : [];
    mostrar();
  }, () => {
    // El servidor negó la lectura: el código ya no vale
    desDatos = null;
    if (!esAdmin) cerrarServicio("error");
  });
}

/* ───────────── Login / crear cuenta ───────────── */

let modo = "entrar";
document.querySelectorAll("[data-modo]").forEach(b => b.addEventListener("click", () => {
  modo = b.dataset.modo;
  document.querySelectorAll("[data-modo]").forEach(x => x.classList.toggle("activa", x === b));
  $("lblNombre").hidden = modo !== "crear";
  $("btnAuth").textContent = modo === "crear" ? "Crear cuenta" : "Entrar";
  $("clave").autocomplete = modo === "crear" ? "new-password" : "current-password";
  $("estadoAuth").textContent = "";
}));

$("formAuth").addEventListener("submit", async e => {
  e.preventDefault();
  const correo = $("correo").value.trim(), clave = $("clave").value;
  const est = $("estadoAuth"), btn = $("btnAuth");
  btn.disabled = true; est.textContent = "Un momento…";
  try {
    if (modo === "entrar") {
      await signInWithEmailAndPassword(auth, correo, clave);
    } else {
      const c = await createUserWithEmailAndPassword(auth, correo, clave);
      await setDoc(doc(db, "users", c.user.uid), {
        email: correo, nombre: $("nombre").value.trim(), creado: serverTimestamp()
      });
    }
    est.textContent = ""; $("clave").value = "";
  } catch (err) {
    est.textContent = errorTexto(err);
  } finally {
    btn.disabled = false;
  }
});

$("btnSalir").addEventListener("click", () => signOut(auth));

/* ───────────── Admin: editar multas ───────────── */

async function guardarLineas(nuevas, mensaje) {
  if (!esAdmin) return;
  if (JSON.stringify(nuevas).length > 900000) { estado.textContent = "Es demasiado texto para guardar (límite ~900 KB)."; return; }
  estado.textContent = "Guardando…";
  try {
    await setDoc(doc(db, "datos", "multas"), { lineas: nuevas, actualizado: serverTimestamp() });
    texto.value = ""; estado.textContent = mensaje;
  } catch (e) { estado.textContent = "No se pudo guardar: " + errorTexto(e); }
}

$("btnAgregar").addEventListener("click", () => {
  const nuevas = separar(texto.value);
  if (!nuevas.length) { estado.textContent = "Pega algún texto primero."; return; }
  guardarLineas(lineas.concat(nuevas), `Se agregaron ${nuevas.length} líneas. Total: ${lineas.length + nuevas.length}.`);
});

$("btnReemplazar").addEventListener("click", () => {
  const nuevas = separar(texto.value);
  if (!nuevas.length) { estado.textContent = "Pega algún texto primero."; return; }
  guardarLineas(nuevas, `Texto reemplazado. Total: ${nuevas.length} líneas.`);
});

$("btnBorrar").addEventListener("click", () => {
  if (!lineas.length || !confirm("¿Borrar todas las multas guardadas?")) return;
  guardarLineas([], "Se borró todo.");
});
