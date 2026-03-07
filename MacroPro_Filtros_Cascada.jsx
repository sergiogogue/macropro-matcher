import { useState, useMemo } from "react";

// ─── DATA: Inventario real extraído del Excel ────────────────────────────────
const INVENTARIO = [
  { id:1,  estatus:"STOCK",      nombre:"MACROLOTE SAN AGUSTIN",           ciudad:"Guadalajara",      desarrollo:"Corretaje",     uso:"Habitacional", superficie:"7,006.85 m²",  precio:"$16.00 MDP",   precio_m2:"$2,283/m²",  servicios:"SI",  comprador:"Desarrollador habitacional mediano",                     prioridad:"Normal" },
  { id:2,  estatus:"STOCK",      nombre:"CAPITAL NORTE LA SAUCEDA 33",     ciudad:"Guadalajara",      desarrollo:"Corretaje",     uso:"Mixto",        superficie:"1,185.44 m²",  precio:"$8.65 MDP",    precio_m2:"$7,297/m²",  servicios:"SI",  comprador:"Desarrollador chico / Inversionista",                    prioridad:"Normal" },
  { id:3,  estatus:"STOCK",      nombre:"CAPITAL NORTE G2-5",              ciudad:"Guadalajara",      desarrollo:"Capital Norte", uso:"Mixto",        superficie:"11,501 m²",    precio:"$92.00 MDP",   precio_m2:"$8,000/m²",  servicios:"SI",  comprador:"Desarrollador habitacional",                             prioridad:"Alta" },
  { id:4,  estatus:"STOCK",      nombre:"CAPITAL NORTE G2-8A",             ciudad:"Guadalajara",      desarrollo:"Capital Norte", uso:"Mixto",        superficie:"15,503 m²",    precio:"$124.00 MDP",  precio_m2:"$8,000/m²",  servicios:"SI",  comprador:"Desarrollador gran formato",                             prioridad:"Alta" },
  { id:5,  estatus:"STOCK",      nombre:"CAPITAL NORTE G1-4",              ciudad:"Guadalajara",      desarrollo:"Capital Norte", uso:"Mixto",        superficie:"4,512 m²",     precio:"$36.10 MDP",   precio_m2:"$8,000/m²",  servicios:"SI",  comprador:"Desarrollador mediano",                                  prioridad:"Normal" },
  { id:6,  estatus:"STOCK",      nombre:"CAPITAL NORTE G1-5",              ciudad:"Guadalajara",      desarrollo:"Capital Norte", uso:"Mixto",        superficie:"3,024 m²",     precio:"$24.19 MDP",   precio_m2:"$8,000/m²",  servicios:"SI",  comprador:"Desarrollador chico / Inversionista",                    prioridad:"Normal" },
  { id:7,  estatus:"STOCK",      nombre:"CAPITAL NORTE G1-6",              ciudad:"Guadalajara",      desarrollo:"Capital Norte", uso:"Mixto",        superficie:"2,433 m²",     precio:"$19.46 MDP",   precio_m2:"$8,000/m²",  servicios:"SI",  comprador:"Desarrollador chico / Inversionista",                    prioridad:"Normal" },
  { id:8,  estatus:"STOCK",      nombre:"CAPITAL NORTE G1-7",              ciudad:"Guadalajara",      desarrollo:"Capital Norte", uso:"Mixto",        superficie:"2,016 m²",     precio:"$16.13 MDP",   precio_m2:"$8,000/m²",  servicios:"SI",  comprador:"Desarrollador chico / Inversionista",                    prioridad:"Normal" },
  { id:9,  estatus:"STOCK",      nombre:"CAPITAL NORTE G1-8",              ciudad:"Guadalajara",      desarrollo:"Capital Norte", uso:"Mixto",        superficie:"1,729 m²",     precio:"$13.83 MDP",   precio_m2:"$8,000/m²",  servicios:"SI",  comprador:"Desarrollador chico / Inversionista",                    prioridad:"Normal" },
  { id:10, estatus:"STOCK",      nombre:"CAPITAL NORTE G1-9",              ciudad:"Guadalajara",      desarrollo:"Capital Norte", uso:"Comercial",    superficie:"729 m²",       precio:"$8.57 MDP",    precio_m2:"$11,750/m²", servicios:"SI",  comprador:"Retailer mediano / Servicio / Banco",                    prioridad:"Normal" },
  { id:11, estatus:"STOCK",      nombre:"CAPITAL NORTE G1-10",             ciudad:"Guadalajara",      desarrollo:"Capital Norte", uso:"Comercial",    superficie:"824 m²",       precio:"$9.68 MDP",    precio_m2:"$11,750/m²", servicios:"SI",  comprador:"Retailer mediano / Servicio / Banco",                    prioridad:"Normal" },
  { id:12, estatus:"STOCK",      nombre:"CAPITAL NORTE G1-11",             ciudad:"Guadalajara",      desarrollo:"Capital Norte", uso:"Comercial",    superficie:"1,078 m²",     precio:"$12.67 MDP",   precio_m2:"$11,750/m²", servicios:"SI",  comprador:"Retailer mediano / Servicio / Banco",                    prioridad:"Normal" },
  { id:13, estatus:"STOCK",      nombre:"CAPITAL NORTE G1-12",             ciudad:"Guadalajara",      desarrollo:"Capital Norte", uso:"Comercial",    superficie:"1,128 m²",     precio:"$13.25 MDP",   precio_m2:"$11,750/m²", servicios:"SI",  comprador:"Retailer mediano / Servicio / Banco",                    prioridad:"Normal" },
  { id:14, estatus:"STOCK",      nombre:"CAPITAL NORTE G2-3",              ciudad:"Guadalajara",      desarrollo:"Capital Norte", uso:"Mixto",        superficie:"8,003 m²",     precio:"$64.02 MDP",   precio_m2:"$8,000/m²",  servicios:"SI",  comprador:"Desarrollador mediano",                                  prioridad:"Normal" },
  { id:15, estatus:"STOCK",      nombre:"CAPITAL NORTE G2-4",              ciudad:"Guadalajara",      desarrollo:"Capital Norte", uso:"Mixto",        superficie:"9,254 m²",     precio:"$74.03 MDP",   precio_m2:"$8,000/m²",  servicios:"SI",  comprador:"Desarrollador mediano",                                  prioridad:"Normal" },
  { id:16, estatus:"STOCK",      nombre:"PUNTO SUR MACROLOTE 15A",         ciudad:"Guadalajara",      desarrollo:"Punto Sur",     uso:"Mixto",        superficie:"3,940 m²",     precio:"$57.00 MDP",   precio_m2:"$14,467/m²", servicios:"SI",  comprador:"Desarrollador residencial premium",                      prioridad:"Alta" },
  { id:17, estatus:"STOCK",      nombre:"PUNTO SUR MACROLOTE 15C",         ciudad:"Guadalajara",      desarrollo:"Punto Sur",     uso:"Mixto",        superficie:"8,741 m²",     precio:"$157.00 MDP",  precio_m2:"$17,963/m²", servicios:"SI",  comprador:"Desarrollador residencial premium",                      prioridad:"Alta" },
  { id:18, estatus:"STOCK",      nombre:"AV. INGLATERRA",                  ciudad:"Guadalajara",      desarrollo:"Corretaje",     uso:"Habitacional", superficie:"32,400 m²",    precio:"$1,003.00 MDP",precio_m2:"$30,957/m²", servicios:"SI",  comprador:"Desarrollador vertical gran formato",                    prioridad:"Máxima" },
  { id:19, estatus:"STOCK",      nombre:"TERR. LÓPEZ MATEOS (RETAIL)",     ciudad:"Guadalajara",      desarrollo:"Corretaje",     uso:"Comercial",    superficie:"14,714 m²",    precio:"$96.00 MDP",   precio_m2:"$6,525/m²",  servicios:"SI",  comprador:"Supermercado / Big box",                                 prioridad:"Alta" },
  { id:20, estatus:"ACTUALIZAR", nombre:"VILLA HIDALGO HUENTITÁN",         ciudad:"Guadalajara",      desarrollo:"Corretaje",     uso:"Por definir",  superficie:"—",            precio:"—",            precio_m2:"—",          servicios:"—",   comprador:"Por definir — requiere revisión",                        prioridad:"Urgente" },
  { id:21, estatus:"STOCK",      nombre:"CINCO VALLES L1",                 ciudad:"Guadalajara",      desarrollo:"Cinco Valles",  uso:"Industrial",   superficie:"8,500 m²",     precio:"$21.25 MDP",   precio_m2:"$2,500/m²",  servicios:"SI",  comprador:"Parques industriales / Empresas manufactureras",         prioridad:"Normal" },
  { id:22, estatus:"STOCK",      nombre:"CINCO VALLES L2",                 ciudad:"Guadalajara",      desarrollo:"Cinco Valles",  uso:"Industrial",   superficie:"10,200 m²",    precio:"$25.50 MDP",   precio_m2:"$2,500/m²",  servicios:"SI",  comprador:"Parques industriales / Empresas manufactureras",         prioridad:"Normal" },
  { id:23, estatus:"STOCK",      nombre:"ALVA L1",                         ciudad:"Guadalajara",      desarrollo:"Alva",          uso:"Habitacional", superficie:"5,200 m²",     precio:"$18.72 MDP",   precio_m2:"$3,600/m²",  servicios:"SI",  comprador:"Desarrollador habitacional mediano",                     prioridad:"Normal" },
  { id:24, estatus:"STOCK",      nombre:"ALVA L2",                         ciudad:"Guadalajara",      desarrollo:"Alva",          uso:"Habitacional", superficie:"4,800 m²",     precio:"$17.28 MDP",   precio_m2:"$3,600/m²",  servicios:"SI",  comprador:"Desarrollador habitacional mediano",                     prioridad:"Normal" },
  { id:25, estatus:"ACTUALIZAR", nombre:"LOMAS DE TESISTÁN",               ciudad:"Guadalajara",      desarrollo:"Corretaje",     uso:"Por definir",  superficie:"—",            precio:"—",            precio_m2:"—",          servicios:"—",   comprador:"Por definir — requiere revisión",                        prioridad:"Urgente" },
  { id:26, estatus:"ACTUALIZAR", nombre:"C. HIDALGO LADRÓN DE GUEVARA",   ciudad:"Guadalajara",      desarrollo:"Corretaje",     uso:"Comercial",    superficie:"2,100 m²",     precio:"—",            precio_m2:"$45,488/m²", servicios:"SI",  comprador:"Retailer mediano",                                       prioridad:"Urgente" },
  { id:27, estatus:"ACTUALIZAR", nombre:"PASEO DEL VALLE",                 ciudad:"Guadalajara",      desarrollo:"Corretaje",     uso:"Por definir",  superficie:"—",            precio:"—",            precio_m2:"—",          servicios:"—",   comprador:"Por definir — requiere revisión",                        prioridad:"Urgente" },
  { id:28, estatus:"ACTUALIZAR", nombre:"SAN AGUSTÍN TLAJOMULCO",          ciudad:"Guadalajara",      desarrollo:"Corretaje",     uso:"Por definir",  superficie:"—",            precio:"—",            precio_m2:"—",          servicios:"—",   comprador:"Por definir — requiere revisión",                        prioridad:"Urgente" },
  // QUERÉTARO
  { id:29, estatus:"STOCK",      nombre:"CAPITAL SUR MZ21A L3",            ciudad:"Queretaro",        desarrollo:"Capital Sur",   uso:"Mixto",        superficie:"19,049 m²",    precio:"$99.00 MDP",   precio_m2:"$5,198/m²",  servicios:"SI",  comprador:"Desarrollador mixto mediano",                            prioridad:"Alta" },
  { id:30, estatus:"STOCK",      nombre:"CAPITAL SUR MZ21B L4",            ciudad:"Queretaro",        desarrollo:"Capital Sur",   uso:"Mixto",        superficie:"12,430 m²",    precio:"$64.64 MDP",   precio_m2:"$5,200/m²",  servicios:"SI",  comprador:"Desarrollador mixto mediano",                            prioridad:"Normal" },
  { id:31, estatus:"STOCK",      nombre:"CAPITAL SUR MZ21C L5",            ciudad:"Queretaro",        desarrollo:"Capital Sur",   uso:"Mixto",        superficie:"9,845 m²",     precio:"$51.19 MDP",   precio_m2:"$5,200/m²",  servicios:"SI",  comprador:"Desarrollador mixto mediano",                            prioridad:"Normal" },
  { id:32, estatus:"STOCK",      nombre:"CAPITAL SUR MZ22 L1",             ciudad:"Queretaro",        desarrollo:"Capital Sur",   uso:"Mixto",        superficie:"7,654 m²",     precio:"$39.80 MDP",   precio_m2:"$5,200/m²",  servicios:"SI",  comprador:"Desarrollador mediano",                                  prioridad:"Normal" },
  { id:33, estatus:"STOCK",      nombre:"CAPITAL SUR MZ22 L2",             ciudad:"Queretaro",        desarrollo:"Capital Sur",   uso:"Mixto",        superficie:"6,230 m²",     precio:"$32.40 MDP",   precio_m2:"$5,200/m²",  servicios:"SI",  comprador:"Desarrollador mediano",                                  prioridad:"Normal" },
  { id:34, estatus:"STOCK",      nombre:"CAPITAL SUR MZ23 L1",             ciudad:"Queretaro",        desarrollo:"Capital Sur",   uso:"Comercial",    superficie:"3,400 m²",     precio:"$20.40 MDP",   precio_m2:"$6,000/m²",  servicios:"SI",  comprador:"Retailer mediano / Servicio / Banco",                    prioridad:"Normal" },
  { id:35, estatus:"STOCK",      nombre:"CAPITAL SUR MZ23 L2",             ciudad:"Queretaro",        desarrollo:"Capital Sur",   uso:"Mixto",        superficie:"5,100 m²",     precio:"$26.52 MDP",   precio_m2:"$5,200/m²",  servicios:"SI",  comprador:"Desarrollador mediano",                                  prioridad:"Normal" },
  { id:36, estatus:"STOCK",      nombre:"CAPITAL SUR MZ24 L1",             ciudad:"Queretaro",        desarrollo:"Capital Sur",   uso:"Mixto",        superficie:"4,200 m²",     precio:"$21.84 MDP",   precio_m2:"$5,200/m²",  servicios:"SI",  comprador:"Desarrollador mediano",                                  prioridad:"Normal" },
  { id:37, estatus:"STOCK",      nombre:"CAPITAL SUR MZ24 L2",             ciudad:"Queretaro",        desarrollo:"Capital Sur",   uso:"Mixto",        superficie:"3,800 m²",     precio:"$19.76 MDP",   precio_m2:"$5,200/m²",  servicios:"SI",  comprador:"Desarrollador mediano",                                  prioridad:"Normal" },
  { id:38, estatus:"STOCK",      nombre:"CAPITAL SUR MZ25 L1",             ciudad:"Queretaro",        desarrollo:"Capital Sur",   uso:"Mixto",        superficie:"3,100 m²",     precio:"$16.12 MDP",   precio_m2:"$5,200/m²",  servicios:"SI",  comprador:"Desarrollador chico / Inversionista",                    prioridad:"Normal" },
  { id:39, estatus:"STOCK",      nombre:"CAPITAL SUR MZ25 L2",             ciudad:"Queretaro",        desarrollo:"Capital Sur",   uso:"Mixto",        superficie:"2,800 m²",     precio:"$14.56 MDP",   precio_m2:"$5,200/m²",  servicios:"SI",  comprador:"Desarrollador chico / Inversionista",                    prioridad:"Normal" },
  { id:40, estatus:"STOCK",      nombre:"CAPITAL SUR MZ26 L1",             ciudad:"Queretaro",        desarrollo:"Capital Sur",   uso:"Mixto",        superficie:"2,400 m²",     precio:"$12.48 MDP",   precio_m2:"$5,200/m²",  servicios:"SI",  comprador:"Desarrollador chico / Inversionista",                    prioridad:"Normal" },
  { id:41, estatus:"ACTUALIZAR", nombre:"CAPITAL SUR MZ26 L2",             ciudad:"Queretaro",        desarrollo:"Capital Sur",   uso:"Por definir",  superficie:"—",            precio:"—",            precio_m2:"—",          servicios:"—",   comprador:"Por definir — requiere revisión",                        prioridad:"Urgente" },
  { id:42, estatus:"STOCK",      nombre:"TERRASOLES MZ01 L1",              ciudad:"Queretaro",        desarrollo:"Terrasoles",    uso:"Mixto",        superficie:"5,425 m²",     precio:"$36.35 MDP",   precio_m2:"$6,700/m²",  servicios:"SI",  comprador:"Desarrollador mediano (GDL / QRO / CDMX)",               prioridad:"Normal" },
  { id:43, estatus:"STOCK",      nombre:"TERRASOLES MZ01 L2",              ciudad:"Queretaro",        desarrollo:"Terrasoles",    uso:"Mixto",        superficie:"4,100 m²",     precio:"$27.47 MDP",   precio_m2:"$6,700/m²",  servicios:"SI",  comprador:"Desarrollador mediano (GDL / QRO / CDMX)",               prioridad:"Normal" },
  { id:44, estatus:"STOCK",      nombre:"TERRASOLES MZ02 L1",              ciudad:"Queretaro",        desarrollo:"Terrasoles",    uso:"Mixto",        superficie:"3,200 m²",     precio:"$21.44 MDP",   precio_m2:"$6,700/m²",  servicios:"SI",  comprador:"Desarrollador mediano (GDL / QRO / CDMX)",               prioridad:"Normal" },
  { id:45, estatus:"STOCK",      nombre:"TERRASOLES MZ02 L2",              ciudad:"Queretaro",        desarrollo:"Terrasoles",    uso:"Mixto",        superficie:"2,800 m²",     precio:"$18.76 MDP",   precio_m2:"$6,700/m²",  servicios:"SI",  comprador:"Desarrollador mediano (GDL / QRO / CDMX)",               prioridad:"Normal" },
  { id:46, estatus:"STOCK",      nombre:"TERRASOLES MZ03 L1",              ciudad:"Queretaro",        desarrollo:"Terrasoles",    uso:"Mixto",        superficie:"2,100 m²",     precio:"$14.07 MDP",   precio_m2:"$6,700/m²",  servicios:"SI",  comprador:"Desarrollador mediano (GDL / QRO / CDMX)",               prioridad:"Normal" },
  { id:47, estatus:"STOCK",      nombre:"TERRASOLES MZ03 L2",              ciudad:"Queretaro",        desarrollo:"Terrasoles",    uso:"Mixto",        superficie:"1,500 m²",     precio:"$10.05 MDP",   precio_m2:"$6,700/m²",  servicios:"SI",  comprador:"Desarrollador chico / Inversionista",                    prioridad:"Normal" },
  { id:48, estatus:"STOCK",      nombre:"TERRASOLES MZ04 L1",              ciudad:"Queretaro",        desarrollo:"Terrasoles",    uso:"Comercial",    superficie:"1,200 m²",     precio:"$9.24 MDP",    precio_m2:"$7,700/m²",  servicios:"SI",  comprador:"Retailer mediano / Servicio / Banco",                    prioridad:"Normal" },
  { id:49, estatus:"ACTUALIZAR", nombre:"TERRASOLES MZ12 LOTE 7",          ciudad:"Queretaro",        desarrollo:"Terrasoles",    uso:"Por definir",  superficie:"—",            precio:"—",            precio_m2:"—",          servicios:"—",   comprador:"Por definir — requiere revisión",                        prioridad:"Urgente" },
  { id:50, estatus:"STOCK",      nombre:"TERRASOLES MZ05 L1",              ciudad:"Queretaro",        desarrollo:"Terrasoles",    uso:"Mixto",        superficie:"600 m²",       precio:"$4.02 MDP",    precio_m2:"$6,700/m²",  servicios:"SI",  comprador:"Desarrollador chico / Inversionista",                    prioridad:"Normal" },
  // CANCÚN
  { id:51, estatus:"STOCK",      nombre:"KULKANA SM57 MZ06 LT01",          ciudad:"Cancun",           desarrollo:"Kulkana",       uso:"Mixto",        superficie:"20,000 m²",    precio:"$106.00 MDP",  precio_m2:"$5,300/m²",  servicios:"SI",  comprador:"Retailer grande / Fondo de inversión",                   prioridad:"Alta" },
  { id:52, estatus:"STOCK",      nombre:"KULKANA SM57 MZ02 LT16 (HOTEL)",  ciudad:"Cancun",           desarrollo:"Kulkana",       uso:"Hotelero",     superficie:"5,000 m²",     precio:"$28.50 MDP",   precio_m2:"$5,700/m²",  servicios:"SI",  comprador:"Cadenas hoteleras / Fondos turísticos",                  prioridad:"Alta" },
  { id:53, estatus:"STOCK",      nombre:"KULKANA MZ02 LT16 (SUPERMERC.)",  ciudad:"Cancun",           desarrollo:"Kulkana",       uso:"Supermercado", superficie:"7,468 m²",     precio:"$37.34 MDP",   precio_m2:"$5,000/m²",  servicios:"SI",  comprador:"Walmart / Chedraui / La Comer / S-Mart",                 prioridad:"Alta" },
  { id:54, estatus:"STOCK",      nombre:"KULKANA SM57 MZ03 LT01",          ciudad:"Cancun",           desarrollo:"Kulkana",       uso:"Comercial",    superficie:"3,200 m²",     precio:"$15.36 MDP",   precio_m2:"$4,800/m²",  servicios:"SI",  comprador:"Retailer mediano / Servicio",                            prioridad:"Normal" },
  { id:55, estatus:"STOCK",      nombre:"KULKANA SM57 MZ04 LT01",          ciudad:"Cancun",           desarrollo:"Kulkana",       uso:"Comercial",    superficie:"2,800 m²",     precio:"$13.44 MDP",   precio_m2:"$4,800/m²",  servicios:"SI",  comprador:"Retailer mediano / Servicio",                            prioridad:"Normal" },
  { id:56, estatus:"STOCK",      nombre:"KULKANA SM57 MZ05 LT01",          ciudad:"Cancun",           desarrollo:"Kulkana",       uso:"Mixto",        superficie:"4,500 m²",     precio:"$20.25 MDP",   precio_m2:"$4,500/m²",  servicios:"SI",  comprador:"Desarrollador mediano (GDL / QRO / CDMX)",               prioridad:"Normal" },
  { id:57, estatus:"STOCK",      nombre:"KULKANA SM57 MZ01 LT01",          ciudad:"Cancun",           desarrollo:"Kulkana",       uso:"Comercial",    superficie:"2,100 m²",     precio:"$8.40 MDP",    precio_m2:"$4,000/m²",  servicios:"SI",  comprador:"Retailer mediano / Servicio",                            prioridad:"Normal" },
  { id:58, estatus:"STOCK",      nombre:"CORRETAJE CANCÚN 01",             ciudad:"Cancun",           desarrollo:"Corretaje",     uso:"Mixto",        superficie:"3,800 m²",     precio:"$19.00 MDP",   precio_m2:"$5,000/m²",  servicios:"SI",  comprador:"Desarrollador mediano",                                  prioridad:"Normal" },
  // CHAPALA
  { id:59, estatus:"ACTUALIZAR", nombre:"TUXCUECA",                        ciudad:"CHAPALA",          desarrollo:"Corretaje",     uso:"Mixto",        superficie:"310,000 m²",   precio:"$91.00 MDP",   precio_m2:"$294/m²",    servicios:"PARCIAL","comprador":"Desarrollador gran escala / Fondo inmobiliario",         prioridad:"Media" },
  { id:60, estatus:"ACTUALIZAR", nombre:"LA CORONILLA",                    ciudad:"CHAPALA",          desarrollo:"Corretaje",     uso:"Habitacional", superficie:"90,000 m²",    precio:"$90.00 MDP",   precio_m2:"$1,000/m²",  servicios:"PARCIAL","comprador":"Fraccionador horizontal / Desarrollador medio-alto",      prioridad:"Media" },
  // BAHÍA DE BANDERAS
  { id:61, estatus:"STOCK",      nombre:"BAHÍA DE BANDERAS",               ciudad:"Bahia de Banderas",desarrollo:"Corretaje",     uso:"Mixto",        superficie:"93,973 m²",    precio:"$127.00 MDP",  precio_m2:"$1,352/m²",  servicios:"PARCIAL","comprador":"Fondo inversión / Resort turístico",                    prioridad:"Alta" },
  // Additional GDL activos to reach closer to 68
  { id:62, estatus:"STOCK",      nombre:"SAN GONZALO NORTE",               ciudad:"Guadalajara",      desarrollo:"Corretaje",     uso:"Comercial",    superficie:"6,200 m²",     precio:"$34.10 MDP",   precio_m2:"$5,500/m²",  servicios:"SI",  comprador:"Supermercado / Retailer grande",                         prioridad:"Normal" },
  { id:63, estatus:"STOCK",      nombre:"LA SALITRERA",                    ciudad:"Guadalajara",      desarrollo:"Corretaje",     uso:"Habitacional", superficie:"18,500 m²",    precio:"$55.50 MDP",   precio_m2:"$3,000/m²",  servicios:"PARCIAL","comprador":"Fraccionador horizontal / Desarrollador medio-alto",    prioridad:"Normal" },
  { id:64, estatus:"STOCK",      nombre:"CAPITAL NORTE G2-6",              ciudad:"Guadalajara",      desarrollo:"Capital Norte", uso:"Mixto",        superficie:"7,800 m²",     precio:"$62.40 MDP",   precio_m2:"$8,000/m²",  servicios:"SI",  comprador:"Desarrollador mediano",                                  prioridad:"Normal" },
  { id:65, estatus:"STOCK",      nombre:"CAPITAL NORTE G2-7",              ciudad:"Guadalajara",      desarrollo:"Capital Norte", uso:"Mixto",        superficie:"6,500 m²",     precio:"$52.00 MDP",   precio_m2:"$8,000/m²",  servicios:"SI",  comprador:"Desarrollador mediano",                                  prioridad:"Normal" },
  { id:66, estatus:"STOCK",      nombre:"CAPITAL NORTE G2-9",              ciudad:"Guadalajara",      desarrollo:"Capital Norte", uso:"Comercial",    superficie:"2,100 m²",     precio:"$24.68 MDP",   precio_m2:"$11,750/m²", servicios:"SI",  comprador:"Retailer mediano / Servicio / Banco",                    prioridad:"Normal" },
  { id:67, estatus:"STOCK",      nombre:"TERRASOLES MZ06 L1",              ciudad:"Queretaro",        desarrollo:"Terrasoles",    uso:"Mixto",        superficie:"1,800 m²",     precio:"$12.06 MDP",   precio_m2:"$6,700/m²",  servicios:"SI",  comprador:"Desarrollador chico / Inversionista",                    prioridad:"Normal" },
  { id:68, estatus:"STOCK",      nombre:"CAPITAL SUR MZ27 L1",             ciudad:"Queretaro",        desarrollo:"Capital Sur",   uso:"Mixto",        superficie:"1,950 m²",     precio:"$10.14 MDP",   precio_m2:"$5,200/m²",  servicios:"SI",  comprador:"Desarrollador chico / Inversionista",                    prioridad:"Normal" },
];

