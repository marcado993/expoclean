// SmartDose — firmware ESP32 (prototipo)
//
// Hardware:
//   - Bomba peristáltica 12 V (producto concentrado) vía MOSFET  → PIN_PERISTALTICA
//   - Bomba 12 V o electroválvula (agua del EcoLoop) vía relé/MOSFET → PIN_AGUA
//   - Sensor de flujo YF-S201 en la línea de agua               → PIN_FLUJO_AGUA
//   - (Opcional) YF-S201 a la salida del EcoLoop                 → PIN_FLUJO_ECOLOOP
//
// Agua: se mide con el sensor de flujo (cuenta pulsos).
// Químico: la peristáltica es muy repetible, se dosifica por tiempo calibrado.
//
// API (la usa la app, ver src/lib/smartdose.js):
//   POST /dispensar {agua_ml, quimico_ml}
//   POST /detener
//   GET  /estado
//   GET  /ecoloop

#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>

const char* WIFI_SSID = "SmartDose";
const char* WIFI_PASS = "cambiar123";   // modo punto de acceso → IP 192.168.4.1

const int PIN_PERISTALTICA = 25;
const int PIN_AGUA = 26;
const int PIN_FLUJO_AGUA = 27;
const int PIN_FLUJO_ECOLOOP = 14;

// CALIBRAR: dispensar 10 s a un vaso medidor y anotar.
const float QUIMICO_ML_POR_SEG = 1.6;   // peristáltica típica ~100 mL/min
const float PULSOS_POR_LITRO = 450.0;   // YF-S201 según hoja de datos; calibrar
const unsigned long TIMEOUT_MS = 5UL * 60UL * 1000UL;

WebServer server(80);

volatile unsigned long pulsosAgua = 0;
volatile unsigned long pulsosEcoloop = 0;
void IRAM_ATTR isrAgua() { pulsosAgua++; }
void IRAM_ATTR isrEcoloop() { pulsosEcoloop++; }

enum Estado { LIBRE, DISPENSANDO, ERROR_ };
Estado estado = LIBRE;
float objetivoAgua = 0, objetivoQuimico = 0;
unsigned long inicioMs = 0, duracionQuimicoMs = 0, pulsosObjetivo = 0;
bool quimicoListo = true, aguaLista = true;

void cors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

void apagarTodo() {
  digitalWrite(PIN_PERISTALTICA, LOW);
  digitalWrite(PIN_AGUA, LOW);
}

float progreso() {
  if (estado != DISPENSANDO) return estado == LIBRE ? 1.0 : 0.0;
  float pa = pulsosObjetivo ? min(1.0f, (float)pulsosAgua / pulsosObjetivo) : 1.0f;
  float pq = duracionQuimicoMs ? min(1.0f, (float)(millis() - inicioMs) / duracionQuimicoMs) : 1.0f;
  return min(pa, pq);
}

void handleDispensar() {
  cors();
  if (estado == DISPENSANDO) { server.send(409, "application/json", "{\"error\":\"ocupado\"}"); return; }

  JsonDocument doc;
  if (deserializeJson(doc, server.arg("plain"))) { server.send(400, "application/json", "{\"error\":\"json\"}"); return; }
  objetivoAgua = doc["agua_ml"] | 0.0;
  objetivoQuimico = doc["quimico_ml"] | 0.0;
  if (objetivoAgua < 0 || objetivoAgua > 10000 || objetivoQuimico < 0 || objetivoQuimico > 500) {
    server.send(400, "application/json", "{\"error\":\"fuera de rango\"}");
    return;
  }

  pulsosAgua = 0;
  pulsosObjetivo = (unsigned long)(objetivoAgua / 1000.0 * PULSOS_POR_LITRO);
  duracionQuimicoMs = (unsigned long)(objetivoQuimico / QUIMICO_ML_POR_SEG * 1000.0);
  inicioMs = millis();
  quimicoListo = duracionQuimicoMs == 0;
  aguaLista = pulsosObjetivo == 0;

  // Ambas a la vez: el agua que cae mezcla el concentrado en el recipiente.
  digitalWrite(PIN_PERISTALTICA, quimicoListo ? LOW : HIGH);
  digitalWrite(PIN_AGUA, aguaLista ? LOW : HIGH);
  estado = DISPENSANDO;
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleDetener() {
  cors();
  apagarTodo();
  estado = LIBRE;
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleEstado() {
  cors();
  JsonDocument doc;
  doc["estado"] = estado == LIBRE ? "libre" : estado == DISPENSANDO ? "dispensando" : "error";
  doc["progreso"] = progreso();
  doc["agua_ml"] = pulsosAgua / PULSOS_POR_LITRO * 1000.0;
  String out; serializeJson(doc, out);
  server.send(200, "application/json", out);
  if (estado == ERROR_) estado = LIBRE;  // el error se reporta una vez
}

void handleEcoloop() {
  cors();
  JsonDocument doc;
  doc["litros"] = pulsosEcoloop / PULSOS_POR_LITRO;
  String out; serializeJson(doc, out);
  server.send(200, "application/json", out);
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_PERISTALTICA, OUTPUT);
  pinMode(PIN_AGUA, OUTPUT);
  apagarTodo();
  pinMode(PIN_FLUJO_AGUA, INPUT_PULLUP);
  pinMode(PIN_FLUJO_ECOLOOP, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_FLUJO_AGUA), isrAgua, FALLING);
  attachInterrupt(digitalPinToInterrupt(PIN_FLUJO_ECOLOOP), isrEcoloop, FALLING);

  WiFi.softAP(WIFI_SSID, WIFI_PASS);
  Serial.print("SmartDose en "); Serial.println(WiFi.softAPIP());

  server.on("/dispensar", HTTP_POST, handleDispensar);
  server.on("/detener", HTTP_POST, handleDetener);
  server.on("/estado", HTTP_GET, handleEstado);
  server.on("/ecoloop", HTTP_GET, handleEcoloop);
  server.onNotFound([]() {
    cors();
    server.send(server.method() == HTTP_OPTIONS ? 204 : 404);
  });
  server.begin();
}

void loop() {
  server.handleClient();
  if (estado != DISPENSANDO) return;

  unsigned long t = millis() - inicioMs;
  if (!quimicoListo && t >= duracionQuimicoMs) { digitalWrite(PIN_PERISTALTICA, LOW); quimicoListo = true; }
  if (!aguaLista && pulsosAgua >= pulsosObjetivo) { digitalWrite(PIN_AGUA, LOW); aguaLista = true; }

  if (quimicoListo && aguaLista) {
    estado = LIBRE;
  } else if (t > TIMEOUT_MS) {
    // Sin flujo de agua (tanque vacío / manguera tapada): no dejar bombas prendidas.
    apagarTodo();
    estado = ERROR_;
  }
}
