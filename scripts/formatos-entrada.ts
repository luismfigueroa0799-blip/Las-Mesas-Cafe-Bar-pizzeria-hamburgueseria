// Punto de entrada para el script de pruebas: reexporta los helpers que se
// quieren verificar.
export {
  normalizarTelefono,
  telefonoValido,
  soloDigitos,
} from '../artifacts/las-mesas/src/telefono';
export {
  precioANumero,
  precioACentavos,
  formatearPrecio,
} from '../artifacts/las-mesas/src/precio';
