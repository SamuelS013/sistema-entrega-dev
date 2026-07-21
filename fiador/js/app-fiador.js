import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, remove } from "firebase/database";

// 🔥 CONFIGURACIÓN DE FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyCy_rJwB35LIqEYQuTPgh25tYmkqIfDczw",
    authDomain: "sistema-entregas-dev.firebaseapp.com",
    databaseURL: "https://sistema-entregas-dev-default-rtdb.firebaseio.com",
    projectId: "sistema-entregas-dev",
    storageBucket: "sistema-entregas-dev.firebasestorage.app",
    messagingSenderId: "287519131424",
    appId: "1:287519131424:web:a208ec25128d8036e13945"
};

// Inicializar Firebase UNA SOLA VEZ
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Nodos del DOM
const contenedorFacturas = document.getElementById('contenedor-facturas');
const overlayFactura = document.getElementById('overlay-factura');
const btnGenerarFactura = document.getElementById('btn-generar-factura');
const btnCancelar = document.getElementById('btn-cancelar');
const formularioFactura = document.getElementById('formulario-factura');
const btnAgregarProducto = document.getElementById('btn-agregar-producto');
const listaProductosInputs = document.getElementById('lista-productos-inputs');
const lblMontoTotal = document.getElementById('monto-total-automatico');
const lblIdFactura = document.getElementById('factura-id-automatico');
const lblFechaFactura = document.getElementById('factura-fecha-automatica');

let idFacturaActual = "";

// Función para calcular el monto total
function calcularTotalFactura() {
    let total = 0;
    const filas = listaProductosInputs.querySelectorAll('.fila-producto');
    filas.forEach(fila => {
        const cantidad = parseFloat(fila.querySelector('.prod-cantidad').value) || 0;
        const precio = parseFloat(fila.querySelector('.prod-precio').value) || 0;
        total += cantidad * precio;
    });
    lblMontoTotal.textContent = total.toFixed(2);
    return total;
}

// Escuchar cambios en inputs de productos
listaProductosInputs.addEventListener('input', calcularTotalFactura);

// Botón añadir producto
if (btnAgregarProducto) {
    btnAgregarProducto.addEventListener('click', () => {
        const nuevaFila = document.createElement('div');
        nuevaFila.className = 'fila-producto';
        nuevaFila.innerHTML = `
            <input type="text" placeholder="Producto" class="prod-nombre" required>
            <input type="number" placeholder="Cant." class="prod-cantidad" min="1" value="1" required>
            <input type="number" placeholder="Precio U." class="prod-precio" min="0" step="0.01" required>
        `;
        listaProductosInputs.appendChild(nuevaFila);
    });
}

// Abrir formulario y asignar ID y fecha
if (btnGenerarFactura) {
    btnGenerarFactura.addEventListener('click', () => {
        idFacturaActual = Math.floor(1000 + Math.random() * 9000).toString();
        const fechaHoy = new Date().toLocaleDateString('es-ES');
        if (lblIdFactura) lblIdFactura.textContent = idFacturaActual;
        if (lblFechaFactura) lblFechaFactura.textContent = fechaHoy;
        lblMontoTotal.textContent = "0.00";
        if (overlayFactura) overlayFactura.classList.remove('oculto');
    });
}

// Cancelar/Cerrar Ventana
if (btnCancelar) {
    btnCancelar.addEventListener('click', () => {
        if (overlayFactura) overlayFactura.classList.add('oculto');
        resetearFormulario();
    });
}

function resetearFormulario() {
    if (formularioFactura) formularioFactura.reset();
    listaProductosInputs.innerHTML = `
        <div class="fila-producto">
            <input type="text" placeholder="Producto" class="prod-nombre" required>
            <input type="number" placeholder="Cant." class="prod-cantidad" min="1" value="1" required>
            <input type="number" placeholder="Precio U." class="prod-precio" min="0" step="0.01" required>
        </div>
    `;
    lblMontoTotal.textContent = "0.00";
}

