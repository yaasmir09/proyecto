--
-- PostgreSQL database dump
--

\restrict Ve4gzYCw5ir9wB9xFbjFWWfKamueb20oRKvxP95dDVbLYGxYIUrDAmpr1OkYKXY

-- Dumped from database version 16.15
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.seguimientos DROP CONSTRAINT IF EXISTS seguimientos_cliente_id_fkey;
ALTER TABLE IF EXISTS ONLY public.prestamos DROP CONSTRAINT IF EXISTS prestamos_contrato_id_fkey;
ALTER TABLE IF EXISTS ONLY public.prestamos DROP CONSTRAINT IF EXISTS prestamos_cliente_id_fkey;
ALTER TABLE IF EXISTS ONLY public.pagos DROP CONSTRAINT IF EXISTS pagos_factura_id_fkey;
ALTER TABLE IF EXISTS ONLY public.facturas DROP CONSTRAINT IF EXISTS facturas_cliente_id_fkey;
ALTER TABLE IF EXISTS ONLY public.cuotas DROP CONSTRAINT IF EXISTS cuotas_prestamo_id_fkey;
ALTER TABLE IF EXISTS ONLY public.contratos DROP CONSTRAINT IF EXISTS contratos_cliente_id_fkey;
DROP INDEX IF EXISTS public.idx_prestamos_contrato;
DROP INDEX IF EXISTS public.idx_prestamos_cliente;
DROP INDEX IF EXISTS public.idx_cuotas_prestamo;
DROP INDEX IF EXISTS public.idx_cuotas_estado;
DROP INDEX IF EXISTS public.contratos_numero_contrato_idx;
ALTER TABLE IF EXISTS ONLY public.usuarios DROP CONSTRAINT IF EXISTS usuarios_pkey;
ALTER TABLE IF EXISTS ONLY public.usuarios DROP CONSTRAINT IF EXISTS usuarios_email_key;
ALTER TABLE IF EXISTS ONLY public.seguimientos DROP CONSTRAINT IF EXISTS seguimientos_pkey;
ALTER TABLE IF EXISTS ONLY public.prestamos DROP CONSTRAINT IF EXISTS prestamos_pkey;
ALTER TABLE IF EXISTS ONLY public.pagos DROP CONSTRAINT IF EXISTS pagos_pkey;
ALTER TABLE IF EXISTS ONLY public.facturas DROP CONSTRAINT IF EXISTS facturas_pkey;
ALTER TABLE IF EXISTS ONLY public.facturas DROP CONSTRAINT IF EXISTS facturas_numero_factura_key;
ALTER TABLE IF EXISTS ONLY public.cuotas DROP CONSTRAINT IF EXISTS cuotas_pkey;
ALTER TABLE IF EXISTS ONLY public.contratos DROP CONSTRAINT IF EXISTS contratos_pkey;
ALTER TABLE IF EXISTS ONLY public.contratos DROP CONSTRAINT IF EXISTS contratos_numero_contrato_key;
ALTER TABLE IF EXISTS ONLY public.clientes DROP CONSTRAINT IF EXISTS clientes_pkey;
ALTER TABLE IF EXISTS ONLY public.clientes DROP CONSTRAINT IF EXISTS clientes_email_key;
ALTER TABLE IF EXISTS public.usuarios ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.seguimientos ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.prestamos ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.pagos ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.facturas ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.cuotas ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.contratos ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.clientes ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.usuarios_id_seq;
DROP TABLE IF EXISTS public.usuarios;
DROP SEQUENCE IF EXISTS public.seguimientos_id_seq;
DROP TABLE IF EXISTS public.seguimientos;
DROP SEQUENCE IF EXISTS public.prestamos_id_seq;
DROP TABLE IF EXISTS public.prestamos;
DROP SEQUENCE IF EXISTS public.pagos_id_seq;
DROP TABLE IF EXISTS public.pagos;
DROP SEQUENCE IF EXISTS public.facturas_id_seq;
DROP TABLE IF EXISTS public.facturas;
DROP SEQUENCE IF EXISTS public.cuotas_id_seq;
DROP TABLE IF EXISTS public.cuotas;
DROP SEQUENCE IF EXISTS public.contratos_id_seq;
DROP TABLE IF EXISTS public.contratos;
DROP SEQUENCE IF EXISTS public.clientes_id_seq;
DROP TABLE IF EXISTS public.clientes;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: clientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clientes (
    id integer NOT NULL,
    nombre character varying(150) NOT NULL,
    email character varying(150) NOT NULL,
    identificacion character varying(25),
    telefono character varying(20),
    empresa character varying(150),
    estado character varying(20) DEFAULT 'activo'::character varying,
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT clientes_estado_check CHECK (((estado)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying, 'riesgo'::character varying])::text[])))
);


