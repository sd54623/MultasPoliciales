import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot,
  collection, getDocs, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig, CONTACTO } from "./firebase-config.js";

const $ = id => document.getElementById(id);
const VISTAS = ["vistaCarga", "vistaConfig", "vistaLogin", "vistaBloqueado", "vistaApp"];
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

let usuario = null, esAdmin = false, expiraEn = null, registrando = false;
let desPerfil = null, desDatos = null, reloj = null;

const fmt = d => d.toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" });
function restante(ms) {
  const min = Math.max(1, Math.floor(ms / 60000));
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
  if (d) return `${d} d ${h} h`;
  if (h) return `${h} h ${m} min`;
  return `${m} min`;
}

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
  if (desPerfil) desPerfil();
  if (desDatos) desDatos();
  desPerfil = desDatos = null;
  clearInterval(reloj); reloj = null;
  lineas = []; esAdmin = false; expiraEn = null;
  resultados.innerHTML = ""; contador.textContent = ""; campo.value = "";
}

onAuthStateChanged(auth, async user => {
  limpiarSesion();
  usuario = user;
  if (!user) { $("barra").hidden = true; ver("vistaLogin"); return; }

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
  escucharPerfil(user);
});

function escucharPerfil(user) {
  desPerfil = onSnapshot(doc(db, "users", user.uid), snap => {
    expiraEn = snap.exists() && snap.data().expiraEn ? snap.data().expiraEn.toDate() : null;
    if (!snap.exists() && !registrando) {
      setDoc(doc(db, "users", user.uid), { email: user.email, nombre: "", creado: serverTimestamp() }).catch(() => {});
    }
    evaluar();
  }, () => bloquear("sin"));
}

// Decide si el usuario puede ver las multas ahora mismo
function evaluar() {
  if (esAdmin) return;
  if (expiraEn && expiraEn > new Date()) {
    if (!desDatos) abrirDatos();
    mostrarApp();
    if (!reloj) reloj = setInterval(evaluar, 15000);
  } else {
    bloquear(expiraEn ? "vencida" : "sin");
  }
}

function bloquear(motivo) {
  if (desDatos) { desDatos(); desDatos = null; }
  clearInterval(reloj); reloj = null;
  lineas = []; resultados.innerHTML = "";
  $("chip").textContent = ""; $("chip").className = "chip";
  if (motivo === "vencida") {
    $("bloqueadoTitulo").textContent = "Tu suscripción ha finalizado";
    $("bloqueadoTexto").textContent = "Adquiere una nueva para seguir disfrutando de ella.";
  } else {
    $("bloqueadoTitulo").textContent = "Aún no tienes una suscripción activa";
    $("bloqueadoTexto").textContent = "Tu cuenta fue creada, pero todavía no tiene acceso a las multas.";
  }
  $("bloqueadoContacto").textContent = CONTACTO;
  ver("vistaBloqueado");
}

function mostrarApp() {
  ver("vistaApp");
  $("panelEditor").hidden = !esAdmin;
  $("navAdmin").hidden = !esAdmin;
  $("tituloBuscar").textContent = esAdmin ? "2. Buscar" : "Buscar";
  const chip = $("chip");
  if (esAdmin) { chip.textContent = "Admin"; chip.className = "chip admin"; }
  else if (expiraEn) { chip.textContent = `Acceso hasta ${fmt(expiraEn)} (${restante(expiraEn - Date.now())})`; chip.className = "chip ok"; }
  mostrar();
}