// Renderizar historial de facturas
if (contenedorFacturas) {
    onValue(ref(db, 'facturas'), (snapshot) => {
        contenedorFacturas.innerHTML = '';
        if (!snapshot.exists()) {
            contenedorFacturas.innerHTML = '<p class="alerta-vacio">No hay facturas registradas en el historial.</p>';
            return;
        }
        const datos = snapshot.val();
        Object.keys(datos).forEach(id => {
            const factura = datos[id];
            const div = document.createElement('div');
            div.className = 'tarjeta-factura';
            
            const botonAnular = factura.estado !== 'pagada' 
                ? `<button class="btn-anular-historial" data-id="${id}">Anular Factura</button>` 
                : '';
            
            div.innerHTML = `
                <div class="factura-cabecera">
                    <span><strong>ID:</strong> ${factura.codigoCorto || id}</span>
                    <span>${factura.fecha || 'Sin fecha'}</span>
                </div>
                <div style="margin-bottom: 5px;"><strong>Deudor:</strong> ${factura.deudor || 'Anónimo'}</div>
                <div class="factura-monto">$${parseFloat(factura.monto).toFixed(2)}</div>
                <div style="font-size: 12px; margin-top: 5px;">
                    <strong>Estado:</strong> ${factura.estado.toUpperCase()} | 
                    <strong>Restante:</strong> $${parseFloat(factura.saldoRestante ?? factura.monto).toFixed(2)}
                </div>
                ${botonAnular}
            `;
            contenedorFacturas.appendChild(div);
        });

        // Eventos para botones de anular
        document.querySelectorAll('.btn-anular-historial').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idAnular = e.target.getAttribute('data-id');
                if (confirm(`¿Estás seguro de que deseas anular la factura #${idAnular}?`)) {
                    remove(ref(db, `facturas/${idAnular}`))
                        .then(() => alert('Factura anulada exitosamente.'))
                        .catch(() => alert('Error al anular la factura.'));
                }
            });
        });
    });
}

// Escuchar Pagos Recibidos
const historialPagos = document.getElementById('historial-pagos');
if (historialPagos) {
    onValue(ref(db, 'pagos'), (snapshot) => {
        historialPagos.innerHTML = '';
        if (!snapshot.exists()) {
            historialPagos.innerHTML = '<p class="alerta-vacio">No se han recibido notificaciones de pago.</p>';
            return;
        }
        const pagos = snapshot.val();
        Object.keys(pagos).forEach(key => {
            const p = pagos[key];
            const div = document.createElement('div');
            div.className = 'tarjeta-factura';
            div.style.borderLeft = "5px solid #FF7A00";
            div.innerHTML = `
                <div class="factura-cabecera">
                    <span><strong>Factura Ref:</strong> ${p.facturaId || 'N/A'}</span>
                    <span>${p.fecha || 'Sin fecha'}</span>
                </div>
                <div><strong>Monto Abonado:</strong> $${parseFloat(p.monto).toFixed(2)}</div>
                <div style="font-size:12px; color:#555;"><strong>Detalle:</strong> ${p.referencia || 'Sin referencia'} (${p.tipoPago || 'N/A'})</div>
            `;
            historialPagos.appendChild(div);
        });
    });
}

// Guardar factura
if (formularioFactura) {
    formularioFactura.addEventListener('submit', (e) => {
        e.preventDefault();
        const inputDeudor = document.getElementById('nombre-deudor');
        const montoFinal = calcularTotalFactura();
        
        if (!inputDeudor || inputDeudor.value.trim() === "" || montoFinal <= 0) {
            alert("Asegúrate de tener un deudor válido y productos con precio.");
            return;
        }

        const productosArr = [];
        listaProductosInputs.querySelectorAll('.fila-producto').forEach(fila => {
            productosArr.push({
                nombre: fila.querySelector('.prod-nombre').value.trim(),
                cantidad: parseInt(fila.querySelector('.prod-cantidad').value) || 1,
                precioUnitario: parseFloat(fila.querySelector('.prod-precio').value) || 0
            });
        });

        const nuevaFactura = {
            codigoCorto: idFacturaActual,
            deudor: inputDeudor.value.trim(),
            monto: montoFinal,
            saldoRestante: montoFinal,
            fecha: new Date().toLocaleDateString('es-ES'),
            estado: 'pendiente',
            productos: productosArr
        };

        set(ref(db, `facturas/${idFacturaActual}`), nuevaFactura)
            .then(() => {
                if (overlayFactura) overlayFactura.classList.add('oculto');
                alert(`Factura #${idFacturaActual} guardada exitosamente.`);
                resetearFormulario();
            })
            .catch((error) => {
                console.error(error);
                alert("Error al subir la factura.");
            });
    });
}
