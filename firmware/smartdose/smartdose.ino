// SmartDose — firmware ESP32 (prototipo)
//
// Hardware:
//   - Bomba peristáltica 12 V (producto concentrado) vía MOSFET  → PIN_PERISTALTICA
//   - Bomba 12 V o electroválvula (agua del EcoLoop) vía relé/MOSFET → PIN_AGUA
//   - Sensor de flujo YF-S201 en la línea de agua               → PIN_FLUJO_AGUA
//   - (Opcional) YF-S201 a la salida del EcoLoop                 → PIN_FLUJO_ECOLOOP
//   - Servo SG90 (válvula de pinza / prueba)                     → PIN_SERVO
//     café = GND común · rojo = 5–6 V externo · naranja = señal
//   - Módulo relé (interruptor, se apaga solo)                   → PIN_RELE
//     VCC = 5 V · GND = GND · IN = señal
//
// Agua: se mide con el sensor de flujo (cuenta pulsos).
// Químico: la peristáltica es muy repetible, se dosifica por tiempo calibrado.
//
// API (la usa la app, ver src/lib/smartdose.js):
//   POST /dispensar {agua_ml, quimico_ml}
//   POST /detener
//   GET  /estado
//   GET  /ecoloop
//   POST /servo {angulo}       (prueba del motor desde Ajustes)
//   POST /rele {segundos, id}  (botón Llenar: 30 s; Admin: 3 s; 0 lo apaga)
//        Uno a la vez: mientras el relé está prendido, todo lo demás responde 409 "ocupado".
//        Idempotente: repetir el mismo id no vuelve a llenar, solo informa cómo va.
//   GET  /ping                 (módulo Admin: prueba de conexión)

#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>

const char* VERSION = "0.3";
const char* WIFI_SSID = "SmartDose";
const char* WIFI_PASS = "cambiar123";   // modo punto de acceso → IP 192.168.4.1

const int PIN_PERISTALTICA = 25;
const int PIN_AGUA = 26;
const int PIN_FLUJO_AGUA = 27;
const int PIN_FLUJO_ECOLOOP = 14;
const int PIN_SERVO = 13;
const int PIN_RELE = 22;

// Casi todos los módulos relé se activan con LOW. Si el tuyo hace lo contrario, cambia a false.
const bool RELE_ACTIVO_BAJO = true;
const unsigned long RELE_MAX_SEG = 120;

// El servo abre mientras se dispensa y cierra al terminar.
const int SERVO_CERRADO = 0;
const int SERVO_ABIERTO = 90;

// Sin sensor de flujo conectado, el agua se dosifica por tiempo para poder probar.
const bool HAY_SENSOR_FLUJO = false;
const float AGUA_ML_POR_SEG = 100.0;    // CALIBRAR con la bomba real

// CALIBRAR: dispensar 10 s a un vaso medidor y anotar.
const float QUIMICO_ML_POR_SEG = 1.6;   // peristáltica típica ~100 mL/min
const float PULSOS_POR_LITRO = 450.0;   // YF-S201 según hoja de datos; calibrar
const unsigned long TIMEOUT_MS = 5UL * 60UL * 1000UL;

WebServer server(80);
Servo servo;

volatile unsigned long pulsosAgua = 0;
volatile unsigned long pulsosEcoloop = 0;
void IRAM_ATTR isrAgua() { pulsosAgua++; }
void IRAM_ATTR isrEcoloop() { pulsosEcoloop++; }

enum Estado { LIBRE, DISPENSANDO, ERROR_ };
Estado estado = LIBRE;
float objetivoAgua = 0, objetivoQuimico = 0;
unsigned long inicioMs = 0, duracionQuimicoMs = 0, duracionAguaMs = 0, pulsosObjetivo = 0;
bool quimicoListo = true, aguaLista = true;

unsigned long releHastaMs = 0;  // 0 = apagado
String trabajoId = "";          // id del último llenado aceptado (en curso o terminado)

long releRestaMs() {
  return releHastaMs ? max(0L, (long)(releHastaMs - millis())) : 0;
}
bool ocupado() { return releHastaMs != 0 || estado == DISPENSANDO; }