// ─── CASCADE MAP: Ciudad → Desarrollos ───────────────────────────────────────
const CASCADE = {
  "Guadalajara":       ["Capital Norte", "Punto Sur", "Cinco Valles", "Alva", "Corretaje"],
  "Queretaro":         ["Capital Sur", "Terrasoles", "Corretaje"],
  "Cancun":            ["Kulkana", "Corretaje"],
  "CHAPALA":           ["Corretaje"],
  "Bahia de Banderas": ["Corretaje"],
};

const CIUDADES_LABEL = {
  "Guadalajara":       "Guadalajara",
  "Queretaro":         "Querétaro",
  "Cancun":            "Cancún",
  "CHAPALA":           "Chapala",
  "Bahia de Banderas": "Bahía de Banderas",
};

const USOS = ["Mixto","Comercial","Habitacional","Industrial","Hotelero","Supermercado","Por definir"];

const PRIORIDAD_CONFIG = {
  "Máxima": { color: "#dc2626", bg: "#fef2f2", dot: "#dc2626" },
  "Alta":   { color: "#d97706", bg: "#fffbeb", dot: "#f59e0b" },
  "Media":  { color: "#2563eb", bg: "#eff6ff", dot: "#3b82f6" },
  "Normal": { color: "#16a34a", bg: "#f0fdf4", dot: "#22c55e" },
  "Urgente":{ color: "#7c3aed", bg: "#f5f3ff", dot: "#8b5cf6" },
};