--
-- Name: clientes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clientes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clientes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clientes_id_seq OWNED BY public.clientes.id;


--
-- Name: contratos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contratos (
    id integer NOT NULL,
    cliente_id integer NOT NULL,
    numero_contrato character varying(50) NOT NULL,
    monto numeric(14,2),
    cuotas integer,
    frecuencia character varying(20),
    tasa numeric(6,4),
    fecha_limite_pago date,
    reglas text,
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: contratos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contratos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contratos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contratos_id_seq OWNED BY public.contratos.id;


--
-- Name: cuotas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cuotas (
    id integer NOT NULL,
    prestamo_id integer NOT NULL,
    numero_cuota integer NOT NULL,
    fecha_vencimiento date NOT NULL,
    capital numeric(14,2) NOT NULL,
    interes numeric(14,2) NOT NULL,
    monto_cuota numeric(14,2) NOT NULL,
    saldo_pendiente numeric(14,2) NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying,
    fecha_pago date,
    monto_pagado numeric(14,2) DEFAULT 0,
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    actualizado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cuotas_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'pagada'::character varying, 'vencida'::character varying, 'parcial'::character varying])::text[])))
);


--
-- Name: cuotas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cuotas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cuotas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cuotas_id_seq OWNED BY public.cuotas.id;


--
-- Name: facturas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.facturas (
    id integer NOT NULL,
    cliente_id integer NOT NULL,
    numero_factura character varying(50) NOT NULL,
    monto numeric(10,2) NOT NULL,
    fecha_emision date NOT NULL,
    fecha_vencimiento date NOT NULL,
    estado character varying(20) DEFAULT 'activa'::character varying,
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT facturas_estado_check CHECK (((estado)::text = ANY ((ARRAY['activa'::character varying, 'vencida'::character varying, 'pagada'::character varying, 'revision'::character varying])::text[])))
);


--
-- Name: facturas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.facturas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: facturas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.facturas_id_seq OWNED BY public.facturas.id;


--
-- Name: pagos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagos (
    id integer NOT NULL,
    factura_id integer NOT NULL,
    monto numeric(10,2) NOT NULL,
    metodo character varying(50) NOT NULL,
    fecha_pago date NOT NULL,
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: pagos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pagos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pagos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pagos_id_seq OWNED BY public.pagos.id;


--
-- Name: prestamos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prestamos (
    id integer NOT NULL,
    cliente_id integer NOT NULL,
    contrato_id integer,
    monto_original numeric(14,2) NOT NULL,
    saldo_pendiente numeric(14,2) NOT NULL,
    cuotas_totales integer NOT NULL,
    cuotas_pagadas integer DEFAULT 0,
    frecuencia character varying(20) NOT NULL,
    tasa numeric(6,4) NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_proximo_pago date,
    estado character varying(20) DEFAULT 'activo'::character varying,
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    actualizado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT prestamos_estado_check CHECK (((estado)::text = ANY ((ARRAY['activo'::character varying, 'pagado'::character varying, 'vencido'::character varying, 'cancelado'::character varying])::text[])))
);


--
-- Name: prestamos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.prestamos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prestamos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.prestamos_id_seq OWNED BY public.prestamos.id;


--
-- Name: seguimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seguimientos (
    id integer NOT NULL,
    cliente_id integer NOT NULL,
    tipo character varying(80) NOT NULL,
    comentario text NOT NULL,
    estado character varying(40) DEFAULT 'pendiente'::character varying,
    fecha date NOT NULL,
    creado_en timestamp without time zone DEFAULT now()
);


--
-- Name: seguimientos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seguimientos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seguimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.seguimientos_id_seq OWNED BY public.seguimientos.id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    nombre character varying(150) NOT NULL,
    email character varying(150) NOT NULL,
    password character varying(255) NOT NULL,
    rol character varying(50) NOT NULL,
    creado_en timestamp without time zone DEFAULT now()
);


--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: clientes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes ALTER COLUMN id SET DEFAULT nextval('public.clientes_id_seq'::regclass);


--
-- Name: contratos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contratos ALTER COLUMN id SET DEFAULT nextval('public.contratos_id_seq'::regclass);


--
-- Name: cuotas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuotas ALTER COLUMN id SET DEFAULT nextval('public.cuotas_id_seq'::regclass);


--
-- Name: facturas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facturas ALTER COLUMN id SET DEFAULT nextval('public.facturas_id_seq'::regclass);


