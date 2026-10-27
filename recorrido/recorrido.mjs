// Recorrido de la tienda como un cliente real, en un teléfono (390 × 844):
// portada → menú → abrir un plato → cerrar. Solo MIRA: nunca toca el carrito,
// el perfil ni el pago, así no crea clientes ni pedidos en ningún negocio.
//
// Falla (y la corrida queda en rojo) si: la página responde ≥ 500, el
// navegador lanza un error de JavaScript, el menú no muestra platos o la ficha
// de un plato no abre. Los tiempos van a la tabla del Summary; si el menú
// tarda más de LENTO_MS se anota como lento (aviso, no alarma).
//
// Uso: SITE_URL=https://… node recorrido/recorrido.mjs portobello-pizza [otro-negocio…]
import { chromium } from "playwright";
import fs from "node:fs";

const SITE = (process.env.SITE_URL || "").replace(/\/$/, "");
const SLUGS = process.argv.slice(2).filter((s) => /^[a-z0-9-]{1,63}$/.test(s));
const LENTO_MS = Number(process.env.LENTO_MS || 5000);
const OUT = process.env.RECORRIDO_OUT || "recorrido-salida";
if (!SITE || SLUGS.length === 0) {
  console.error("Falta SITE_URL o el negocio.");
  process.exit(2);
}
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const filas = [];
const fallas = [];
const lentos = [];

async function recorrer(slug) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "es-CO",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 FastFoodVigilancia",
  });
  // Sin la bienvenida ni el recorrido guiado (no son parte de lo que se revisa).
  await ctx.addInitScript((s) => {
    try {
      for (const k of ["", ":distancia", ":mesa"]) localStorage.setItem(`ff-tour-seen:consumer:${s}${k}`, "1");
      sessionStorage.setItem(`ff-closed-dismissed:${s}`, "1");
    } catch {}
  }, slug);
  const page = await ctx.newPage();
  const errores = [];
  const servidor = [];
  page.on("pageerror", (e) => errores.push(String(e).slice(0, 200)));
  page.on("response", (r) => {
    if (r.status() >= 500 && r.url().startsWith(SITE)) servidor.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  const fila = { slug, portada: "-", menu: "-", platos: 0, ficha: "-", nota: "" };
  try {
    // 1) Portada
    let t0 = Date.now();
    const home = await page.goto(`${SITE}/r/${slug}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (!home || home.status() >= 400) throw new Error(`la portada respondió ${home?.status() ?? "sin respuesta"}`);
    await page.locator("body").waitFor();
    fila.portada = `${((Date.now() - t0) / 1000).toFixed(1)} s`;

    // 2) Menú: listo cuando hay al menos 3 fotos de platos a la vista.
    t0 = Date.now();
    const menu = await page.goto(`${SITE}/r/${slug}/menu`, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (!menu || menu.status() >= 400) throw new Error(`el menú respondió ${menu?.status() ?? "sin respuesta"}`);
    await page.waitForFunction(() => document.querySelectorAll("main img").length >= 3, null, { timeout: 20000 }).catch(() => {});
    const ms = Date.now() - t0;
    fila.menu = `${(ms / 1000).toFixed(1)} s`;
    fila.platos = await page.evaluate(() => document.querySelectorAll("main img").length);
    if (fila.platos === 0) throw new Error("el menú no muestra platos");
    if (ms > LENTO_MS) lentos.push(`${slug}: el menú tardó ${fila.menu}`);

    // 3) Abrir el primer plato que tenga precio y ver que salga su ficha.
    const plato = page.locator("main [role=button], main a").filter({ hasText: "$" }).first();
    if (await plato.count()) {
      t0 = Date.now();
      await plato.scrollIntoViewIfNeeded();
      await plato.click({ timeout: 10000 });
      const ficha = page.getByRole("dialog").first();
      await ficha.waitFor({ timeout: 10000 });
      // Lista = ya muestra el precio (no el esqueleto de carga).
      const lista = await ficha
        .getByText(/\$\s?[0-9]/)
        .first()
        .waitFor({ timeout: 12000 })
        .then(() => true)
        .catch(() => false);
      if (!lista) throw new Error("la ficha del plato se quedó cargando");
      fila.ficha = `${((Date.now() - t0) / 1000).toFixed(1)} s`;
      await page.screenshot({ path: `${OUT}/${slug}-ficha.png` });
      await page.keyboard.press("Escape");
    } else {
      fila.nota = "sin plato con precio para abrir";
    }
    await page.waitForTimeout(800);
  } catch (e) {
    fallas.push(`${slug}: ${String(e.message || e).split("\n")[0]}`);
    await page.screenshot({ path: `${OUT}/${slug}-falla.png` }).catch(() => {});
  }
  if (errores.length) fallas.push(`${slug}: error en el navegador — ${errores[0]}`);
  if (servidor.length) fallas.push(`${slug}: el servidor respondió ${servidor.slice(0, 3).join(", ")}`);
  filas.push(fila);
  await ctx.close();
}

for (const slug of SLUGS) await recorrer(slug);
await browser.close();

const resumen = [
  `### Recorrido de la tienda ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
  "| Negocio | Portada | Menú | Fotos | Ficha | Nota |",
  "|---|---|---|---|---|---|",
  ...filas.map((f) => `| ${f.slug} | ${f.portada} | ${f.menu} | ${f.platos} | ${f.ficha} | ${f.nota} |`),
  lentos.length ? `\n**Lento (más de ${LENTO_MS / 1000} s):**\n${lentos.map((l) => `- ${l}`).join("\n")}` : "",
].join("\n");
console.log(resumen);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, resumen + "\n");
fs.writeFileSync(`${OUT}/fallas.txt`, fallas.map((f) => `- ${f}`).join("\n"));
if (fallas.length) {
  console.error(fallas.join("\n"));
  process.exit(1);
}
