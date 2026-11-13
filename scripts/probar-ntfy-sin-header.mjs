const cuerpo = ["---------------------------------","Pedido: PED-4K7X","---------------------------------","Detalles:","2 x Café Solo - 1,50 €","1 x La suprema - 6,50 €","---------------------------------","Total: 9,50 €"].join("\n");

// 1) SIN ninguna cabecera (lo que hace n8n con contentType raw + sendHeaders OFF)
const r1 = await fetch("https://ntfy.sh/las-mesas-prueba2", { method: "POST", body: cuerpo });
const t1 = await r1.text();
console.log("sin Content-Type -> HTTP", r1.status);
console.log("  ", t1.slice(0, 300));
console.log();

// 2) Con text/plain (por si hiciera falta)
const r2 = await fetch("https://ntfy.sh/las-mesas-prueba2", { method: "POST", headers: { "Content-Type": "text/plain; charset=utf-8" }, body: cuerpo });
const t2 = await r2.text();
console.log("con text/plain -> HTTP", r2.status);
console.log("  ", t2.slice(0, 300));
console.log();

// 3) Lo que ve la tablet en el caso sin Content-Type
await new Promise((res) => setTimeout(res, 1200));
const json = await (await fetch("https://ntfy.sh/las-mesas-prueba2/json?poll=1&since=2m", { headers: { Accept: "application/json" } })).text();
for (const l of json.split("\n").filter(Boolean)) {
  try { const m = JSON.parse(l); if (m.event && m.event !== "open") console.log("tablet ve ->", JSON.stringify(m.message)); } catch {}
}