--
-- Name: pagos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos ALTER COLUMN id SET DEFAULT nextval('public.pagos_id_seq'::regclass);


--
-- Name: prestamos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestamos ALTER COLUMN id SET DEFAULT nextval('public.prestamos_id_seq'::regclass);


--
-- Name: seguimientos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seguimientos ALTER COLUMN id SET DEFAULT nextval('public.seguimientos_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Data for Name: clientes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.clientes (id, nombre, email, identificacion, telefono, empresa, estado, creado_en) FROM stdin;
1	Ana Morales	ana@central.com	610-090398-1333H	5551234	Grupo Central	activo	2026-08-19 16:09:29.668338
2	Luis Pérez	luis@textil.com	610-090399-1334H	5555678	Alianza Textil	riesgo	2026-08-19 16:09:29.671403
3	Carla Ruiz	carla@solar.com	610-090400-1335H	5559012	Alta Solar	activo	2026-08-19 16:09:29.673706
5	Jostin Molina	jostinmolina@gmail.com	601-090606-1222X	78220022	Robos	activo	2026-08-19 17:13:53.095093
\.


--
-- Data for Name: contratos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contratos (id, cliente_id, numero_contrato, monto, cuotas, frecuencia, tasa, fecha_limite_pago, reglas, creado_en) FROM stdin;
2	2	CONTR-0002	1000.00	2	quincenal	12.0000	2026-08-19	1. El cliente debe pagar en las fechas indicadas.\n2. El pago atrasado genera interés según la tasa acordada.\n3. El cliente acepta la firma del contratista y del cliente.\n4. El pago debe realizarse según la frecuencia acordada y la fecha establecida.\n5. Cualquier atraso generará interés sobre el saldo pendiente.\n6. La empresa podrá realizar seguimiento y recordatorios por medio telefónico o escrito.\n7. El cliente acepta la información y condiciones del préstamo de manera voluntaria.	2026-08-19 16:46:23.750944
3	2	CONTR-0003	2000.00	4	quincenal	12.0000	2026-08-19	1. El cliente debe pagar en las fechas indicadas.\n2. El pago atrasado genera interés según la tasa acordada.\n3. El cliente acepta la firma del contratista y del cliente.\n4. El pago debe realizarse según la frecuencia acordada y la fecha establecida.\n5. Cualquier atraso generará interés sobre el saldo pendiente.\n6. La empresa podrá realizar seguimiento y recordatorios por medio telefónico o escrito.\n7. El cliente acepta la información y condiciones del préstamo de manera voluntaria.	2026-08-19 16:47:14.866365
6	2	CONTR-0004	2000.00	4	semanal	12.0000	2026-08-19	1. El cliente debe pagar en las fechas indicadas.\n2. El pago atrasado genera interés según la tasa acordada.\n3. El cliente acepta la firma del contratista y del cliente.\n4. El pago debe realizarse según la frecuencia acordada y la fecha establecida.\n5. Cualquier atraso generará interés sobre el saldo pendiente.\n6. La empresa podrá realizar seguimiento y recordatorios por medio telefónico o escrito.\n7. El cliente acepta la información y condiciones del préstamo de manera voluntaria.	2026-08-19 16:53:01.653348
14	5	CONTR-0005	30000.00	12	mensual	12.0000	2026-08-19	1. El cliente debe pagar en las fechas indicadas.\n2. El pago atrasado genera interés según la tasa acordada.\n3. El cliente acepta la firma del contratista y del cliente.\n4. El pago debe realizarse según la frecuencia acordada y la fecha establecida.\n5. Cualquier atraso generará interés sobre el saldo pendiente.\n6. La empresa podrá realizar seguimiento y recordatorios por medio telefónico o escrito.\n7. El cliente acepta la información y condiciones del préstamo de manera voluntaria.	2026-08-19 17:17:13.815626
15	5	CONTR-0006	20000.00	10	mensual	12.0000	2026-08-19	1. El cliente debe pagar en las fechas indicadas.\n2. El pago atrasado genera interés según la tasa acordada.\n3. El cliente acepta la firma del contratista y del cliente.\n4. El pago debe realizarse según la frecuencia acordada y la fecha establecida.\n5. Cualquier atraso generará interés sobre el saldo pendiente.\n6. La empresa podrá realizar seguimiento y recordatorios por medio telefónico o escrito.\n7. El cliente acepta la información y condiciones del préstamo de manera voluntaria.	2026-08-19 20:43:40.292893
\.


--
-- Data for Name: cuotas; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cuotas (id, prestamo_id, numero_cuota, fecha_vencimiento, capital, interes, monto_cuota, saldo_pendiente, estado, fecha_pago, monto_pagado, creado_en, actualizado_en) FROM stdin;
14	3	3	2026-11-17	2413.01	252.45	2665.46	22832.42	pendiente	\N	0.00	2026-08-19 17:17:13.833614	2026-08-19 17:17:13.833614
15	3	4	2026-12-17	2437.14	228.32	2665.46	20395.28	pendiente	\N	0.00	2026-08-19 17:17:13.836597	2026-08-19 17:17:13.836597
16	3	5	2027-01-16	2461.51	203.95	2665.46	17933.77	pendiente	\N	0.00	2026-08-19 17:17:13.839735	2026-08-19 17:17:13.839735
17	3	6	2027-02-15	2486.12	179.34	2665.46	15447.65	pendiente	\N	0.00	2026-08-19 17:17:13.842963	2026-08-19 17:17:13.842963
18	3	7	2027-03-17	2510.98	154.48	2665.46	12936.67	pendiente	\N	0.00	2026-08-19 17:17:13.845576	2026-08-19 17:17:13.845576
19	3	8	2027-04-16	2536.09	129.37	2665.46	10400.58	pendiente	\N	0.00	2026-08-19 17:17:13.84777	2026-08-19 17:17:13.84777
20	3	9	2027-05-16	2561.45	104.01	2665.46	7839.13	pendiente	\N	0.00	2026-08-19 17:17:13.850177	2026-08-19 17:17:13.850177
21	3	10	2027-06-15	2587.07	78.39	2665.46	5252.06	pendiente	\N	0.00	2026-08-19 17:17:13.852481	2026-08-19 17:17:13.852481
22	3	11	2027-07-15	2612.94	52.52	2665.46	2639.12	pendiente	\N	0.00	2026-08-19 17:17:13.85486	2026-08-19 17:17:13.85486
23	3	12	2027-08-14	2639.07	26.39	2665.46	0.05	pendiente	\N	0.00	2026-08-19 17:17:13.857592	2026-08-19 17:17:13.857592
12	3	1	2026-09-18	2365.46	300.00	2665.46	27634.54	pagada	2026-08-19	2665.46	2026-08-19 17:17:13.823412	2026-08-19 17:18:10.45431
13	3	2	2026-10-18	2389.11	276.35	2665.46	25245.43	pagada	2026-08-19	2665.46	2026-08-19 17:17:13.82884	2026-08-19 17:19:05.788037
25	4	2	2026-10-18	1930.76	180.88	2111.64	16157.60	pendiente	\N	0.00	2026-08-19 20:43:40.305665	2026-08-19 20:43:40.305665
26	4	3	2026-11-17	1950.06	161.58	2111.64	14207.54	pendiente	\N	0.00	2026-08-19 20:43:40.308656	2026-08-19 20:43:40.308656
27	4	4	2026-12-17	1969.56	142.08	2111.64	12237.98	pendiente	\N	0.00	2026-08-19 20:43:40.311707	2026-08-19 20:43:40.311707
28	4	5	2027-01-16	1989.26	122.38	2111.64	10248.72	pendiente	\N	0.00	2026-08-19 20:43:40.314481	2026-08-19 20:43:40.314481
29	4	6	2027-02-15	2009.15	102.49	2111.64	8239.57	pendiente	\N	0.00	2026-08-19 20:43:40.317059	2026-08-19 20:43:40.317059
30	4	7	2027-03-17	2029.24	82.40	2111.64	6210.33	pendiente	\N	0.00	2026-08-19 20:43:40.319381	2026-08-19 20:43:40.319381
31	4	8	2027-04-16	2049.54	62.10	2111.64	4160.79	pendiente	\N	0.00	2026-08-19 20:43:40.32196	2026-08-19 20:43:40.32196
32	4	9	2027-05-16	2070.03	41.61	2111.64	2090.76	pendiente	\N	0.00	2026-08-19 20:43:40.324446	2026-08-19 20:43:40.324446
33	4	10	2027-06-15	2090.73	20.91	2111.64	0.03	pendiente	\N	0.00	2026-08-19 20:43:40.326867	2026-08-19 20:43:40.326867
24	4	1	2026-09-18	1911.64	200.00	2111.64	18088.36	pagada	2026-08-19	2111.64	2026-08-19 20:43:40.301595	2026-08-19 20:59:06.017018
\.


--
-- Data for Name: facturas; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.facturas (id, cliente_id, numero_factura, monto, fecha_emision, fecha_vencimiento, estado, creado_en) FROM stdin;
29	5	FAC-0001	20000.00	2026-08-20	2026-08-20	revision	2026-08-19 20:43:40.261237
\.


--
-- Data for Name: pagos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pagos (id, factura_id, monto, metodo, fecha_pago, creado_en) FROM stdin;
5	29	2111.64	transferencia	2026-08-19	2026-08-19 20:59:06.009058
\.


--
-- Data for Name: prestamos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.prestamos (id, cliente_id, contrato_id, monto_original, saldo_pendiente, cuotas_totales, cuotas_pagadas, frecuencia, tasa, fecha_inicio, fecha_proximo_pago, estado, creado_en, actualizado_en) FROM stdin;
3	5	14	30000.00	0.00	12	12	mensual	12.0000	2026-08-19	2026-09-18	pagado	2026-08-19 17:17:13.819393	2026-08-19 19:05:34.123374
4	5	15	20000.00	17888.36	10	1	mensual	12.0000	2026-08-19	2026-09-18	activo	2026-08-19 20:43:40.297943	2026-08-19 20:59:06.021191
\.


--
-- Data for Name: seguimientos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.seguimientos (id, cliente_id, tipo, comentario, estado, fecha, creado_en) FROM stdin;
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.usuarios (id, nombre, email, password, rol, creado_en) FROM stdin;
\.


--
-- Name: clientes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.clientes_id_seq', 5, true);


--
-- Name: contratos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.contratos_id_seq', 15, true);


--
-- Name: cuotas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.cuotas_id_seq', 33, true);


--
-- Name: facturas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.facturas_id_seq', 29, true);


--
-- Name: pagos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pagos_id_seq', 5, true);


--
-- Name: prestamos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.prestamos_id_seq', 4, true);


--
-- Name: seguimientos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.seguimientos_id_seq', 1, false);


--
-- Name: usuarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.usuarios_id_seq', 1, false);


--
-- Name: clientes clientes_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_email_key UNIQUE (email);


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);


