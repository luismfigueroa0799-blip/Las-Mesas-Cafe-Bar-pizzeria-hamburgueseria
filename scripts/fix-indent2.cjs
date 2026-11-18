const fs = require('fs');
const f = 'artifacts/las-mesas/src/CartContext.tsx';
const c = fs.readFileSync(f, 'utf8');
const antes = "      const id = String(product.id ?? product.name);\n        return [...previo, { ...product, id, quantity: 1 }];";
const despues = "      const id = String(product.id ?? product.name);\n      return [...previo, { ...product, id, quantity: 1 }];";
if (c.includes(antes)) {
  fs.writeFileSync(f, c.replace(antes, despues), 'utf8');
  console.log('OK: indentacion normalizada en ' + f);
} else {
  console.log('AVISO: patron no encontrado');
}
