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
//
// LED azul de la placa (para saber en qué paso va, sin computadora):
//   parpadeo rápido continuo ...... buscando el Wi-Fi
//   2 parpadeos largos ............ no se pudo conectar al Wi-Fi (nombre/clave, o red de 5 GHz)
//   3 parpadeos largos ............ conectó al Wi-Fi pero el TOKEN no coincide con el servidor
//   5 parpadeos cortos ............ conectó al Wi-Fi pero no llega al servidor (sin internet o portal de login)
//   4 parpadeos y queda PRENDIDO .. conectado al servidor: la app ya lo ve
// En el Monitor Serie (115200 baudios) sale lo mismo en texto.

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
const bool RELE_ACTIVO_BAJO = false;         // tu módulo se activa con HIGH: apagado = LOW. Si queda prendido solo, pon true
const long SEG_MAX = 120;
const int PIN_LED = 2;                       // LED azul de la placa

String ultimaId = "";                        // última orden ejecutada (no se repite)
bool enLinea = false;                        // ¿el último contacto con el servidor salió bien?

void bomba(int i, bool prendida) {
  digitalWrite(PIN_BOMBA[i], prendida == RELE_ACTIVO_BAJO ? LOW : HIGH);
}

void apagarTodo() {
  for (int i = 0; i < N; i++) bomba(i, false);
}

void parpadear(int veces, int ms) {
  for (int i = 0; i < veces; i++) {
    digitalWrite(PIN_LED, HIGH); delay(ms);
    digitalWrite(PIN_LED, LOW);  delay(ms);
  }
  delay(600);
}

// Cuando el Wi-Fi no conecta: ¿la red se ve? Si no aparece, casi siempre es de 5 GHz o está lejos.
void diagnosticarWifi() {
  Serial.println("Redes que ve el ESP32 (solo ve las de 2.4 GHz):");
  int n = WiFi.scanNetworks();
  bool vista = false;
  for (int i = 0; i < n; i++) {
    Serial.print("  ");
    Serial.print(WiFi.SSID(i));
    Serial.print("  (");
    Serial.print(WiFi.RSSI(i));
    Serial.println(" dBm)");
    if (WiFi.SSID(i) == WIFI_SSID) vista = true;
  }
  if (!vista) {
    Serial.print(">> No veo la red '");
    Serial.print(WIFI_SSID);
    Serial.println("'. Debe ser de 2.4 GHz (no 5 GHz) y con el nombre exacto.");
  } else {
    Serial.println(">> La red se ve: revisa la CLAVE (distingue mayúsculas).");
  }
  WiFi.scanDelete();
}

void conectarWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  enLinea = false;
  Serial.print("Conectando a '");
  Serial.print(WIFI_SSID);
  Serial.print("'");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) {
    digitalWrite(PIN_LED, i % 2);            // parpadeo rápido mientras busca
    delay(250);
    Serial.print(".");
  }
  digitalWrite(PIN_LED, LOW);
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print(" listo. IP ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println(" NO conecta.");
    parpadear(2, 700);
    diagnosticarWifi();
  }
}

// Anuncia por el LED y el Monitor Serie el resultado de hablar con el servidor.
void resultadoServidor(int codigo) {
  bool ok = codigo == 200 || codigo == 204;
  if (ok && !enLinea) {
    Serial.print("Conectado al servidor ");
    Serial.print(SERVIDOR);
    Serial.println(". La app ya ve la máquina.");
    parpadear(4, 150);                       // las 4 luces de "conectado"
  }
  if (!ok) {
    if (codigo == 401) {
      Serial.println("El servidor rechazó el TOKEN: debe ser igual a CLEANDOSE_TOKEN del servidor.");
      parpadear(3, 700);
    } else {
      Serial.print("No llego al servidor (código ");
      Serial.print(codigo);
      Serial.println("). ¿Este Wi-Fi tiene internet y no pide inicio de sesión?");
      parpadear(5, 120);
    }
  }
  enLinea = ok;
  digitalWrite(PIN_LED, ok ? HIGH : LOW);
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
  Serial.print("Bomba ");
  Serial.print(compartimento);
  Serial.print(" ON por ");
  Serial.print(segundos);
  Serial.println(" s");
  bomba(compartimento - 1, true);
  unsigned long fin = millis() + segundos * 1000UL;
  while ((long)(fin - millis()) > 0) delay(20);   // la bomba se apaga aunque se caiga el Wi-Fi
  bomba(compartimento - 1, false);
  Serial.println("Bomba OFF");

  for (int intento = 0; intento < 5 && !avisar(id, "hecha"); intento++) delay(1000);
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < N; i++) {
    bomba(i, false);                         // antes de pinMode: no hace clic al arrancar
    pinMode(PIN_BOMBA[i], OUTPUT);
  }
  apagarTodo();
  pinMode(PIN_LED, OUTPUT);
  delay(500);
  Serial.println();
  Serial.println("CleanDose: arrancando");
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  conectarWifi();
}

void loop() {
  conectarWifi();
  if (WiFi.status() != WL_CONNECTED) { delay(3000); return; }

  HTTPClient http;
  http.begin(String(SERVIDOR) + "/api/esp32/orden?espera=20");
  http.setTimeout(25000);                    // un poco más que la espera del servidor
  http.addHeader("X-Token", TOKEN);
  int codigo = http.GET();
  resultadoServidor(codigo);

  if (codigo == 200) {
    JsonDocument orden;
    DeserializationError e = deserializeJson(orden, http.getString());
    http.end();
    if (!e) dosificar(orden["id"] | "", orden["compartimento"] | 0, orden["segundos"] | 0);
  } else {
    http.end();
    if (codigo != 204) delay(codigo == 401 ? 10000 : 2000);   // 204 = conectado, sin órdenes
  }
}