--
-- Name: contratos contratos_numero_contrato_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contratos
    ADD CONSTRAINT contratos_numero_contrato_key UNIQUE (numero_contrato);


--
-- Name: contratos contratos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contratos
    ADD CONSTRAINT contratos_pkey PRIMARY KEY (id);


--
-- Name: cuotas cuotas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuotas
    ADD CONSTRAINT cuotas_pkey PRIMARY KEY (id);


--
-- Name: facturas facturas_numero_factura_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facturas
    ADD CONSTRAINT facturas_numero_factura_key UNIQUE (numero_factura);


--
-- Name: facturas facturas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facturas
    ADD CONSTRAINT facturas_pkey PRIMARY KEY (id);


--
-- Name: pagos pagos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_pkey PRIMARY KEY (id);


--
-- Name: prestamos prestamos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestamos
    ADD CONSTRAINT prestamos_pkey PRIMARY KEY (id);


--
-- Name: seguimientos seguimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seguimientos
    ADD CONSTRAINT seguimientos_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: contratos_numero_contrato_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX contratos_numero_contrato_idx ON public.contratos USING btree (numero_contrato) WHERE (numero_contrato IS NOT NULL);


--
-- Name: idx_cuotas_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cuotas_estado ON public.cuotas USING btree (estado);