void responderOcupado() {
  JsonDocument doc;
  doc["error"] = "ocupado";
  doc["rele_ms"] = releRestaMs();
  String out; serializeJson(doc, out);
  server.send(409, "application/json", out);
}

void rele(bool prendido) {
  digitalWrite(PIN_RELE, prendido == RELE_ACTIVO_BAJO ? LOW : HIGH);
  if (!prendido) releHastaMs = 0;
}

void cors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

void apagarTodo() {
  digitalWrite(PIN_PERISTALTICA, LOW);
  digitalWrite(PIN_AGUA, LOW);
  servo.write(SERVO_CERRADO);
  rele(false);
}

unsigned long aguaTranscurrida() {
  return HAY_SENSOR_FLUJO ? pulsosAgua : millis() - inicioMs;
}

float progreso() {
  if (estado != DISPENSANDO) return estado == LIBRE ? 1.0 : 0.0;
  unsigned long metaAgua = HAY_SENSOR_FLUJO ? pulsosObjetivo : duracionAguaMs;
  float pa = metaAgua ? min(1.0f, (float)aguaTranscurrida() / metaAgua) : 1.0f;
  float pq = duracionQuimicoMs ? min(1.0f, (float)(millis() - inicioMs) / duracionQuimicoMs) : 1.0f;
  return min(pa, pq);
}