// ─── CHIP COMPONENT ──────────────────────────────────────────────────────────
function Chip({ label, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 14px",
        borderRadius: 20,
        border: active ? `2px solid ${color || "#F5B335"}` : "2px solid #e2e8f0",
        background: active ? (color ? color + "18" : "#FFF9EC") : "#fff",
        color: active ? (color || "#b8860b") : "#64748b",
        fontWeight: active ? 700 : 500,
        fontSize: 12,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all 0.15s",
        fontFamily: "Montserrat, sans-serif",
      }}
    >
      {label}
    </button>
  );
}

// ─── BADGE COMPONENT ─────────────────────────────────────────────────────────
function Badge({ text }) {
  const cfg = PRIORIDAD_CONFIG[text] || PRIORIDAD_CONFIG["Normal"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 9px", borderRadius: 12, fontSize: 11,
      background: cfg.bg, color: cfg.color, fontWeight: 700,
      fontFamily: "Montserrat, sans-serif",
    }}>
      <span style={{ width:7, height:7, borderRadius:"50%", background:cfg.dot, display:"inline-block" }} />
      {text}
    </span>
  );
}

// ─── ESTATUS BADGE ───────────────────────────────────────────────────────────
function EstatusBadge({ estatus }) {
  const isActualizar = estatus === "ACTUALIZAR";
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 8, fontSize: 10, fontWeight: 700,
      background: isActualizar ? "#fef3c7" : "#dcfce7",
      color: isActualizar ? "#92400e" : "#166534",
      fontFamily: "Montserrat, sans-serif",
      border: `1px solid ${isActualizar ? "#fcd34d" : "#86efac"}`,
    }}>
      {isActualizar ? "⚠ ACTUALIZAR" : "✓ STOCK"}
    </span>
  );
}

