// CleanDose — firmware ESP32
//
// El ESP32 SOLO prende bombas. Todo lo demás (compartimentos, tareas, registros) vive en el
// servidor. El ESP32 se conecta al Wi-Fi del lugar y le pregunta al servidor si hay una orden:
//
//   GET  http://SERVIDOR/api/esp32/orden?espera=20   → 204 nada, o {id, compartimento, segundos}
//   POST http://SERVIDOR/api/esp32/estado            → {id, estado: dosificando | hecha | error}
//
// La pregunta queda abierta hasta 20 s (long polling): la orden llega al instante sin saturar
// al ESP32 ni a la red. Una dosis a la vez; si llega la misma orden dos veces, no repite.
//
// Conexión AHORA (un solo relé y una bomba): los 4 compartimentos prenden el GPIO 22.
//   Relé: IN → GPIO 22 · VCC → VIN (5 V) · GND → GND · bomba en COM / NO con su fuente.
// Cuando haya 4 bombas, cambia PIN_BOMBA a {22, 21, 19, 18} (un relé por compartimento).
//
// Librería: ArduinoJson (v7) desde el Library Manager.

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ── Cambia esto ──────────────────────────────────────────
const char* WIFI_SSID = "TU_WIFI";
const char* WIFI_PASS = "TU_CLAVE";
const char* SERVIDOR  = "http://149.130.170.232:8080";
const char* TOKEN     = "cambiar-token";     // igual que CLEANDOSE_TOKEN en el servidor
// ─────────────────────────────────────────────────────────

const int N = 4;
const int PIN_BOMBA[N] = {22, 22, 22, 22};   // por ahora todos al mismo relé
const bool RELE_ACTIVO_BAJO = true;          // si los relés hacen lo contrario, cambia a false
const long SEG_MAX = 120;
const int PIN_LED = 2;                       // LED de la placa: prendido = conectado al servidor

String ultimaId = "";                        // última orden ejecutada (no se repite)

void bomba(int i, bool prendida) {
  digitalWrite(PIN_BOMBA[i], prendida == RELE_ACTIVO_BAJO ? LOW : HIGH);
}

void apagarTodo() {
  for (int i = 0; i < N; i++) bomba(i, false);
}

void conectarWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  digitalWrite(PIN_LED, LOW);
  Serial.printf("Conectando a %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(WiFi.status() == WL_CONNECTED ? " listo" : " sin conexión, reintento");
  if (WiFi.status() == WL_CONNECTED) Serial.println(WiFi.localIP());
}

bool avisar(const String& id, const char* estado) {
  HTTPClient http;
  http.begin(String(SERVIDOR) + "/api/esp32/estado");
  http.setTimeout(5000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Token", TOKEN);
  int codigo = http.POST("{\"id\":\"" + id + "\",\"estado\":\"" + estado + "\"}");
  http.end();
  return codigo == 200;
}

void dosificar(const String& id, int compartimento, long segundos) {
  if (id == ultimaId) {                      // orden repetida: solo confirmar
    avisar(id, "hecha");
    return;
  }
  if (compartimento < 1 || compartimento > N || segundos < 1 || segundos > SEG_MAX) {
    avisar(id, "error");
    return;
  }
  ultimaId = id;
  avisar(id, "dosificando");
  Serial.printf("Bomba %d ON por %ld s\n", compartimento, segundos);
  bomba(compartimento - 1, true);
  unsigned long fin = millis() + segundos * 1000UL;
  while ((long)(fin - millis()) > 0) delay(20);   // la bomba se apaga aunque se caiga el Wi-Fi
  bomba(compartimento - 1, false);
  Serial.printf("Bomba %d OFF\n", compartimento);

  for (int intento = 0; intento < 5 && !avisar(id, "hecha"); intento++) delay(1000);
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < N; i++) {
    bomba(i, false);                         // antes de pinMode: no hace clic al arrancar
    pinMode(PIN_BOMBA[i], OUTPUT);
  }
  pinMode(PIN_LED, OUTPUT);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  conectarWifi();
}

void loop() {
  conectarWifi();
  if (WiFi.status() != WL_CONNECTED) { delay(2000); return; }

  HTTPClient http;
  http.begin(String(SERVIDOR) + "/api/esp32/orden?espera=20");
  http.setTimeout(25000);                    // un poco más que la espera del servidor
  http.addHeader("X-Token", TOKEN);
  int codigo = http.GET();

  if (codigo == 200) {
    digitalWrite(PIN_LED, HIGH);
    JsonDocument orden;
    DeserializationError e = deserializeJson(orden, http.getString());
    http.end();
    if (!e) dosificar(orden["id"] | "", orden["compartimento"] | 0, orden["segundos"] | 0);
  } else {
    http.end();
    if (codigo == 204) {
      digitalWrite(PIN_LED, HIGH);           // conectado, sin órdenes
    } else {
      digitalWrite(PIN_LED, LOW);
      Serial.printf("Servidor respondió %d, reintento\n", codigo);
      delay(codigo == 401 ? 10000 : 2000);   // 401 = token distinto al del servidor
    }
  }
}