function abrirDatos() {
  desDatos = onSnapshot(doc(db, "datos", "multas"), snap => {
    lineas = snap.exists() ? (snap.data().lineas || []) : [];
    mostrar();
  }, () => {
    // El servidor negó la lectura: la suscripción venció
    desDatos = null;
    if (!esAdmin) bloquear("vencida");
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
      registrando = true;
      const c = await createUserWithEmailAndPassword(auth, correo, clave);
      await setDoc(doc(db, "users", c.user.uid), {
        email: correo, nombre: $("nombre").value.trim(), creado: serverTimestamp()
      });
    }
    est.textContent = ""; $("clave").value = "";
  } catch (err) {
    est.textContent = errorTexto(err);
  } finally {
    registrando = false; btn.disabled = false;
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

/* ───────────── Admin: usuarios y suscripciones ───────────── */

document.querySelectorAll("[data-pestana]").forEach(b => b.addEventListener("click", () => {
  const p = b.dataset.pestana;
  document.querySelectorAll("[data-pestana]").forEach(x => x.classList.toggle("activa", x === b));
  $("pestanaMultas").hidden = p !== "multas";
  $("pestanaUsuarios").hidden = p !== "usuarios";
  if (p === "usuarios") cargarUsuarios();
}));

let usuarios = [];

async function cargarUsuarios() {
  $("estadoUsuarios").textContent = "Cargando…";
  try {
    const snap = await getDocs(collection(db, "users"));
    usuarios = snap.docs.map(d => {
      const x = d.data();
      return { uid: d.id, email: x.email || "", nombre: x.nombre || "", creado: x.creado ? x.creado.toDate() : null, expiraEn: x.expiraEn ? x.expiraEn.toDate() : null };
    }).sort((a, b) => (b.creado || 0) - (a.creado || 0));
    $("estadoUsuarios").textContent = `${usuarios.length} ${usuarios.length === 1 ? "usuario" : "usuarios"}.`;
    pintarUsuarios();
  } catch (e) { $("estadoUsuarios").textContent = "No se pudo cargar: " + errorTexto(e); }
}

function pintarUsuarios() {
  const q = limpiar($("buscaUsuario").value.trim());
  const ahora = new Date();
  const lista = usuarios.filter(u => !q || limpiar(u.email + " " + u.nombre).includes(q));
  $("listaUsuarios").innerHTML = lista.length ? lista.map(u => {
    let clase = "sin", etiqueta = "Sin acceso";
    if (u.expiraEn && u.expiraEn > ahora) { clase = "activa"; etiqueta = `Activa hasta ${fmt(u.expiraEn)} (${restante(u.expiraEn - ahora)})`; }
    else if (u.expiraEn) { clase = "vencida"; etiqueta = `Venció el ${fmt(u.expiraEn)}`; }
    const nombre = u.nombre ? `<strong>${escapar(u.nombre)}</strong> · ` : "";
    return `<article class="usuario" data-uid="${escapar(u.uid)}">
      <div class="u-info"><div>${nombre}${escapar(u.email)}</div><div class="estado-u ${clase}">${etiqueta}</div></div>
      <div class="u-acciones">
        <button type="button" data-horas="24">+24 h</button>
        <button type="button" data-horas="48">+2 días</button>
        <button type="button" data-horas="72">+3 días</button>
        <button type="button" data-horas="168">+7 días</button>
        <button type="button" data-horas="720">+30 días</button>
        <span class="otro"><input type="number" class="cant" min="1" value="1" aria-label="Cantidad">
          <select class="unidad" aria-label="Unidad"><option value="1">horas</option><option value="24" selected>días</option></select>
          <button type="button" class="sec" data-otro="1">Dar</button></span>
        <button type="button" class="sec peligro" data-quitar="1">Quitar acceso</button>
      </div></article>`;
  }).join("") : '<div class="vacio">No hay usuarios.</div>';
}

$("buscaUsuario").addEventListener("input", pintarUsuarios);

$("listaUsuarios").addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b) return;
  const fila = b.closest(".usuario"); const u = usuarios.find(x => x.uid === fila.dataset.uid); if (!u) return;
  let horas = null;
  if (b.dataset.horas) horas = Number(b.dataset.horas);
  else if (b.dataset.otro) {
    const n = Number(fila.querySelector(".cant").value), un = Number(fila.querySelector(".unidad").value);
    if (!(n > 0)) { $("estadoUsuarios").textContent = "Escribe una cantidad mayor que 0."; return; }
    horas = n * un;
  } else if (!b.dataset.quitar) return;

  try {
    let nuevo = null;
    if (horas !== null) {
      const base = Math.max(Date.now(), u.expiraEn ? u.expiraEn.getTime() : 0);
      nuevo = new Date(base + horas * 3600000);
    }
    await updateDoc(doc(db, "users", u.uid), { expiraEn: nuevo ? Timestamp.fromDate(nuevo) : null });
    u.expiraEn = nuevo;
    $("estadoUsuarios").textContent = nuevo ? `Acceso de ${u.email} hasta ${fmt(nuevo)}` : `Se quitó el acceso a ${u.email}.`;
    pintarUsuarios();
  } catch (err) { $("estadoUsuarios").textContent = "No se pudo guardar: " + errorTexto(err); }
});