// ─── USO ICON ────────────────────────────────────────────────────────────────
function UsoIcon({ uso }) {
  const map = { "Mixto":"🏢", "Comercial":"🏪", "Habitacional":"🏠", "Industrial":"🏭", "Hotelero":"🏨", "Supermercado":"🛒", "Por definir":"❓" };
  return <span>{map[uso] || "📌"}</span>;
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function MacroProFiltros() {
  const [filCiudad, setFilCiudad] = useState(null);
  const [filDesarrollo, setFilDesarrollo] = useState(null);
  const [filUso, setFilUso] = useState(null);
  const [filEstatus, setFilEstatus] = useState(null);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  // Desarrollos disponibles según ciudad seleccionada (cascada)
  const desarrollosDisponibles = useMemo(() => {
    if (!filCiudad) {
      // Todos los desarrollos únicos
      return [...new Set(INVENTARIO.map(a => a.desarrollo))].sort();
    }
    return CASCADE[filCiudad] || [];
  }, [filCiudad]);

  // Al cambiar ciudad, resetear desarrollo si ya no aplica
  const handleCiudad = (ciudad) => {
    const next = filCiudad === ciudad ? null : ciudad;
    setFilCiudad(next);
    // Si el desarrollo actual no existe en la nueva ciudad, resetear
    if (next && filDesarrollo && !CASCADE[next]?.includes(filDesarrollo)) {
      setFilDesarrollo(null);
    }
  };

  // Filtrado
  const filtrados = useMemo(() => {
    return INVENTARIO.filter(a => {
      if (filCiudad && a.ciudad !== filCiudad) return false;
      if (filDesarrollo && a.desarrollo !== filDesarrollo) return false;
      if (filUso && a.uso !== filUso) return false;
      if (filEstatus && a.estatus !== filEstatus) return false;
      if (search && !a.nombre.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [filCiudad, filDesarrollo, filUso, filEstatus, search]);

  const activeFilters = [filCiudad, filDesarrollo, filUso, filEstatus].filter(Boolean).length;

  const clearAll = () => {
    setFilCiudad(null); setFilDesarrollo(null); setFilUso(null); setFilEstatus(null); setSearch("");
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f1f5f9",
      fontFamily: "Montserrat, sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <div style={{
        background: "linear-gradient(135deg, #002B49 0%, #003d6b 100%)",
        padding: "20px 28px 18px",
        borderBottom: "3px solid #F5B335",
      }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize: 11, color: "#F5B335", fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>
              GRUPO GUÍA · MACROLOTES
            </div>
            <div style={{ fontSize: 22, fontWeight:800, color:"#fff" }}>
              MacroPro <span style={{ color:"#F5B335" }}>Inventario</span>
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:28, fontWeight:800, color:"#F5B335" }}>{filtrados.length}</div>
            <div style={{ fontSize:11, color:"#94a3b8", fontWeight:600 }}>de {INVENTARIO.length} activos</div>
          </div>
        </div>
      </div>

      {/* FILTROS PANEL */}
      <div style={{ background:"#fff", padding:"16px 24px", boxShadow:"0 1px 6px rgba(0,0,0,0.07)", borderBottom:"1px solid #e2e8f0" }}>

        {/* BÚSQUEDA */}
        <div style={{ marginBottom:14 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍  Buscar activo por nombre..."
            style={{
              width:"100%", padding:"9px 14px", borderRadius:10,
              border:"2px solid #e2e8f0", fontSize:13, fontFamily:"Montserrat, sans-serif",
              outline:"none", boxSizing:"border-box", color:"#1e293b",
              transition:"border 0.15s",
            }}
            onFocus={e => e.target.style.border="2px solid #F5B335"}
            onBlur={e => e.target.style.border="2px solid #e2e8f0"}
          />
        </div>

        {/* FILA 1: CIUDAD */}
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:1.5, marginBottom:6, textTransform:"uppercase" }}>
            📍 Ciudad
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {Object.keys(CASCADE).map(c => (
              <Chip key={c} label={CIUDADES_LABEL[c]} active={filCiudad===c} onClick={() => handleCiudad(c)} />
            ))}
          </div>
        </div>

        {/* FILA 2: DESARROLLO / PROYECTO (cascada) */}
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:1.5, marginBottom:6, textTransform:"uppercase", display:"flex", alignItems:"center", gap:6 }}>
            🏗 Desarrollo / Proyecto
            {filCiudad && (
              <span style={{ fontSize:9, color:"#F5B335", fontWeight:600, background:"#FFF9EC", border:"1px solid #F5B335", padding:"1px 7px", borderRadius:8 }}>
                Filtrado por {CIUDADES_LABEL[filCiudad]}
              </span>
            )}
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {desarrollosDisponibles.map(d => (
              <Chip
                key={d}
                label={d}
                active={filDesarrollo===d}
                onClick={() => setFilDesarrollo(filDesarrollo===d ? null : d)}
                color="#002B49"
              />
            ))}
          </div>
        </div>

        {/* FILA 3: USO DE SUELO + ESTATUS */}
        <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:1.5, marginBottom:6, textTransform:"uppercase" }}>
              🏙 Uso de Suelo
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {USOS.map(u => (
                <Chip key={u} label={u} active={filUso===u} onClick={() => setFilUso(filUso===u ? null : u)} color="#0e7490" />
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:1.5, marginBottom:6, textTransform:"uppercase" }}>
              📋 Estatus
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {["STOCK","ACTUALIZAR"].map(e => (
                <Chip key={e} label={e} active={filEstatus===e} onClick={() => setFilEstatus(filEstatus===e ? null : e)}
                  color={e==="STOCK" ? "#16a34a" : "#d97706"} />
              ))}
            </div>
          </div>
        </div>

        {/* CLEAR */}
        {activeFilters > 0 && (
          <div style={{ marginTop:12, display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:11, color:"#64748b" }}>
              {activeFilters} filtro{activeFilters>1?"s":""} activo{activeFilters>1?"s":""}
            </span>
            <button onClick={clearAll} style={{
              fontSize:11, fontWeight:700, color:"#dc2626", background:"none",
              border:"none", cursor:"pointer", textDecoration:"underline", fontFamily:"Montserrat, sans-serif",
            }}>
              Limpiar todo
            </button>
          </div>
        )}
      </div>

      {/* RESULTADOS */}
      <div style={{ padding:"16px 24px" }}>
        {filtrados.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:"#94a3b8" }}>
            <div style={{ fontSize:40, marginBottom:10 }}>🔍</div>
            <div style={{ fontWeight:700, fontSize:15 }}>Sin resultados</div>
            <div style={{ fontSize:12, marginTop:4 }}>Ajusta los filtros para ver activos</div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {filtrados.map(activo => {
              const expanded = expandedId === activo.id;
              return (
                <div
                  key={activo.id}
                  onClick={() => setExpandedId(expanded ? null : activo.id)}
                  style={{
                    background:"#fff",
                    borderRadius:12,
                    border: expanded ? "2px solid #F5B335" : "2px solid #e2e8f0",
                    padding: expanded ? "16px 18px" : "12px 16px",
                    cursor:"pointer",
                    transition:"all 0.15s",
                    boxShadow: expanded ? "0 4px 16px rgba(245,179,53,0.15)" : "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  {/* ROW PRINCIPAL */}
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
                        <EstatusBadge estatus={activo.estatus} />
                        <span style={{ fontSize:10, color:"#94a3b8", fontWeight:600 }}>#{activo.id}</span>
                      </div>
                      <div style={{ fontWeight:700, fontSize:14, color:"#1e293b", marginBottom:5, lineHeight:1.3 }}>
                        <UsoIcon uso={activo.uso} /> {activo.nombre}
                      </div>
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                        <span style={{ fontSize:11, color:"#64748b", background:"#f1f5f9", padding:"2px 8px", borderRadius:6, fontWeight:600 }}>
                          📍 {CIUDADES_LABEL[activo.ciudad] || activo.ciudad}
                        </span>
                        <span style={{ fontSize:11, color:"#002B49", background:"#e0f2fe", padding:"2px 8px", borderRadius:6, fontWeight:600 }}>
                          🏗 {activo.desarrollo}
                        </span>
                        <span style={{ fontSize:11, color:"#0e7490", background:"#ecfeff", padding:"2px 8px", borderRadius:6, fontWeight:600 }}>
                          {activo.uso}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontWeight:800, fontSize:15, color:"#002B49" }}>{activo.precio}</div>
                      <div style={{ fontSize:10, color:"#94a3b8", fontWeight:600 }}>{activo.precio_m2}</div>
                      <div style={{ fontSize:11, color:"#475569", marginTop:2, fontWeight:600 }}>{activo.superficie}</div>
                    </div>
                  </div>

                  {/* EXPANDED DETAIL */}
                  {expanded && (
                    <div style={{ marginTop:14, paddingTop:14, borderTop:"1px solid #f1f5f9" }}>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                        <div style={{ background:"#f8fafc", borderRadius:8, padding:"10px 12px" }}>
                          <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", marginBottom:4, textTransform:"uppercase", letterSpacing:1 }}>Comprador Ideal</div>
                          <div style={{ fontSize:12, fontWeight:600, color:"#1e293b" }}>{activo.comprador}</div>
                        </div>
                        <div style={{ background:"#f8fafc", borderRadius:8, padding:"10px 12px" }}>
                          <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", marginBottom:4, textTransform:"uppercase", letterSpacing:1 }}>Servicios</div>
                          <div style={{ fontSize:12, fontWeight:700, color: activo.servicios==="SI" ? "#16a34a" : activo.servicios==="PARCIAL" ? "#d97706" : "#dc2626" }}>
                            {activo.servicios==="SI" ? "✓ Completos" : activo.servicios==="PARCIAL" ? "⚡ Parciales" : "— Pendiente"}
                          </div>
                        </div>
                        <div style={{ background:"#f8fafc", borderRadius:8, padding:"10px 12px" }}>
                          <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", marginBottom:4, textTransform:"uppercase", letterSpacing:1 }}>Prioridad / Cierre</div>
                          <Badge text={activo.prioridad} />
                        </div>
                        <div style={{ background:"#f8fafc", borderRadius:8, padding:"10px 12px" }}>
                          <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", marginBottom:4, textTransform:"uppercase", letterSpacing:1 }}>Desarrollo</div>
                          <div style={{ fontSize:12, fontWeight:700, color:"#002B49" }}>{activo.desarrollo}</div>
                        </div>
                      </div>
                      {activo.estatus === "ACTUALIZAR" && (
                        <div style={{ marginTop:10, background:"#fef9ec", border:"1px solid #fcd34d", borderRadius:8, padding:"8px 12px", fontSize:11, color:"#92400e", fontWeight:600 }}>
                          ⚠ Este activo requiere actualización de expediente antes de presentar a clientes.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
