import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, push, onValue } from "firebase/database";

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

// Captura de elementos
const montoGranTotal = document.getElementById('monto-gran-total');
const contenedorPendientes = document.getElementById('contenedor-facturas-pendientes');
const historialPagadas = document.getElementById('historial-pagadas');
const overlayPago = document.getElementById('overlay-pago');
const btnRegistrarPago = document.getElementById('btn-registrar-pago');
const btnCancelarPago = document.getElementById('btn-cancelar-pago');
const formularioPago = document.getElementById('formulario-pago');

let cacheFacturas = {};

// Lógica de apertura/cierre de modales
if (btnRegistrarPago) {
    btnRegistrarPago.addEventListener('click', () => {
        if (overlayPago) overlayPago.classList.remove('oculto');
    });
}

if (btnCancelarPago) {
    btnCancelarPago.addEventListener('click', () => {
        if (overlayPago) overlayPago.classList.add('oculto');
        if (formularioPago) formularioPago.reset();
    });
}

// Escuchar facturas
if (montoGranTotal && contenedorPendientes && historialPagadas) {
    onValue(ref(db, 'facturas'), (snapshot) => {
        contenedorPendientes.innerHTML = '';
        historialPagadas.innerHTML = '';
        let totalAcumulado = 0;
        let tienePendientes = false;
        let tienePagadas = false;

        if (!snapshot.exists()) {
            cacheFacturas = {};
            montoGranTotal.textContent = "$0.00";
            contenedorPendientes.innerHTML = '<p class="alerta-vacio">No tienes facturas pendientes. ¡Estás al día!</p>';
            historialPagadas.innerHTML = '<p class="alerta-vacio">No hay registros de facturas pagadas aún.</p>';
            return;
        }

        cacheFacturas = snapshot.val();
        Object.keys(cacheFacturas).forEach(id => {
            const factura = cacheFacturas[id];
            const div = document.createElement('div');
            div.className = 'tarjeta-factura';
            const saldoRestante = parseFloat(factura.saldoRestante ?? factura.monto);

            div.innerHTML = `
                <div class="factura-cabecera">
                    <span><strong>ID Factura:</strong> ${factura.codigoCorto || id}</span>
                    <span>${factura.fecha || 'Sin fecha'}</span>
                </div>
                <div style="margin-bottom: 5px;"><strong>Concepto:</strong> Entrega de productos</div>
                <div class="factura-monto">$${saldoRestante.toFixed(2)}</div>
                <div style="font-size:11px; color:#777; margin-top:5px;">Original: $${parseFloat(factura.monto).toFixed(2)}</div>
            `;

            if (factura.estado === 'pendiente') {
                totalAcumulado += saldoRestante;
                contenedorPendientes.appendChild(div);
                tienePendientes = true;
            } else if (factura.estado === 'pagada') {
                historialPagadas.appendChild(div);
                tienePagadas = true;
            }
        });

        montoGranTotal.textContent = `$${totalAcumulado.toFixed(2)}`;
        if (!tienePendientes) {
            contenedorPendientes.innerHTML = '<p class="alerta-vacio">¡Felicidades! No tienes facturas pendientes.</p>';
        }
        if (!tienePagadas) {
            historialPagadas.innerHTML = '<p class="alerta-vacio">No hay registros de facturas pagadas aún.</p>';
        }
    });
}

// Registrar pagos con efecto cascada
if (formularioPago) {
    formularioPago.addEventListener('submit', (e) => {
        e.preventDefault();
        const inputIdFactura = document.getElementById('pago-id-factura').value.trim();
        const inputMontoPago = parseFloat(document.getElementById('monto-pago').value);
        const inputTipo = document.getElementById('tipo-pago').value;
        const inputReferencia = document.getElementById('referencia-pago').value.trim();
        const inputFoto = document.getElementById('foto-comprobante');

        if (!cacheFacturas[inputIdFactura]) {
            alert("El ID de factura ingresado no existe en el sistema.");
            return;
        }

        if (isNaN(inputMontoPago) || inputMontoPago <= 0) {
            alert("Por favor, introduce un monto válido.");
            return;
        }

        if (!inputFoto || inputFoto.files.length === 0) {
            alert("Por favor, adjunta una foto del comprobante de pago.");
            return;
        }

        let dineroDisponible = inputMontoPago;
        let facturaOriginal = cacheFacturas[inputIdFactura];
        let saldoOriginal = parseFloat(facturaOriginal.saldoRestante ?? facturaOriginal.monto);

        // Aplicar a la factura seleccionada
        if (dineroDisponible >= saldoOriginal) {
            dineroDisponible -= saldoOriginal;
            facturaOriginal.saldoRestante = 0;
            facturaOriginal.estado = 'pagada';
        } else {
            facturaOriginal.saldoRestante = saldoOriginal - dineroDisponible;
            dineroDisponible = 0;
            facturaOriginal.estado = 'pendiente';
        }

        set(ref(db, `facturas/${inputIdFactura}`), facturaOriginal);

        // Efecto cascada
        if (dineroDisponible > 0) {
            const llavesFacturas = Object.keys(cacheFacturas).filter(id => id !== inputIdFactura);
            for (let id of llavesFacturas) {
                let otraFactura = cacheFacturas[id];
                if (otraFactura.estado === 'pendiente') {
                    let saldoOtra = parseFloat(otraFactura.saldoRestante ?? otraFactura.monto);
                    if (dineroDisponible >= saldoOtra) {
                        dineroDisponible -= saldoOtra;
                        otraFactura.saldoRestante = 0;
                        otraFactura.estado = 'pagada';
                    } else {
                        otraFactura.saldoRestante = saldoOtra - dineroDisponible;
                        dineroDisponible = 0;
                        otraFactura.estado = 'pendiente';
                    }
                    set(ref(db, `facturas/${id}`), otraFactura);
                }
                if (dineroDisponible <= 0) break;
            }
        }

        // Registrar el pago
        const nuevoPago = {
            facturaId: inputIdFactura,
            monto: inputMontoPago,
            tipoPago: inputTipo,
            referencia: inputReferencia,
            fecha: new Date().toLocaleString('es-ES'),
            fotoComprobante: inputFoto.files[0] ? inputFoto.files[0].name : 'Sin foto'
        };

        push(ref(db, 'pagos'), nuevoPago)
            .then(() => {
                alert("¡Pago procesado y balance actualizado automáticamente!");
                if (overlayPago) overlayPago.classList.add('oculto');
                formularioPago.reset();
            })
            .catch((error) => {
                console.error(error);
                alert("Error al registrar el reporte de pago.");
            });
    });
}