--
-- Name: idx_cuotas_prestamo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cuotas_prestamo ON public.cuotas USING btree (prestamo_id);


--
-- Name: idx_prestamos_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prestamos_cliente ON public.prestamos USING btree (cliente_id);


--
-- Name: idx_prestamos_contrato; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prestamos_contrato ON public.prestamos USING btree (contrato_id);


--
-- Name: contratos contratos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contratos
    ADD CONSTRAINT contratos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;


--
-- Name: cuotas cuotas_prestamo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuotas
    ADD CONSTRAINT cuotas_prestamo_id_fkey FOREIGN KEY (prestamo_id) REFERENCES public.prestamos(id) ON DELETE CASCADE;


--
-- Name: facturas facturas_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facturas
    ADD CONSTRAINT facturas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;


--
-- Name: pagos pagos_factura_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_factura_id_fkey FOREIGN KEY (factura_id) REFERENCES public.facturas(id) ON DELETE CASCADE;


--
-- Name: prestamos prestamos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestamos
    ADD CONSTRAINT prestamos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;


--
-- Name: prestamos prestamos_contrato_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestamos
    ADD CONSTRAINT prestamos_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES public.contratos(id) ON DELETE SET NULL;


--
-- Name: seguimientos seguimientos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seguimientos
    ADD CONSTRAINT seguimientos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict Ve4gzYCw5ir9wB9xFbjFWWfKamueb20oRKvxP95dDVbLYGxYIUrDAmpr1OkYKXY

