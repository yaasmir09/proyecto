CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  telefono VARCHAR(20),
  empresa VARCHAR(150),
  estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo','inactivo','riesgo')),
  creado_en TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS facturas (
  id SERIAL PRIMARY KEY,
  cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  numero_factura VARCHAR(50) NOT NULL UNIQUE,
  monto NUMERIC(10,2) NOT NULL,
  fecha_emision DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  estado VARCHAR(20) DEFAULT 'activa' CHECK (estado IN ('activa','vencida','pagada','revision')),
  creado_en TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pagos (
  id SERIAL PRIMARY KEY,
  factura_id INT NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  monto NUMERIC(10,2) NOT NULL,
  metodo VARCHAR(50) NOT NULL,
  fecha_pago DATE NOT NULL,
  creado_en TIMESTAMP DEFAULT now()
);

INSERT INTO clientes (nombre, email, telefono, empresa, estado) VALUES
('Ana Morales', 'ana@central.com', '5551234', 'Grupo Central', 'activo')
ON CONFLICT (email) DO NOTHING;

INSERT INTO clientes (nombre, email, telefono, empresa, estado) VALUES
('Luis Pérez', 'luis@textil.com', '5555678', 'Alianza Textil', 'riesgo')
ON CONFLICT (email) DO NOTHING;

INSERT INTO clientes (nombre, email, telefono, empresa, estado) VALUES
('Carla Ruiz', 'carla@solar.com', '5559012', 'Alta Solar', 'activo')
ON CONFLICT (email) DO NOTHING;