void handleDispensar() {
  cors();
  if (ocupado()) { responderOcupado(); return; }

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
  duracionAguaMs = (unsigned long)(objetivoAgua / AGUA_ML_POR_SEG * 1000.0);
  duracionQuimicoMs = (unsigned long)(objetivoQuimico / QUIMICO_ML_POR_SEG * 1000.0);
  inicioMs = millis();
  quimicoListo = duracionQuimicoMs == 0;
  aguaLista = (HAY_SENSOR_FLUJO ? pulsosObjetivo : duracionAguaMs) == 0;

  // Ambas a la vez: el agua que cae mezcla el concentrado en el recipiente.
  digitalWrite(PIN_PERISTALTICA, quimicoListo ? LOW : HIGH);
  digitalWrite(PIN_AGUA, aguaLista ? LOW : HIGH);
  servo.write(SERVO_ABIERTO);
  estado = DISPENSANDO;
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleDetener() {
  cors();
  apagarTodo();
  estado = LIBRE;
  server.send(200, "application/json", "{\"ok\":true}");
}

void handlePing() {
  cors();
  JsonDocument doc;
  doc["ok"] = true;
  doc["version"] = VERSION;
  doc["uptime_s"] = millis() / 1000;
  doc["clientes"] = WiFi.softAPgetStationNum();
  doc["memoria_libre"] = ESP.getFreeHeap();
  doc["rele"] = releRestaMs() > 0;
  doc["rele_pin"] = PIN_RELE;
  doc["estado"] = estado == LIBRE ? "libre" : estado == DISPENSANDO ? "dispensando" : "error";
  String out; serializeJson(doc, out);
  server.send(200, "application/json", out);
}

void handleEstado() {
  cors();
  JsonDocument doc;
  doc["estado"] = estado == LIBRE ? "libre" : estado == DISPENSANDO ? "dispensando" : "error";
  doc["progreso"] = progreso();
  doc["rele_ms"] = releRestaMs();
  doc["rele_seg"] = (releRestaMs() + 999) / 1000;
  doc["trabajo_id"] = trabajoId;
  doc["agua_ml"] = HAY_SENSOR_FLUJO ? pulsosAgua / PULSOS_POR_LITRO * 1000.0
                                    : min(objetivoAgua, (millis() - inicioMs) / 1000.0f * AGUA_ML_POR_SEG);
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

void handleServo() {
  cors();
  if (ocupado()) { responderOcupado(); return; }
  JsonDocument doc;
  if (deserializeJson(doc, server.arg("plain"))) { server.send(400, "application/json", "{\"error\":\"json\"}"); return; }
  int angulo = doc["angulo"] | -1;
  if (angulo < 0 || angulo > 180) { server.send(400, "application/json", "{\"error\":\"fuera de rango\"}"); return; }
  servo.write(angulo);
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleRele() {
  cors();
  JsonDocument doc;
  if (deserializeJson(doc, server.arg("plain"))) { server.send(400, "application/json", "{\"error\":\"json\"}"); return; }
  long seg = doc["segundos"] | 3;      // pulso de prueba: 3 s prendido y se apaga solo
  String id = doc["id"] | "";
  if (seg < 0 || seg > (long)RELE_MAX_SEG) { server.send(400, "application/json", "{\"error\":\"fuera de rango\"}"); return; }

  if (seg == 0) {                      // apagar siempre se permite (seguridad)
    rele(false);
    server.send(200, "application/json", "{\"ok\":true}");
    return;
  }

  JsonDocument res;
  if (id.length() && id == trabajoId) {
    // La misma orden otra vez (doble toque, reintento por mala señal): no se vuelve a llenar.
    res["ok"] = true;
    res["repetido"] = true;
  } else if (ocupado()) {
    responderOcupado();
    return;
  } else {
    trabajoId = id;
    rele(true);
    releHastaMs = millis() + seg * 1000UL;
    if (releHastaMs == 0) releHastaMs = 1;
    res["ok"] = true;
    Serial.print("Relé ON "); Serial.print(seg); Serial.print(" s, id "); Serial.println(id);
  }
  res["rele_ms"] = releRestaMs();
  String out; serializeJson(res, out);
  server.send(200, "application/json", out);
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_PERISTALTICA, OUTPUT);
  pinMode(PIN_AGUA, OUTPUT);
  rele(false);                           // antes de pinMode, para que no haga clic al arrancar
  pinMode(PIN_RELE, OUTPUT);
  servo.setPeriodHertz(50);
  servo.attach(PIN_SERVO, 500, 2400);   // pulsos del SG90 en µs
  apagarTodo();
  pinMode(PIN_FLUJO_AGUA, INPUT_PULLUP);
  pinMode(PIN_FLUJO_ECOLOOP, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_FLUJO_AGUA), isrAgua, FALLING);
  attachInterrupt(digitalPinToInterrupt(PIN_FLUJO_ECOLOOP), isrEcoloop, FALLING);

  WiFi.softAP(WIFI_SSID, WIFI_PASS, 1, 0, 8);   // canal 1, red visible, hasta 8 equipos
  WiFi.setSleep(false);                          // sin ahorro de energía: responde siempre rápido
  Serial.print("SmartDose en "); Serial.println(WiFi.softAPIP());

  server.on("/dispensar", HTTP_POST, handleDispensar);
  server.on("/detener", HTTP_POST, handleDetener);
  server.on("/estado", HTTP_GET, handleEstado);
  server.on("/ecoloop", HTTP_GET, handleEcoloop);
  server.on("/servo", HTTP_POST, handleServo);
  server.on("/rele", HTTP_POST, handleRele);
  server.on("/ping", HTTP_GET, handlePing);
  server.onNotFound([]() {
    cors();
    server.send(server.method() == HTTP_OPTIONS ? 204 : 404);
  });
  server.begin();
}

void loop() {
  server.handleClient();
  if (releHastaMs && (long)(millis() - releHastaMs) >= 0) rele(false);
  if (estado != DISPENSANDO) return;

  unsigned long t = millis() - inicioMs;
  if (!quimicoListo && t >= duracionQuimicoMs) { digitalWrite(PIN_PERISTALTICA, LOW); quimicoListo = true; }
  if (!aguaLista && aguaTranscurrida() >= (HAY_SENSOR_FLUJO ? pulsosObjetivo : duracionAguaMs)) {
    digitalWrite(PIN_AGUA, LOW);
    aguaLista = true;
  }

  if (quimicoListo && aguaLista) {
    servo.write(SERVO_CERRADO);
    estado = LIBRE;
  } else if (t > TIMEOUT_MS) {
    // Sin flujo de agua (tanque vacío / manguera tapada): no dejar bombas prendidas.
    apagarTodo();
    estado = ERROR_;
  }
}
