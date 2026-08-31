CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  identificacion VARCHAR(25),
  telefono VARCHAR(20),
  empresa VARCHAR(150),
  estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'riesgo')),
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS facturas (
  id SERIAL PRIMARY KEY,
  cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  numero_factura VARCHAR(50) NOT NULL UNIQUE,
  monto NUMERIC(10,2) NOT NULL,
  fecha_emision DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  estado VARCHAR(20) DEFAULT 'activa' CHECK (estado IN ('activa', 'vencida', 'pagada', 'revision')),
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pagos (
  id SERIAL PRIMARY KEY,
  factura_id INT NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  monto NUMERIC(10,2) NOT NULL,
  metodo VARCHAR(50) NOT NULL,
  fecha_pago DATE NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contratos (
  id SERIAL PRIMARY KEY,
  cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  numero_contrato VARCHAR(50) NOT NULL UNIQUE,
  monto NUMERIC(14,2),
  cuotas INT,
  frecuencia VARCHAR(20),
  tasa NUMERIC(6,4),
  fecha_limite_pago DATE,
  reglas TEXT,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prestamos (
  id SERIAL PRIMARY KEY,
  cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  contrato_id INT REFERENCES contratos(id) ON DELETE SET NULL,
  monto_original NUMERIC(14,2) NOT NULL,
  saldo_pendiente NUMERIC(14,2) NOT NULL,
  cuotas_totales INT NOT NULL,
  cuotas_pagadas INT DEFAULT 0,
  frecuencia VARCHAR(20) NOT NULL,
  tasa NUMERIC(6,4) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_proximo_pago DATE,
  estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'pagado', 'vencido', 'cancelado')),
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cuotas (
  id SERIAL PRIMARY KEY,
  prestamo_id INT NOT NULL REFERENCES prestamos(id) ON DELETE CASCADE,
  numero_cuota INT NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  capital NUMERIC(14,2) NOT NULL,
  interes NUMERIC(14,2) NOT NULL,
  monto_cuota NUMERIC(14,2) NOT NULL,
  saldo_pendiente NUMERIC(14,2) NOT NULL,
  estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagada', 'vencida', 'parcial')),
  fecha_pago DATE,
  monto_pagado NUMERIC(14,2) DEFAULT 0,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prestamos_cliente ON prestamos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_prestamos_contrato ON prestamos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_prestamo ON cuotas(prestamo_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_estado ON cuotas(estado);

INSERT INTO clientes (nombre, email, identificacion, telefono, empresa, estado) VALUES
('Ana Morales', 'ana@central.com', '610-090398-1333H', '5551234', 'Grupo Central', 'activo')
ON CONFLICT (email) DO NOTHING;

INSERT INTO clientes (nombre, email, identificacion, telefono, empresa, estado) VALUES
('Luis Pérez', 'luis@textil.com', '610-090399-1334H', '5555678', 'Alianza Textil', 'riesgo')
ON CONFLICT (email) DO NOTHING;

INSERT INTO clientes (nombre, email, identificacion, telefono, empresa, estado) VALUES
('Carla Ruiz', 'carla@solar.com', '610-090400-1335H', '5559012', 'Alta Solar', 'activo')
ON CONFLICT (email) DO NOTHING;

INSERT INTO facturas (cliente_id, numero_factura, monto, fecha_emision, fecha_vencimiento, estado) VALUES
(1, 'FAC-0001', 12860.00, '2026-07-01', '2026-08-22', 'vencida')
ON CONFLICT (numero_factura) DO NOTHING;

INSERT INTO facturas (cliente_id, numero_factura, monto, fecha_emision, fecha_vencimiento, estado) VALUES
(2, 'FAC-0002', 8120.00, '2026-07-10', '2026-08-26', 'revision')
ON CONFLICT (numero_factura) DO NOTHING;

INSERT INTO facturas (cliente_id, numero_factura, monto, fecha_emision, fecha_vencimiento, estado) VALUES
(3, 'FAC-0003', 4520.00, '2026-07-15', '2026-08-29', 'activa')
ON CONFLICT (numero_factura) DO NOTHING;
